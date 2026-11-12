import test from 'node:test';
import assert from 'node:assert/strict';
import N, { classify, createLedger, verdict, HOSTS } from './netwatch.mjs';

const ME = 'https://www.ai-nativesolutions.com';

test('classify: this site, the three expected hosts, in-memory addresses, and everything else named as unknown', () => {
  assert.deepEqual(classify(ME + '/site/app.mjs', ME), { origin: ME, host: 'www.ai-nativesolutions.com', party: 'first', kind: 'this-site', say: "this site's own files" });
  assert.equal(classify('site/app.mjs', ME).party, 'first');                               // a relative address is this site's
  assert.equal(classify('https://cdn.jsdelivr.net/npm/x', ME).kind, 'model-runtime');
  assert.equal(classify('https://huggingface.co/mlc-ai/x', ME).kind, 'model-weights');
  assert.equal(classify('https://cdn-lfs.huggingface.co/x', ME).kind, 'model-weights');
  assert.equal(classify('https://cas-bridge.xethub.hf.co/x', ME).kind, 'model-weights');
  assert.equal(classify('https://raw.githubusercontent.com/mlc-ai/x.wasm', ME).kind, 'model-runtime');
  for (const u of ['https://evil.example/collect', 'https://nothuggingface.co/x', 'https://huggingface.co.evil.example/x', 'https://xhf.co/x', 'https://cdn.jsdelivr.net.evil.example/x', 'https://raw.githubusercontent.com.x.io/y', 'http://www.ai-nativesolutions.com/x', 'https://ai-nativesolutions.com/x']) {
    const c = classify(u, ME); assert.equal(c.kind, 'unknown', u); assert.equal(c.party, 'third', u);
  }
  assert.equal(classify('data:text/plain,hi', ME).party, 'local'); assert.equal(classify('blob:' + ME + '/abc', ME).kind, 'in-memory');
  for (const bad of [null, undefined, 5, '', 'http://[bad']) assert.equal(classify(bad, '').kind, 'unreadable', String(bad));
  assert.equal(classify('https://x.example/a', '').party, 'third');                         // no page origin: nothing is first-party
  assert.equal(HOSTS.length, 3);
});

test('ledger: entries in order, bytes cleaned, a body is a body', () => {
  const L = createLedger(ME);
  const a = L.add({ url: ME + '/', bytesDown: 1000.9, at: 5 });
  assert.deepEqual(a, { n: 1, url: ME + '/', host: 'www.ai-nativesolutions.com', party: 'first', kind: 'this-site', say: "this site's own files", bytesDown: 1000, body: false, method: 'GET', source: 'page', at: 5 });
  const b = L.add({ url: 'https://huggingface.co/w', bytesDown: -4, method: 'get', source: 'model worker' });
  assert.equal(b.n, 2); assert.equal(b.bytesDown, 0); assert.equal(b.method, 'GET'); assert.equal(b.source, 'model worker'); assert.equal(b.at, 0);
  assert.equal(L.add({ url: 'https://evil.example/c', body: true, method: 'post', bytesDown: NaN }).body, true);
  assert.equal(L.add({ url: 'https://x.example/', body: 'yes' }).body, false);            // only a real true counts as a body
  for (const junk of [null, 5, {}, { url: '' }, { url: 7 }, { url: 'http://[bad' }]) assert.equal(L.add(junk), null);
  assert.equal(L.entries().length, 4);
  L.entries().push('x'); assert.equal(L.entries().length, 4);                             // the list handed out is a copy
});

test('summary: grouped by host, this site first, in-memory rows left out; totals from the entries alone', () => {
  const L = createLedger(ME);
  L.add({ url: 'https://huggingface.co/a', bytesDown: 50 }); L.add({ url: 'https://huggingface.co/b', bytesDown: 70 });
  L.add({ url: ME + '/x', bytesDown: 10 }); L.add({ url: 'blob:' + ME + '/1', bytesDown: 999 }); L.add({ url: 'https://cdn.jsdelivr.net/l', bytesDown: 5 });
  const s = L.summary();
  assert.equal(s.total, 4); assert.equal(s.withBody, 0); assert.equal(s.unknown, 0); assert.equal(s.bytesDown, 135);
  assert.deepEqual(s.hosts.map((h) => [h.host, h.requests, h.bytesDown, h.party]), [['www.ai-nativesolutions.com', 1, 10, 'first'], ['huggingface.co', 2, 120, 'third'], ['cdn.jsdelivr.net', 1, 5, 'third']]);
  L.add({ url: 'https://evil.example/c', body: true, method: 'POST' });
  const t = L.summary();
  assert.equal(t.total, 5); assert.equal(t.withBody, 1); assert.equal(t.unknown, 1);
  assert.deepEqual(createLedger(ME).summary(), { total: 0, withBody: 0, unknown: 0, bytesDown: 0, hosts: [] });
});

test('between: what happened after one mark and up to another', () => {
  const L = createLedger(ME);
  L.add({ url: ME + '/a' });
  assert.equal(L.mark('start', 10), 1);
  assert.deepEqual(L.between('start'), { requests: 0, withBody: 0, thirdParty: 0, unknown: 0, rows: [] });
  L.add({ url: 'https://huggingface.co/w' }); L.add({ url: 'https://evil.example/c', body: true }); L.add({ url: 'data:,x' });
  L.add({ url: 'https://cdn.jsdelivr.net/l' }); L.add({ url: ME + '/b' });
  L.mark('end');
  L.add({ url: ME + '/late' });
  const mid = L.between('start', 'end');
  // four real requests (the in-memory one is left out): three to other hosts, one of those to a host nobody expected, one carrying a body
  assert.equal(mid.requests, 4); assert.equal(mid.withBody, 1); assert.equal(mid.thirdParty, 3); assert.equal(mid.unknown, 1); assert.deepEqual(mid.rows.map((r) => r.n), [2, 3, 5, 6]);
  assert.equal(L.between('start').requests, 5);                                           // no second mark: until now
  assert.equal(L.between('nope'), null); assert.equal(L.between('start', 'nope'), null); assert.equal(L.between('end', 'start'), null);
  assert.equal(L.between('end', 'end').requests, 0);
  L.mark('start'); assert.equal(L.between('start').requests, 0);                          // marking again moves the mark
});

test('verdict: one honest line, worst news first', () => {
  assert.equal(verdict({ total: 12, withBody: 0, unknown: 0 }), 'Every request so far was a download. None carried anything up: 0 of 12.');
  assert.match(verdict({ total: 12, withBody: 1, unknown: 0 }), /^1 request carried data up\. .*a fault/);
  assert.match(verdict({ total: 12, withBody: 2, unknown: 0 }), /^2 requests carried data up/);
  assert.match(verdict({ total: 12, withBody: 0, unknown: 1 }), /^This page contacted 1 address it does not expect/);
  assert.match(verdict({ total: 12, withBody: 3, unknown: 2 }), /^This page contacted 2 addresses it does not expect/);   // an unknown host outranks everything
  for (const junk of [null, {}, { total: 1.5 }, 'x']) assert.equal(verdict(junk), 'The ledger has nothing to report yet.');
  assert.deepEqual(Object.keys(N).sort(), ['HOSTS', 'classify', 'createLedger', 'verdict']);
});
