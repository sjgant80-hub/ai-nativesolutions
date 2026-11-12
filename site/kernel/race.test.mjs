import test from 'node:test';
import assert from 'node:assert/strict';
import R, { LANES, CAP, plan, ratio, placing, sentence, ordinal, speedLine, table, bytes } from './race.mjs';

test('plan: a file is read whole up to the cap, and the cut is said', () => {
  assert.equal(CAP, 1048576);
  assert.deepEqual(plan(0), { bytes: 0, cut: false }); assert.deepEqual(plan(500), { bytes: 500, cut: false });
  assert.deepEqual(plan(CAP), { bytes: CAP, cut: false }); assert.deepEqual(plan(CAP + 1), { bytes: CAP, cut: true });
  for (const junk of [-1, 1.5, NaN, '9', null]) assert.deepEqual(plan(junk), { bytes: 0, cut: false });
});

test('ratio: to three places, and 0 for anything that is not two positive whole numbers', () => {
  assert.equal(ratio(20209, 1363), 14.827); assert.equal(ratio(1000, 3), 333.333); assert.equal(ratio(10, 10), 1); assert.equal(ratio(1, 3), 0.333);
  for (const [a, b] of [[0, 5], [5, 0], [-1, 5], [5, -1], [1.5, 2], [2, 1.5], ['10', 2], [10, null]]) assert.equal(ratio(a, b), 0);
});

const RES = [{ id: 'light', bytes: 300, ms: 900, identical: true }, { id: 'brotli', bytes: 320, ms: 100, identical: true }, { id: 'zstd', bytes: 340, ms: 20, identical: true }, { id: 'gzip', bytes: 400, ms: 2, identical: true }];

test('placing: smallest first, ties share a place, a lane that did not round-trip is out', () => {
  const p = placing(1200, RES);
  assert.deepEqual(p.lanes.map((l) => [l.id, l.place, l.ratio]), [['light', 1, 4], ['brotli', 2, 3.75], ['zstd', 3, 3.529], ['gzip', 4, 3]]);
  assert.deepEqual(p.dropped, []);
  const tie = placing(1200, [{ id: 'zstd', bytes: 300, identical: true }, { id: 'light', bytes: 300, identical: true }, { id: 'gzip', bytes: 400, identical: true }]);
  assert.deepEqual(tie.lanes.map((l) => [l.id, l.place]), [['light', 1], ['zstd', 1], ['gzip', 3]]);       // a tie shares first; the next is third
  const out = placing(1200, [{ id: 'light', bytes: 100, identical: false }, { id: 'gzip', bytes: 400, identical: true }, { id: 'x', bytes: 5, identical: 'true' }]);
  assert.deepEqual(out.lanes.map((l) => l.id), ['gzip']); assert.deepEqual(out.dropped, ['light', 'x']);  // only a real true counts as identical
  assert.equal(placing(1200, [{ id: 'a', bytes: 10, identical: true, ms: -5 }]).lanes[0].ms, 0);
  assert.equal(placing(1200, [{ id: 'a', bytes: 10, identical: true, ms: 7 }]).lanes[0].ms, 7);
  for (const junk of [null, 'x', [null, 5, { id: '', bytes: 5 }, { id: 'a', bytes: 0, identical: true }, { id: 'a', bytes: -3 }, { id: 'a', bytes: 1.5 }]]) assert.deepEqual(placing(1200, junk), { lanes: [], dropped: [] });
});

test('sentence: it names the winner, whoever that is', () => {
  assert.equal(sentence(1200, RES), 'LIGHT (cold) won on this file: 4 times smaller, 6.7% ahead of Brotli 11.');
  const lose = [{ id: 'light', bytes: 330, ms: 9, identical: true }, { id: 'brotli', bytes: 300, ms: 1, identical: true }, { id: 'gzip', bytes: 400, ms: 1, identical: true }];
  assert.equal(sentence(1200, lose), 'LIGHT (cold) lost on this file. Brotli 11 won at 4 times smaller; LIGHT (cold) came 2nd at 3.636 times, 10% behind.');
  const last = [{ id: 'light', bytes: 500, identical: true }, { id: 'brotli', bytes: 300, identical: true }, { id: 'zstd', bytes: 310, identical: true }, { id: 'gzip', bytes: 400, identical: true }];
  assert.match(sentence(1200, last), /came 4th at 2\.4 times, 66\.7% behind\.$/);
  assert.equal(sentence(1200, [{ id: 'light', bytes: 300, identical: true }, { id: 'zstd', bytes: 300, identical: true }]), 'LIGHT (cold) tied for first with Zstandard 19 at 4 times smaller.');
  assert.equal(sentence(1200, [{ id: 'light', bytes: 300, identical: true }]), 'LIGHT (cold) made your 1,200 bytes 4 times smaller. No other lane finished.');
  assert.match(sentence(1200, [{ id: 'light', bytes: 300, identical: false }, { id: 'gzip', bytes: 400, identical: true }]), /^LIGHT \(cold\) did not give your bytes back exactly, so it is disqualified/);
  assert.equal(sentence(1200, [{ id: 'gzip', bytes: 400, identical: true }]), 'No result for LIGHT (cold) yet.');
  assert.equal(sentence(1200, RES, 'gzip'), 'gzip lost on this file. LIGHT (cold) won at 4 times smaller; gzip came 4th at 3 times, 33.3% behind.');
  assert.equal(sentence(1200, RES, 'mystery'), 'No result for mystery yet.');
  assert.deepEqual([1, 2, 3, 4, 11].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th']);
  for (const junk of ['x', null, 2.5, { toString() { throw new Error('toxic'); } }]) assert.equal(ordinal(junk), '');
});

test('speedLine: the truth about time', () => {
  assert.equal(speedLine(RES), 'LIGHT (cold) is the slow one: 900 ms against 2 ms for gzip (about 450 times slower). It trades time for size.');
  assert.equal(speedLine([{ id: 'light', ms: 5 }, { id: 'gzip', ms: 5 }]), 'LIGHT (cold) was also the fastest here.');
  assert.equal(speedLine([{ id: 'light', ms: 3 }, { id: 'gzip', ms: 5 }, { id: 'zstd', ms: 9 }]), 'LIGHT (cold) was also the fastest here.');
  assert.equal(speedLine([{ id: 'light', ms: 9 }, { id: 'gzip', ms: 6 }]), 'LIGHT (cold) is the slow one: 9 ms against 6 ms for gzip (about 2 times slower). It trades time for size.');
  assert.equal(speedLine([{ id: 'light', ms: 7 }, { id: 'gzip', ms: 6 }]), 'LIGHT (cold) is the slow one: 7 ms against 6 ms for gzip. It trades time for size.');
  assert.equal(speedLine([{ id: 'light', ms: 7 }, { id: 'gzip', ms: 0 }]), 'LIGHT (cold) is the slow one: 7 ms against 0 ms for gzip. It trades time for size.');
  assert.equal(speedLine([{ id: 'light', ms: 7 }, { id: 'zstd', ms: 3 }, { id: 'gzip', ms: 4 }]).includes('Zstandard 19'), true);   // the FASTEST other lane is the one named
  assert.match(speedLine([{ id: 'light', ms: 9 }, { id: 'gzip', ms: 5 }, { id: 'zstd', ms: 5 }]), /against 5 ms for gzip /);   // two equally fast: the first is named
  for (const junk of [null, [], [{ id: 'light', ms: 5 }], [{ id: 'gzip', ms: 5 }], [{ id: 'light', ms: -1 }, { id: 'gzip', ms: 5 }], [{ id: 'light', ms: 'x' }, { id: 'gzip', ms: 5 }]]) assert.equal(speedLine(junk), '');
});

test('table: the sealed record, losses included', () => {
  const record = { types: [
    { key: 'callbook', label: 'call book', items: 8, raw: 20209, ladder: { 15: { frame: 9258 }, 31: { frame: 1363 } }, baselines: { gzip9: 10284, brotli11: 8453, zstd19: 10373, zstdSeed: 2042 } },
    { key: 'memory', label: 'memory journal', items: 25, raw: 250608, ladder: { 15: { frame: 96231 }, 31: { frame: 69326 } }, baselines: { gzip9: 117025, brotli11: 99167, zstd19: 113328, zstdSeed: 82453 } },
    { key: 'z', label: 'zstd best', items: 1, raw: 1000, ladder: { 15: { frame: 500 }, 31: { frame: 400 } }, baselines: { gzip9: 600, brotli11: 550, zstd19: 500, zstdSeed: 300 } },
    { key: 'g', label: 'gzip best', items: 1, raw: 1000, ladder: { 15: { frame: 501 }, 31: { frame: 300 } }, baselines: { gzip9: 480, brotli11: 550, zstd19: 500, zstdSeed: 300 } },
    { key: 'broken', raw: 1000, ladder: { 15: { frame: 0 }, 31: { frame: 5 } }, baselines: { gzip9: 1, brotli11: 1, zstd19: 1, zstdSeed: 1 } },
    { key: 'noraw', raw: 0, ladder: { 15: { frame: 5 }, 31: { frame: 5 } }, baselines: { gzip9: 1, brotli11: 1, zstd19: 1, zstdSeed: 1 } },
    null, { key: 'nolad', raw: 10, baselines: {} }, { key: 'nobase', raw: 10, ladder: {} },
  ] };
  const t = table(record);
  assert.deepEqual(t.map((r) => r.key), ['callbook', 'memory', 'z', 'g']);
  assert.deepEqual(t[0], { key: 'callbook', label: 'call book', items: 8, raw: 20209, cold: { light: 2.183, best: 2.391, who: 'Brotli 11', lightWins: false }, seeded: { light: 14.827, zstd: 9.897, lightWins: true } });
  assert.equal(t[1].cold.lightWins, true); assert.equal(t[1].cold.who, 'Brotli 11');
  assert.equal(t[2].cold.who, 'Zstandard 19'); assert.equal(t[2].cold.lightWins, false);   // a tie with the best baseline is not a win
  assert.equal(t[3].cold.who, 'gzip 9'); assert.equal(t[3].seeded.lightWins, false);       // …and a tie with the seeded baseline is not one either
  for (const junk of [null, {}, { types: 'x' }]) assert.deepEqual(table(junk), []);
});

test('bytes: plain sizes; lanes named; default export carries every name', () => {
  assert.equal(bytes(0), '0 bytes'); assert.equal(bytes(9999), '9,999 bytes'); assert.equal(bytes(10000), '9.8 KB'); assert.equal(bytes(1048575), '1,024 KB'); assert.equal(bytes(1048576), '1 MB'); assert.equal(bytes(299458978), '285.59 MB');
  for (const junk of [-1, 1.5, NaN, '5', null]) assert.equal(bytes(junk), '');
  assert.deepEqual(LANES.map((l) => l.id), ['light', 'brotli', 'zstd', 'gzip']);
  assert.deepEqual(Object.keys(R).sort(), ['CAP', 'LANES', 'bytes', 'ordinal', 'placing', 'plan', 'ratio', 'sentence', 'speedLine', 'table']);
});
