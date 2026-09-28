// vo-process.cjs — tighten each local-TTS clip without re-voicing it: trim edge silence and compress any
// internal pause longer than MAXP down to MAXP (5 ms fades at every cut so there are no clicks).
// Writes vo/<id>.trim.wav and vo/timing.json (speech duration per scene).
const fs = require('fs'), path = require('path');
const SR = 48000, WIN = 480, TH = 0.012 * 32768, MAXP = 0.28, FADE = Math.round(0.005 * SR);

function readWav(p) {
  const b = fs.readFileSync(p); let o = 12, data = null;
  while (o < b.length) { const id = b.toString('ascii', o, o + 4), sz = b.readUInt32LE(o + 4);
    if (id === 'data') { data = b.subarray(o + 8, o + 8 + sz); break; } o += 8 + sz + (sz & 1); }
  return new Int16Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.length));
}
function writeWav(p, s) {
  const b = Buffer.alloc(44 + s.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + s.length * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(s.length * 2, 40);
  for (let i = 0; i < s.length; i++) b.writeInt16LE(s[i], 44 + i * 2);
  fs.writeFileSync(p, b);
}
const scenes = JSON.parse(fs.readFileSync('script.json', 'utf8')).scenes;
const timing = {}; let total = 0;
for (const sc of scenes) {
  const s = readWav(path.join('vo', sc.id + '.wav'));
  const n = Math.floor(s.length / WIN), loud = [];
  for (let i = 0; i < n; i++) { let m = 0; for (let j = i * WIN; j < (i + 1) * WIN; j++) { const a = Math.abs(s[j]); if (a > m) m = a; } loud.push(m > TH); }
  const first = Math.max(0, loud.indexOf(true) - 2), last = Math.min(n - 1, loud.lastIndexOf(true) + 4); // keep a hair of attack/release
  // build segments: keep loud runs, clamp silent runs to MAXP
  const keep = []; let i = first;
  while (i <= last) {
    let j = i; const isLoud = loud[i]; while (j <= last && loud[j] === isLoud) j++;
    const a = i * WIN, bEnd = j * WIN;
    if (isLoud || (bEnd - a) / SR <= MAXP) keep.push([a, bEnd]);
    else { const half = Math.round(MAXP * SR / 2); keep.push([a, a + half]); keep.push([bEnd - half, bEnd]); }
    i = j;
  }
  const out = []; for (const [a, b] of keep) {
    const seg = Array.from(s.subarray(a, b));
    for (let k = 0; k < Math.min(FADE, seg.length); k++) { seg[k] = Math.round(seg[k] * k / FADE); seg[seg.length - 1 - k] = Math.round(seg[seg.length - 1 - k] * k / FADE); }
    out.push(...seg);
  }
  const res = Int16Array.from(out);
  writeWav(path.join('vo', sc.id + '.trim.wav'), res);
  timing[sc.id] = +(res.length / SR).toFixed(3); total += res.length / SR;
  console.log(sc.id.padEnd(9), (s.length / SR).toFixed(2) + 's →', (res.length / SR).toFixed(2) + 's');
}
fs.writeFileSync(path.join('vo', 'timing.json'), JSON.stringify(timing, null, 1));
console.log('TOTAL speech after tightening:', total.toFixed(1) + 's');
