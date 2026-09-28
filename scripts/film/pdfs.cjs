// pdfs.cjs (site dir as the argument) — regenerate fall-os-prospectus.pdf (A4 portrait, the page's own print CSS) and fall-os-deck.pdf
// (A4 landscape, one slide per page) from the served working tree, the same way the originals were made
// (Chrome print). Then verify each: page count, page size, embedded images, and a print-media preview.
const { chromium } = require('C:/Users/sjgan/Downloads/si-didy-agent/node_modules/playwright');
const fs = require('fs'), path = require('path'), serve = require('./serve.cjs');
const SITE = process.argv[2], OUT = path.join(__dirname, 'out', 'site');
if (!SITE || !fs.existsSync(path.join(SITE, 'deck.html'))) { console.error('usage: node pdfs.cjs <site checkout dir> — no default: it writes the PDFs into that folder'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const inspect = (f) => { const s = fs.readFileSync(f).toString('latin1'); return { pages: (s.match(/\/Type\s*\/Page[^s]/g) || []).length, mediaBox: (s.match(/\/MediaBox\s*\[\s*([\d.\s]+)\]/) || [])[1], images: (s.match(/\/Subtype\s*\/Image/g) || []).length, kb: Math.round(fs.statSync(f).size / 1024) }; };
const before = { prospectus: inspect(path.join(SITE, 'fall-os-prospectus.pdf')), deck: inspect(path.join(SITE, 'fall-os-deck.pdf')) };
(async () => {
  const srv = await serve(SITE, 8832);
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport: { width: 1240, height: 1754 } });
  const load = async (pg) => { await p.goto('http://127.0.0.1:8832/' + pg + '?cb=' + Date.now(), { waitUntil: 'networkidle' });
    await p.evaluate(async () => { document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager'; }); await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))); }); };
  await load('prospectus.html');
  await p.pdf({ path: path.join(SITE, 'fall-os-prospectus.pdf'), format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '14mm', left: '14mm', right: '14mm' } });
  await p.emulateMedia({ media: 'print' }); await p.screenshot({ path: path.join(OUT, 'prospectus-print-preview.png'), clip: { x: 0, y: 0, width: 1240, height: 3400 } }); await p.emulateMedia({ media: 'screen' });
  await load('deck.html');
  // fit every slide to one A4-landscape page: under print media, scale any slide taller than the page by
  // exactly the ratio it needs (content-heavy tables/lists), so the PDF is one slide per page, nothing split.
  await p.setViewportSize({ width: 1123, height: 794 }); await p.emulateMedia({ media: 'print' });
  const fitted = await p.evaluate(() => { const out = [];
    for (const s of document.querySelectorAll('section.slide')) {
      const fit = document.createElement('div'); fit.className = 'fit'; while (s.firstChild) fit.appendChild(s.firstChild); s.appendChild(fit);   // scale the content, never the page box
      const cs = getComputedStyle(s), avail = s.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom), h = fit.scrollHeight;
      if (h > avail) { const z = Math.floor(avail / h * 1000) / 1000; fit.style.zoom = z; out.push(s.id + '×' + z); } }
    return out; });
  console.log('deck slides fitted to one page:', fitted.join(', ') || 'none needed');
  await p.pdf({ path: path.join(SITE, 'fall-os-deck.pdf'), preferCSSPageSize: true, printBackground: true });
  const r = { prospectus: inspect(path.join(SITE, 'fall-os-prospectus.pdf')), deck: inspect(path.join(SITE, 'fall-os-deck.pdf')), deckSlides: await p.evaluate(() => document.querySelectorAll('.slide').length) };
  console.log(JSON.stringify({ before, after: r }, null, 1));
  await b.close(); srv.close();
})().catch(e => { console.error('PDF FAIL', e.message); process.exit(1); });
