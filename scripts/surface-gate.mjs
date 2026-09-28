// ai-nativesolutions · scripts/surface-gate.mjs — the product-surface rules, as a gate that can fail.
// Scope: the pages the 2026-09 package owns (front door, explainer, prospectus, deck) + the llms files.
//  1 · no pricing of our own (strictly no currency figures on the front door and the explainer)
//  2 · the Konomi credit, verbatim; Gary W. Floyd always credited in full form
//  3 · no private cosmology on the visible page (the approved ◊·κ=1 seed tag excepted)
//  4 · the held-out claim stays narrow-true — no drift toward a stronger claim than the product can back
//  5 · the site's figures match media/film/facts.json, the single source behind the film and brochure
//  6 · every same-repo link and asset resolves
//   node scripts/surface-gate.mjs        exit 0 = clean · exit 1 = the failures, named
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OWNED = ['index.html', 'explainer.html', 'prospectus.html', 'deck.html'];
const STRICT = ['index.html', 'explainer.html'];
const F = JSON.parse(readFileSync(join(root, 'media', 'film', 'facts.json'), 'utf8'));
const fails = []; const fail = (f, m) => fails.push(f + ': ' + m);
const read = (f) => readFileSync(join(root, f), 'utf8');
const visible = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

for (const f of OWNED) {
  const html = read(f), text = visible(html);
  // 1 · pricing
  if (/"@type"\s*:\s*"Offer"|priceCurrency/.test(html)) fail(f, 'an Offer / priceCurrency schema — pricing is never on the product');
  if (/\/mo\b/.test(text)) fail(f, 'a "/mo" price');
  if (/£0\b|tiers? £\d|£\d[\d,.]*\s*(?:k|K)?\s*[-–]\s*£\d/.test(text)) fail(f, 'our own pricing (a £0 price or a priced tier)');
  if (STRICT.includes(f) && /[£$€]\s?\d/.test(text)) fail(f, 'a currency figure on the front door / explainer: ' + text.match(/.{0,40}[£$€]\s?\d.{0,30}/)[0]);
  // 2 · credits
  const konomi = f === 'prospectus.html' ? /Thomas Frumkin/ : /Konomi architecture\s*,\s*created by Thomas Frumkin/;
  if (!konomi.test(text)) fail(f, 'the Konomi credit is missing ("Powered by the Konomi architecture, created by Thomas Frumkin")');
  for (const m of text.matchAll(/Gary W\. Floyd/g)) { const after = text.slice(m.index, m.index + 110); if (!/Lumiea Systems Research Division/.test(after)) fail(f, 'Gary W. Floyd named without the full credit: "' + after.slice(0, 70) + '…"'); }
  // 3 · private cosmology off the visible page (the seed tag ◊·κ=1 is approved and ignored)
  const leak = text.replace(/◊\s*·\s*κ\s*=\s*1/g, '').match(/.{0,30}(?:κ|φ|\bM7\b).{0,30}/);
  if (leak) fail(f, 'private notation on the visible page: "' + leak[0] + '"');
  // 4 · anti-cheat drift
  if (/hermetic|memoris|memoriz|cannot have been/i.test(text)) fail(f, 'a drift word in the proof language: ' + text.match(/.{0,40}(?:hermetic|memoris|memoriz|cannot have been).{0,30}/i)[0]);
  // 6 · same-repo links and assets resolve
  for (const m of html.replace(/<script[\s\S]*?<\/script>/g, '').matchAll(/(?:href|src|poster)="([^"]+)"/g)) {
    const u = m[1]; if (/^(?:https?:|mailto:|#|data:|\/\/)/.test(u)) continue;
    const p = u.replace(/^\.\//, '').split(/[?#]/)[0]; if (p && !existsSync(join(root, p))) fail(f, 'links to a file that is not here: ' + p);
  }
}
for (const f of ['llms.txt', 'llms-full.txt']) if (/hermetic|memoris|memoriz|cannot have been/i.test(read(f))) fail(f, 'a drift word in the proof language');

// 4b · the explainer carries the narrow-true held-out claim, verbatim from the facts file
if (!visible(read('explainer.html')).includes(F.forgemint.heldOutClaim)) fail('explainer.html', 'the narrow-true held-out claim is missing or reworded');

// 5 · the front door's figures agree with the facts file
const idx = visible(read('index.html')), R = F.realReceipt, D = F.dispatcher;
// whole phrases, not bare fractions — "9/16" alone also appears in the second clause, so a changed first score would slip past
for (const want of [`scored ${R.vsBase.node}/${R.probes} against its base's ${R.vsBase.base}/${R.probes}`, `${R.vsBigger.node}/${R.probes} against a model ~7× its size, which scored ${R.vsBigger.other}/${R.probes}`, `${D.auto} run themselves`, `${D.behindKey} wait for a human key`, `${D.todo} are marked`])
  if (!idx.includes(want)) fail('index.html', 'figure disagrees with facts.json (expected "' + want + '")');

if (fails.length) { console.error('SURFACE GATE FAILED — ' + fails.length + ' problem(s):\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('surface gate clean — ' + OWNED.length + ' pages: no own pricing, credits present, no private notation, proof language narrow-true, figures match facts.json, every same-repo link resolves');
