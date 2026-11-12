// site/kernel/race.mjs — the compression race's arithmetic and its verdict (pure; no clock, no DOM, no network).
// The race itself runs in a worker on the visitor's own bytes. This file turns the measured sizes into the placing and
// the sentence under it, so the page can never round a loss into a win:
//   · a lane only counts if its output decoded back to the exact input (identical: true)
//   · the placing is by output size, smallest first; a tie shares the place
//   · the sentence names who won and by how much, whoever that is
// It also reads the codec's published, sealed record into the per-type table, losses included.

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v : '');
const whole = (v) => Number.isSafeInteger(v) && v >= 0;

export const LANES = Object.freeze([
  { id: 'light', name: 'LIGHT (cold)', note: 'our codec, with no shared seed: what a stranger\'s first message costs' },
  { id: 'brotli', name: 'Brotli 11', note: 'Google\'s codec at its strongest setting' },
  { id: 'zstd', name: 'Zstandard 19', note: 'Meta\'s codec at a high setting' },
  { id: 'gzip', name: 'gzip', note: 'the web\'s old default, your browser\'s own build' },
]);
/** The most bytes the race reads from a file. LIGHT is a context-mixing codec written in plain JavaScript; a megabyte
 *  takes it a few seconds. Every lane gets the same bytes, so the race is fair; a bigger file is cut to this, and the
 *  page says so. */
export const CAP = 1048576;

/** plan(size) → { bytes, cut }: how much of a file of that size the race reads */
export function plan(size) {
  const n = whole(size) ? size : 0;
  return { bytes: Math.min(n, CAP), cut: n > CAP };
}

/** ratio(raw, out) → raw / out to three places, or 0 when either is not a positive whole number */
export function ratio(raw, out) {
  if (!whole(raw) || !whole(out) || raw === 0 || out === 0) return 0;
  return Math.round((raw / out) * 1000) / 1000;
}

/** placing(results) → the lanes that round-tripped, smallest output first, each with { id, bytes, ms, ratio, place }.
 *  results: [{ id, bytes, ms, identical }]. A lane that did not decode to the exact input is left out (and listed in dropped). */
export function placing(raw, results) {
  const list = (Array.isArray(results) ? results : []).filter((r) => isObj(r) && str(r.id) && whole(r.bytes) && r.bytes > 0);
  const ok = list.filter((r) => r.identical === true).map((r) => ({ id: r.id, bytes: r.bytes, ms: Number.isFinite(r.ms) ? Math.max(0, r.ms) : 0, ratio: ratio(raw, r.bytes) }));
  ok.sort((a, b) => a.bytes - b.bytes || a.id.localeCompare(b.id));
  let place = 0, last = -1;
  ok.forEach((r, i) => { if (r.bytes !== last) { place = i + 1; last = r.bytes; } r.place = place; });
  return { lanes: ok, dropped: list.filter((r) => r.identical !== true).map((r) => r.id) };
}

const nameOf = (id) => { const l = LANES.find((x) => x.id === id); return l ? l.name : id; };
const pct = (a, b) => Math.round((Math.abs(a - b) / b) * 1000) / 10;

/** sentence(raw, results, focus) → the plain verdict about the focus lane (LIGHT unless told otherwise) */
export function sentence(raw, results, focus = 'light') {
  const { lanes, dropped } = placing(raw, results);
  if (dropped.includes(focus)) return nameOf(focus) + ' did not give your bytes back exactly, so it is disqualified. That is a fault: tell us.';
  const me = lanes.find((l) => l.id === focus);
  if (!me) return 'No result for ' + nameOf(focus) + ' yet.';
  if (lanes.length === 1) return nameOf(focus) + ' made your ' + raw.toLocaleString('en-GB') + ' bytes ' + me.ratio + ' times smaller. No other lane finished.';
  const first = lanes[0];
  if (me.place === 1) {
    const next = lanes.find((l) => l.place > 1);
    const tied = lanes.filter((l) => l.place === 1 && l.id !== focus);
    if (tied.length) return nameOf(focus) + ' tied for first with ' + tied.map((l) => nameOf(l.id)).join(' and ') + ' at ' + me.ratio + ' times smaller.';
    return nameOf(focus) + ' won on this file: ' + me.ratio + ' times smaller, ' + pct(next.bytes, me.bytes) + '% ahead of ' + nameOf(next.id) + '.';
  }
  return nameOf(focus) + ' lost on this file. ' + nameOf(first.id) + ' won at ' + first.ratio + ' times smaller; ' + nameOf(focus) + ' came ' + ordinal(me.place) + ' at ' + me.ratio + ' times, ' + pct(me.bytes, first.bytes) + '% behind.';
}
export function ordinal(n) { return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : Number.isInteger(n) ? n + 'th' : ''; }

/** speedLine(results, focus) → the honest line about time, which LIGHT loses */
export function speedLine(results, focus = 'light') {
  const list = (Array.isArray(results) ? results : []).filter((r) => isObj(r) && Number.isFinite(r.ms) && r.ms >= 0);
  const me = list.find((r) => r.id === focus), others = list.filter((r) => r.id !== focus);
  if (!me || others.length === 0) return '';
  const fastest = others.reduce((a, b) => (b.ms < a.ms ? b : a));
  if (me.ms <= fastest.ms) return nameOf(focus) + ' was also the fastest here.';
  const times = fastest.ms > 0 ? Math.round(me.ms / fastest.ms) : 0;
  return nameOf(focus) + ' is the slow one: ' + Math.round(me.ms).toLocaleString('en-GB') + ' ms against ' + Math.round(fastest.ms).toLocaleString('en-GB') + ' ms for ' + nameOf(fastest.id) + (times > 1 ? ' (about ' + times.toLocaleString('en-GB') + ' times slower)' : '') + '. It trades time for size.';
}

/** table(record) → the per-type rows of the codec's sealed record, each with who won cold and who won with a shared seed.
 *  record.types[]: { key, label, items, raw, ladder: { 15: { frame }, 31: { frame } }, baselines: { gzip9, brotli11, zstd19, zstdSeed } } */
export function table(record) {
  const types = isObj(record) && Array.isArray(record.types) ? record.types : [];
  const rows = [];
  for (const t of types) {
    if (!isObj(t) || !isObj(t.ladder) || !isObj(t.baselines) || !whole(t.raw) || t.raw === 0) continue;
    const cold = isObj(t.ladder['15']) ? t.ladder['15'].frame : null, full = isObj(t.ladder['31']) ? t.ladder['31'].frame : null;
    const b = t.baselines;
    if (![cold, full, b.gzip9, b.brotli11, b.zstd19, b.zstdSeed].every((v) => whole(v) && v > 0)) continue;
    const coldBest = Math.min(b.gzip9, b.brotli11, b.zstd19), coldWho = coldBest === b.brotli11 ? 'Brotli 11' : coldBest === b.zstd19 ? 'Zstandard 19' : 'gzip 9';
    rows.push({ key: str(t.key), label: str(t.label), items: whole(t.items) ? t.items : 0, raw: t.raw,
      cold: { light: ratio(t.raw, cold), best: ratio(t.raw, coldBest), who: coldWho, lightWins: cold < coldBest },
      seeded: { light: ratio(t.raw, full), zstd: ratio(t.raw, b.zstdSeed), lightWins: full < b.zstdSeed } });
  }
  return rows;
}

/** bytes(n) → '1,234 bytes' | '12.3 KB' | '4.56 MB' */
export function bytes(n) {
  if (!whole(n)) return '';
  if (n < 10000) return n.toLocaleString('en-GB') + ' bytes';
  if (n < 1048576) return (Math.round(n / 102.4) / 10).toLocaleString('en-GB') + ' KB';
  return (Math.round(n / 10485.76) / 100).toLocaleString('en-GB') + ' MB';
}

export default { LANES, CAP, plan, ratio, placing, sentence, ordinal, speedLine, table, bytes };
