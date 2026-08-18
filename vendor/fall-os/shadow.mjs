// shadow.mjs — THE SHADOW-INDEX · catch the un-collapsed 99%.
//
// Every collapse casts a shadow: the roads-not-taken the core already keeps but that otherwise
// evaporate. This organ CATCHES them — content-addresses each un-collapsed branch (so the same
// branch forked-toward across DIFFERENT decisions dedupes and counts up), and runs a recurrence
// detector: the branch you keep circling but never commit to is the signal for the next build.
//
// Zero myth: "keep the roads-not-taken, address them, count them, search them." Zero new compute:
// a COLLECTOR on outputs the Oracle / re-collapse / generative estate already produce and discard.
// It imports only the core's content-address (h16) — a REMEMBER-adjacent organ of the one body.
import { h16 } from './core.mjs';

export function makeIndex() { return { shadows: new Map(), order: [] }; }

// a branch → stable text → its content address. (collapse roads carry {value:{label,...}}.)
export function describe(branch) {
  if (typeof branch === 'string') return branch;
  if (branch && branch.value !== undefined) return (branch.value && branch.value.label) ? String(branch.value.label) : JSON.stringify(branch.value);
  return JSON.stringify(branch);
}

// CAST one un-collapsed branch, tagged by the decision that cast it. Dedupes by content:
// the same branch from a DIFFERENT decision ⇒ +1 distinct context ⇒ times_shadowed rises.
export function cast(idx, branch, decision) {
  const desc = describe(branch), id = h16(desc), dec = String(decision);
  let e = idx.shadows.get(id);
  if (!e) { e = { id, branch: desc, first_seen_at: dec, contexts: [], times_shadowed: 0, related: [] }; idx.shadows.set(id, e); idx.order.push(id); }
  if (!e.contexts.includes(dec)) e.contexts.push(dec);   // count DISTINCT decisions, not repeats
  e.times_shadowed = e.contexts.length;
  return e;
}

// CAST the whole shadow of one collapse() — every road-not-taken becomes a shadow of `decision`,
// recorded as siblings (related). THIS is the hook every organ wires to; it invents nothing.
export function castShadow(idx, collapsed, decision) {
  const roads = (collapsed && collapsed.roads) ? collapsed.roads : [];
  const cast_ = roads.map(r => cast(idx, r, decision));
  const ids = cast_.map(e => e.id);
  for (const e of cast_) for (const sib of ids) if (sib !== e.id && !e.related.includes(sib)) e.related.push(sib);
  return cast_;
}

// RECURRENCE — the payoff. Rank shadows by the number of DISTINCT decisions that forked toward
// them; ≥ threshold across different decisions = a pattern = the un-collapsed next-build signal.
export function recurring(idx, threshold = 3) {
  return [...idx.shadows.values()]
    .filter(e => e.times_shadowed >= threshold)
    .sort((a, b) => b.times_shadowed - a.times_shadowed || a.branch.localeCompare(b.branch));
}
export function ranked(idx) {
  return [...idx.shadows.values()].sort((a, b) => b.times_shadowed - a.times_shadowed || a.branch.localeCompare(b.branch));
}

// QUERY — mine the shadow (it's a library, not a graveyard).
export const shadowsOf = (idx, decision) => [...idx.shadows.values()].filter(e => e.contexts.includes(String(decision)));   // "what did I nearly build HERE"
export function twinsOf(idx, branch) { const e = idx.shadows.get(h16(describe(branch))); return e ? e.related.map(id => idx.shadows.get(id)).filter(Boolean) : []; }  // "the un-collapsed twin of X"
export function related(idx, id) { const e = idx.shadows.get(id); return e ? e.related.map(r => idx.shadows.get(r)).filter(Boolean) : []; }

// RESURRECT — promote a shadow back to a live possibility-spec, to hand to the generative estate.
export function resurrect(idx, id) {
  const e = idx.shadows.get(id);
  return e ? { spec: e.branch, from: 'shadow:' + id, forked_toward: e.times_shadowed, contexts: e.contexts.slice() } : null;
}

export default { makeIndex, describe, cast, castShadow, recurring, ranked, shadowsOf, twinsOf, related, resurrect };
