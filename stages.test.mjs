// ai-nativesolutions · stages.test.mjs — the operating board's honesty gate, every rule falsifiable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATES, DOORS, validStage, board } from './stages.mjs';

const SIX = () => [
  { n: 1, seat: 'Marketing', state: 'BUILT', machinery: 'rail + outbox + fallscrub', proof: '' },
  { n: 2, seat: 'Pipeline', state: 'PLANNED' },
  { n: 3, seat: 'Product', state: 'LIVE', machinery: 'the operator crawl+mint', proof: 'https://sjgant80-hub.github.io/sididy-catalogue/' },
  { n: 4, seat: 'Delivery', state: 'BUILT', machinery: 'the signed-door executor' },
  { n: 5, seat: 'Full loop', state: 'BUILT', machinery: 'the nightly ritual' },
  { n: 6, seat: 'Company = product', state: 'LIVE', machinery: 'fallcorp + Northgate', proof: 'https://sjgant80-hub.github.io/fallcorp/' },
];
const DOORSHELD = () => ({ money: 'human', legal: 'human', taste: 'human', 'client-trust': 'human' });

test('A LIVE STAGE MUST SHOW PROOF — a live claim without a link is the vendor lie refused', () => {
  assert.match(validStage({ n: 3, seat: 'Product', state: 'LIVE', machinery: 'x', proof: '' }).why, /no proof link/);
  assert.match(validStage({ n: 3, seat: 'Product', state: 'LIVE', machinery: 'x', proof: 'not-a-url' }).why, /no proof link/);
  assert.equal(validStage({ n: 3, seat: 'Product', state: 'LIVE', machinery: 'x', proof: 'https://example.test/' }).ok, true);
});

test('BUILT MUST NAME ITS MACHINERY — "what actually does the work?"', () => {
  assert.match(validStage({ n: 1, seat: 'Marketing', state: 'BUILT', machinery: '' }).why, /names no machinery/);
  assert.equal(validStage({ n: 2, seat: 'Pipeline', state: 'PLANNED' }).ok, true, 'a planned stage needs no machinery yet');
});

test('STAGE SHAPE — numbered 1..6, a real state, a named seat', () => {
  assert.match(validStage({ n: 0, seat: 'x', state: 'LIVE', proof: 'https://a.b' }).why, /numbered 1\.\.6/);
  assert.match(validStage({ n: 7, seat: 'x', state: 'PLANNED' }).why, /numbered 1\.\.6/);
  assert.match(validStage({ n: 1, seat: '  ', state: 'PLANNED' }).why, /names no seat/);
  assert.match(validStage({ n: 1, seat: 'x', state: 'MAYBE' }).why, /no real state/);
  assert.match(validStage({ n: 1, seat: 'x', state: 'BUILT', machinery: 'm', door: 'vibes' }).why, /not one of the four/);
});

test('THE BOARD — six stages, no dupes, no gaps', () => {
  const b = board(SIX(), DOORSHELD());
  assert.equal(b.ok, true, b.why);
  assert.equal(b.live, 2);
  assert.equal(b.built, 3);
  assert.equal(b.planned, 1);
  assert.match(b.why, /2 live · 3 built · 1 planned · all four doors human/);
  assert.match(board(SIX().slice(0, 5), DOORSHELD()).why, /six stages — got 5/);
  const dup = SIX(); dup[1].n = 1;
  assert.match(board(dup, DOORSHELD()).why, /listed twice/);
  const gap = SIX(); gap[1].n = 9;   // out of range → validStage catches it
  assert.match(board(gap, DOORSHELD()).why, /numbered 1\.\.6/);
  // built counts BUILT specifically, not non-built — a board where the two differ
  const fourBuilt = [
    { n: 1, seat: 'a', state: 'BUILT', machinery: 'm' }, { n: 2, seat: 'b', state: 'BUILT', machinery: 'm' },
    { n: 3, seat: 'c', state: 'BUILT', machinery: 'm' }, { n: 4, seat: 'd', state: 'BUILT', machinery: 'm' },
    { n: 5, seat: 'e', state: 'LIVE', machinery: 'm', proof: 'https://a.b/' }, { n: 6, seat: 'f', state: 'PLANNED' },
  ];
  const fb = board(fourBuilt, DOORSHELD());
  assert.equal(fb.built, 4); assert.equal(fb.live, 1); assert.equal(fb.planned, 1);
});

test('EVERY DOOR MUST BE HUMAN — an agent at a door poisons the pitch', () => {
  for (const door of DOORS) {
    const bad = DOORSHELD(); bad[door] = 'agent';
    const r = board(SIX(), bad);
    assert.equal(r.ok, false);
    assert.match(r.why, new RegExp('the ' + door + ' door is not held by a human'));
  }
  assert.match(board(SIX(), { money: 'human', legal: 'human', taste: 'human' }).why, /client-trust door is not held/);
});

test('THE RATIO IS DERIVED, NOT TYPED — agents on the seats, humans on the doors', () => {
  const b = board(SIX(), DOORSHELD());
  assert.match(b.ratio, /agents run the 6 operational seats; humans hold the 4 doors/);
  assert.equal(b.doorsHuman, 4);
});

test('FUZZ: total on garbage', () => {
  validStage(null); validStage(7); board(null, null); board('x', 7); board([], {});
  assert.match(validStage(7).why, /not a stage/, 'a number is not a stage');
  assert.match(validStage('x').why, /not a stage/);
  assert.match(validStage(() => {}).why, /not a stage/, 'a function is not a stage');
  assert.match(board([], DOORSHELD()).why, /six stages/);
  assert.ok(true);
});
