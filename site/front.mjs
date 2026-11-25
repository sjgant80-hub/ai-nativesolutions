// site/front.mjs — the front door's entry point. It starts the counter of what the page fetched and sent first (so
// every later request is on it), lights the crystal from the results already written on the page, and starts the
// question box. Nothing here decides anything a visitor relies on: the numbers were written into the page when it
// was built, from the records they come from, and the answers come from the vendored, gated kernels.
import { startLedger } from './net.mjs';
import CRYSTAL from '../vendor/house-standard/kit/crystal.js';
import HOUSE from '../vendor/house-standard/kit/house.js';

const $ = (id) => document.getElementById(id);
const safe = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const net = startLedger();

// each result on the page is a face of the crystal: green when it holds, gold while it is still being tested, red
// when it failed. The page says which, in its own markup; this only reads it.
const faces = [...document.querySelectorAll('[data-face]')].slice(0, CRYSTAL.FACES).map((el) => ({ el, state: Number(el.dataset.face) || 0, say: el.dataset.say || '' }));
const rest = $('facet').textContent;
const crystal = CRYSTAL.mount($('crystal'), { energy: 0.9 });
if (crystal) {
  crystal.setFaces(Array.from({ length: CRYSTAL.FACES }, (_, i) => (faces[i] ? faces[i].state : 0)));
  crystal.onHover((i) => { const f = faces[i]; $('facet').innerHTML = f ? '<b>' + safe(f.say) + '</b>' + (f.state === 2 ? ' · still being tested' : f.state === 3 ? ' · a goal failed, and is kept' : '') : safe(rest); });
  crystal.onPick((i) => { const f = faces[i]; if (f && f.el.scrollIntoView) f.el.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  HOUSE.bindScroll(crystal, 0.9);
}
HOUSE.reveal(document); HOUSE.light(document);

try { const m = await import('./front-ask.mjs'); await m.startAsk({ net, crystal }); }
catch (e) {
  console.warn('the question box could not start:', e);
  $('ask-state').textContent = 'The question box could not start in this browser. The numbers and links on this page do not need it.';
}
window.__front = { net, crystal, faces };
