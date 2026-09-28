// pdf-prospectus.cjs — regenerate ONLY fall-os-prospectus.pdf (A4 portrait, the page's own print CSS, Chrome print),
// exactly as pdfs.cjs made it, from a given site checkout. The deck PDF is not touched.
//   node pdf-prospectus.cjs <site dir>
const { chromium } = require('C:/Users/sjgan/Downloads/si-didy-agent/node_modules/playwright');
const fs = require('fs'), path = require('path'), serve = require('./serve.cjs');
const SITE = process.argv[2];
if (!SITE || !fs.existsSync(path.join(SITE, 'prospectus.html'))) { console.error('usage: pdf-prospectus.cjs <site dir with prospectus.html>'); process.exit(1); }
const OUT = path.join(SITE, 'fall-os-prospectus.pdf');
const inspect = (f) => { const s = fs.readFileSync(f).toString('latin1'); return { pages: (s.match(/\/Type\s*\/Page[^s]/g) || []).length, mediaBox: (s.match(/\/MediaBox\s*\[\s*([\d.\s]+)\]/) || [])[1], images: (s.match(/\/Subtype\s*\/Image/g) || []).length, kb: Math.round(fs.statSync(f).size / 1024) }; };
(async () => {
  const before = fs.existsSync(OUT) ? inspect(OUT) : null;
  const srv = await serve(SITE, 8833);
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport: { width: 1240, height: 1754 } });
  await p.goto('http://127.0.0.1:8833/prospectus.html?cb=' + Date.now(), { waitUntil: 'networkidle' });
  await p.evaluate(async () => { document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager'; }); await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))); });
  await p.pdf({ path: OUT, format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '14mm', left: '14mm', right: '14mm' } });
  await b.close(); srv.close();
  console.log(JSON.stringify({ before, after: inspect(OUT) }));
})().catch(e => { console.error('PDF FAIL', e.message); process.exit(1); });
