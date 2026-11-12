// src/rng.mjs — a seeded random stream (mulberry32): the same seed gives the same numbers in Node, in CI and in every
// browser, so the fuzz, the swarm and the samples a test draws re-run byte for byte. Pure and total.

/** a generator: next() → a whole number in [0, 2^32); int(n) → [0, n); bytes(n) → n random bytes */
export function rng(seed) {
  let a = (Number.isSafeInteger(seed) ? seed : 0) >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  const int = (n) => (Number.isSafeInteger(n) && n > 0 ? next() % n : 0);
  const bytes = (n) => { const len = Math.max(0, Number.isSafeInteger(n) ? n : 0); const out = new Uint8Array(len); for (let i = 0; i < len; i++) out[i] = next() & 255; return out; };
  return { next, int, bytes };
}
