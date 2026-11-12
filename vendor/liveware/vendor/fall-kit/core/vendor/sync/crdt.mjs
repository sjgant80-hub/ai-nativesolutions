// crdt.mjs — FallSync's merge law, pure and gated: a last-writer-wins map over Lamport time. The FallSync class
// (fallsync.js) keeps its transport, subscriptions and snapshots; this is the rule it merges by, and the shared
// foundation of the estate (fall-kit/core) vendors this file, so every node merges by the one law.
//
//   emptyDoc(docId)                      → { docId, lamport: 0, entries: {} }
//   setKey(doc, nodeId, key, value)      → { ok, doc, entry } | { ok: false, why }   the clock ticks, the write is stamped
//   deleteKey(doc, nodeId, key)          → { ok, doc, entry } | { ok: false, why }   a tombstone, so a delete also converges
//   entryWins(a, b)                      → does a replace b? the later Lamport time; on a tie, the larger node id
//   merge(doc, other)                    → { ok, doc, changed } | { ok: false, why }  commutative, associative, idempotent
//   validDoc(x) · valueOf(doc)           → is this a document? · its live keys and values, keys sorted
//
// Pure and total: every function returns a new document and never changes the one it was given.
// MIT · AI-Native Solutions.

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const whole = (n) => Number.isSafeInteger(n) && n >= 0;
export const MAX_KEY = 256;

function plain(v, depth) {
  if (v === null || typeof v === 'boolean' || typeof v === 'string') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (depth <= 0 || typeof v !== 'object') return false;
  if (Array.isArray(v)) return v.every((x) => plain(x, depth - 1));
  return Object.getPrototypeOf(v) === Object.prototype && Object.values(v).every((x) => plain(x, depth - 1));
}
const validKey = (k) => typeof k === 'string' && k.length >= 1 && k.length <= MAX_KEY;
const validEntry = (e) => isObj(e) && whole(e.ts) && e.ts >= 1 && typeof e.nodeId === 'string' && e.nodeId.length >= 1 && typeof e.deleted === 'boolean' && has(e, 'value') && plain(e.value, 32) && (!e.deleted || e.value === null);

export function emptyDoc(docId) {
  return typeof docId === 'string' && docId.length >= 1 ? { docId, lamport: 0, entries: {} } : null;
}

export function validDoc(x) {
  return isObj(x) && typeof x.docId === 'string' && x.docId.length >= 1 && whole(x.lamport) && isObj(x.entries)
    && Object.keys(x.entries).every((k) => validKey(k) && validEntry(x.entries[k]) && x.entries[k].ts <= x.lamport);
}

const copy = (doc) => ({ docId: doc.docId, lamport: doc.lamport, entries: { ...doc.entries } });

function write(doc, nodeId, key, value, deleted) {
  if (!validDoc(doc)) return { ok: false, why: 'not a document' };
  if (typeof nodeId !== 'string' || nodeId.length === 0) return { ok: false, why: 'a write names its node' };
  if (!validKey(key)) return { ok: false, why: 'a key is 1–' + MAX_KEY + ' characters' };
  if (!deleted && !plain(value, 32)) return { ok: false, why: 'the value is not plain JSON' };
  const next = copy(doc);
  next.lamport = doc.lamport + 1;
  const entry = { value: deleted ? null : value, ts: next.lamport, nodeId, deleted };
  next.entries[key] = entry;
  return { ok: true, doc: next, entry };
}
export const setKey = (doc, nodeId, key, value) => write(doc, nodeId, key, value, false);
export const deleteKey = (doc, nodeId, key) => write(doc, nodeId, key, null, true);

/** Does entry a replace entry b? */
export function entryWins(a, b) {
  if (!b) return true;
  if (!a) return false;
  return a.ts > b.ts || (a.ts === b.ts && a.nodeId > b.nodeId);
}

/** Another document folded in: for every key the winning entry stays. */
export function merge(doc, other) {
  if (!validDoc(doc) || !validDoc(other)) return { ok: false, why: 'not a document' };
  if (doc.docId !== other.docId) return { ok: false, why: 'another document' };
  const next = copy(doc), changed = [];
  next.lamport = Math.max(doc.lamport, other.lamport);
  for (const key of Object.keys(other.entries).sort()) {
    const local = has(doc.entries, key) ? doc.entries[key] : undefined;
    const remote = other.entries[key];
    if (entryWins(remote, local)) { next.entries[key] = { ...remote }; changed.push(key); }
  }
  return { ok: true, doc: next, changed };
}

/** What the document says now: live keys and their values, keys in order. */
export function valueOf(doc) {
  if (!validDoc(doc)) return null;
  const out = {};
  for (const k of Object.keys(doc.entries).sort()) if (!doc.entries[k].deleted) out[k] = doc.entries[k].value;
  return out;
}
