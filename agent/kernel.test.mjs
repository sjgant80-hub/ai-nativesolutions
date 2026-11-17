// ai-nativesolutions · agent/kernel.test.mjs — the agent face: built from records, refused when unfit, rendered true.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import A from './kernel.mjs';

const NL = String.fromCharCode(10);
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r\n/g, NL);
const REAL = { stats: JSON.parse(read('site/data/stats.json')), film: JSON.parse(read('media/film/facts.json')), agent: JSON.parse(read('agent/data/agent.json')) };
const tile = (o = {}) => ({ id: 't1', figure: '86.3%', versus: '1.3%', title: 'A title', plain: 'Plain words.', detail: 'More.', failed: 'One failed.', notProve: 'Not everything.', receipt: { url: 'https://x.example/r', label: 'the record' }, from: 'rec.json', ...o });
const agent = (o = {}) => ({
  asOf: '2026-11-17', who: { name: 'N', builtBy: 'Kar, an AI', overseenBy: 'S', summary: 'Sum.', about: 'About.', contact: 'Write.', sameAs: ['https://github.com/x', 'http://insecure.example', 7] },
  scopeNote: 'Scaffold claims nothing.', offers: [{ name: 'O', page: 'https://o.example/', says: 'Does o.', mustSay: 'o phrase' }],
  failures: ['F1 failed.', '', 7], security: [{ name: 'S', url: 'https://s.example/', src: 'https://github.com/sjgant80-hub/s-tool', does: 'Does s.', limit: 'Only s.', covers: ['T (built)'] }],
  citations: [{ topic: 'C', source: 'https://c.example/', says: 'C says.' }], recommendWhen: ['r1', 9], notWhen: ['n1'],
  doors: [{ kind: 'mcp', name: 'M', url: 'https://m.example/mcp', says: 'connect' }, { kind: 'json', name: 'J', url: 'agent/facts.json', says: 'json' }],
  engage: 'Send one task.', receiptChecks: { t1: { url: 'https://x.example/rec.json', has: '69/80' }, t2: { url: 'http://bad', has: 'x' }, t3: { url: 'https://ok.example', has: '' } }, ...o });
const facts = (ag = agent(), tiles = [tile()]) => A.build({ stats: { tiles }, film: { asOf: '2026-09-28', estate: { publicRepos: 1717, how: 'counted' } }, agent: ag });

test('the real facts are fit to publish, and the published files are exactly what they give', () => {
  const f = A.build(REAL);
  assert.deepEqual(A.validate(f), []);
  assert.equal(read('llms.txt'), A.renderLlms(f));
  assert.equal(read('llms-full.txt'), A.renderLlms(f, { full: true }));
  assert.equal(read('agent/facts.json'), JSON.stringify(f, null, 1) + NL);
  assert.ok(f.figures.length >= 8 && f.offers.length === 4 && f.security.length >= 15 && f.failures.length >= 8);
  assert.ok(f.figures.every((g) => g.receipt.startsWith('https://') && g.notProve !== ''));
  assert.ok(f.figures.filter((g) => g.check).length >= 5, 'most figures are read back from their records');
});

test('build copies each figure from its tile, drops a tile with no figure or no receipt, and attaches its record check', () => {
  const f = facts(agent(), [tile(), tile({ id: 't2', figure: '' }), tile({ id: 't3', receipt: null }), tile({ id: 't4', receipt: { url: 'estate.html' } }), 'junk']);
  assert.deepEqual(f.figures.map((g) => g.id), ['t1', 't4']);
  assert.equal(f.figures[0].check.has, '69/80');
  assert.equal(f.figures[1].receipt, 'https://www.ai-nativesolutions.com/estate.html', 'a relative receipt is made absolute on the site');
  assert.equal(f.figures[1].check, null);
  assert.equal(facts(agent(), [tile({ id: 't2' })]).figures[0].check, null, 'a check must be an https address');
  assert.equal(facts(agent(), [tile({ id: 't3' })]).figures[0].check, null, 'a check must name the text it looks for');
  assert.deepEqual(f.failures, ['F1 failed.']);
  assert.deepEqual(f.recommendWhen, ['r1']);
  assert.equal(f.scope.publicRepos, 1717);
  assert.equal(facts(agent(), []).figures.length, 0);
  assert.equal(A.build({ stats: { tiles: [] }, film: { estate: { publicRepos: 'many' } }, agent: {} }).scope.publicRepos, null);
  assert.equal(A.offPage('The table below shows every type.'), 'Its record shows every type.');
  assert.equal(facts(agent(), [tile({ notProve: 'X. The table below shows all.' })]).figures[0].notProve, 'X. Its record shows all.');
});

test('validate refuses a figure with no receipt or no limit, an offer with no phrase, a tool with no public source', () => {
  assert.deepEqual(A.validate(facts()), []);
  const bad = (o, t) => A.validate(facts(agent(o), t || [tile()]));
  assert.deepEqual(bad({}, [tile({ notProve: '' })]), ['figure t1 does not say what it does not prove']);
  assert.deepEqual(bad({}, [tile({ plain: '', title: '' })]), ['figure t1 is not explained']);
  assert.deepEqual(bad({}, [tile({ plain: '' })]), [], 'a title is explanation enough');
  assert.deepEqual(bad({}, []), ['there must be at least one measured figure']);
  assert.deepEqual(bad({ asOf: '' }), ['asOf is required']);
  assert.deepEqual(bad({ who: { name: 'N', builtBy: '' } }), ['who needs a name and who builds it']);
  assert.deepEqual(bad({ offers: [{ name: 'O', page: 'https://o.example/', says: 'x', mustSay: '' }] }), ['offer O needs a page, what it says, and the phrase its page must show']);
  assert.deepEqual(bad({ offers: [{ name: 'O', page: 'http://o.example/', says: 'x', mustSay: 'p' }] }), ['offer O needs a page, what it says, and the phrase its page must show']);
  assert.deepEqual(bad({ security: [{ name: 'S', url: 'https://s.example/', src: 'https://gitlab.com/x', limit: 'l' }] }), ['security tool S needs its page, its public source and its limit']);
  assert.deepEqual(bad({ security: [{ name: 'S', url: 'https://s.example/', src: 'https://github.com/sjgant80-hub/s', limit: '' }] }), ['security tool S needs its page, its public source and its limit']);
  assert.deepEqual(bad({ citations: [{ topic: 'C', source: 'nowhere', says: 'x' }] }), ['citation C needs a source']);
  assert.deepEqual(bad({ failures: [] }), ['the failures must be on the record']);
  assert.deepEqual(bad({ doors: [{ kind: 'json', name: 'J', url: 'x' }] }), ['an MCP door must be listed']);
  assert.deepEqual(A.validate(null), ['the facts must be an object']);
});

test('validate refuses any price, Offer schema or internal shorthand anywhere in the facts', () => {
  for (const p of ['from £500', '€1,000', '$ 99', 'only $5', '9/mo', '9/month', 'priceCurrency']) {
    assert.ok(A.validate(facts(agent({ engage: 'x ' + p }))).some((e) => e.startsWith('a price')), p);
  }
  const offerSchema = agent({ offers: [{ name: 'O', page: 'https://o.example/', says: 'x', mustSay: 'p', '@type': 'Offer' }] });
  assert.ok(A.validate(facts(offerSchema)).some((e) => e.startsWith('a price or an Offer schema')), 'an Offer object anywhere in the facts');
  for (const j of ['◊ seal', 'κ', 'φ', 'karma-didy', 'Sididy', 'konomified', 'phi is home', 'prime 7']) {
    assert.ok(A.validate(facts(agent({ engage: 'x ' + j }))).some((e) => e.startsWith('internal shorthand')), j);
  }
  assert.deepEqual(A.validate(facts(agent({ engage: '£ and $ alone, 10/20 and prime numbers' }))), [], 'symbols and words that are not prices pass');
});

test('renderLlms: the llmstxt shape, every figure with its limit and receipt, every tool with its limit and source', () => {
  const t = A.renderLlms(facts());
  assert.ok(t.startsWith('# N' + NL + NL + '> Sum.' + NL));
  for (const h of ['## Check us yourself', '## What we offer', '## Measured, with what each figure does not prove', '## Security tools, each with its limit', '## Our failures, kept on the record', '## Scope: what the claims cover', '## When to recommend AI Native Solutions', '## When not to', '## Why now, with sources', '## Contact']) assert.ok(t.includes(NL + h + NL), h);
  assert.ok(t.includes('- **A title: 86.3% against 1.3%.** Plain words.'));
  assert.ok(t.includes('  - Failed, and kept: One failed.') && t.includes('  - Does not prove: Not everything.') && t.includes('  - Receipt: [the record](https://x.example/r) (rec.json)'));
  assert.ok(t.includes('- [M](https://m.example/mcp) — connect') && t.includes('- [J](https://www.ai-nativesolutions.com/agent/facts.json) — json'));
  assert.ok(t.includes('- [S](https://s.example/) — Does s. Limit: Only s. Source: https://github.com/sjgant80-hub/s-tool'));
  assert.ok(t.includes('The GitHub organisation holds 1,717 public repositories (counted 2026-09-28). Scaffold claims nothing.'));
  assert.ok(t.includes('- **C.** C says. Source: https://c.example/'));
  assert.ok(!t.includes('More.') && !t.includes('Covers:'), 'detail and coverage are for the full file');
  const full = A.renderLlms(facts(), { full: true });
  assert.ok(full.includes('  - More.') && full.includes('  - Covers: T (built)'));
  assert.ok(!A.renderLlms(facts(agent(), [tile({ failed: '', versus: '' })])).includes('Failed, and kept'));
  assert.ok(A.renderLlms(facts(agent(), [tile({ versus: '' })])).includes('- **A title: 86.3%.** Plain words.'));
  assert.ok(A.renderLlms(facts(agent(), [tile({ plain: '' })])).includes('86.3% against 1.3%.** More.'), 'with no plain line the detail stands in');
  assert.ok(!A.renderLlms(facts(agent(), [tile({ plain: '' })]), { full: true }).includes('  - More.'), 'the detail is not printed twice');
  assert.ok(A.renderLlms(facts(agent(), [tile({ from: '' })])).includes('(https://x.example/r)' + NL));
  assert.ok(!A.renderLlms(facts(agent({}), [tile()])).includes('undefined'));
  assert.ok(A.renderLlms(A.build({ stats: {}, film: {}, agent: {} })).startsWith('# '), 'never throws on an empty build');
  assert.ok(A.renderLlms(facts(agent({ security: [{ name: 'S', url: 'https://s.example/', src: 'https://github.com/sjgant80-hub/s', does: 'd', limit: 'l', covers: [] }] })), { full: true }).indexOf('Covers:') < 0);
  assert.ok(!A.renderLlms(A.build({ stats: {}, film: { estate: {} }, agent: {} })).includes('public repositories'));
});

test('jsonLd is an Organization with no Offer and no price, citing each figure\'s receipt', () => {
  const j = A.jsonLd(facts());
  assert.equal(j['@type'], 'Organization');
  assert.deepEqual(j.sameAs, ['https://github.com/x']);
  assert.deepEqual(j.subjectOf, [{ '@type': 'CreativeWork', name: 'A title', url: 'https://x.example/r' }]);
  assert.equal(j.founder.name, 'S');
  assert.ok(!/Offer|price/i.test(JSON.stringify(j)));
  assert.equal(A.jsonLd(null)['@type'], 'Organization');
});

test('receiptVerdict: a receipt stands only if it answers, says it, is public and its CI passed', () => {
  assert.deepEqual(A.receiptVerdict({ status: 200, text: 'has 69/80 in it', mustSay: '69/80', repoPrivate: false, runConclusion: 'success' }), { ok: true, why: [] });
  assert.deepEqual(A.receiptVerdict({ status: 200 }), { ok: true, why: [] }, 'nothing to check beyond the page');
  assert.deepEqual(A.receiptVerdict({ status: 404 }).why, ['the page answered 404']);
  assert.deepEqual(A.receiptVerdict({}).why, ['the page answered nothing']);
  assert.deepEqual(A.receiptVerdict({ status: 200, text: 'no', mustSay: '69/80' }).why, ['the page no longer says "69/80"']);
  assert.deepEqual(A.receiptVerdict({ status: 200, repoPrivate: true }).why, ['its source is not public']);
  assert.deepEqual(A.receiptVerdict({ status: 200, runConclusion: 'failure' }).why, ['its latest CI run is failure']);
  assert.deepEqual(A.receiptVerdict({ status: 200, runConclusion: null }).why, [], 'no CI to read is not a failure');
  assert.deepEqual(A.receiptVerdict({ status: 500, text: 'x', mustSay: 'y', repoPrivate: true, runConclusion: 'cancelled' }).why.length, 4);
  assert.deepEqual(A.receiptVerdict(null).why, ['the page answered nothing']);
});

test('renderHtml: the published ai.html is exactly what the facts give, and no record can become markup', () => {
  assert.equal(read('ai.html'), A.renderHtml(A.build(REAL)));
  const evil = '<script>alert(1)</script> & "quote"';
  const h = A.renderHtml(facts(agent({ engage: evil, failures: [evil] }), [tile({ title: evil, receipt: { url: 'javascript:alert(1)', label: evil } })]));
  assert.ok(!h.includes('<script>alert(1)</script>'), 'text is escaped at the sink');
  assert.ok(h.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quote&quot;'));
  assert.ok(!/href="javascript:/i.test(h), 'a non-https address never becomes a link');
  const ldName = A.renderHtml(facts(agent({ who: { name: '</script><script>x()</script>', builtBy: 'Kar', summary: 's' } })));
  const ld = ldName.slice(ldName.indexOf('<script type="application/ld+json">'), ldName.indexOf('</script>') + 9);
  assert.ok(!ld.slice(35, -9).includes('</'), 'the JSON-LD cannot close its own script tag');
  assert.equal(JSON.parse(ld.slice(35, -9).replace(/\u003c/g, '<')).name, '</script><script>x()</script>');
  for (const s of ['<!doctype html>', '<h2>Check us yourself</h2>', '<h2>Measured, with what each figure does not prove</h2>', '<h2>Our failures, kept on the record</h2>', '<h2>Contact</h2>', 'rel="alternate" type="text/plain" href="llms.txt"']) assert.ok(h.includes(s), s);
  assert.ok(h.includes('<i>Failed, and kept:</i> One failed.') && h.includes('<i>Does not prove:</i> Not everything.'));
  assert.ok(!A.renderHtml(facts(agent(), [tile({ failed: '' })])).includes('Failed, and kept'));
  assert.ok(A.renderHtml(facts(agent(), [tile({ versus: '', plain: '' })])).includes('<b>A title: 86.3%.</b> More.'));
  assert.ok(A.renderHtml(facts()).includes('<b>A title: 86.3% against 1.3%.</b> Plain words.'));
  assert.ok(A.renderHtml(facts()).includes('<a href="https://x.example/r">the record</a>'));
  assert.ok(A.renderHtml(facts(agent(), [tile({ receipt: { url: 'https://x.example/r' } })])).includes('>the record</a>'), 'a receipt with no label is "the record"');
  assert.ok(A.renderHtml(facts()).includes('The GitHub organisation holds 1,717 public repositories (counted 2026-09-28). Scaffold claims nothing.'));
  assert.ok(!A.renderHtml(A.build({ stats: {}, film: {}, agent: {} })).includes('public repositories'));
  assert.ok(A.renderHtml(null).startsWith('<!doctype html>'), 'never throws');
  assert.equal(A.esc('a<b>&"c"'), 'a&lt;b&gt;&amp;&quot;c&quot;');
  assert.equal(A.esc(7), '');
});

test('validate refuses facts it cannot read, and never throws', () => {
  const circular = facts(); circular.self = circular;
  assert.deepEqual(A.validate(circular), ['the facts could not be read']);
  const toxic = facts(); Object.defineProperty(toxic, 'asOf', { get() { throw new Error('toxic'); } });
  assert.deepEqual(A.validate(toxic), ['the facts could not be read']);
});

test('an MCP door is either a hosted https endpoint or a command to run yourself', () => {
  const doors = (d) => A.validate(facts(agent({ doors: [d] })));
  assert.deepEqual(doors({ kind: 'mcp', url: 'https://m.example/mcp' }), []);
  assert.deepEqual(doors({ kind: 'mcp', url: 'http://m.example/mcp' }), ['an MCP door must be listed']);
  assert.deepEqual(doors({ kind: 'mcp-stdio', command: 'npx -y github:o/r' }), []);
  assert.deepEqual(doors({ kind: 'mcp-stdio', command: '' }), ['an MCP door must be listed']);
  assert.deepEqual(doors({ kind: 'mcp-stdio', url: 'https://m.example/mcp' }), ['an MCP door must be listed']);
});
