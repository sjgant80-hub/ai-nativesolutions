// ai-nativesolutions · scripts/surface-gate.mjs — the product-surface rules, as a gate that can fail.
// Scope: the pages the 2026-09 package owns (front door, explainer, prospectus, deck) + the llms files.
//  1 · SITE-WIDE: no price on any page (visible text + script data), two argued exact-text exemptions
//  2 · the Konomi credit, verbatim; Gary W. Floyd always credited in full form
//  3 · no private cosmology on the visible page (the approved ◊·κ=1 seed tag excepted)
//  4 · the held-out claim stays narrow-true — no drift toward a stronger claim than the product can back
//  5 · the site's figures match media/film/facts.json, the single source behind the film and brochure
//  6 · every same-repo link and asset resolves
//   node scripts/surface-gate.mjs        exit 0 = clean · exit 1 = the failures, named
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OWNED = ['index.html', 'explainer.html', 'prospectus.html', 'deck.html'];
const F = JSON.parse(readFileSync(join(root, 'media', 'film', 'facts.json'), 'utf8'));
const fails = []; const fail = (f, m) => fails.push(f + ': ' + m);
const read = (f) => readFileSync(join(root, f), 'utf8');
const visible = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

// 1 · SITE-WIDE PRICING — no price on ANY page of the site: visible text AND script contents (the estate portal
//     renders repo descriptions from embedded data, which a visible-text check would never see). "$" needs two
//     digits or a price suffix so a JavaScript regex back-reference like '$1' is not mistaken for a price.
const PRICE = /[£€]\s?\d[\d,.]*\s*[kKmM]?|\$\d{2,}[\d,.]*|\$\s?\d[\d,.]*\s*(?:\/|per\b|k\b|m\b)|\/mo\b|\/month\b|priceCurrency|"@type"\s*:\s*"Offer"/g;
// An exemption is a written reason, matched on exact text — it stops applying the moment the text changes, and one
// that no longer matches anything fails as STALE (so the list can never quietly excuse something that isn't there).
const PRICE_EXEMPT = [
  { file: 'prospectus.html', section: ['<span class="num">14</span>', '<span class="num">15</span>'],
    reason: "§14 'Illustrative economics by industry' is a customer's CURRENT rented-software spend under stated assumptions — not a price we charge; kept as-is by Simon's decision, 2026-09-28" },
  { file: 'prospectus.html', phrase: 'A £500 laptop', reason: "the hardware-class floor in 'what it runs on' — the laptop a customer already owns, not a price we charge" },
  { file: 'deck.html', phrase: 'A £500 laptop', reason: "the hardware-class floor in 'what it runs on' — the laptop a customer already owns, not a price we charge" },
];
for (const x of PRICE_EXEMPT) if (!x.reason || x.reason.length < 20) { console.error('REFUSED: a price exemption without an argued reason (' + x.file + ')'); process.exit(1); }
const SITE = readdirSync(root).filter(x => x.endsWith('.html')).sort().concat(['llms.txt', 'llms-full.txt']);
const exemptUsed = new Set();
for (const f of SITE) {
  let raw = read(f);
  for (const [i, x] of PRICE_EXEMPT.entries()) if (x.file === f && x.section) {
    const a = raw.indexOf(x.section[0]), b = raw.indexOf(x.section[1], a + 1);
    if (a >= 0 && b > a) { raw = raw.slice(0, a) + raw.slice(b); exemptUsed.add(i); }
  }
  const scripts = f.endsWith('.html') ? (raw.match(/<script[\s\S]*?<\/script>/g) || []).join('\n') : '';
  let text = (f.endsWith('.html') ? visible(raw) : raw.replace(/\s+/g, ' ')) + ' ␞ ' + scripts;
  for (const [i, x] of PRICE_EXEMPT.entries()) if (x.file === f && x.phrase && text.includes(x.phrase)) { text = text.split(x.phrase).join(' '); exemptUsed.add(i); }
  for (const m of text.matchAll(PRICE)) fail(f, 'a price on the site: "' + text.slice(Math.max(0, m.index - 45), m.index + 30).replace(/\s+/g, ' ').trim() + '"');
}
for (const [i, x] of PRICE_EXEMPT.entries()) if (!exemptUsed.has(i)) fail(x.file, 'STALE price exemption — it no longer matches anything, remove it: ' + (x.phrase || x.section.join(' … ')));

for (const f of OWNED) {
  const html = read(f), text = visible(html);
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

// 2b · SITE-WIDE: any page that ships the dream / dreaming framing carries Gary W. Floyd's FULL dream-state credit
// (name + company + paper). Not scoped to the package pages — every .html in the site root, plus the llms files.
const GARY_DREAM = /Gary W\. Floyd,?\s*Lumiea Systems Research Division\s*—\s*ThunderStruck Service LLC[\s\S]{0,12}Dream State Architecture/;
for (const f of SITE) {
  // visible text AND script data — the estate portal renders build descriptions (some name dreaming) at runtime
  const raw = read(f), text = f.endsWith('.html') ? visible(raw) + ' ' + (raw.match(/<script[\s\S]*?<\/script>/g) || []).join(' ') : raw.replace(/\s+/g, ' ');
  const hit = text.match(/.{0,40}\bdream.{0,30}/i);
  if (hit && !GARY_DREAM.test(text)) fail(f, 'ships the dream framing ("' + hit[0].trim() + '") without Gary W. Floyd\'s full dream-state credit (Gary W. Floyd, Lumiea Systems Research Division — ThunderStruck Service LLC — “Dream State Architecture…,” 2025)');
}

// 4b · the explainer carries the narrow-true held-out claim, verbatim from the facts file
if (!visible(read('explainer.html')).includes(F.forgemint.heldOutClaim)) fail('explainer.html', 'the narrow-true held-out claim is missing or reworded');

// 5 · the front door's figures agree with the facts file
const idx = visible(read('index.html')), R = F.realReceipt, D = F.dispatcher;
// whole phrases, not bare fractions — "9/16" alone also appears in the second clause, so a changed first score would slip past
for (const want of [`scored ${R.vsBase.node}/${R.probes} against its base's ${R.vsBase.base}/${R.probes}`, `${R.vsBigger.node}/${R.probes} against a model ~7× its size, which scored ${R.vsBigger.other}/${R.probes}`, `${D.auto} run themselves`, `${D.behindKey} wait for a human key`, `${D.todo} are marked`])
  if (!idx.includes(want)) fail('index.html', 'figure disagrees with facts.json (expected "' + want + '")');

if (fails.length) { console.error('SURFACE GATE FAILED — ' + fails.length + ' problem(s):\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('surface gate clean — ' + SITE.length + ' site files: no price anywhere (' + exemptUsed.size + ' argued exemptions applied), dream credit wherever dreaming is named; ' + OWNED.length + ' package pages: credits present, no private notation, proof language narrow-true, figures match facts.json, every same-repo link resolves');
