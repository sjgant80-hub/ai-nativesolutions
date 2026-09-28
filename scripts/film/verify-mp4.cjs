// verify-mp4.cjs — prove out/film.mp4 is a real, correct, playable file. Two independent checks:
//  A · structure: parse the boxes ourselves (tracks, codecs, durations, offsets inside mdat, sizes add up)
//  B · playback: Chrome decodes it — metadata, seeks + decoded frames, real-time play, and the audio track
//      decodes with real voice energy where the voiceover is (and quiet before it starts).
const { chromium } = require('C:/Users/sjgan/Downloads/si-didy-agent/node_modules/playwright');
const fs = require('fs'), path = require('path'), serve = require('./serve.cjs');
const ROOT = __dirname, FILE = path.join(ROOT, 'out', 'film.mp4'), buf = fs.readFileSync(FILE);
const fails = []; const ok = (c, m) => { if (!c) fails.push(m); };

// ── A · structure ──
function kids(b, s, e) { const out = []; let o = s; while (o + 8 <= e) { const sz = b.readUInt32BE(o), ty = b.toString('latin1', o + 4, o + 8); if (sz < 8 || o + sz > e) { fails.push('bad box ' + ty + ' @' + o); break; } out.push({ ty, s: o, e: o + sz, body: o + 8 }); o += sz; } return out; }
const find = (arr, ty) => arr.find(x => x.ty === ty);
const top = kids(buf, 0, buf.length);
ok(top[0] && top[0].ty === 'ftyp', 'ftyp is not first');
const moov = find(top, 'moov'), mdat = find(top, 'mdat');
ok(moov && mdat, 'missing moov or mdat'); ok(moov.s < mdat.s, 'moov is not before mdat (not faststart)');
const tracks = kids(buf, moov.body, moov.e).filter(x => x.ty === 'trak').map(tr => {
  const mdia = find(kids(buf, tr.body, tr.e), 'mdia'), mk = kids(buf, mdia.body, mdia.e);
  const mdhd = find(mk, 'mdhd'), hdlr = find(mk, 'hdlr'), minf = find(mk, 'minf'), stbl = find(kids(buf, minf.body, minf.e), 'stbl'), sk = kids(buf, stbl.body, stbl.e);
  const ts = buf.readUInt32BE(mdhd.body + 12), dur = buf.readUInt32BE(mdhd.body + 16), handler = buf.toString('latin1', hdlr.body + 8, hdlr.body + 12);
  const stsd = find(sk, 'stsd'), codec = buf.toString('latin1', stsd.body + 12, stsd.body + 16);
  const stsz = find(sk, 'stsz'), n = buf.readUInt32BE(stsz.body + 8), sizes = []; for (let i = 0; i < n; i++) sizes.push(buf.readUInt32BE(stsz.body + 12 + i * 4));
  const stco = find(sk, 'stco'), nc = buf.readUInt32BE(stco.body + 4), offs = []; for (let i = 0; i < nc; i++) offs.push(buf.readUInt32BE(stco.body + 8 + i * 4));
  const stsc = find(sk, 'stsc'), ne = buf.readUInt32BE(stsc.body + 4), runs = []; for (let i = 0; i < ne; i++) runs.push([buf.readUInt32BE(stsc.body + 8 + i * 12), buf.readUInt32BE(stsc.body + 12 + i * 12)]);
  const stts = find(sk, 'stts'), sttsN = buf.readUInt32BE(stts.body + 8), sttsD = buf.readUInt32BE(stts.body + 12);
  // expand stsc → samples per chunk, then check every chunk's byte range sits inside mdat
  const per = []; for (let c = 1; c <= nc; c++) { let v = 0; for (const [f, s] of runs) if (c >= f) v = s; per.push(v); }
  let si = 0, inside = true; offs.forEach((o, c) => { let len = 0; for (let k = 0; k < per[c]; k++) len += sizes[si++]; if (o < mdat.body || o + len > mdat.e) inside = false; });
  return { handler, codec, timescale: ts, seconds: +(dur / ts).toFixed(3), samples: n, sttsSamples: sttsN, sttsDelta: sttsD, chunks: nc, bytes: sizes.reduce((a, b) => a + b, 0), perSum: per.reduce((a, b) => a + b, 0), inside };
});
const v = tracks.find(t => t.handler === 'vide'), a = tracks.find(t => t.handler === 'soun');
ok(v && v.codec === 'avc1', 'no avc1 video track'); ok(a && a.codec === 'mp4a', 'no mp4a audio track');
for (const t of tracks) { ok(t.samples === t.sttsSamples, t.handler + ': stts count != stsz count'); ok(t.perSum === t.samples, t.handler + ': stsc does not cover every sample'); ok(t.inside, t.handler + ': a chunk falls outside mdat'); }
ok(v.bytes + a.bytes === mdat.e - mdat.body, 'sample bytes do not exactly fill mdat');
ok(Math.abs(v.seconds - 90) < 0.05, 'video is not 90 s (' + v.seconds + ')');
console.log('A · structure', JSON.stringify({ tracks, mdatBytes: mdat.e - mdat.body, fileMB: +(buf.length / 1048576).toFixed(2) }));

// ── B · playback in Chrome ──
(async () => {
  const srv = await serve(ROOT, 8822);
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto('http://127.0.0.1:8822/blank.html');
  fs.mkdirSync(path.join(ROOT, 'out', 'verify'), { recursive: true });
  const r = await p.evaluate(async () => {
    const vid = document.createElement('video'); vid.muted = true; vid.preload = 'auto'; vid.src = 'out/film.mp4'; document.body.append(vid);
    await new Promise((res, rej) => { vid.onloadedmetadata = res; vid.onerror = () => rej(new Error('video error ' + (vid.error && vid.error.code))); });
    const meta = { duration: vid.duration, w: vid.videoWidth, h: vid.videoHeight };
    const cv = document.createElement('canvas'); cv.width = 960; cv.height = 540; const g = cv.getContext('2d');
    const frames = {};
    for (const t of [2, 15, 32, 50, 75, 88]) {
      await new Promise(res => { vid.onseeked = res; vid.currentTime = t; });
      g.drawImage(vid, 0, 0, 960, 540); const d = g.getImageData(0, 0, 960, 540).data; let lum = 0; for (let i = 0; i < d.length; i += 64) lum += d[i] + d[i + 1] + d[i + 2];
      frames[t] = { png: cv.toDataURL('image/png'), meanLum: +(lum / (d.length / 64) / 3).toFixed(1) };
    }
    vid.currentTime = 10; await new Promise(res => { vid.onseeked = res; }); const before = vid.currentTime; await vid.play(); await new Promise(res => setTimeout(res, 1500)); vid.pause(); const advanced = +(vid.currentTime - before).toFixed(2);
    const ab = await (await fetch('out/film.mp4')).arrayBuffer(); const ac = new OfflineAudioContext(1, 48000, 48000); const au = await ac.decodeAudioData(ab); const ch = au.getChannelData(0);
    const rms = (a0, a1) => { let s = 0, n = 0; for (let i = Math.floor(a0 * au.sampleRate); i < Math.floor(a1 * au.sampleRate); i++) { s += ch[i] * ch[i]; n++; } return +Math.sqrt(s / n).toFixed(4); };
    return { meta, frames, advanced, audio: { seconds: +au.duration.toFixed(3), sampleRate: au.sampleRate, rmsBeforeVoice: rms(0, 0.3), rmsDuringVoice: rms(1, 5), rmsEndCard: rms(86.2, 89) } };
  });
  for (const [t, f] of Object.entries(r.frames)) fs.writeFileSync(path.join(ROOT, 'out', 'verify', 'decoded-' + t + 's.png'), Buffer.from(f.png.split(',')[1], 'base64'));
  const frameLum = Object.fromEntries(Object.entries(r.frames).map(([t, f]) => [t, f.meanLum]));
  ok(Math.abs(r.meta.duration - 90) < 0.1, 'browser duration ' + r.meta.duration); ok(r.meta.w === 1920 && r.meta.h === 1080, 'dimensions ' + r.meta.w + 'x' + r.meta.h);
  ok(r.advanced > 1.0, 'real-time playback did not advance (' + r.advanced + 's in 1.5s)'); ok(Object.values(frameLum).every(l => l > 3), 'a decoded frame is black');
  ok(r.audio.rmsDuringVoice > 0.02, 'no voice energy in the audio track'); ok(r.audio.rmsDuringVoice > r.audio.rmsBeforeVoice * 3, 'voice is not louder than the lead-in');
  console.log('B · playback', JSON.stringify({ meta: r.meta, frameMeanLuma: frameLum, playbackAdvancedSecIn1_5s: r.advanced, audio: r.audio }));
  await b.close(); srv.close();
  if (fails.length) { console.log('✗ MP4 VERIFY FAILED:\n  ' + fails.join('\n  ')); process.exit(1); }
  console.log('✓ MP4 VERIFIED — structure sound, decodes, seeks, plays in real time, voice present');
})().catch(e => { console.error('VERIFY FAIL', e.message); process.exit(1); });
