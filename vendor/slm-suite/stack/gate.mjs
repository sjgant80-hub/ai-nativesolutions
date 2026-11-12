// stack/gate.mjs — the shared stack's gate (pure; no I/O; the same for every vertical). Nothing ungrounded surfaces:
//   · readFacts: the model's output is read against the vertical's fact schema; anything that does not fit is refused.
//   · cleanSummary: the model's one-sentence summary is the only free text it contributes; a summary that cites law or
//     names a date on its own is withheld (provisions and dates come only from the library).
//   · decide: the facts go to the library; a missing critical fact means ABSTAIN with the reason; every provision the
//     library returns must be in the verified table, and is cited from it.
//   · citeId / invented: read free-text citations (to grade a raw model the same way) and count the invented ones.

/** firstObject(text) → the first {...} object in a text, parsed, or null */
export function firstObject(text) {
  const s = String(text ?? ''), at = s.indexOf('{');
  if (at === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = at; i !== s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) { try { return JSON.parse(s.slice(at, i + 1)); } catch { return null; } }
  }
  return null;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const okDate = (v) => v === null || (typeof v === 'string' && ISO.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z')) && new Date(v + 'T00:00:00Z').toISOString().startsWith(v));
/** readFacts(text, schema) → the facts the schema allows, or null. schema: { key: 'date' | 'number' | 'boolean' | 'int' | 'text' | [allowed…] } */
export function readFacts(text, schema) {
  const o = firstObject(text);
  if (!o) return null;   // firstObject gives an object or null, never an array or a scalar
  const out = {};
  for (const [k, t] of Object.entries(schema)) {
    const v = o[k];
    const ok = Array.isArray(t) ? t.includes(v)
      : t === 'date' ? okDate(v)
      : t === 'number' ? typeof v === 'number' && Number.isFinite(v) && v >= 0
      : t === 'int' ? Number.isInteger(v) && v >= 0 && v <= 9
      : t === 'boolean' ? typeof v === 'boolean'
      : typeof v === 'string' && v.length <= 400;
    if (!ok) return null;
    out[k] = v;
  }
  return out;
}

const LAWISH = /\b(s\.|ss\.|sec\.|section|sections|reg\.|regulation|regulations|act|acts|schedule|para\.)\s*\d|\b\w+ act \d{4}\b|\b(statute|legislation)\b/i;
const DATEISH = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{1,2}(st|nd|rd|th)?\s+(of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(st|nd|rd|th)?\b/i;
/** cleanSummary(s) → { summary, withheld } — withheld names why a summary was not passed on (it cited law or dates) */
export function cleanSummary(s) {
  const t = String(s ?? '').trim();
  if (LAWISH.test(t)) return { summary: '', withheld: 'cites-law' };
  if (DATEISH.test(t)) return { summary: '', withheld: 'names-a-date' };
  return { summary: t, withheld: null };
}

/** decide(modelText, { today, schema, answer, table }) → the gated result: abstain with a reason, or the library's answer cited from the table */
export function decide(modelText, { today, schema, answer, table }) {
  const facts = readFacts(modelText, schema);
  if (!facts) return { abstain: true, reason: 'could-not-read', missing: [], facts: null, answer: null, cites: [], summary: '', withheld: null };
  const a = answer({ ...facts, today });
  const known = new Map(table.map((p) => [p.id, p]));
  const unknown = a.rights.filter((id) => !known.has(id));
  const { summary, withheld } = cleanSummary(facts.summary);
  if (a.abstain) return { abstain: true, reason: 'missing-facts', missing: a.missing, facts, answer: a, cites: [], summary, withheld };
  if (unknown.length) return { abstain: true, reason: 'not-in-verified-table', missing: [], facts, answer: a, cites: [], summary, withheld, unknown };
  return { abstain: false, reason: null, missing: [], facts, answer: a, cites: a.rights.map((id) => known.get(id)), summary, withheld };
}

/** citeId(text, patterns) → the id of the first table provision a free-text citation names, or null. patterns: [[id, RegExp]] */
export function citeId(text, patterns) {
  for (const [id, re] of patterns) if (re.test(String(text))) return id;
  return null;
}
/** invented(citations, applicable, patterns) → the citations that name nothing in the table, or a provision that does not apply */
export function invented(citations, applicable, patterns) {
  return citations.filter((c) => { const id = citeId(c, patterns); return id === null || !applicable.includes(id); });
}

export default { firstObject, readFacts, cleanSummary, decide, citeId, invented };
