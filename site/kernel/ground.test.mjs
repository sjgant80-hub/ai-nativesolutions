import test from 'node:test';
import assert from 'node:assert/strict';
import Gr, { parts, fromWords, datesFromWords, findDate, findNumber, saysPaidBy, ground, applyAngles, WHY, DATE_KEYS, MONTHS } from './ground.mjs';

test('parts: only a real calendar day in ISO form', () => {
  assert.deepEqual(parts('2026-10-03'), { y: 2026, m: 10, d: 3 });
  assert.deepEqual(parts('2024-02-29'), { y: 2024, m: 2, d: 29 });
  for (const bad of ['2026-02-29', '2026-13-01', '2026-00-10', '2026-04-31', '2026-1-3', '03/10/2026', ' 2026-10-03', '2026-10-03 ', '', null, undefined, 20261003, {}]) assert.equal(parts(bad), null, String(bad));
});

test('fromWords: day, month name, year, and nothing looser', () => {
  assert.equal(fromWords('27 October 2026'), '2026-10-27'); assert.equal(fromWords('3 march 2026'), '2026-03-03'); assert.equal(fromWords('  09 JUNE 2025 '), '2025-06-09');
  assert.equal(fromWords('29 February 2024'), '2024-02-29');
  for (const bad of ['29 February 2026', '31 April 2026', '0 May 2026', '32 May 2026', '27 Oct 2026', '27 October 26', 'October 27 2026', '27 October 2026 x', '2026-10-27', '27  October 2026', '127 October 2026', '', null, undefined, 5, {}]) assert.equal(fromWords(bad), null, String(bad));
});

test('datesFromWords: the three date keys become ISO; what is not a real date becomes null and is named', () => {
  const r = datesFromWords({ kind: 'goods', bought: '27 October 2026', delivered: null, faultFound: 'last Tuesday', price: 5 });
  assert.deepEqual(r.obj, { kind: 'goods', bought: '2026-10-27', delivered: null, faultFound: null, price: 5 });
  assert.deepEqual(r.notes, [{ key: 'faultFound', value: 'last Tuesday', why: 'not-a-date' }]);
  const j = datesFromWords({ bought: 5, delivered: undefined, faultFound: '30 February 2026' });
  assert.deepEqual(j.obj, { bought: null, delivered: null, faultFound: null });
  assert.deepEqual(j.notes.map((n) => [n.key, n.value]), [['bought', ''], ['delivered', ''], ['faultFound', '30 February 2026']]);
  const src = { bought: '1 May 2026', delivered: null, faultFound: null };
  assert.notEqual(datesFromWords(src).obj, src); assert.equal(src.bought, '1 May 2026');   // a copy
  for (const junk of [null, 5, 'x', [1]]) assert.deepEqual(datesFromWords(junk), { obj: null, notes: [] });
  assert.deepEqual(datesFromWords({ get bought() { throw new Error('toxic'); } }), { obj: null, notes: [] });   // an object that throws when read is refused, not passed on
});

test('findDate: ISO, UK numeric and written forms; a different day, month or year is not a match', () => {
  const iso = '2026-10-03';
  assert.equal(findDate('delivered 2026-10-03 to me', iso), 'iso');
  for (const t of ['on 3/10/2026', 'on 03/10/2026', 'on 3.10.2026', 'on 03-10-26', 'on 3/10/26.']) assert.equal(findDate(t, iso), 'numeric', t);
  for (const t of ['on 3 October 2026', 'on 3rd October', 'the 3rd of October 2026', 'on 03 Oct', 'on 3 oct. 2026', 'October 3', 'October 3rd, 2026', 'Oct the 3rd', 'ON 3 OCTOBER']) assert.equal(findDate(t, iso), 'words', t);
  for (const t of ['on 13 October 2026', 'on 3 November 2026', 'on 3 October 2025', 'October 3, 2025', 'on 30 October', 'on 23 October', 'October 31', 'October 30', 'on 3/11/2026', 'on 13/10/2026', 'on 3/10/2025', 'on 10/3/2026',
    'ref 2026-10-031', 'on 3 octopus', 'three weeks ago', '3 10 2026', '', 'on 3/10/20261', 'on 1/3/10/2026', 'in 3 October2025']) assert.equal(findDate(t, iso), null, t);
  assert.equal(findDate('a first try on 3 October 2025, then again on 3 October 2026', iso), 'words');   // any occurrence with the right year counts
  assert.equal(findDate('on 5 September 2026', '2026-09-05'), 'words'); assert.equal(findDate('on 5 Sept 2026', '2026-09-05'), 'words');
  assert.equal(findDate('on 5 Sept 2026', '2026-10-05'), null);                                          // "sept" is September only
  assert.equal(findDate('1 May 2026', '2026-05-01'), 'words'); assert.equal(findDate('1 Mayfair 2026', '2026-05-01'), null);
  assert.equal(findDate('on 12 March', '2026-03-12'), 'words'); assert.equal(findDate('on 2 March', '2026-03-12'), null); assert.equal(findDate('on 112 March', '2026-03-12'), null);
  for (const bad of [[null, iso], ['text', '2026-02-30'], ['text', null], [5, iso]]) assert.equal(findDate(...bad), null);
  assert.equal(MONTHS.length, 12);
});

test('findNumber: the amount must stand in the text as a number of its own', () => {
  for (const t of ['paid 849 pounds', 'paid 849.00', 'paid 849.0', '849', 'cost: 849,']) assert.equal(findNumber(t, 849), true, t);
  for (const t of ['paid 8490', 'paid 1849', 'paid 849.50', 'paid 84', 'order 2849 ', 'paid 0.849', 'ref 849,000', '']) assert.equal(findNumber(t, 849), false, t);
  assert.equal(findNumber('it was 1,299 in the sale', 1299), true); assert.equal(findNumber('it was 1299', 1299), true); assert.equal(findNumber('it was 1,2999', 1299), false);
  assert.equal(findNumber('paid 849.50 in all', 849.5), true); assert.equal(findNumber('paid 849.5 in all', 849.5), true); assert.equal(findNumber('paid 849 in all', 849.5), false);
  assert.equal(findNumber('paid 12.05', 12.05), true); assert.equal(findNumber('paid 12.5', 12.05), false);
  assert.equal(findNumber('free: 0 pounds', 0), true);
  for (const bad of [-1, NaN, Infinity, '849', null, undefined]) assert.equal(findNumber('paid 849', bad), false, String(bad));
  assert.equal(findNumber('the balance is -5 pounds', -5), false);                        // a negative amount is never an amount paid
  assert.equal(parts('0050-01-01'), null);                                                // a year the calendar would move is not a real date here
  assert.equal(findNumber(null, 849), false);
});

test('saysPaidBy: the text has to say how it was paid', () => {
  assert.equal(saysPaidBy('by credit card', 'credit card'), true); assert.equal(saysPaidBy('on my Credit-Card', 'credit card'), true); assert.equal(saysPaidBy('by creditcard', 'credit card'), true);
  assert.equal(saysPaidBy('by card', 'credit card'), false); assert.equal(saysPaidBy('by debit card', 'credit card'), false);
  assert.equal(saysPaidBy('my debit card', 'debit card'), true); assert.equal(saysPaidBy('in cash', 'cash'), true); assert.equal(saysPaidBy('cashback', 'cash'), false);
  assert.equal(saysPaidBy('by bank transfer', 'bank transfer'), true); assert.equal(saysPaidBy('by BACS', 'bank transfer'), true); assert.equal(saysPaidBy('a faster payment', 'bank transfer'), true);
  for (const bad of ['cheque', 'toString', '__proto__', '', null, undefined, 5]) assert.equal(saysPaidBy('credit card cash debit transfer', bad), false, String(bad));
  assert.equal(saysPaidBy(null, 'cash'), false);
});

const TEXT = 'I bought a laptop online on 2 October 2026 for 849 pounds by credit card. It came on 6 October 2026 and broke on 20 October 2026.';
const FACTS = { kind: 'goods', channel: 'online', price: 849, paidBy: 'credit card', bought: '2026-10-02', delivered: '2026-10-06', faultFound: '2026-10-20', repairsTried: 0, changedMind: false, summary: 's' };

test('ground: facts the text supports pass untouched', () => {
  const g = ground(FACTS, TEXT, '2026-11-12');
  assert.deepEqual(g, { facts: FACTS, notes: [], angles: true });
  assert.notEqual(g.facts, FACTS);                                                        // a copy, never the reader's own object
});

test('ground: a date the text does not state becomes "not stated", and is named', () => {
  const g = ground({ ...FACTS, delivered: '2026-10-07', faultFound: '2026-10-21' }, TEXT, '2026-11-12');
  assert.equal(g.facts.delivered, null); assert.equal(g.facts.faultFound, null); assert.equal(g.facts.bought, '2026-10-02');
  assert.deepEqual(g.notes, [{ key: 'delivered', value: '2026-10-07', why: 'not-in-text' }, { key: 'faultFound', value: '2026-10-21', why: 'not-in-text' }]);
  assert.equal(g.angles, true);
  const junk = ground({ ...FACTS, bought: 'yesterday', delivered: 20261006, faultFound: undefined }, TEXT, '2026-11-12');
  assert.equal(junk.facts.bought, null); assert.equal(junk.facts.delivered, null); assert.equal(junk.facts.faultFound, undefined);
  assert.deepEqual(junk.notes.map((n) => [n.key, n.value, n.why]), [['bought', 'yesterday', 'not-in-text'], ['delivered', '', 'not-in-text']]);
  assert.deepEqual(ground({ ...FACTS, faultFound: null }, TEXT, '2026-11-12').notes, []);   // null was already "not stated"
});

test('ground: a date after today is not used; the day itself is', () => {
  assert.deepEqual(ground(FACTS, TEXT, '2026-10-19').notes, [{ key: 'faultFound', value: '2026-10-20', why: 'after-today' }]);
  assert.equal(ground(FACTS, TEXT, '2026-10-19').facts.faultFound, null);
  assert.deepEqual(ground(FACTS, TEXT, '2026-10-20').notes, []);
  assert.deepEqual(ground(FACTS, TEXT, '2025-12-31').notes.map((n) => n.key), ['bought', 'delivered', 'faultFound']);
  assert.deepEqual(ground(FACTS, TEXT, '2026-09-30').notes.map((n) => n.why), ['after-today', 'after-today', 'after-today']);   // month before
  assert.deepEqual(ground(FACTS, TEXT, 'not a date').notes, []);                          // no usable today: the future check is skipped, never guessed
  assert.deepEqual(ground(FACTS, TEXT).notes, []);
});

test('ground: a price or a credit card the text does not give stops anything being proposed from them', () => {
  const p = ground({ ...FACTS, price: 850 }, TEXT, '2026-11-12');
  assert.equal(p.facts.price, 0); assert.equal(p.angles, false); assert.deepEqual(p.notes, [{ key: 'price', value: '850', why: 'price-not-in-text' }]);
  const c = ground({ ...FACTS, paidBy: 'credit card' }, TEXT.replace('credit card', 'card'), '2026-11-12');
  assert.equal(c.facts.paidBy, 'credit card'); assert.equal(c.angles, false); assert.deepEqual(c.notes, [{ key: 'paidBy', value: 'credit card', why: 'payment-not-in-text' }]);
  assert.equal(ground({ ...FACTS, paidBy: 'cash' }, TEXT.replace('credit card', 'card'), '2026-11-12').angles, true);   // only the credit-card claim carries an angle
  assert.deepEqual(ground({ ...FACTS, price: 0 }, 'no amount here, by credit card, 2 October 2026 6 October 2026 20 October 2026', '2026-11-12').notes, []);   // nothing claimed, nothing to check
  assert.equal(ground({ ...FACTS, price: '849' }, TEXT, '2026-11-12').facts.price, '849');   // not a number: left for the gate's own schema check to refuse
  const both = ground({ ...FACTS, price: 1, paidBy: 'credit card' }, 'nothing', '2026-11-12');
  assert.deepEqual(both.notes.map((n) => n.why), ['not-in-text', 'not-in-text', 'not-in-text', 'price-not-in-text', 'payment-not-in-text']);
});

test('ground: junk in is an empty, closed answer', () => {
  for (const junk of [null, undefined, 5, 'x', [1]]) assert.deepEqual(ground(junk, TEXT, '2026-11-12'), { facts: null, notes: [], angles: false });
  assert.deepEqual(ground({ get bought() { throw new Error('toxic'); } }, TEXT, '2026-11-12'), { facts: null, notes: [], angles: false });
  assert.deepEqual(DATE_KEYS, ['bought', 'delivered', 'faultFound']);
});

test('applyAngles: proposals are removed only when the source check says so, and nothing else is touched', () => {
  const result = { abstain: false, answer: { claim: 'goods-fault', angles: ['cca-s75'], rights: ['cra-s9'] }, cites: [1] };
  assert.equal(applyAngles(result, { angles: true }), result);
  const out = applyAngles(result, { angles: false });
  assert.deepEqual(out, { abstain: false, answer: { claim: 'goods-fault', angles: [], rights: ['cra-s9'] }, cites: [1], withheldAngles: ['cca-s75'] });
  assert.deepEqual(result.answer.angles, ['cca-s75']);                                    // the gate's own result is never edited in place
  const none = { answer: { angles: [] } };
  assert.equal(applyAngles(none, { angles: false }), none);
  for (const bad of [[null, { angles: false }], [{}, { angles: false }], [{ answer: null }, { angles: false }], [{ answer: { angles: 'x' } }, { angles: false }], [result, null], [result, {}], [result, { angles: 0 }]]) assert.equal(applyAngles(...bad), bad[0]);
});

test('WHY has a plain sentence for every reason ground can give; default export carries every name', () => {
  assert.deepEqual(Object.keys(WHY).sort(), ['after-today', 'not-a-date', 'not-in-text', 'payment-not-in-text', 'price-not-in-text']);
  for (const s of Object.values(WHY)) assert.ok(s.length > 30);
  assert.deepEqual(Object.keys(Gr).sort(), ['DATE_KEYS', 'MONTHS', 'WHY', 'applyAngles', 'datesFromWords', 'findDate', 'findNumber', 'fromWords', 'ground', 'parts', 'saysPaidBy']);
});
