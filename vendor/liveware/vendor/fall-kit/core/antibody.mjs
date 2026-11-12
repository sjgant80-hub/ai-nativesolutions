// ════════════════════════════════════════════════════════════════
// core/antibody.mjs — every attack on the LIGHT wire becomes an antibody. Pure, total, integer-only, gated.
//
// The LIGHT door (vendor/light/packet.mjs) refuses a packet at a named stage, on raw bytes, before its body is decoded.
// This organ turns each refusal into two things a node can keep and share:
//   an EXACT antibody — the SHA-256 of the refused bytes. Those bytes are then recognised on sight, by family, without
//                       paying for an Ed25519 verify again.
//   a SHAPE antibody  — the refused packet's point in feature space (how it was built, as small integers). A new
//                       packet near a known one is named as a VARIANT of it — immunity to the family, not just the bytes.
//
// NO FALSE IMMUNITY. An exact antibody may only ever match bytes that can never be admitted. It is minted only for a
// PERMANENT stage — the bytes are malformed (size, magic, version, length, body) and stay malformed, or they fail the
// pinned key set (sender, signature) or the counters (counter only grows) they were refused under. A KEYED antibody
// names the exact key set it was minted under and matches only under that set: pin a new peer and it stops matching,
// and the door decides again. A dictionary refusal is not permanent (the dictionary may be installed later) and an
// error is never minted. Shape antibodies never refuse anything: they name and count. A node adopts a peer's antigens
// only by re-running them on its own door (vendor/immune/subscribe.mjs), so no peer can make a door refuse a packet it
// would admit.
//
// Powered by the Konomi architecture, created by Thomas Frumkin.
// ════════════════════════════════════════════════════════════════
import { MAGIC, HEADER, SIG } from './vendor/light/packet.mjs';
import { sha256 } from './vendor/light/sha256.mjs';

export const STAGE_INDEX = Object.freeze({ size: 0, magic: 1, version: 2, length: 3, dictionary: 4, sender: 5, signature: 6, counter: 7, body: 8, error: 9 });
export const PERMANENT = Object.freeze(['size', 'magic', 'version', 'length', 'sender', 'signature', 'counter', 'body']);
export const KEYED = Object.freeze(['sender', 'signature', 'counter']);
export const FAMILY = Object.freeze({ size: 'malformed', magic: 'foreign', version: 'malformed', length: 'malformed', dictionary: 'unknown-dictionary', sender: 'forged', signature: 'forged', counter: 'replay', body: 'poisoned', error: 'fault' });
export const WEIGHTS = Object.freeze([64, 1, 4, 2, 2, 2, 1, 1, 1, 1]);   // the stage dominates: a family never crosses stages
export const RADIUS = 24, MAX_LIBRARY = 4096, DIMS = 10;
const HEX64 = /^[0-9a-f]{64}$/;
const hex64 = (s) => typeof s === 'string' && HEX64.test(s);
const has = (o, k) => o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
const isBytes = (b) => b instanceof Uint8Array;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const hex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('');

/** The SHA-256 of some bytes, as hex. */
export const hashOf = (bytes) => hex(sha256(isBytes(bytes) ? bytes : new Uint8Array(0)));

/** How a packet was built, as ten small integers. Total: anything that is not bytes is an empty packet. */
export function features(bytes, stage) {
  const b = isBytes(bytes) ? bytes : new Uint8Array(0), len = b.length;
  const magic = MAGIC.reduce((k, m, i) => k + (b[i] === m ? 1 : 0), 0);   // past the end b[i] is undefined: no match
  let printable = 0;
  for (const x of b) if (x >= 0x20 && x <= 0x7e) printable++;
  const n = len >= HEADER ? ((b[19] << 24) | (b[20] << 16) | (b[21] << 8) | b[22]) >>> 0 : -1;
  const sig = len >= HEADER + SIG ? b.subarray(len - SIG) : null;
  return [
    has(STAGE_INDEX, stage) ? STAGE_INDEX[stage] : STAGE_INDEX.error,
    Math.min(len, 1600) >> 4,
    magic,
    len > 4 ? b[4] : 256,
    len > 18 ? b[18] : 256,
    n === -1 ? 129 : clamp(n - (len - HEADER - SIG), -64, 64) + 64,
    len > 8 ? ((b[5] | b[6] | b[7] | b[8]) === 0 ? 0 : 1) : 2,
    sig !== null && sig.every((x) => x === 0) ? 1 : 0,
    sig !== null && sig[63] >= 0x10 ? 1 : 0,
    len === 0 ? 0 : Math.floor((printable * 16) / len),
  ];
}

/** Weighted L1 distance between two feature points; anything that is not a point is infinitely far. */
export function distance(a, b) {
  if (!isPoint(a) || !isPoint(b)) return Infinity;
  let d = 0;
  for (let i = 0; i < DIMS; i++) d += WEIGHTS[i] * Math.abs(a[i] - b[i]);
  return d;
}
function isPoint(p) {
  if (!Array.isArray(p) || p.length !== DIMS) return false;
  for (const x of p) if (!Number.isInteger(x) || x < 0 || x > 256) return false;
  return true;
}

/** The family a refusal stage names. */
export const familyOf = (stage) => (has(FAMILY, stage) ? FAMILY[stage] : 'fault');

/**
 * Antibodies for one refused packet. ctx = { stage, keyset (hex SHA-256 of the pinned key set), hash? }.
 * → { exact: antibody | null, shape: antibody | null }. Pure.
 */
export function mint(bytes, ctx) {
  const c = ctx !== null && typeof ctx === 'object' ? ctx : {};
  const stage = has(STAGE_INDEX, c.stage) ? c.stage : null;
  if (stage === null || stage === 'error') return { exact: null, shape: null };
  const hash = hex64(c.hash) ? c.hash : hashOf(bytes);
  const keyed = KEYED.includes(stage);
  if (keyed && !hex64(c.keyset)) return { exact: null, shape: null };
  const family = FAMILY[stage];
  const exact = PERMANENT.includes(stage) ? { kind: 'exact', hash, stage, family, keyset: keyed ? c.keyset : null } : null;
  return { exact, shape: { kind: 'shape', point: features(bytes, stage), stage, family, of: hash } };
}

export const emptyLibrary = () => ({ exact: {}, shapes: [] });
const sizeOf = (lib) => Object.keys(lib.exact).length + lib.shapes.length;
const exactKey = (hash, keyset) => hash + '|' + (keyset === null ? '*' : keyset);

function validExact(a) {
  return has(a, 'kind') && a.kind === 'exact' && hex64(a.hash) && PERMANENT.includes(a.stage) &&
    a.family === FAMILY[a.stage] && (KEYED.includes(a.stage) ? hex64(a.keyset) : a.keyset === null);
}
function validShape(a) {
  return has(a, 'kind') && a.kind === 'shape' && has(STAGE_INDEX, a.stage) && a.stage !== 'error' && a.family === FAMILY[a.stage] &&
    isPoint(a.point) && a.point[0] === STAGE_INDEX[a.stage] && hex64(a.of);
}
function validLibrary(lib) {
  return lib !== null && typeof lib === 'object' && lib.exact !== null && typeof lib.exact === 'object' && !Array.isArray(lib.exact) && Array.isArray(lib.shapes);
}

/** Add antibodies to a library. Junk is skipped, duplicates are skipped, the library is bounded. → { library, added }. */
export function adopt(library, antibodies) {
  const base = validLibrary(library) ? library : emptyLibrary();
  const lib = { exact: { ...base.exact }, shapes: base.shapes.slice() };
  let added = 0;
  for (const a of Array.isArray(antibodies) ? antibodies : []) {
    if (sizeOf(lib) >= MAX_LIBRARY) break;
    if (validExact(a)) {
      const key = exactKey(a.hash, a.keyset);
      if (has(lib.exact, key)) continue;
      lib.exact[key] = { kind: 'exact', hash: a.hash, stage: a.stage, family: a.family, keyset: a.keyset };
      added++;
    } else if (validShape(a)) {
      if (lib.shapes.some((s) => s.of === a.of && distance(s.point, a.point) === 0)) continue;
      lib.shapes.push({ kind: 'shape', point: a.point.slice(), stage: a.stage, family: a.family, of: a.of });
      added++;
    }
  }
  return { library: lib, added };
}

/**
 * What a library knows about some bytes. ctx = { keyset, hash?, stage? }. The exact match is by hash, under the exact
 * key set for a keyed antibody; with a stage, the nearest shape within RADIUS names a variant (on a tie, the one adopted first). Pure, total.
 * → { exact: antibody | null, variant: { of, family, distance } | null }
 */
export function recognise(library, bytes, ctx) {
  const lib = validLibrary(library) ? library : emptyLibrary(), c = ctx !== null && typeof ctx === 'object' ? ctx : {};
  const hash = hex64(c.hash) ? c.hash : hashOf(bytes);
  const keyset = hex64(c.keyset) ? c.keyset : null;
  let exact = null;
  if (keyset !== null && has(lib.exact, exactKey(hash, keyset))) exact = lib.exact[exactKey(hash, keyset)];
  else if (has(lib.exact, exactKey(hash, null))) exact = lib.exact[exactKey(hash, null)];
  let variant = null;
  if (has(STAGE_INDEX, c.stage)) {
    const p = features(bytes, c.stage);
    for (const s of lib.shapes) {
      const d = distance(p, s.point);
      if (d <= RADIUS && (variant === null || d < variant.distance)) variant = { of: s.of, family: s.family, distance: d };
    }
  }
  return { exact, variant };
}
