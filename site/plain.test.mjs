// site/plain.test.mjs — every page a visitor can reach from the front door is held to the reading-age check.
// The rule is Simon's: the company site is simple enough for a twelve-year-old to read. It is measured, not claimed:
// vendor/house-standard/src/plain.mjs (school year at most 6 for what greets a visitor, at most 7 for the whole page,
// no sentence over 25 words, long words at most one in ten, no trade word in view).
//   node --test site/plain.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import PLAIN from '../vendor/house-standard/src/plain.mjs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
// held to the bar. A page joins this list when it passes; it never leaves it.
const PLAIN_PAGES = ['index.html', 'deep.html', 'talk.html', 'explainer.html', 'estate.html', 'credits/index.html', 'prospectus.html', 'deck.html', 'classic.html', 'konomi.html'];
// in the sitemap but not linked from the front door's pages: held to the bar all the same
const ALSO_PLAIN = ['os.html'];
// older pages, retired on 27 November 2026: each is kept as it was under legacy/, and the short note left at its old
// address is held to the bar
const MOVED = ['offerings.html', 'spec.html', 'architecture.html', 'demo.html', 'FallCube.html', 'FallCRM-Elite-v3.html', 'fallos.html'];
// at the site root and outside the visitor's path, each for a written reason
const ROOT_OTHER = {
  'ai.html': 'written for AI agents to read (scripts/build-agent.mjs); a person is sent to the front door instead',
};
// reachable, and not held to the bar, each for a written reason. An exemption is a reason, not a convenience.
const NOT_HELD = {
  'legacy/prospectus-2026-09.html': 'the first edition of the booklet (September 2026), kept exactly as it was published; the plain-words edition replaces it and links to it',
  'legacy/deck-2026-09.html': 'the first edition of the slides (September 2026), kept exactly as they were published; the plain-words slides replace them and link to them',
  'ai.html': 'written for AI agents to read, and drawn word for word from the agent records (scripts/build-agent.mjs); a person is sent to the front door instead',
};

for (const page of [...PLAIN_PAGES, ...ALSO_PLAIN, ...MOVED]) test('a twelve-year-old can read ' + page, () => {
  const r = PLAIN.check(read(page));
  assert.equal(r.pass, true, r.rules.filter((x) => !x.pass).map((x) => x.id + ' ' + x.name + ': ' + x.why).join(' | '));
});

// the pages of this site that a page links to (its own folder's pages, by path from the site root)
const linksOf = (page) => {
  const dir = page.includes('/') ? page.slice(0, page.lastIndexOf('/') + 1) : '';
  const html = read(page).replace(/<script[\s\S]*?<\/script>/g, '');
  const out = new Set();
  for (const m of html.matchAll(/href="([^"#?]+)(?:[#?][^"]*)?"/g)) {
    let h = m[1];
    if (/^(?:https?:|mailto:|data:)/.test(h) || /^(?:\.\/)?(?:vendor|media)\//.test(h)) continue;
    h = h.startsWith('/') ? h.slice(1) : h.startsWith('./') ? dir + h.slice(2) : dir + h;
    if (h === '' || h.endsWith('/')) h += 'index.html';
    if (h.endsWith('.html')) out.add(h);
  }
  return [...out];
};

test('every page a visitor can reach from the front door is held to the bar, or is named with the reason it is not', () => {
  const seen = new Set(['index.html']), todo = ['index.html'];
  while (todo.length) {
    const page = todo.pop();
    for (const h of linksOf(page)) {
      assert.ok(existsSync(new URL('../' + h, import.meta.url)), page + ' links to ' + h + ', which is not here');
      assert.ok(PLAIN_PAGES.includes(h) || Object.hasOwn(NOT_HELD, h), h + ' is reachable (from ' + page + ') and is in neither list');
      // a page that is not held is an end: a visitor is not led on from it by this test
      if (!seen.has(h) && PLAIN_PAGES.includes(h)) { seen.add(h); todo.push(h); }
    }
  }
  assert.ok(seen.size >= 8, 'the walk from the front door found the site (' + [...seen].join(', ') + ')');
  for (const p of PLAIN_PAGES) assert.ok(seen.has(p), p + ' is held to the bar but cannot be reached from the front door');
  for (const [p, why] of Object.entries(NOT_HELD)) { assert.ok(existsSync(new URL('../' + p, import.meta.url)), p + ' is named and is not here'); assert.ok(why.length > 60, p + ' has no written reason'); }
});

test('each retired page is kept under legacy/, says what it is, and its old address says where it went', () => {
  for (const page of MOVED) {
    const note = read(page), old = read('legacy/' + page);
    assert.ok(note.includes('This page has moved.') && note.includes('href="legacy/' + page + '"'), page + ' does not say where the older page went');
    assert.ok(note.includes('Powered by the Konomi architecture, created by Thomas Frumkin.'), page + ' has no credit line');
    assert.ok(old.includes('<base href="../">') && old.includes('<meta name="robots" content="noindex">'), 'legacy/' + page + ' does not resolve from the site root, or may be indexed');
    assert.ok(/This is an older (page|app), last changed in \w+ 2026, kept as it was/.test(old), 'legacy/' + page + ' does not say what it is');
    assert.ok(!/href=["']#/.test(old), 'legacy/' + page + ' has a same-page link that would now lead to the front door');
  }
});

test('no page at the site root is outside the rule: each is held to the bar, or named with its reason', () => {
  const root = readdirSync(new URL('../', import.meta.url)).filter((f) => f.endsWith('.html')).sort();
  const known = new Set([...PLAIN_PAGES, ...ALSO_PLAIN, ...MOVED, ...Object.keys(ROOT_OTHER)]);
  for (const f of root) assert.ok(known.has(f), f + ' is at the site root and is in no list: hold it to the bar, retire it to legacy/, or name the reason');
  for (const [p, why] of Object.entries(ROOT_OTHER)) { assert.ok(existsSync(new URL('../' + p, import.meta.url)), p + ' is named and is not here'); assert.ok(why.length > 60, p + ' has no written reason'); }
});

test('each first edition says what it is and points to the plain-words edition', () => {
  for (const [old, now] of [['legacy/prospectus-2026-09.html', 'prospectus.html'], ['legacy/deck-2026-09.html', 'deck.html']]) {
    const h = read(old);
    assert.ok(h.includes('<base href="../">'), old + ' resolves its links from the site root');
    assert.ok(h.includes('This is the first edition, from September 2026, kept as it was published.') && h.includes('href="' + now + '"'), old + ' says what it is and links to ' + now);
    assert.ok(read(now).includes('href="' + old + '"'), now + ' links to its first edition');
  }
});
