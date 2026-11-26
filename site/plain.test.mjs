// site/plain.test.mjs — the pages a visitor reaches from the front door are held to the reading-age check too.
// The rule is Simon's: the company site is simple enough for a twelve-year-old to read. It is measured, not claimed:
// vendor/house-standard/src/plain.mjs (school year at most 6 for what greets a visitor, at most 7 for the whole page,
// no sentence over 25 words, long words at most one in ten, no trade word in view).
//   node --test site/plain.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import PLAIN from '../vendor/house-standard/src/plain.mjs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
// held to the bar today. A page joins this list when it passes; it never leaves it.
const PLAIN_PAGES = ['index.html', 'deep.html', 'talk.html', 'explainer.html', 'estate.html', 'credits/index.html'];
// linked from the site and NOT yet plain: named here so the list of what is left cannot be forgotten
const NOT_YET = ['prospectus.html', 'deck.html'];

for (const page of PLAIN_PAGES) test('a twelve-year-old can read ' + page, () => {
  const r = PLAIN.check(read(page));
  assert.equal(r.pass, true, r.rules.filter((x) => !x.pass).map((x) => x.id + ' ' + x.name + ': ' + x.why).join(' | '));
});

test('every page the front door links to is either held to the bar or named as not yet plain', () => {
  const front = read('index.html').replace(/<script[\s\S]*?<\/script>/g, '');
  const linked = [...new Set([...front.matchAll(/href="([^"#?]+)(?:[#?][^"]*)?"/g)].map((m) => m[1]).filter((h) => !/^(?:https?:|mailto:|data:|vendor\/)/.test(h)).map((h) => (h.endsWith('/') ? h + 'index.html' : h)))];
  assert.ok(linked.length >= 5, 'the front door\'s links were found (' + linked.join(', ') + ')');
  for (const h of linked) assert.ok(PLAIN_PAGES.includes(h) || NOT_YET.includes(h), h + ' is linked from the front door and is in neither list');
  // a page named as not yet plain really is not: once it passes, it moves to the held list
  for (const p of NOT_YET) assert.equal(PLAIN.check(read(p)).pass, false, p + ' now passes: move it to PLAIN_PAGES');
});
