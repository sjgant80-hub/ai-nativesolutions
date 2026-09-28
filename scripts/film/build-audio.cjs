// build-audio.cjs — lay the tightened local-TTS clips on a 90.0 s timeline, split captions into readable
// chunks timed to the voice, and mix a quiet, procedurally generated ambient pad underneath (no licensed
// audio anywhere). Outputs: out/film-audio.wav (48 kHz mono 16-bit), timeline.json, out/film.vtt.
const fs = require('fs'), path = require('path');
const SR = 48000, LEAD = 0.35, GAP = 0.20, TARGET = 90.0;
const script = JSON.parse(fs.readFileSync('script.json', 'utf8'));
const timing = JSON.parse(fs.readFileSync(path.join('vo', 'timing.json'), 'utf8'));
fs.mkdirSync('out', { recursive: true });

function readWav(p) {
  const b = fs.readFileSync(p); let o = 12;
  while (o < b.length) { const id = b.toString('ascii', o, o + 4), sz = b.readUInt32LE(o + 4);
    if (id === 'data') { const d = b.subarray(o + 8, o + 8 + sz); return new Int16Array(d.buffer.slice(d.byteOffset, d.byteOffset + d.length)); }
    o += 8 + sz + (sz & 1); }
}

// 1 · timeline: voice starts, scene spans (a scene lasts until the next voice starts)
let t = LEAD; const scenes = [];
for (const sc of script.scenes) { const d = timing[sc.id]; scenes.push({ id: sc.id, part: sc.part, text: sc.text, voStart: +t.toFixed(3), voEnd: +(t + d).toFixed(3) }); t += d + GAP; }
const lastVoEnd = scenes[scenes.length - 1].voEnd;
const DURATION = Math.max(TARGET, +(lastVoEnd + 0.6).toFixed(2));
scenes.forEach((s, i) => { s.start = i === 0 ? 0 : scenes[i].voStart - GAP / 2; s.end = i === scenes.length - 1 ? DURATION : scenes[i + 1].voStart - GAP / 2; });
scenes.forEach(s => { s.start = +s.start.toFixed(3); s.end = +s.end.toFixed(3); });

// 2 · captions: split on sentence ends / dashes into chunks ≤ ~78 chars, time by character share
function chunks(text) {
  const parts = text.split(/(?<=[.?!:])\s+|\s+—\s+/).map(x => x.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    if (p.length <= 78) { out.push(p); continue; }
    const words = p.split(' '); let cur = '';
    for (const w of words) { if ((cur + ' ' + w).trim().length > 70) { out.push(cur.trim()); cur = w; } else cur += ' ' + w; }
    if (cur.trim()) out.push(cur.trim());
  }
  return out;
}
for (const s of scenes) {
  const cs = chunks(s.text), total = cs.reduce((a, c) => a + c.length, 0), span = s.voEnd - s.voStart;
  let c0 = s.voStart; s.captions = cs.map((c) => { const d = span * c.length / total; const cap = { start: +c0.toFixed(3), end: +(c0 + d).toFixed(3), text: c }; c0 += d; return cap; });
  s.captions[s.captions.length - 1].end = +Math.min(s.end, s.voEnd + 0.35).toFixed(3);
}

// 3 · mix: voice + ambient pad (two chords: part one, then a brighter voicing for the estate)
const N = Math.round(DURATION * SR), mix = new Float32Array(N);
for (const s of scenes) {
  const clip = readWav(path.join('vo', s.id + '.trim.wav')), o = Math.round(s.voStart * SR);
  for (let i = 0; i < clip.length && o + i < N; i++) mix[o + i] += clip[i] / 32768 * 0.92;
}
const partTwoAt = scenes.find(s => s.part === 2).voStart;
const chordA = [73.42, 110.0, 146.83, 220.0, 277.18];   // D2 A2 D3 A3 C#4 — open, unresolved
const chordB = [73.42, 110.0, 146.83, 185.0, 220.0, 293.66]; // D2 A2 D3 F#3 A3 D4 — resolves bright for the estate
const padLevel = Math.pow(10, -31 / 20);
for (let i = 0; i < N; i++) {
  const x = i / SR;
  const mB = Math.min(1, Math.max(0, (x - (partTwoAt - 1.5)) / 3)); // 3 s crossfade into chord B
  let v = 0;
  chordA.forEach((f, k) => { v += (1 - mB) * Math.sin(2 * Math.PI * f * x + k) * (0.6 + 0.4 * Math.sin(2 * Math.PI * (0.05 + 0.013 * k) * x)); v += (1 - mB) * 0.5 * Math.sin(2 * Math.PI * f * 1.003 * x); });
  chordB.forEach((f, k) => { v += mB * Math.sin(2 * Math.PI * f * x + k) * (0.6 + 0.4 * Math.sin(2 * Math.PI * (0.047 + 0.011 * k) * x)); v += mB * 0.5 * Math.sin(2 * Math.PI * f * 0.997 * x); });
  const env = Math.min(1, x / 2.5) * Math.min(1, (DURATION - x) / 3.0);
  mix[i] += v / 8 * padLevel * env;
}
let peak = 0; for (const v of mix) peak = Math.max(peak, Math.abs(v));
const gain = peak > 0.98 ? 0.98 / peak : 1;
const pcm = Buffer.alloc(44 + N * 2);
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 2, 4); pcm.write('WAVE', 8); pcm.write('fmt ', 12); pcm.writeUInt32LE(16, 16);
pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22); pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 2, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34);
pcm.write('data', 36); pcm.writeUInt32LE(N * 2, 40);
for (let i = 0; i < N; i++) pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(mix[i] * gain * 32767))), 44 + i * 2);
fs.writeFileSync(path.join('out', 'film-audio.wav'), pcm);

// 4 · WebVTT sidecar (the same captions that are burned into the picture)
const ts = (x) => { const h = Math.floor(x / 3600), m = Math.floor(x / 60) % 60, s = (x % 60).toFixed(3).padStart(6, '0'); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + s; };
let vtt = 'WEBVTT\n\n'; let k = 1;
for (const s of scenes) for (const c of s.captions) vtt += (k++) + '\n' + ts(c.start) + ' --> ' + ts(c.end) + '\n' + c.text + '\n\n';
fs.writeFileSync(path.join('out', 'film.vtt'), vtt);

fs.writeFileSync('timeline.json', JSON.stringify({ fps: 30, width: 1920, height: 1080, duration: DURATION, partTwoAt, scenes }, null, 1));
console.log('duration', DURATION, 's · scenes', scenes.length, '· captions', k - 1, '· peak', peak.toFixed(3), '· gain', gain.toFixed(3));
for (const s of scenes) console.log(' ', s.id.padEnd(9), s.start.toFixed(2).padStart(6), '→', s.end.toFixed(2).padStart(6), ' vo', s.voStart.toFixed(2), '–', s.voEnd.toFixed(2), ' caps', s.captions.length);
