// verticals/legal/library.mjs — the verified pattern library for UK consumer-claim triage (pure; no I/O).
// Every rule is a provision in verticals/legal/law.json, read on legislation.gov.uk on 2026-11-09. Given the facts of a
// complaint it gives the claim type, the provisions that apply, the remedy, the deadline dates, the angles worth a
// human's look, and the facts it would need but does not have. It never guesses: a missing critical fact is named.
//
// Dates (UTC calendar days, ISO 'YYYY-MM-DD'):
//   · "the end of N days beginning with the first day after D" and "the end of N days after D" both end on D + N.
//   · "within six months beginning with the day D" ends on (D + 6 calendar months) − 1 day.
//   · six years "from" D ends on D + 6 calendar years (a day that does not exist, 29 February, becomes the month's last).

export const DISTANCE = Object.freeze(['online', 'phone']);
export const S75_LOW = 100, S75_HIGH = 30000;

const DAY = 86400000;
const parse = (iso) => Date.parse(iso + 'T00:00:00Z');
const iso = (t) => new Date(t).toISOString().slice(0, 10);
/** addDays('2026-03-03', 30) → '2026-04-02' */
export const addDays = (d, n) => iso(parse(d) + n * DAY);
/** addMonths(d, n): the same day n calendar months on, or that month's last day if it has no such day */
export function addMonths(d, n) {
  const [y, m, day] = d.split('-').map(Number), total = y * 12 + (m - 1) + n, ty = Math.floor(total / 12), tm = total % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return iso(Date.UTC(ty, tm, Math.min(day, last)));
}
/** onOrBefore(a, b) → whether calendar day a is on or before calendar day b */
export const onOrBefore = (a, b) => parse(a) <= parse(b);

/** claimOf(facts) → the claim type the facts describe */
export function claimOf(f) {
  if (f.kind === 'service') return 'service-poor';
  if (!f.changedMind) return 'goods-fault';
  return DISTANCE.includes(f.channel) ? 'distance-cancel' : 'no-statutory-right';
}
/** NEEDS: the facts each claim type cannot be answered without */
export const NEEDS = Object.freeze({ 'goods-fault': ['delivered', 'faultFound'], 'service-poor': ['delivered'], 'distance-cancel': ['delivered'], 'no-statutory-right': [] });

/** answer(facts) → { claim, abstain, missing, rights, remedy, deadlines, angles, next, presumption } */
export function answer(f) {
  const claim = claimOf(f), missing = NEEDS[claim].filter((k) => !f[k]);
  if (missing.length) return { claim, abstain: true, missing, rights: [], remedy: null, deadlines: [], angles: [], next: 'ask-for-missing-facts', presumption: false };
  const rights = [], deadlines = [], angles = [];
  let remedy, next = 'letter-before-action-14-days', presumption = false;
  if (claim === 'goods-fault') {
    rights.push('cra-s9');
    const rejectBy = addDays(f.delivered, 30);
    presumption = onOrBefore(f.faultFound, addDays(addMonths(f.delivered, 6), -1));
    if (presumption) rights.push('cra-s19-14');
    if (onOrBefore(f.today, rejectBy)) { remedy = 'reject'; rights.push('cra-s20', 'cra-s22'); deadlines.push({ what: 'reject-by', date: rejectBy }); }
    else if (f.repairsTried > 0) { remedy = 'price-reduction-or-final-reject'; rights.push('cra-s24'); if (onOrBefore(f.today, addDays(addMonths(f.delivered, 6), -1))) rights.push('cra-s24-10'); }
    else { remedy = 'repair-or-replacement'; rights.push('cra-s23'); }
  } else if (claim === 'service-poor') {
    rights.push('cra-s49');
    if (f.repairsTried > 0) { remedy = 'price-reduction'; rights.push('cra-s56'); } else { remedy = 'repeat-performance'; rights.push('cra-s55'); }
  } else if (claim === 'distance-cancel') {
    const cancelBy = addDays(f.delivered, 14);
    if (onOrBefore(f.today, cancelBy)) { remedy = 'cancel-and-refund'; rights.push('ccr-reg29', 'ccr-reg30', 'ccr-reg34'); deadlines.push({ what: 'cancel-by', date: cancelBy }); next = 'notify-cancellation'; }
    else { remedy = 'cancellation-period-passed'; rights.push('ccr-reg30'); next = 'check-returns-policy'; }
  } else { remedy = 'no-statutory-right'; next = 'check-returns-policy'; }
  if (claim === 'goods-fault' || claim === 'service-poor') {
    rights.push('la-s5');
    deadlines.push({ what: 'limitation', date: addMonths(f.delivered, 72) });
    if (f.paidBy === 'credit card' && f.price > S75_LOW && f.price <= S75_HIGH) angles.push('cca-s75');
  }
  return { claim, abstain: false, missing: [], rights, remedy, deadlines, angles, next, presumption };
}

/** same(a, b) → whether two answers agree on everything a reader acts on (claim, abstain, missing, rights, remedy, dates, angles) */
export function same(a, b) {
  const key = (x) => JSON.stringify([x.claim, x.abstain, [...x.missing].sort(), [...x.rights].sort(), x.remedy, x.deadlines.map((d) => d.what + ' ' + d.date).sort(), [...x.angles].sort()]);
  return key(a) === key(b);
}

export default { DISTANCE, S75_LOW, S75_HIGH, addDays, addMonths, onOrBefore, claimOf, NEEDS, answer, same };
