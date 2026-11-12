// src/compress.mjs — T5, LIGHT against real baselines, as CLAIMS.md seals it. LIGHT is the vendored codec; the gzip,
// zstd and brotli baselines are injected (Node's zlib in CI; the browser's CompressionStream where it offers them), so
// this file only measures and proves the round trip. Pure but for the injected baselines.
import { encode, decode } from '../vendor/fall-kit/core/vendor/light/codec.mjs';
import { sha256, hex } from '../vendor/fall-kit/core/vendor/light/sha256.mjs';

export const ratio = (orig, out) => (out > 0 ? Math.round((orig / out) * 100) / 100 : 0);

/** compress bytes with LIGHT, decompress, and prove byte-identity → { ok, size, ratio, roundTrip, origSha, backSha } */
export function light(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(0);
  const e = encode(b);
  if (!e.ok) return { ok: false, why: e.why };
  const d = decode(e.bytes);
  // a failed decode gets a marker that is not a 64-hex digest, so the round-trip check is one comparison, no `&&`
  const origSha = hex(sha256(b)), backSha = d.ok ? hex(sha256(d.bytes)) : 'no-decode';
  const roundTrip = backSha === origSha;
  return { ok: true, orig: b.length, size: e.bytes.length, ratio: ratio(b.length, e.bytes.length), roundTrip, origSha, backSha };
}

/** one sample measured against every baseline. baselines = { gzip(bytes)→len, zstd?(bytes)→len, brotli?(bytes)→len } */
export function measureOne(bytes, baselines) {
  const l = light(bytes), out = { orig: l.orig, light: { size: l.size, ratio: l.ratio }, roundTrip: l.roundTrip, origSha: l.origSha };
  const bl = baselines !== null && typeof baselines === 'object' ? baselines : {};
  for (const name of ['gzip', 'zstd', 'brotli']) {
    if (typeof bl[name] !== 'function') { out[name] = null; continue; }
    try { const n = bl[name](bytes); out[name] = Number.isSafeInteger(n) && n > 0 ? { size: n, ratio: ratio(l.orig, n) } : null; } catch { out[name] = null; }
  }
  return out;
}

/** the headline range from a measured table, honest: the type at the low end and the type at the high end vs gzip */
export function headline(rows) {
  const r = (Array.isArray(rows) ? rows : []).filter((x) => x && x.light && x.light.ratio > 0 && x.gzip);
  if (!r.length) return null;
  const sorted = r.slice().sort((a, b) => a.light.ratio - b.light.ratio);
  const lo = sorted[0], hi = sorted[sorted.length - 1];
  return { lowType: lo.type, lowLight: lo.light.ratio, lowGzip: lo.gzip.ratio, highType: hi.type, highLight: hi.light.ratio, highGzip: hi.gzip.ratio };
}
