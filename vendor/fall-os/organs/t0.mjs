// t0.mjs — TIER 0 · the conductor's brain when there is NO model at all.
//
// The page could describe fall-os but handed a visitor nothing to use: the demo forked
// "candidate 1", "candidate 2" — it SHOWED the core and DID nothing. This organ is what makes the
// conductor usable on the visitor's own words with zero setup: no key, no download, no server, no
// network. It is the EXPLORE organ that `conduct()` calls, so the five phases run on real input.
//
// WHAT IT HONESTLY IS: a deterministic decision-framing tool. It does not understand the sentence.
// It looks for SIGNALS it can name (cue words), and forks a fixed taxonomy of decision STANCES
// scored against those signals. That is a real, useful thing — a scored field of stances grounded
// in evidence quoted back from your own text, with the rejected ones kept as roads-not-taken.
//
// WHAT IT IS NOT: a language model. It cannot paraphrase you, and it never pretends to. Every score
// is traceable to a cue word it will show you, and when it finds nothing it SAYS so rather than
// inventing a reading. `evidence()` is exported precisely so the UI can display the basis — a score
// a visitor cannot audit is a number they have no reason to trust.
//
// Tier 1 (in-browser WebLLM) and above phrase these stances against the specific decision. They
// improve the WORDING. The field, the gate and the shadow are this file either way.

// ── SIGNALS ──────────────────────────────────────────────────────────────────────────────────────
//
// Each signal is a named thing to look for, with the literal cues that count as finding it. Cues are
// matched on word boundaries so "user" does not fire inside "users" by accident of substring — plural
// forms are listed where they are wanted. Deliberately small and readable: a visitor can check it.
export const SIGNALS = [
  { id: 'reversible',   label: 'easy to undo',        cues: ['try', 'trial', 'experiment', 'prototype', 'pilot', 'revert', 'undo', 'reversible', 'draft', 'spike'] },
  { id: 'irreversible', label: 'hard to undo',        cues: ['migrate', 'migration', 'rewrite', 'replace', 'delete', 'permanent', 'irreversible', 'sign', 'launch', 'publish', 'hire', 'fire', 'sell', 'commit'] },
  { id: 'deadline',     label: 'time pressure',       cues: ['deadline', 'urgent', 'urgently', 'asap', 'today', 'tomorrow', 'friday', 'monday', 'late', 'overdue', 'behind', 'soon'] },
  { id: 'cost',         label: 'money at stake',      cues: ['cost', 'costs', 'expensive', 'cheap', 'budget', 'price', 'pricing', 'spend', 'spending', 'pay', 'paid', 'afford', 'invoice'] },
  { id: 'risk',         label: 'something can break', cues: ['risk', 'risky', 'safe', 'safety', 'danger', 'dangerous', 'break', 'breaks', 'broken', 'fail', 'fails', 'failure', 'outage', 'security', 'legal', 'compliance', 'liability'] },
  { id: 'scale',        label: 'affects many things', cues: ['all', 'every', 'whole', 'entire', 'everything', 'everyone', 'bulk', 'mass', 'fleet', 'thousands', 'millions'] },
  { id: 'unknown',      label: 'genuine uncertainty', cues: ['unsure', 'unclear', 'maybe', 'perhaps', 'might', 'guess', 'wondering', 'confused', 'whether'] },
  { id: 'people',       label: 'other people affected', cues: ['team', 'client', 'clients', 'customer', 'customers', 'user', 'users', 'partner', 'staff', 'stakeholder', 'stakeholders', 'colleague', 'colleagues', 'boss'] },
  { id: 'existing',     label: 'something already runs', cues: ['existing', 'current', 'currently', 'already', 'legacy', 'live', 'production', 'incumbent'] },
  { id: 'speed',        label: 'wants to move fast',  cues: ['fast', 'quick', 'quickly', 'ship', 'now', 'immediately', 'mvp', 'rapid'] },
];

const WORD = /[a-z0-9£$]+/g;

/**
 * What the text actually says, as far as this organ can tell. Returns the signals FOUND, each with
 * the cue words that fired — so the score can be audited against the visitor's own sentence — plus
 * `found: false` when there is nothing, which the UI is expected to say out loud.
 *
 * A question mark counts toward `unknown`: it is the one piece of punctuation that reliably carries
 * meaning here, and a decision phrased as a question is genuinely less settled than one phrased flat.
 */
export function evidence(text) {
  const s = String(text == null ? '' : text).toLowerCase();
  const words = new Set(s.match(WORD) || []);
  const signals = [];
  for (const sig of SIGNALS) {
    const hits = sig.cues.filter(c => words.has(c));
    if (sig.id === 'unknown' && s.includes('?') && !hits.includes('?')) hits.push('?');
    if (hits.length) signals.push({ id: sig.id, label: sig.label, cues: hits });
  }
  return { signals, ids: signals.map(x => x.id), found: signals.length > 0, words: words.size };
}

// ── STANCES ──────────────────────────────────────────────────────────────────────────────────────
//
// A fixed taxonomy of ways to come at a decision. `wants` raise a stance, `avoids` lower it, and
// `prior` is how strong the stance is with NO signal at all — a stated default, not a learned weight.
// The priors are deliberately not uniform: "ship the smallest reversible slice" really is the better
// blind bet than "run both in parallel", and pretending otherwise would make the tool useless on the
// short inputs most people type first.
export const STANCES = [
  { name: 'Ship the smallest reversible slice', move: 'Find the version you could undo on Monday, and do that one.', prior: 0.64, wants: ['reversible', 'unknown', 'speed'], avoids: ['irreversible'] },
  { name: 'Verify before you commit',           move: 'Decide what would prove this wrong, and go look for it first.', prior: 0.62, wants: ['irreversible', 'risk', 'scale'], avoids: ['reversible'] },
  { name: 'Cut the scope, not the quality',     move: 'Drop whole features rather than doing all of them badly.', prior: 0.60, wants: ['deadline', 'cost', 'scale'], avoids: [] },
  { name: 'Do the irreversible part last',      move: 'Reorder the work so every undoable step happens before the one-way door.', prior: 0.54, wants: ['irreversible', 'risk'], avoids: [] },
  { name: 'Set a stop rule before you start',   move: 'Write down now what result would make you abandon this.', prior: 0.52, wants: ['cost', 'unknown', 'scale'], avoids: [] },
  { name: 'Buy or reuse instead of building',   move: 'Check whether the boring paid version ends this today.', prior: 0.50, wants: ['cost', 'deadline', 'existing'], avoids: ['scale'] },
  { name: 'Talk to whoever it lands on',        move: 'Ask the people who live with the result before you pick.', prior: 0.48, wants: ['people', 'irreversible'], avoids: ['speed'] },
  { name: 'Run the new one beside the old one', move: 'Keep what works running until the replacement has earned the swap.', prior: 0.46, wants: ['existing', 'risk', 'irreversible'], avoids: ['cost'] },
  { name: 'Hold it open — decide later',        move: 'Name the date you will decide, and spend nothing until then.', prior: 0.44, wants: ['unknown'], avoids: ['deadline', 'speed'] },
  { name: 'Do nothing — waiting is cheap here', move: 'If nothing breaks by not choosing, that is the choice.', prior: 0.40, wants: ['unknown', 'reversible'], avoids: ['deadline', 'risk'] },
];

const clamp01 = (x) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

/**
 * Score one stance against found signals. Traceable by construction: the returned `why` lists exactly
 * which signals pushed it up and which pushed it down, so the number can be checked against the text.
 */
export function scoreStance(stance, ids) {
  const present = new Set(ids);
  const wantHit = (stance.wants || []).filter(w => present.has(w));
  const avoidHit = (stance.avoids || []).filter(a => present.has(a));
  const wantFrac = stance.wants && stance.wants.length ? wantHit.length / stance.wants.length : 0;
  const avoidFrac = stance.avoids && stance.avoids.length ? avoidHit.length / stance.avoids.length : 0;
  const score = clamp01(stance.prior + 0.45 * wantFrac - 0.30 * avoidFrac);
  return { score, up: wantHit, down: avoidHit };
}

/**
 * The organ, in the shape `conduct()` expects: `{ phase, generate, score }`.
 *
 * `generate(i, theta)` is called by the core's `fork`, which walks i = 0,1,2… and hands back the
 * golden angle. The stance is picked by STEPPING THROUGH THE TAXONOMY AT THE GOLDEN OFFSET rather
 * than in list order — so a visitor asking for 4 branches gets four spread across the taxonomy
 * instead of the first four in the file, which is the whole point of forking on 137.5°. Modulo the
 * list length it is a bijection for any n ≤ the taxonomy size, so nothing is visited twice.
 */
export function t0Organ(text) {
  const ev = evidence(text);
  const seen = new Set();
  return {
    phase: 'explore',
    evidence: ev,
    generate(i, theta) {
      // A fork always walks i upward from zero, so a zero index marks the START of one. Clearing here makes the
      // organ safe to run more than once — without it the "already handed out" set survives into the
      // next fork and the SAME organ answers the SAME question with a different field. That is not a
      // cosmetic bug: the conductor re-runs the loop when the visitor authors a branch, so committing
      // "verify before you commit" would quietly build something they never saw.
      if (i === 0) seen.clear();
      // Walk the taxonomy by the golden step, skipping any stance already handed out. The skip loop
      // is what keeps it a permutation when n approaches the taxonomy size.
      let idx = Math.round((theta / 360) * STANCES.length) % STANCES.length;
      let guard = 0;
      while (seen.has(idx) && guard < STANCES.length) { idx = (idx + 1) % STANCES.length; guard++; }
      seen.add(idx);
      const st = STANCES[idx];
      const { score, up, down } = scoreStance(st, ev.ids);
      return { label: st.name, move: st.move, stance: st.name, precomputed: score, up, down, theta };
    },
    score(v) { return clamp01(v && typeof v.precomputed === 'number' ? v.precomputed : 0); },
  };
}

/**
 * Read a field the conductor produced back as plain English. The estate's rule is that nothing is
 * silently dropped: this reports how many stances held, how many were kept as roads-not-taken, and
 * — when the text carried no signal at all — says that in place of implying the scores meant more
 * than the stated priors.
 */
export function summarise(field, ev) {
  const held = field && field.holds ? field.holds.length : 0;
  const roads = field && field.roads ? field.roads.length : 0;
  if (!ev || !ev.found) {
    return `No signals found in that text, so these are ranked by their stated defaults only — ${held} held, ${roads} kept as roads-not-taken. Say more about what is at stake and the ranking will change.`;
  }
  const names = ev.signals.map(s => s.label).join(', ');
  return `Found ${ev.signals.length} signal${ev.signals.length === 1 ? '' : 's'} in your text (${names}). ${held} stance${held === 1 ? '' : 's'} cleared the gate; ${roads} kept as roads-not-taken.`;
}

export default { SIGNALS, STANCES, evidence, scoreStance, t0Organ, summarise };
