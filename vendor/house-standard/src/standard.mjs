// standard.mjs — the ship gate, as code. Given a built page (its HTML as text), it rules on the parts of the house
// standard that a page can be held to mechanically. It cannot tell whether a number is true: that is what the page's
// own seal, gate and records are for. It tells whether the page is BUILT the way the standard requires.
//
//   H1 THE KIT            the crystal hero, receipts, a stack, a glass with something to press, an honest expander
//   H2 THE LAW OF THE PAGE no paragraph of prose greets a visitor, and the whole default view is short
//   H3 RECEIPTS           every receipt carries its source one click away, or says it is still sealing
//   H4 NOTHING UNFINISHED no placeholder, nothing left unmeasured, and no id that two elements share
//   H5 THE FAIL-WALL      limits are on the page behind a click, and a failure or an unfinished part is shown as one
//   H6 ONE IDENTITY       the committed-dark tokens and the three faces
//   H7 HOUSE RULES        the credit line (or the page's own written reason for leaving it off), no price, no
//                         private shorthand
//
//   measure(html) → what it counted         check(html) → { pass, rules: [{ id, name, pass, why }], measured }
// Pure and total: anything that is not a page fails every rule, and nothing throws.
export const LIMITS = { paragraph: 45, view: 1250, limits: 3 };
export const NAMES = { H1: 'The kit', H2: 'The law of the page', H3: 'Receipts', H4: 'Nothing unfinished', H5: 'The fail-wall', H6: 'One identity', H7: 'House rules' };
const TOKENS = ['#02070c', '#49e8c8', '#ffcf6a', '#ff6b6b'], FACES = ['Fraunces', 'Hanken Grotesk', 'JetBrains Mono'];
const CREDIT = 'Powered by the Konomi architecture, created by Thomas Frumkin.';
// a price of our own: an amount for a seat, a user or a period, or the words of a price list. What others charge,
// set out with its source, is not this: a buyer's page is required to carry that comparison.
const PRICED = /[£$€]\s?\d[\d,.]*\s*(?:\/|per|a|each)\s*(?:seat|user|month|mo\b|year|yr\b|licen[cs]e)|\b(?:buy now|subscribe now|pricing plans?|our pricing|price list)\b/i;
// three signs and one word that stay off public pages, written here so that this file does not carry them either
const SHORTHAND = new RegExp(`[\\u03ba\\u03c6\\u25ca]|\\b${['to', 'rus'].join('')}\\b`, 'i');

const str = (x) => (typeof x === 'string' ? x : '');
const strip = (s) => s.replace(/<[^>]+>/g, ' ');
const words = (s) => strip(s).split(/\s+/).filter(Boolean).length;
const count = (s, re) => (s.match(re) || []).length;
// body(html) → what a visitor is shown: the body, without scripts and styles
const body = (html) => { const a = html.search(/<body[\s>]/i); return (a < 0 ? '' : html.slice(a)).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' '); };
// folded(s) → s without what waits behind a click: every expander goes, however deep expanders sit inside expanders
// (the innermost go first, so an outer one is never cut short at an inner one's end)
function folded(s) {
  for (;;) { const t = s.replace(/<details\b(?:(?!<details\b)[\s\S])*?<\/details>/gi, ' '); if (t === s) return s; s = t; }
}
// blocks(s, cls, tag) → the inner HTML of every element (of that tag, if one is named) whose class list holds cls,
// each matched to its own closing tag
function blocks(s, cls, tag) {
  const out = [], open = new RegExp(`<(${tag || '[a-z0-9]+'})\\b[^>]*\\bclass="[^"]*(?<![\\w-])${cls}(?![\\w-])[^"]*"[^>]*>`, 'gi');
  for (let m = open.exec(s); m !== null; m = open.exec(s)) {
    const tag = m[1].toLowerCase(), tags = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
    tags.lastIndex = open.lastIndex;
    let depth = 1, end = -1;
    for (let t = tags.exec(s); t !== null; t = tags.exec(s)) { depth += t[1] === '/' ? -1 : 1; if (depth === 0) { end = t.index; break; } }
    if (end !== -1) out.push(s.slice(open.lastIndex, end));
  }
  return out;
}
// twice(b) → every id that more than one element carries: a script that asks for such an id is handed the wrong element
const twice = (b) => { const n = new Map(); for (const m of b.matchAll(/<[a-z0-9]+\b[^>]*?\sid="([^"]+)"/gi)) n.set(m[1], (n.get(m[1]) || 0) + 1); return [...n].filter((e) => e[1] > 1).map((e) => e[0]); };
// exempt(page) → why this page leaves the credit line off, when its head says so in a sentence: an exemption is a
// written reason, shown wherever the rule is shown, and never a silent switch
const exempt = (page) => { const m = page.match(/<meta name="house-exemption" content="credit: ([^"]{20,})">/); return m ? m[1].trim() : ''; };

export function measure(html) {
  const page = str(html), b = body(page);
  const open = folded(b).replace(/<svg[\s\S]*?<\/svg>/gi, ' ').replace(/<select[\s\S]*?<\/select>/gi, ' ');
  const paragraphs = [...open.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => words(m[1]));
  const stats = blocks(b, 'stat'), honest = blocks(b, 'honest', 'details');
  const glass = blocks(b, 'glass');
  return {
    crystal: /<canvas\b[^>]*\bid="crystal"/i.test(b), receipts: stats.length, stackRows: blocks(b, 'srow').length, glass: glass.length,
    controls: count(glass.join(' ') + blocks(b, 'proof').join(' '), /<(button|select|textarea|input)\b/gi), expanders: honest.length,
    limits: honest.reduce((a, h) => a + count(h, /<p\b/gi), 0),
    longest: paragraphs.length ? Math.max(...paragraphs) : 0, viewWords: words(open), allWords: words(b),
    sourced: stats.filter((s) => /<a\b[^>]*\bclass="[^"]*\bsrc\b[^"]*"[^>]*\bhref="[^"]+"/i.test(s) || /sealing now/i.test(s)).length,
    unfinished: count(strip(b), /not measured yet|lorem ipsum|coming soon|\bTODO\b|\bTBD\b/gi),
    shown: /class="[^"]*\b(tag rd|fail|bad)\b/.test(b) || /sealing now/i.test(b),
    tokens: TOKENS.filter((t) => page.toLowerCase().includes(t)).length, faces: FACES.filter((f) => page.includes(f)).length,
    clashes: twice(b), credit: b.includes(CREDIT), exempt: exempt(page), priced: PRICED.test(strip(b)), shorthand: SHORTHAND.test(b),
  };
}

export function check(html) {
  const m = measure(html), out = [];
  const rule = (id, pass, why) => out.push({ id, name: NAMES[id], pass, why });
  const missing = [!m.crystal && 'the crystal hero', m.receipts === 0 && 'receipts', m.stackRows === 0 && 'a stack', (m.glass === 0 || m.controls === 0) && 'a glass with something to press', m.expanders === 0 && 'an honest expander'].filter(Boolean);
  rule('H1', missing.length === 0, missing.length === 0 ? `crystal hero, ${m.receipts} receipts, ${m.stackRows} stack rows, ${m.controls} controls on the glass, ${m.expanders} expanders` : `missing: ${missing.join(', ')}`);
  rule('H2', m.allWords > 0 && m.longest <= LIMITS.paragraph && m.viewWords <= LIMITS.view, `${m.viewWords} words before any click (at most ${LIMITS.view}); the longest paragraph is ${m.longest} words (at most ${LIMITS.paragraph})`);
  rule('H3', m.receipts > 0 && m.sourced === m.receipts, `${m.sourced} of ${m.receipts} receipts carry their source, or say they are still sealing`);
  rule('H4', m.allWords > 0 && m.unfinished === 0 && m.clashes.length === 0, [m.unfinished === 0 ? 'no placeholder on the page' : `${m.unfinished} placeholders on the page`, m.clashes.length === 0 ? 'no id used twice' : `used as an id by more than one element: ${m.clashes.join(', ')}`].join('; '));
  rule('H5', m.limits >= LIMITS.limits && m.shown, `${m.limits} limits behind a click (at least ${LIMITS.limits}); ${m.shown ? 'a failure or an unfinished part is shown as one' : 'nothing on the page is shown as failed or unfinished'}`);
  rule('H6', m.tokens === TOKENS.length && m.faces === FACES.length, `${m.tokens} of ${TOKENS.length} house colours, ${m.faces} of ${FACES.length} house faces`);
  rule('H7', (m.credit || m.exempt !== '') && !m.priced && !m.shorthand, [m.credit ? 'the credit line is on the page' : m.exempt !== '' ? `the credit line is left off, and the page says why: ${m.exempt}` : 'the credit line is missing', m.priced ? 'a price is on the page' : 'no price', m.shorthand ? 'private shorthand is on the page' : 'no private shorthand'].join('; '));
  return { pass: out.every((r) => r.pass), rules: out, measured: m };
}

export default { LIMITS, NAMES, measure, check };
