// site/front.test.mjs — the gate of the short front door (site/front.html, built as index.html). Three things are
// held: it is built the house way (the ship gate), a twelve-year-old can read it (the reading-age check), and every
// number on it is the one the record gives. Both checks are the house standard's own files, vendored and pinned.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import STANDARD from '../vendor/house-standard/src/standard.mjs';
import PLAIN from '../vendor/house-standard/src/plain.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const page = read('site/front.html'), built = read('index.html');
const shown = (html) => html.slice(html.indexOf('<body>')).replace(/<script[\s\S]*?<\/script>/g, ' ');
const words = (html) => shown(html).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const FL = json('vendor/house-standard/data/flagships.json'), flag = (repo) => FL.builds.find((b) => b.repo === repo);

test('the security policy: this site only, nothing else, and no eval', () => {
  const m = page.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(m, 'the page carries a Content-Security-Policy');
  const csp = Object.fromEntries(m[1].split(';').map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
  for (const k of ['default-src', 'script-src', 'worker-src', 'connect-src', 'font-src']) assert.deepEqual(csp[k], ["'self'"], k);
  assert.deepEqual(csp['object-src'], ["'none'"]); assert.deepEqual(csp['base-uri'], ["'none'"]); assert.deepEqual(csp['form-action'], ["'none'"]);
  assert.ok(!m[1].includes('unsafe-eval') && !m[1].includes('http'), 'no outside host is allowed at all');
});

test('the page loads code and fonts from this site only, and has no inline script or handler', () => {
  for (const m of page.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="([^"]+)"/g)) {
    if (/rel="(canonical|icon)"/.test(m[0])) continue;
    assert.ok(!/^(https?:)?\/\//.test(m[1]), 'an outside address in ' + m[0]);
    assert.ok(existsSync(join(root, m[1])), 'missing file ' + m[1]);
  }
  assert.equal((page.match(/<script\b/g) || []).length, 1);
  assert.match(page, /<script type="module" src="site\/front\.mjs"><\/script>/);
  assert.ok(!/\son[a-z]+="/.test(page), 'an inline event handler');
  assert.ok(!/<form\b(?![^>]*method="dialog")/.test(page), 'a form that could submit');
  for (const m of read('vendor/house-standard/kit/house.css').matchAll(/url\('([^']+\.woff2)'\)/g)) assert.ok(existsSync(join(root, m[1])), 'the font ' + m[1] + ' is on this site');
});

test('every element the front door\'s code reaches for is on the page, once', () => {
  const all = [...page.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]), ids = new Set(all);
  assert.equal(ids.size, all.length, 'an id is used twice on the page');
  for (const f of ['site/front.mjs', 'site/front-ask.mjs', 'site/net.mjs']) for (const m of read(f).matchAll(/\$\('([^']+)'\)|getElementById\('([^']+)'\)/g)) assert.ok(ids.has(m[1] || m[2]), f + ' looks for #' + (m[1] || m[2]) + ', which the page does not have');
  assert.ok(page.includes('id="ledger-table"') && /<table id="ledger-table"><thead>[\s\S]*?<tbody><\/tbody>/.test(page), 'the counter\'s table has a body to fill');
  // every button does something, and every link on the page has somewhere to go
  const code = read('site/front.mjs') + read('site/front-ask.mjs') + read('site/net.mjs');
  for (const m of page.matchAll(/<button[^>]*\sid="([^"]+)"/g)) assert.ok(new RegExp("\\$\\('" + m[1] + "'\\)|getElementById\\('" + m[1] + "'\\)").test(code), 'the button #' + m[1] + ' does nothing');
  for (const m of shown(built).matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(m[1]), 'a link goes to #' + m[1] + ', which is not on the page');
  for (const m of shown(built).matchAll(/href="([^"#][^"]*)"/g)) {
    if (/^(https:|mailto:)/.test(m[1])) continue;
    const [file, anchor] = m[1].split('#');
    assert.ok(existsSync(join(root, file)), 'a link goes to ' + file + ', which is not on this site');
    if (anchor) assert.ok(read(file.endsWith('/') ? file + 'index.html' : file).includes('id="' + anchor + '"'), 'a link goes to ' + m[1] + ', and that page has no such part');
  }
});

test('the built page is built the house way: the ship gate', () => {
  assert.ok(!/<!--([A-Z0-9-]+)--><!--\/\1-->/.test(built), 'an empty marker');
  const r = STANDARD.check(built);
  assert.equal(r.pass, true, r.rules.filter((x) => !x.pass).map((x) => x.id + ' ' + x.name + ': ' + x.why).join(' | '));
  assert.ok(built.includes(read('vendor/house-standard/kit/house.css').trim()), 'the house style sheet is on the page whole');
});

test('a twelve-year-old can read it: the reading-age check, on the page and on what the question box says', () => {
  const r = PLAIN.check(built);
  assert.equal(r.pass, true, r.rules.filter((x) => !x.pass).map((x) => x.id + ' ' + x.name + ': ' + x.why).join(' | '));
  assert.deepEqual(r.measured.all.jargon, [], 'no trade word anywhere on the page, behind a click or not');
  // the question box writes its words when it runs, so they are read here from its file: every line it can show
  // (a line is a quoted piece of the file that starts as a sentence does, has words and spaces in it, and no code)
  const ask = read('site/front-ask.mjs').split('\n').filter((l) => !l.trimStart().startsWith('//')).join('\n');
  const lines = [...ask.matchAll(/'([A-Z“][^'\n]{13,})'/g)].map((m) => m[1]).filter((s) => (s.match(/ /g) || []).length >= 2 && !/[=<>{}\/]|\bimport\b/.test(s));
  assert.ok(lines.length >= 9 && lines.some((l) => l.includes('I can’t tell')) && lines.some((l) => l.includes('It answers anyway')), 'the question box\'s lines were found (' + lines.length + ')');
  const said = PLAIN.check('<body>' + lines.map((l) => '<p>' + l + '</p>').join('') + '</body>');
  assert.equal(said.pass, true, said.rules.filter((x) => !x.pass).map((x) => x.id + ' ' + x.name + ': ' + x.why).join(' | '));
});

test('the question box asks only what was measured, and the page states its full test, misses and all', () => {
  const d = json('vendor/docdecdemo/demo-data.json'), dd = d.measured.docdec.unanswerable, rag = d.measured.vectorRag.unanswerable;
  assert.ok(words(built).includes(`The full test: ${dd.total} questions the pages cannot answer. A normal search answered all ${rag.answered}. Ours said “I can’t tell” to ${dd.abstained}. It still answered ${dd.answered} that it should not have.`));
  assert.equal(dd.abstained + dd.answered, dd.total); assert.equal(rag.answered, rag.total);
  assert.ok(words(built).includes(`It knows ${d.counts.paragraphs} short pieces of text`));
  assert.equal(d.demoQuestions.length, 12); assert.equal(d.demoQuestions.filter((q) => q.label === 'dd-missed' || q.label === 'dd-hallucinated').length, 4, 'the page says ours is wrong in four of the twelve');
  // a typed question would be matched on its words alone, which is not what was measured: the page has no box to type in
  assert.ok(!/<input\b|<textarea\b/.test(shown(page)), 'the front door takes no typed question');
  assert.ok(!read('site/front-ask.mjs').includes('D.tokens('), 'the question box never routes free text');
});

test('every number on the page is the one its record gives', () => {
  const text = words(built), V = flag('the-verifier-set'), C = flag('the-crystal'), K = flag('the-climb'), S = flag('the-seed'), L = flag('the-distillation');
  const x = (b, key) => b.extra.find((e) => e.key === key);
  for (const said of [
    `${x(V, 'unanswerable').value} → ${x(V, 'unanswerable').after} Made-up answers. We asked ${x(V, 'unanswerable').of} questions that have no answer.`,
    `${V.headline.was} → ${V.headline.now} Right answers, out of ${V.headline.of}.`,
    `${x(C, 'forged').value} /${x(C, 'forged').of.toLocaleString('en-GB')} Fakes that got through.`,
    `${K.headline.was} → ${K.headline.now} right, on ${K.headline.of} problems.`,
    `${C.headline.was} → ${C.headline.now} right, on ${C.headline.of} problems.`,
    `${V.headline.was} → ${V.headline.now} right, of ${V.headline.of} problems.`,
    `${x(S, 'sealed').value} of ${x(S, 'sealed').of} pieces passed. ${x(S, 'dissolved').value} failed and were thrown away.`,
    `${Math.round((100 * FL.reuse.taken) / (FL.reuse.taken + FL.reuse.worked))}% of the work used again`,
    json('media/film/facts.json').credits.konomi + '.',
  ]) assert.ok(text.includes(said), 'the page does not say: ' + said);
  // a failed goal is on the page in red; a test still running says so and gives no score
  for (const b of FL.builds.filter((b) => b.claims.fail > 0)) assert.ok(built.includes(`<span class="bad">${b.claims.fail} of its ${b.claims.n} goals failed.`), b.name + '\'s failed goal is shown in red');
  if (L.headline) assert.ok(text.includes(`${L.headline.was} → ${L.headline.now}`), 'the learning test\'s score is on the page');
  else { assert.ok(text.includes('Its first real test is running now.') && text.includes('sealing now'), 'the learning test says it is still running'); assert.ok(!/Its first real test\. On \d+ new problems/.test(text), 'no score is given before it lands'); }
  // every result card names where its proof is, and the proof is one of the estate's own public pages
  const stats = [...shown(built).matchAll(/<div class="stat reveal"[^>]*>[\s\S]*?<\/a><\/div>/g)].map((m) => m[0]);
  assert.ok(stats.length >= 5);
  for (const s of stats) assert.match(s, /<a class="src" href="https:\/\/sjgant80-hub\.github\.io\/[a-z-]+\/(#[a-z]+)?">/, 'a result with no proof one click away');
  assert.ok(!/[£€$]\s?\d/.test(text), 'a price on the page');
});
