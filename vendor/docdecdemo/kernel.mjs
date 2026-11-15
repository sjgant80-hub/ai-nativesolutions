// docdecdemo · kernel.mjs — the grounded document router (the product's transparent grounding layer).
//
// Decides, for a question: answer from a document WITH a citation, or ABSTAIN ('not in your documents'). The gate is
// tunable — a structural distinctive-term match, a coverage/focus check, and an optional local-embedding relevance
// veto (still sovereign). The production engine deepens the routing privately; these behaviours do not change. A plain
// vector-RAG has no route — only a nearest-chunk top1. Inlined verbatim into index.html (a parity test holds them equal);
// the kernel is proven by a mutation gate in the private engine repo.

const arr = (x) => (Array.isArray(x) ? x : []);
const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
const str = (x) => (typeof x === 'string' ? x : '');

const STOP = new Set(('a an and the of to in on for is are was were be been being as at by with from this that these those it its ' +
  'which who whom whose what when where why how do does did not no nor can could would should will shall may might must ' +
  'i you he she they we me him her them us my your his their our or if then than so such about into over under out up down ' +
  'have has had been more most some any all each both few other own same very s t').split(' '));

// tokens(text) → the distinctive content tokens of a string: lowercased words, stopwords and 1-char tokens dropped, de-duplicated.
export function tokens(text) {
  const raw = str(text).toLowerCase().match(/[a-z0-9]+/g) || [];
  const out = [];
  const seen = new Set();
  for (const w of raw) {
    if (w.length < 2 || STOP.has(w)) continue;
    if (!seen.has(w)) { seen.add(w); out.push(w); }
  }
  return out;
}

// idf(docs) → Map term → inverse-document-frequency weight ln(1 + N/df). A term in few documents is distinctive (high);
// a term in every document is near-useless (low). docs: [{ id, terms:[...] }]. The structure of the corpus, deterministic.
export function idf(docs) {
  const d = arr(docs);
  const N = d.length;
  const df = new Map();
  for (const doc of d) {
    for (const t of new Set(arr(doc && doc.terms))) df.set(t, (df.get(t) || 0) + 1);
  }
  const w = new Map();
  for (const [t, c] of df) w.set(t, Math.log(1 + N / c));
  return w;
}

// score(qTerms, docTerms, idfMap) → the structural match: summed idf of the terms the question and the document share,
// and the shared terms themselves (the citation — the structure that resolved it).
export function score(qTerms, docTerms, idfMap) {
  const dset = new Set(arr(docTerms));
  const w = idfMap instanceof Map ? idfMap : new Map();
  let s = 0;
  const shared = [];
  for (const t of new Set(arr(qTerms))) {
    if (dset.has(t)) { s += (w.get(t) || 0); shared.push(t); }
  }
  return { score: s, shared };
}

// focus(qTerms, idfMap) → the question's most distinctive (highest-idf) term: the one it most hinges on.
export function focus(qTerms, idfMap) {
  const w = idfMap instanceof Map ? idfMap : new Map();
  let best = null, bw = -Infinity;
  for (const t of arr(qTerms)) { const v = w.get(t) || 0; if (v > bw) { bw = v; best = t; } }
  return best;
}

// route(qTerms, docs, idfMap, opts) → the grounded decision. Scores every document, then the GATE — answer the best
// document only if EVERY check it is given passes; otherwise ABSTAIN. The gate is tunable:
//   minScore     (default 1)  — the summed-idf match must clear this
//   margin       (default 0)  — the best must beat the runner-up by this (unambiguous)
//   minCoverage  (default 0)  — at least this fraction of the question's distinct terms must be present
//   requireFocus (default false) — the question's most distinctive term must be in the matched document
//   minConfidence + confidence  — a relevance veto: confidence (a Map/obj docId→score, e.g. a local-embedding cosine)
//                                  for the best doc must reach minConfidence. Structure still picks and cites the
//                                  answer; this only vetoes a weak match. Omit both to route on structure alone.
// Returns { answer, cite, score, runnerUp } or { abstain:true, why }.
export function route(qTerms, docs, idfMap, opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  const minScore = num(o.minScore) || (o.minScore === 0 ? 0 : 1);
  const margin = num(o.margin);
  const minCoverage = num(o.minCoverage);
  const scored = arr(docs).map((d) => ({ id: d && d.id, ...score(qTerms, d && d.terms, idfMap) }));
  scored.sort((a, b) => (b.score - a.score) || String(a.id).localeCompare(String(b.id)));
  const best = scored[0];
  const second = scored[1];
  if (!best || best.score < minScore) {
    return { abstain: true, why: 'not in your documents: no document matches strongly enough' };
  }
  if (second && best.score - second.score < margin) {
    return { abstain: true, why: 'ambiguous: more than one document matches about equally' };
  }
  const nq = new Set(arr(qTerms)).size || 1;
  if (best.shared.length / nq < minCoverage) { // minCoverage defaults to 0, so coverage (always >= 0) never trips it when off
    return { abstain: true, why: 'not in your documents: too few of the question\'s terms are present' };
  }
  if (o.requireFocus === true) {
    const f = focus(qTerms, idfMap);
    if (f !== null && !best.shared.includes(f)) {
      return { abstain: true, why: 'not in your documents: the question\'s key term is absent' };
    }
  }
  if (o.minConfidence != null && Number.isFinite(o.minConfidence)) {
    const c = o.confidence;
    const conf = c instanceof Map ? c.get(best.id) : (c == null ? undefined : c[best.id]);
    if (!(num(conf) >= o.minConfidence)) {
      return { abstain: true, why: 'not in your documents: the best match is not relevant enough' };
    }
  }
  return { answer: best.id, cite: best.shared, score: best.score, runnerUp: second ? second.score : 0 };
}

// top1(scored) → the baseline vector-RAG decision: the single highest-scoring document, NEVER abstaining. `scored` is
// [{ id, score }] (e.g. cosine similarities). This is what a plain RAG does — and why it answers even when it shouldn't.
export function top1(scored) {
  const s = arr(scored).filter((x) => x && typeof x === 'object');
  if (s.length === 0) return { abstain: true, why: 'empty index' };
  let best = s[0];
  for (const x of s) if (num(x.score) > num(best.score)) best = x;
  return { answer: best.id, score: num(best.score) };
}

export default { tokens, idf, score, focus, route, top1 };
