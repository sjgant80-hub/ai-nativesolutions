// didy.mjs — DIDY, the ONE conductor of fall-os (the nervous system).
//
// An OS is not 20 tools stuck together: it's ONE core (the bloodstream — core.mjs) + ONE conductor
// (a Didy) with every build registered as an ORGAN that routes through them. The Didy runs the single
// cycle EXPLORE → RESOLVE → VERIFY → BUILD → REMEMBER, and EVERY phase calls the shared core (fork on
// the golden offset / hold at the κ-gate / collapse deliberately / cache by content). So an upgrade to
// the core improves every pass at once. Grounded: it BUILDs only what an author collapses (never
// reflexive); the roads-not-taken are remembered into the shadow-index, not thrown away.
//
// A DIDY is the generic conductor that ships with every fork: blank, untrained. You TRAIN it by
// registering organs and SIGN it with your prefix — a trained instance is a `<prefix>-didy`, a new
// signed branch of the fold-tree. A blank Didy has no prefix; the prefix is the mark of whose it is.
import { fork, hold, collapse, makeCache } from './core.mjs';
import { makeIndex, cast } from './shadow.mjs';

export function makeDidy(prefix = '') {
  const p = String(prefix == null ? '' : prefix).trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  return { name: p ? p + '-didy' : 'didy', prefix: p, organs: {}, memory: [], shadow: makeIndex(), cache: makeCache(), log: [] };
}

// TRAIN a Didy: register an organ into a phase. Organs supply core-callable pieces (generate/score/author)
// and are CALLED BY the loop — never run standalone. This is the fall-os "wrap, don't rebuild" seam:
// training a blank Didy into yours is plugging your organs in.
export function register(c, name, organ) {
  if (!name || !organ || typeof organ !== 'object') return { ok: false, why: 'name + organ object required' };
  c.organs[name] = { name, phase: organ.phase || 'explore', ...organ };
  return { ok: true, name };
}
export const train = register;   // vocabulary: you TRAIN a Didy by registering its organs
export const organsFor = (c, phase) => Object.values(c.organs).filter(o => o.phase === phase);

// THE ONE LOOP. A decision in → a remembered build out (or an open field if nothing is authored).
export function conduct(c, decision, { n = 6, author = null } = {}) {
  const dec = String(decision == null ? '' : decision).trim();
  const ex = organsFor(c, 'explore')[0];                                   // the explore-organ (e.g. the Oracle)
  const generate = (ex && ex.generate) || ((i, theta) => ({ label: dec + ' · branch ' + i, theta }));
  const score = (ex && ex.score) || (v => ((v.theta || 0) % 360) / 360);
  const auth = author || (ex && ex.author) || null;
  const branches = fork(n, generate, {});                                  // EXPLORE — via the shared golden fork
  const held = hold(branches, score);                                      // RESOLVE — at the shared κ-gate
  const field = collapse(held, auth);                                      // VERIFY — the collapse is AUTHORED, never reflexive
  const built = field.decided ? field.chosen : null;                       // BUILD — only an authored, held branch stands
  if (built) { c.cache.once(dec, () => built); c.memory.push({ decision: dec, built: built.value, score: built.score }); }  // build-once + REMEMBER the taken
  for (const r of field.roads) cast(c.shadow, r, 'conduct:' + dec);        // REMEMBER the roads-not-taken → the shadow-index
  for (const h of field.holds) if (!built || h.i !== built.i) cast(c.shadow, h, 'conduct:' + dec);
  c.log.push({ decision: dec, explored: branches.length, held: field.holds.length, built: !!built });
  return { decision: dec, field, built, remembered: !!built };
}

export default { makeDidy, register, train, organsFor, conduct };
