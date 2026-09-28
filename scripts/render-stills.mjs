// ai-nativesolutions · scripts/render-stills.mjs — render the film stills that are drawn from HTML sources.
// A local tool (it drives a headless Chrome over the DevTools protocol), not a CI step: the stills are committed images.
//
//   node scripts/render-stills.mjs [--chrome <path>]
//
// Each still = an HTML source in scripts/stills/, with its {{FACTS}} filled from media/film/facts.json, rendered at
// 1920x1080 into media/images/. It refuses to render a source with an unfilled placeholder, so a still can never ship a
// figure the facts file does not hold. Uses its own Chrome profile and closes only the Chrome it started.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const F = JSON.parse(readFileSync(join(root, 'media', 'film', 'facts.json'), 'utf8'));
const argv = process.argv.slice(2), i = argv.indexOf('--chrome');
const CHROME = i >= 0 ? argv[i + 1] : 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const STILLS = [
  { src: 'scorecard-trust-rail.html', out: 'scorecard-trust-rail.jpg', fill: { HELD_OUT: F.forgemint.heldOutClaim } },
];

const PORT = 9335, W = 1920, H = 1080;
const prof = mkdtempSync(join(tmpdir(), 'stills-'));
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
try {
  let tabs;
  for (let k = 0; k < 60 && !tabs; k++) { try { tabs = await (await fetch(`http://localhost:${PORT}/json`)).json(); } catch { await sleep(250); } }
  if (!tabs) throw new Error('Chrome did not open its debugging port');
  const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0; const wait = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } });
  const cmd = (method, params = {}) => new Promise((r) => { const n = ++id; wait.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  await cmd('Page.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  for (const s of STILLS) {
    let html = readFileSync(join(root, 'scripts', 'stills', s.src), 'utf8');
    for (const [k, v] of Object.entries(s.fill)) html = html.split('{{' + k + '}}').join(esc(v));
    const left = html.match(/\{\{[A-Z_]+\}\}/);
    if (left) throw new Error('REFUSED: ' + s.src + ' has an unfilled ' + left[0]);
    const tmp = join(root, 'scripts', 'stills', '.render-' + s.src);   // beside the source, so relative images resolve
    writeFileSync(tmp, html);
    try {
      await cmd('Page.navigate', { url: pathToFileURL(tmp).href });
      await sleep(2500);
      const r = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
      writeFileSync(join(root, 'media', 'images', s.out), Buffer.from(r.result.data, 'base64'));
      console.log('rendered media/images/' + s.out + ' from scripts/stills/' + s.src);
    } finally { rmSync(tmp, { force: true }); }
  }
  ws.close();
} finally {
  proc.kill();
  try { execSync('taskkill /F /T /PID ' + proc.pid, { stdio: 'ignore' }); } catch {}
}
