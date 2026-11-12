// site/page.test.mjs — the front door's own gate: what must be true of the page as a whole, checked from the files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import E from './kernel/estate.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const page = read('site/page.html');
const built = existsSync(join(root, 'index.html')) && read('index.html').includes('site/app.mjs') ? read('index.html') : existsSync(join(root, 'living.html')) ? read('living.html') : null;
const code = readdirSync(join(root, 'site')).filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs')).map((f) => 'site/' + f)
  .concat(readdirSync(join(root, 'site', 'kernel')).filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs')).map((f) => 'site/kernel/' + f));
const STATS = json('site/data/stats.json'), ORG = json('site/data/organs.json'), EST = json('site/data/estate.json');

test('the security policy: this site only, the three hosts the model needs, and no eval', () => {
  const m = page.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(m, 'the page carries a Content-Security-Policy');
  const csp = Object.fromEntries(m[1].split(';').map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
  assert.deepEqual(csp['default-src'], ["'self'"]);
  assert.deepEqual(csp['script-src'], ["'self'", 'https://cdn.jsdelivr.net', "'wasm-unsafe-eval'"]);
  assert.ok(!m[1].includes("'unsafe-eval'") && !csp['script-src'].includes("'unsafe-inline'"));
  assert.deepEqual(csp['connect-src'], ["'self'", 'https://cdn.jsdelivr.net', 'https://huggingface.co', 'https://*.huggingface.co', 'https://*.hf.co', 'https://raw.githubusercontent.com']);
  assert.deepEqual(csp['object-src'], ["'none'"]); assert.deepEqual(csp['base-uri'], ["'none'"]); assert.deepEqual(csp['form-action'], ["'none'"]);
  assert.deepEqual(csp['font-src'], ["'self'"]); assert.deepEqual(csp['worker-src'], ["'self'"]);
});

test('the page loads code, styles and fonts from this site only, and has no inline script or handler', () => {
  for (const m of page.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="([^"]+)"/g)) {
    if (/rel="(canonical|icon)"/.test(m[0])) continue;
    assert.ok(!/^(https?:)?\/\//.test(m[1]), 'an outside address in ' + m[0]);
    assert.ok(existsSync(join(root, m[1])), 'missing file ' + m[1]);
  }
  assert.equal((page.match(/<script\b/g) || []).length, 1);
  assert.match(page, /<script type="module" src="site\/app\.mjs"><\/script>/);
  assert.ok(!/\son[a-z]+="/.test(page), 'an inline event handler');
  assert.ok(!/<form\b(?![^>]*method="dialog")/.test(page), 'a form that could submit');
});

test('every import in the front door resolves to a file in this repository; the only outside code is the model library', () => {
  const outside = new Set();
  for (const f of code) {
    const src = read(f);
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\s[^'"\n]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|new URL\(\s*'([^']+)',\s*import\.meta\.url\)/g)) {
      const spec = m[1] || m[2] || m[3];
      if (/^https?:/.test(spec)) { outside.add(spec); continue; }
      assert.ok(spec.startsWith('.'), f + ' imports a bare name: ' + spec);
      assert.ok(existsSync(resolve(join(root, dirname(f)), spec)), f + ' imports a missing file: ' + spec);
    }
    for (const m of src.matchAll(/\bfetch\(\s*['"`](https?:[^'"`]+)/g)) outside.add(m[1]);
    assert.ok(!/\beval\(|new Function\(/.test(src), f + ' uses eval');
  }
  assert.deepEqual([...outside], []);                                    // the model library's address lives in data, shown before it is used
  const model = json('site/data/model.json');
  assert.match(model.library, /^https:\/\/cdn\.jsdelivr\.net\/npm\/@mlc-ai\/web-llm@\d+\.\d+\.\d+\/lib\/index\.js$/);   // an exact, pinned version
  assert.equal(model.bytes, model.parts.weights + model.parts.program + model.parts.library);
  assert.match(model.measured, /^\d{4}-\d{2}-\d{2}$/);
});

test('every module of the front door parses', () => {
  // a browser shows a syntax error as a blank organism, not a failed build: so the build checks it
  for (const f of code) {
    const r = spawnSync(process.execPath, ['--check', join(root, f)], { encoding: 'utf8' });
    assert.equal(r.status, 0, f + ' does not parse: ' + String(r.stderr).split('\n').slice(0, 4).join(' '));
  }
});

test('every element the code reaches for is on the page', () => {
  const ids = new Set([...page.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const f of code) for (const m of read(f).matchAll(/\$\('([^']+)'\)|getElementById\('([^']+)'\)/g)) {
    const id = m[1] || m[2];
    assert.ok(ids.has(id) || /^(law-|stat-)/.test(id), f + ' looks for #' + id + ', which the page does not have');
  }
  assert.equal(ids.size, [...page.matchAll(/\sid="([^"]+)"/g)].length, 'an id is used twice on the page');
});

test('every figure has a receipt, a source, and says what it does not prove', () => {
  const ids = new Set();
  for (const t of STATS.tiles) {
    assert.ok(!ids.has(t.id), 'tile id twice: ' + t.id); ids.add(t.id);
    assert.ok(t.title && t.title.length > 10, t.id + ' title');
    assert.ok(t.facts ? ['receipt', 'dispatcher', 'estate'].includes(t.facts) : /\d/.test(t.figure), t.id + ' has a figure');
    assert.ok(t.facts || (t.plain && t.plain.length > 60), t.id + ' is said plainly');
    assert.ok(t.notProve && t.notProve.length > 50, t.id + ' says what it does not prove');
    assert.ok(t.from && t.from.length > 10, t.id + ' names its source');
    assert.ok(/^https:\/\/(sjgant80-hub\.github\.io|github\.com\/sjgant80-hub)\//.test(t.receipt.url) || existsSync(join(root, t.receipt.url)), t.id + ' receipt: ' + t.receipt.url);
    for (const a of t.also || []) assert.match(a.url, /^https:\/\/(sjgant80-hub\.github\.io|github\.com\/sjgant80-hub)\//);
    if (t.try) assert.ok(page.includes('id="' + t.try.slice(1) + '"'), t.id + ' points at a section that exists');
  }
  assert.ok(STATS.tiles.filter((t) => t.failed).length >= 2, 'the failures are on the page');
});

test('the organs are real public builds, linked only to each other, with one heart', () => {
  const names = new Set(EST.nodes.map((n) => n[0])), ids = new Set();
  for (const o of ORG.organs) {
    assert.ok(names.has(o.id), o.id + ' is in the public estate'); assert.ok(!ids.has(o.id), o.id + ' twice'); ids.add(o.id);
    assert.ok(E.CHARACTERS.includes(o.char), o.id + ' character'); assert.ok(o.name && o.gloss && o.gloss.length > 30, o.id + ' is described');
    if (o.figures) { assert.ok(o.figures.every((f) => f.v && f.k && f.k.length > 15), o.id + ' figures'); assert.match(o.from || '', /^https:\/\/(sjgant80-hub\.github\.io|github\.com\/sjgant80-hub)\//, o.id + ' figures need a source'); }
  }
  for (const o of ORG.organs) for (const l of o.links) assert.ok(ids.has(l), o.id + ' links to ' + l + ', which is not an organ');
  assert.equal(ORG.organs.filter((o) => o.char === 'heart').length, 1);
  for (const ch of ['gate', 'immune', 'library', 'night', 'here']) assert.equal(ORG.organs.filter((o) => o.char === ch).length, 1, ch);
  const shape = E.shape({ nodes: EST.nodes.map(([name]) => ({ name })) }, ORG.organs);
  assert.equal(shape.organCount, ORG.organs.length); assert.ok(shape.links.length >= ORG.organs.length - 1);
  assert.ok(E.script(E.castOf(shape)).length > 50, 'the simulation has a script');
});

test('the estate data is public, clean and sorted', () => {
  assert.ok(EST.nodes.length > 1000);
  const PRICE = /[£€]\s?\d|\$\d{2,}|\/mo\b|\/month\b/;
  let prev = '';
  for (const [name, desc, live] of EST.nodes) {
    assert.ok(typeof name === 'string' && name && !name.startsWith('_'), 'name'); assert.ok(name > prev, name + ' out of order or twice'); prev = name;
    assert.ok(typeof desc === 'string' && desc.length <= 140); assert.ok(live === 0 || live === 1);
    assert.ok(!PRICE.test(desc), name + ' carries a price'); assert.ok(!/[◊κφ]|\bprime \d/.test(desc), name + ' carries internal shorthand');
  }
  assert.match(EST.generated, /^\d{4}-\d{2}-\d{2}$/);
});

test('the built page is the template with every marker filled, and says the facts the surface gate holds it to', { skip: built === null }, () => {
  assert.ok(!/<!--([A-Z0-9-]+)--><!--\/\1-->/.test(built), 'an empty marker');
  const F = json('media/film/facts.json'), R = F.realReceipt, D = F.dispatcher;
  const text = built.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  for (const want of ['scored ' + R.vsBase.node + '/' + R.probes + " against its base's " + R.vsBase.base + '/' + R.probes, R.vsBigger.node + '/' + R.probes + ' against a model ~7× its size, which scored ' + R.vsBigger.other + '/' + R.probes,
    D.auto + ' run themselves', D.behindKey + ' wait for a human key', D.todo + ' are marked', F.credits.konomi]) assert.ok(text.includes(want), 'missing: ' + want);
  assert.ok(!/[κφ]|◊\s*·/.test(text), 'internal shorthand on the page');
  // the one place a currency figure may stand: the statute's own limits in the law table (the surface gate argues the same exemption)
  assert.ok(!/[£€]\s?\d|\$\d{2,}/.test(text.split('cash price is over £100 and not more than £30,000').join(' ')), 'a price on the page');
  assert.equal((built.match(/class="tile"/g) || []).length, STATS.tiles.length);
  for (const id of ['surface', 'door', 'race', 'breach', 'organism-zone', 'receipts', 'made', 'start']) assert.ok(built.includes('id="' + id + '"'), 'zone ' + id);
  assert.match(text, /What this does not prove:/); assert.match(text, /What failed, and is kept:/); assert.match(text, /Simon Gant/);
});
