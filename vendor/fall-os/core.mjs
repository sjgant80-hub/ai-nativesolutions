// core.mjs — LIVEWARE · THE ONE MOVE, as shared DNA.
//
// Every organ built this window is the SAME operation aimed at a different target:
//   hold possibility open  →  fork on the golden offset (so branches diverge, not cluster)
//   →  resolve at the κ-gate (≥κ holds, <κ clashes)  →  collapse DELIBERATELY (never auto)
//   →  cache by content (run(S)==S, build once).
// The Oracle (future), re-collapse (past) and the generative estate (build-space) are this
// one move with a different (generate, score, choose) injected. Build the core once; the
// organs are its expressions. Generators/scorers are INJECTED so the core stays pure,
// deterministic and gated — the gated logic IS the live logic.

export const PHI = (1 + Math.sqrt(5)) / 2;              // golden ratio
export const KAPPA = 1 / PHI;                           // ≈ 0.6180339887 — the collapse threshold (1/φ)
export const GOLDEN_DEG = 360 / (PHI * PHI);            // ≈ 137.5077640 — the divergence offset (golden angle)

const clamp01 = x => (x < 0 ? 0 : (x > 1 ? 1 : x));

// ── content address: deterministic FNV-1a ×2 → 16 hex (the estate's h16). Same content ⇒ same key. ──
export function h16(s) {
  s = String(s);
  let a = 0x811c9dc5 >>> 0, b = 0x9e3779b9 >>> 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul((b ^ c) >>> 0, 0x85ebca6b) >>> 0;
    b = ((b << 13) | (b >>> 19)) >>> 0;
  }
  return (b >>> 0).toString(16).padStart(8, '0') + (a >>> 0).toString(16).padStart(8, '0');
}

// ── FORK: generate N DIVERGENT branches. Branch i is seeded at angle i·137.5° so the branches
//    spread across the space instead of clustering near the obvious (the three-gap property of the
//    golden angle). `generate(i, theta)` is injected — it turns an index+angle into a candidate. ──
export function fork(n, generate, { seed = 0 } = {}) {
  const k = Math.max(0, Math.floor(n));
  const out = [];
  for (let i = 0; i < k; i++) {
    const theta = (((seed + i) * GOLDEN_DEG) % 360 + 360) % 360;
    out.push({ i, theta, value: generate(i, theta) });
  }
  return out;
}

// ── HOLD: keep the branches un-collapsed, each SCORED but not chosen. `score(value) → [0,1]`.
//    A branch HOLDS iff its score ≥ κ, else it CLASHES. Nothing is decided here — possibility is
//    held open, side by side. This is the dream state: everything at once, nothing collapsed. ──
export function hold(branches, score) {
  return branches.map(b => {
    const s = clamp01(Number(score(b.value)));
    return { i: b.i, theta: b.theta, value: b.value, score: s, holds: s >= KAPPA };
  });
}

// ── COLLAPSE: DELIBERATE. Surfaces the branches that HOLD (best first) AND the roads-not-taken
//    (the clashed branches — KEPT, not discarded: this is the L6 "shadow", the un-collapsed
//    complement, made queryable). It NEVER auto-decides: a winner is chosen only if an `author`
//    function is supplied (VERIFY, or a person). Without an author, collapse PRESENTS the field
//    and `decided` is false. This is the load-bearing safety — the collapse is authored. ──
export function collapse(held, author = null) {
  const holds = held.filter(b => b.holds).slice().sort((a, b) => b.score - a.score || a.i - b.i);
  const roads = held.filter(b => !b.holds).slice().sort((a, b) => b.score - a.score || a.i - b.i);
  let chosen = null;
  if (typeof author === 'function') { const c = author(holds, roads); chosen = (c === undefined ? null : c); }
  return { holds, roads, chosen, decided: chosen !== null };
}

// ── CACHE: content-addressed. run(S)==S — the same spec collapses ONCE, then replays. ──
export function makeCache() {
  const m = new Map();
  return {
    has: k => m.has(h16(k)),
    get: k => m.get(h16(k)),
    once: (k, produce) => { const key = h16(k); if (!m.has(key)) m.set(key, produce()); return m.get(key); },
    size: () => m.size,
    keys: () => [...m.keys()],
  };
}

// ── THE ONE MOVE, composed. hold-open → fork(golden) → hold(resolve) → collapse(authored).
//    Optionally cached by content so a given spec builds once. This function IS the framework in
//    one call; an organ is a choice of (generate, score, author) plus a target `spec`. ──
export function move(spec, { n = 8, generate, score, author = null, cache = null, seed = 0 } = {}) {
  if (typeof generate !== 'function') throw new TypeError('move: generate(i,theta) is required');
  if (typeof score !== 'function') throw new TypeError('move: score(value) is required');
  const run = () => collapse(hold(fork(n, generate, { seed }), score), author);
  return cache ? cache.once(String(spec) + '|n=' + n + '|seed=' + seed, run) : run();
}

// ── an ORGAN = the one move with a fixed (generate, score, author) triple, aimed at a target.
//    This is how the past/present/future organs are the same DNA differently expressed. ──
export function organ({ generate, score, author = null, n = 8 }) {
  const cache = makeCache();
  return {
    run: (spec, opts = {}) => move(spec, { n, generate, score, author, cache, ...opts }),
    cache,
  };
}

export default { PHI, KAPPA, GOLDEN_DEG, h16, fork, hold, collapse, makeCache, move, organ };
