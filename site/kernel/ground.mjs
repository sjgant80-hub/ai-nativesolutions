// site/kernel/ground.mjs — the source check in front of the gate (pure; no clock, no DOM, no network).
// The SLM stack's own record names its weak link: when the small model reads a fact that is not in the complaint, the
// gate cannot tell. This check closes the part of that gap a rule can close, before the gate ever sees the facts:
//   · a DATE the reader gives must be findable in the visitor's own words (as 2026-10-03, 3/10/2026, 3 October,
//     October 3rd …). A date that is not there is set to "not stated", and the library then abstains if it needed it.
//   · a date after today is not used.
//   · the PRICE must appear in the text as a number, and "credit card" must be said, or nothing that depends on them
//     (the card-issuer angle) is proposed.
// It can only take facts AWAY. It never adds one, and it cannot check the reader's judgement calls (goods or service,
// shop or online): those are shown to the human as read. This check is this page's addition; the sealed 86.3% result
// was measured without it.

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v : '');
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
export const MONTHS = Object.freeze(['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']);
export const DATE_KEYS = Object.freeze(['bought', 'delivered', 'faultFound']);

/** parts('2026-10-03') → { y: 2026, m: 10, d: 3 } for a real calendar day, else null */
export function parts(iso) {
  const m = ISO.exec(str(iso));
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  // a real day is one the calendar gives back unchanged (30 February rolls into March, so it does not)
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== m[0]) return null;
  return { y, m: mo, d };
}

/** fromWords('27 October 2026') → '2026-10-27': a real day written as day, month name, year. Anything else is null.
 *  A small model copies a date as it is written far more reliably than it converts one, so the page asks it to copy
 *  and does the conversion here, where it cannot go wrong quietly. */
export function fromWords(s) {
  const m = /^([0-9]{1,2}) ([a-z]+) ([0-9]{4})$/.exec(str(s).trim().toLowerCase());
  if (!m) return null;
  const mi = MONTHS.indexOf(m[2]);
  if (mi === -1) return null;
  const iso = m[3] + '-' + String(mi + 1).padStart(2, '0') + '-' + m[1].padStart(2, '0');
  return parts(iso) ? iso : null;
}

/** copyOf(o) → a plain copy of an object's own fields, or null for anything that is not an object, or that cannot be
 *  read (a hostile object can throw from a getter: that is refused here, never passed on) */
function copyOf(o) {
  if (!isObj(o)) return null;
  try { return { ...o }; } catch { return null; }
}

/** datesFromWords(obj) → { obj, notes }: a copy of the reader's object with each date key turned from words to ISO.
 *  null stays null. Anything that is not a real day in words becomes null, with a note saying so. */
export function datesFromWords(obj) {
  const out = copyOf(obj), notes = [];
  if (!out) return { obj: null, notes: [] };
  for (const k of DATE_KEYS) {
    const v = out[k];
    if (v === null) continue;
    const iso = fromWords(v);
    if (iso === null) notes.push({ key: k, value: typeof v === 'string' ? v : '', why: 'not-a-date' });
    out[k] = iso;
  }
  return { obj: out, notes };
}

/** findDate(text, iso) → how the date is written in the text ('iso' | 'numeric' | 'words'), or null when it is not there.
 *  Numeric dates are read day first (the UK order). A written date naming a different year does not count. */
export function findDate(text, iso) {
  const p = parts(iso), t = str(text).toLowerCase();
  if (!p || !t) return null;
  if (new RegExp('(?<!\\d)' + iso + '(?!\\d)').test(t)) return 'iso';
  const d = '0?' + p.d, mo = '0?' + p.m, yy = String(p.y).slice(2);
  // not part of a longer number or date on either side; a full stop or comma after it (the end of a sentence) is fine
  const numeric = new RegExp('(?<!\\d)(?<!\\d[/.-])' + d + '[/.-]' + mo + '[/.-](?:' + p.y + '|' + yy + ')(?!\\d)(?![/.-]\\d)');
  if (numeric.test(t)) return 'numeric';
  const full = MONTHS[p.m - 1], short = full.slice(0, 3);
  const month = '(?:' + full + '|' + short + (p.m === 9 ? '|sept' : '') + ')\\.?';
  const ord = '(?:st|nd|rd|th)?';
  const year = '(?:\\s*,?\\s*(\\d{4}))?';
  const forms = [
    new RegExp('(?<![\\d/.-])' + d + ord + '\\s+(?:of\\s+)?' + month + '(?![a-z])' + year, 'g'),
    new RegExp('(?<![a-z])' + month + '\\s+(?:the\\s+)?' + d + ord + '(?![\\d/.-])' + year, 'g'),
  ];
  for (const re of forms) for (const m of t.matchAll(re)) if (m[1] === undefined || Number(m[1]) === p.y) return 'words';
  return null;
}

/** findNumber(text, n) → whether the amount appears in the text as a number (429, 429.00, 1,299, 1299) */
export function findNumber(text, n) {
  if (!Number.isFinite(n) || n < 0) return false;
  const whole = Math.floor(n), cents = Math.round((n - whole) * 100);
  const digits = String(whole), grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const frac = cents === 0 ? '(?:\\.0{1,2})?' : '\\.' + String(cents).padStart(2, '0').replace(/0$/, '0?');
  const re = new RegExp('(?<![\\d.,])(?:' + digits + '|' + grouped + ')' + frac + '(?![\\d])(?!,\\d{3})(?!\\.\\d)');
  return re.test(str(text));
}

const PAID = Object.freeze({ 'credit card': /credit\s*-?\s*card/i, 'debit card': /debit/i, cash: /\bcash\b/i, 'bank transfer': /transfer|\bbacs\b|faster payment/i });
/** saysPaidBy(text, how) → whether the text says the payment was made that way */
export function saysPaidBy(text, how) { return Object.prototype.hasOwnProperty.call(PAID, str(how)) && PAID[how].test(str(text)); }

/** ground(facts, text, today) → { facts, notes, angles }
 *  facts: a copy with every unsupported date set to null and an unsupported price set to 0
 *  notes: [{ key, value, why }] — why: 'not-in-text' | 'after-today' | 'price-not-in-text' | 'payment-not-in-text'
 *  angles: false when the price or the credit-card payment is not in the text (nothing may be proposed from them) */
export function ground(facts, text, today) {
  const out = copyOf(facts), notes = [];
  if (!out) return { facts: null, notes: [], angles: false };
  const now = parts(today), stamp = (p) => p.y * 10000 + p.m * 100 + p.d;
  for (const k of DATE_KEYS) {
    const v = out[k];
    if (v === null || v === undefined) continue;
    const p = parts(v);
    if (!p || !findDate(text, v)) { out[k] = null; notes.push({ key: k, value: str(v), why: 'not-in-text' }); continue; }
    if (now && stamp(p) > stamp(now)) { out[k] = null; notes.push({ key: k, value: v, why: 'after-today' }); }
  }
  let angles = true;
  if (typeof out.price === 'number' && out.price > 0 && !findNumber(text, out.price)) { notes.push({ key: 'price', value: String(out.price), why: 'price-not-in-text' }); out.price = 0; angles = false; }
  if (out.paidBy === 'credit card' && !saysPaidBy(text, 'credit card')) { notes.push({ key: 'paidBy', value: 'credit card', why: 'payment-not-in-text' }); angles = false; }
  return { facts: out, notes, angles };
}

/** applyAngles(result, g) → the gated result with its proposals removed when the ground check does not allow them.
 *  result: what the gate's decide() returned. Nothing else in it is touched. */
export function applyAngles(result, g) {
  if (!isObj(result) || !isObj(result.answer) || !isObj(g) || g.angles !== false) return result;
  if (!Array.isArray(result.answer.angles) || result.answer.angles.length === 0) return result;
  return { ...result, answer: { ...result.answer, angles: [] }, withheldAngles: result.answer.angles.slice() };
}

export const WHY = Object.freeze({
  'not-a-date': 'the reader wrote something here that is not a real date, so it was not used',
  'not-in-text': 'the reader gave this date, but your text does not state it, so it was not used',
  'after-today': 'this date is after today, so it was not used',
  'price-not-in-text': 'the reader gave this amount, but your text does not, so nothing is proposed from it',
  'payment-not-in-text': 'the reader said "credit card", but your text does not, so the card-issuer angle is not proposed',
});

export default { MONTHS, DATE_KEYS, WHY, parts, fromWords, datesFromWords, findDate, findNumber, saysPaidBy, ground, applyAngles };
