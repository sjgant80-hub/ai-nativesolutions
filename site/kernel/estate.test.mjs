import test from 'node:test';
import assert from 'node:assert/strict';
import E, { FAMILIES, FAMILY_IDS, LAYOUT, WORLD, GOLDEN, familyOf, shape, mulberry32, seedPositions, script, castOf, pick, counts } from './estate.mjs';

const PIN42 = [601104,448291,852466];
const est = (names) => ({ nodes: names.map((name) => ({ name, desc: '', url: name.endsWith('x') ? '' : 'u' })) });

test('familyOf: the first matching family, by name; everything else is open water', () => {
  assert.deepEqual(FAMILY_IDS, ['kar', 'konomi', 'mind', 'seed', 'guild', 'fall', 'open']);
  const is = (n, id) => assert.equal(FAMILY_IDS[familyOf(n)], id, n);
  is('kar-hub', 'kar'); is('KAR-Veil', 'kar'); is('konomi-tongue', 'konomi'); is('konomium-vault', 'konomi');
  is('si-didy-loop', 'mind'); is('sididy-run', 'mind'); is('fallseed-law', 'seed'); is('seed-library', 'seed'); is('living-seed', 'seed'); is('fall-spore', 'seed');
  is('kcc-bridge', 'guild'); is('acg-mapper', 'guild'); is('fallhr', 'fall'); is('fall-kit', 'fall'); is('liveware', 'open'); is('karma', 'open'); is('skar-x', 'open');
  for (const junk of [null, undefined, 5, {}, '']) assert.equal(familyOf(junk), FAMILIES.length - 1);
  assert.equal(LAYOUT.length, FAMILIES.length);
});

test('shape: organs first in the order given, then the rest by name; only real organs; each link once', () => {
  const s = shape(est(['zeta', 'kar-hub', 'witness', 'alpha', 'slm-suite', 'beta']), [
    { id: 'kar-hub', char: 'heart', links: ['witness', 'ghost', 'alpha'] }, { id: 'witness', char: 'gate', links: ['slm-suite', 'kar-hub'] },
    { id: 'not-in-estate', char: 'organ', links: [] }, { id: 'slm-suite', char: 'nonsense', links: ['witness'] }, { id: 'witness', char: 'gate', links: [] }]);
  assert.deepEqual(s.nodes.map((n) => n.name), ['kar-hub', 'witness', 'slm-suite', 'alpha', 'beta', 'zeta']);
  assert.equal(s.organCount, 3); assert.equal(s.heart, 0);
  assert.deepEqual(s.nodes.map((n) => n.organ), [true, true, true, false, false, false]);
  assert.deepEqual(s.nodes.map((n) => n.char), ['heart', 'gate', 'organ', 'organ', 'organ', 'organ']);
  // kar-hub→witness (once, though named from both ends), witness→slm-suite (once), heart→slm-suite; never to a non-organ, never to a ghost
  assert.deepEqual(s.links, [[0, 1], [1, 2], [0, 2]]);
  assert.equal(s.nodes[0].fam, 0);
});

test('shape: no heart means no heart links; junk gives an empty, well-formed shape', () => {
  const s = shape(est(['a', 'b']), [{ id: 'a', char: 'gate', links: ['b'] }, { id: 'b', char: 'organ', links: [] }]);
  assert.equal(s.heart, -1); assert.deepEqual(s.links, [[0, 1]]);
  for (const junk of [null, 5, {}, { nodes: 'x' }, { nodes: [null, 5, { name: '' }, { name: 7 }] }]) {
    const z = shape(junk, [{ id: 'a' }]);
    assert.deepEqual(z, { nodes: [], links: [], organCount: 0, heart: -1 });
  }
  assert.deepEqual(shape(est(['a']), 'x').nodes.map((n) => n.name), ['a']);
  assert.deepEqual(shape(est(['a', 'a']), null).nodes.length, 1);                       // a name is one cell
  assert.deepEqual(shape(est(['a']), [{ id: 'a', char: 'heart', links: ['a'] }]).links, []);   // never a link to itself
  assert.deepEqual(shape(est(['a']), [{ id: 'a', char: 'heart', links: 'b' }]).links, []);
});

test('mulberry32: one seed, one stream, the same on every engine', () => {
  const r = mulberry32(1618), got = [r(), r(), r()], again = mulberry32(1618);
  assert.deepEqual(got, [again(), again(), again()]);
  assert.ok(got.every((x) => x >= 0 && x < 1));
  assert.equal(new Set(got).size, 3);
  assert.notEqual(mulberry32(1)(), mulberry32(2)());
  for (const junk of ['x', null, undefined, NaN, Infinity, {}, 7n]) assert.equal(mulberry32(junk)(), mulberry32(0)(), String(junk));   // not a number: seeded as 0, never a throw
  const q = mulberry32(42);
  assert.deepEqual([q(), q(), q()].map((x) => Math.round(x * 1e6)), PIN42);              // pinned: a changed generator moves every cell
});

test('seedPositions: the heart at the centre, organs on a spiral, families in their places, depth in range', () => {
  const nodes = [{ fam: 0, char: 'heart' }, { fam: 0, char: 'gate' }, { fam: 0, char: 'organ' }, { fam: 5 }, { fam: 5 }, { fam: 1 }, { fam: 6 }, { fam: 99 }, null];
  const p = seedPositions(nodes, 3);
  assert.equal(p.length, nodes.length * 4);
  assert.equal(p[0], 0); assert.equal(p[1], 0);                                          // the heart
  const r1 = Math.hypot(p[4], p[5]), want1 = WORLD.organRing * Math.sqrt(2 / 4) + 40;
  assert.ok(Math.abs(r1 - want1) < 1e-3, 'organ 1 radius ' + r1);
  assert.ok(Math.abs(Math.atan2(p[5], p[4]) - GOLDEN) < 1e-5);
  // a ring family: the first build of 'fall' sits at the ring's radius less three steps, at angle 0
  assert.ok(Math.abs(p[12] - (LAYOUT[5].r - 3 * WORLD.spread)) < 1e-3); assert.ok(Math.abs(p[13]) < 1e-3);
  assert.ok(Math.abs(Math.hypot(p[16], p[17]) - (LAYOUT[5].r - 2 * WORLD.spread)) < 1e-3);
  // a blob family: first build one step out from the blob's point
  assert.ok(Math.abs(p[20] - (LAYOUT[1].x + WORLD.spread)) < 1e-3); assert.ok(Math.abs(p[21] - LAYOUT[1].y) < 1e-3);
  // an unknown family, or a hole in the list, is open water
  assert.ok(Math.abs(Math.hypot(p[28], p[29]) - (LAYOUT[6].r - 2 * WORLD.spread)) < 1e-3);
  assert.ok(Math.abs(Math.hypot(p[32], p[33]) - (LAYOUT[6].r - 1 * WORLD.spread)) < 1e-3);
  for (let i = 0; i < nodes.length; i++) { assert.ok(p[i * 4 + 2] >= 0 && p[i * 4 + 2] < 1); assert.equal(p[i * 4 + 3], 0); }
  for (let i = 0; i < 3; i++) assert.ok(p[i * 4 + 2] >= 0.1 && p[i * 4 + 2] < 0.3, 'organs sit near the front');
  assert.deepEqual([...seedPositions(nodes, 3)], [...p]);                                // deterministic
  assert.equal(seedPositions(null, 3).length, 0);
  assert.equal(seedPositions([{ fam: 5 }], 9)[0], 40 + WORLD.organRing * Math.sqrt(1 / 2) > 0 ? seedPositions([{ fam: 5 }], 9)[0] : 0);
  assert.ok(Math.abs(seedPositions([{ fam: 5 }], -1)[0] - (LAYOUT[5].r - 3 * WORLD.spread)) < 1e-3);   // a bad organ count means none
  assert.ok(Math.abs(seedPositions([{ fam: 5 }], 0.5)[0] - (LAYOUT[5].r - 3 * WORLD.spread)) < 1e-3);
});

test('castOf and script: the simulation is a fixed, endless, honest script', () => {
  const s = shape(est(['kar-hub', 'witness', 'break-it', 'pattern-libraries', 'si-didy-loop', 'w1', 'w2', 'w3', 'w4', 'w5', 'zz']), [
    { id: 'kar-hub', char: 'heart' }, { id: 'witness', char: 'gate' }, { id: 'break-it', char: 'immune' }, { id: 'pattern-libraries', char: 'library' }, { id: 'si-didy-loop', char: 'night' },
    { id: 'w1' }, { id: 'w2' }, { id: 'w3' }, { id: 'w4' }, { id: 'w5' }]);
  const c = castOf(s);
  assert.deepEqual(c, { heart: 0, gate: 1, immune: 2, library: 3, night: 4, workers: [5, 6, 7, 8, 9] });
  const b = script(c);
  assert.deepEqual(b.map((x) => x.kind), ['route', 'check', 'keep', 'route', 'check', 'keep', 'route', 'check', 'keep', 'route', 'check', 'refuse', 'learn', 'route', 'check', 'keep', 'night']);
  assert.deepEqual([b[0].from, b[0].to, b[1].from, b[1].to, b[2].from, b[2].to], [0, 5, 5, 1, 1, 3]);
  assert.deepEqual([b[11].from, b[11].to, b[12].from, b[12].to], [1, 2, 2, 0]);                      // the 4th job is refused, and learnt from
  assert.deepEqual([b[16].from, b[16].to], [4, 3]);                                                // the 5th job ends with the night loop
  assert.ok(b.every((x) => typeof x.say === 'string' && x.say.length > 20 && ['work', 'keep', 'refuse', 'learn'].includes(x.tone)));
  assert.equal(b[11].tone, 'refuse'); assert.equal(b[2].tone, 'keep'); assert.equal(b[0].tone, 'work'); assert.equal(b[12].tone, 'learn'); assert.equal(b[16].tone, 'learn');
  // with no library the kept work returns to the heart; with no immune organ nothing is refused; no night without both
  assert.equal(script({ ...c, library: -1 })[2].to, 0);
  assert.ok(script({ ...c, immune: -1 }).every((x) => x.kind !== 'refuse' && x.kind !== 'learn'));
  assert.ok(script({ ...c, night: -1 }).every((x) => x.kind !== 'night'));
  assert.ok(script({ ...c, library: -1 }).every((x) => x.kind !== 'night'));
  for (const junk of [null, {}, { heart: 0 }, { heart: 0, gate: 1 }, { heart: 0, gate: 1, workers: [] }, { heart: -1, gate: 1, workers: [2] }, { heart: 0, gate: 1.5, workers: [2] }, { heart: 0, gate: 1, workers: [-1, 'x'] }]) assert.deepEqual(script(junk), []);
  assert.deepEqual(castOf(null), { heart: -1, gate: -1, immune: -1, library: -1, night: -1, workers: [] });
  assert.deepEqual(castOf({ nodes: [{ char: 'heart' }, { char: 'organ' }, { char: 'organ' }], organCount: 2 }).workers, [1]);   // a cell past the organs is never cast
  assert.equal(castOf({ nodes: [{ char: 'organ' }, { char: 'gate' }], organCount: 1 }).gate, -1);
});

test('pick: the cell under the pointer; an organ within reach beats a nearer ordinary cell', () => {
  const pos = new Float32Array([100, 100, 200, 200, 108, 100, 400, 400]);
  assert.equal(pick(pos, 4, 108, 100, 10, 1), 0);            // the organ (8 away) wins over the cell exactly under the pointer
  assert.equal(pick(pos, 4, 108, 100, 10, 0), 2);            // with no organs, the nearest
  assert.equal(pick(pos, 4, 115, 100, 10, 1), 0);            // an organ reaches half as far again (15)
  assert.equal(pick(pos, 4, 115.1, 100, 10, 1), 2);          // …and no further
  assert.equal(pick(pos, 4, 118, 100, 10, 1), 2);            // exactly at the radius still counts
  assert.equal(pick(pos, 4, 118.1, 100, 10, 1), -1);
  assert.equal(pick(pos, 4, 300, 300, 10, 1), -1);
  assert.equal(pick(pos, 2, 400, 400, 10, 1), -1);           // only the first `count` cells
  assert.equal(pick(pos, 9, 400, 400, 10, 1), 3);            // a count past the data stops at the data
  assert.equal(pick(new Float32Array([0, 0, 9, 5, 5, 9]), 2, 5, 5, 3, 0, 3), 1);   // stride 3
  for (const bad of [[null, 4, 0, 0, 10, 1], [pos, 0, 0, 0, 10, 1], [pos, 1.5, 0, 0, 10, 1], [pos, 4, NaN, 0, 10, 1], [pos, 4, 0, Infinity, 10, 1], [pos, 4, 100, 100, 0, 1], [pos, 4, 100, 100, -1, 1], [pos, 4, 100, 100, 10, 1, 1], [pos, 4, 100, 100, 10, 1, 2.5]]) assert.equal(pick(...bad), -1);
  assert.equal(pick(pos, 4, 100, 100, 10, -3), 0);           // a bad organ count means none: still the nearest
  assert.equal(pick(pos, 4, 100, 100, 10, 'x'), 0);
  assert.equal(pick(pos, 4, 108, 100, 10, 1.5), 2);          // a part-organ count means none either: the cell under the pointer, not the organ beside it
  assert.equal(pick(pos, 1, 100, 100, 10, 0), 0);            // a count of one is a count
  assert.equal(pick(pos, 1.5, 100, 100, 10, 1), -1);         // a count must be whole, even with a cell right under the pointer
  assert.equal(pick(pos, 2, 108, 100, 3, 0), -1);            // the cell just past the count is never found
  assert.equal(pick(pos, 3, 108, 100, 3, 0), 2);
});

test('seedPositions: the family bounds, and every depth drawn in order from the one seeded stream', () => {
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-3, a + ' ≈ ' + b);
  const nodes = [{ fam: 0, char: 'heart' }, { fam: 0 }, { fam: 7 }, { fam: -1 }];
  const p = seedPositions(nodes, 1);
  near(p[4], LAYOUT[0].x + WORLD.spread); near(p[5], LAYOUT[0].y);                     // family 0 is a real family: its first build sits by its blob
  near(Math.hypot(p[8], p[9]), LAYOUT[6].r - 3 * WORLD.spread);                        // one past the last family is open water…
  near(Math.hypot(p[12], p[13]), LAYOUT[6].r - 2 * WORLD.spread);                      // …and so is a negative one
  const r = mulberry32(1618), want = [0.1 + 0.2 * r(), r(), r(), r()];                 // organs sit near the front; every other cell anywhere
  for (let i = 0; i < 4; i++) assert.equal(p[i * 4 + 2], Math.fround(want[i]), 'depth of cell ' + i);
  assert.equal(seedPositions(nodes, 99)[2], Math.fround(0.1 + 0.2 * mulberry32(1618)()));   // an organ count past the list is the whole list
  const all = seedPositions(nodes, 99), r2 = mulberry32(1618);
  for (let i = 0; i < 4; i++) assert.equal(all[i * 4 + 2], Math.fround(0.1 + 0.2 * r2()));
  assert.deepEqual(castOf({ nodes: [{ char: 'heart' }, { char: 'organ' }], organCount: 99 }), { heart: 0, gate: -1, immune: -1, library: -1, night: -1, workers: [1] });
  assert.deepEqual(castOf({ nodes: [{ char: 'heart' }, { char: 'organ' }], organCount: -2 }).workers, []);
  assert.equal(castOf({ nodes: [{ char: 'heart' }, { char: 'organ' }], organCount: -2 }).heart, -1);
});

test('counts: what the page prints, from the same data the organism draws', () => {
  assert.deepEqual(counts(est(['a', 'b', 'cx'])), { builds: 3, live: 2 });
  assert.deepEqual(counts({ nodes: [{ name: 'a', url: 'u' }, null, { name: '' }, { name: 'b', url: 5 }] }), { builds: 2, live: 1 });
  for (const junk of [null, 5, {}, { nodes: 5 }]) assert.deepEqual(counts(junk), { builds: 0, live: 0 });
});

test('default export carries every name', () => {
  assert.deepEqual(Object.keys(E).sort(), ['BEAT_KINDS', 'CHARACTERS', 'FAMILIES', 'FAMILY_IDS', 'GOLDEN', 'LAYOUT', 'WORLD', 'castOf', 'counts', 'familyOf', 'mulberry32', 'pick', 'script', 'seedPositions', 'shape']);
});
