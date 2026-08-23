// ai-nativesolutions · stages.mjs — the company's own operating board, honest by construction.
//
// AI Native Solutions runs itself on the FallCorp architecture: every seat is an AGENT seat
// unless it holds one of four HUMAN doors (money, legal, taste, client-trust). This kernel is
// the honesty gate on the board that shows it: a stage may claim LIVE only with a proof link,
// a door must be held by a human, and the summary is DERIVED, never typed. If the board could
// say "live" without proof it would be the vendor lie the whole company exists to refute — so
// the kernel refuses it.
//
// Pure, total. The page renders what this accepts; the suite makes every rule falsifiable.

export const STATES = Object.freeze(['PLANNED', 'BUILT', 'LIVE']);
export const DOORS = Object.freeze(['money', 'legal', 'taste', 'client-trust']);

const str = (v) => typeof v === 'string' ? v : '';
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? v : null;

/** One stage judged. LIVE demands a proof URL; BUILT demands the machinery be named; all speak. */
export function validStage(s) {
  const o = obj(s);
  if (!o) return { ok: false, why: 'not a stage' };
  if (!Number.isInteger(o.n) || o.n < 1 || o.n > 6) return { ok: false, why: 'a stage is numbered 1..6' };
  if (!str(o.seat).trim()) return { ok: false, why: `stage ${o.n} names no seat` };
  if (!STATES.includes(o.state)) return { ok: false, why: `stage ${o.n} has no real state (PLANNED/BUILT/LIVE)` };
  if (o.state === 'LIVE' && !/^https?:\/\//.test(str(o.proof))) {
    return { ok: false, why: `stage ${o.n} claims LIVE but shows no proof link — a live claim without proof is the vendor lie this company refutes` };
  }
  if (o.state !== 'PLANNED' && !str(o.machinery).trim()) {
    return { ok: false, why: `stage ${o.n} is ${o.state} but names no machinery — what actually does the work?` };
  }
  if ('door' in o && o.door !== null && !DOORS.includes(o.door)) {
    return { ok: false, why: `stage ${o.n} names a door "${str(o.door)}" that is not one of the four` };
  }
  return { ok: true, why: str(o.seat) };
}

/**
 * The whole board judged + summarised. Every stage valid, exactly the six present, every one of
 * the four human doors held by a human somewhere, and the 90/10 derived from the seats — the
 * agent seats are the operational stages, the humans hold the doors. Nothing about the ratio is
 * typed; it falls out of the structure.
 */
export function board(stages, doors) {
  const list = Array.isArray(stages) ? stages : [];
  if (list.length !== 6) return { ok: false, why: `the roadmap is six stages — got ${list.length}` };
  const seen = new Set();
  for (const s of list) {
    const v = validStage(s);
    if (!v.ok) return v;
    if (seen.has(s.n)) return { ok: false, why: `stage ${s.n} is listed twice` };
    seen.add(s.n);
  }
  // no missing-stage check needed: six stages, each valid (n in 1..6) and unique, are exactly
  // {1..6} by pigeonhole. A defensive loop here would be unreachable — so it isn't written.

  const d = obj(doors) || {};
  for (const door of DOORS) {
    if (str(d[door]).toLowerCase() !== 'human') {
      return { ok: false, why: `the ${door} door is not held by a human — the four doors are the product's core claim; an agent at a door poisons the pitch` };
    }
  }

  const live = list.filter(s => s.state === 'LIVE').length;
  const built = list.filter(s => s.state === 'BUILT').length;
  const planned = list.filter(s => s.state === 'PLANNED').length;
  return {
    ok: true,
    live, built, planned,
    doorsHuman: DOORS.length,
    why: `${live} live · ${built} built · ${planned} planned · all four doors human`,
    // the honest headline: agents run the operational seats, humans hold the doors
    ratio: 'agents run the ' + list.length + ' operational seats; humans hold the ' + DOORS.length + ' doors',
  };
}

export default board;
