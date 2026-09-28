// encode.cjs — drive the installed Chrome (local Playwright, no browser download) to render every frame of
// film.html deterministically and encode H.264 + AAC with WebCodecs, then mux to out/film.mp4 here in node.
const { chromium } = require('C:/Users/sjgan/Downloads/si-didy-agent/node_modules/playwright');
const fs = require('fs'), path = require('path'), serve = require('./serve.cjs'), { mux } = require('./mux-mp4.cjs');
const ROOT = __dirname;
async function encodeOnce(codecProfile) {
  const srv = await serve(ROOT, 8821);
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const video = [], audio = [], t0 = Date.now();
  await p.exposeFunction('__push', (json) => { for (const [k, d, ts, key] of JSON.parse(json)) (k === 'v' ? video : audio).push({ data: Buffer.from(d, 'base64'), ts, key: !!key }); });
  await p.exposeFunction('__progress', (i, n) => { process.stdout.write(`\r  frame ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s   `); });
  await p.goto('http://127.0.0.1:8821/film.html?encode=1');
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  const res = await p.evaluate(async (prof) => {
    if (prof === 'baseline') { const orig = VideoEncoder.prototype.configure; VideoEncoder.prototype.configure = function (c) { return orig.call(this, { ...c, codec: 'avc1.42E028' }); }; }
    return window.runEncode(4_000_000);
  }, codecProfile);
  process.stdout.write('\n');
  await b.close(); srv.close();
  if (res.err || errs.length) throw new Error('encode error: ' + (res.err || errs.join('; ')));
  return { res, video, audio, secs: (Date.now() - t0) / 1000 };
}
(async () => {
  let prof = 'high', r = await encodeOnce(prof);
  const monotonic = r.video.every((s, i) => i === 0 || s.ts > r.video[i - 1].ts);
  if (!monotonic) { console.log('  encoder emitted reordered frames — re-encoding as Constrained Baseline (no B-frames)'); prof = 'baseline'; r = await encodeOnce(prof); }
  if (!r.video.every((s, i) => i === 0 || s.ts > r.video[i - 1].ts)) throw new Error('frames still out of order');
  if (!r.video[0].key) throw new Error('first video sample is not a key frame');
  const expected = Math.round(r.res.frames); const missing = []; const have = new Set(r.video.map(s => Math.round(s.ts * 30 / 1e6))); for (let i = 0; i < expected; i++) if (!have.has(i)) missing.push(i);
  if (missing.length) throw new Error(missing.length + ' frame(s) missing, e.g. ' + missing.slice(0, 12).join(','));
  const avcC = Buffer.from(r.res.vDesc, 'base64'), asc = Buffer.from(r.res.aDesc, 'base64');
  const out = mux({ width: 1920, height: 1080, fps: 30, video: r.video, avcC, sampleRate: 48000, channels: 1, audio: r.audio.map(a => a.data), asc });
  fs.writeFileSync(path.join(ROOT, 'out', 'film.mp4'), out.file);
  const vBytes = r.video.reduce((a, s) => a + s.data.length, 0), aBytes = r.audio.reduce((a, s) => a + s.data.length, 0);
  console.log(JSON.stringify({ profile: prof, avcProfileByte: avcC[1], frames: r.video.length, keyframes: r.video.filter(s => s.key).length, audioFrames: r.audio.length,
    videoSec: +out.vDur.toFixed(3), audioSec: +out.aDur.toFixed(3), chunks: out.chunks, mb: +(out.file.length / 1048576).toFixed(2),
    videoKbps: Math.round(vBytes * 8 / out.vDur / 1000), audioKbps: Math.round(aBytes * 8 / out.aDur / 1000), ascHex: asc.toString('hex'), encodeSecs: Math.round(r.secs) }, null, 1));
})().catch(e => { console.error('\nENCODE FAIL', e.message); process.exit(1); });
