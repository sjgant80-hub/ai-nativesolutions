// site/docdec-demo.mjs — tier 1, live: DocDec, the grounded document router, beside a plain vector-RAG, on the same
// questions. DocDec answers from a document WITH a citation, or abstains ("not in your documents"); the RAG returns its
// nearest chunk for every question, including the ones the documents do not answer. The grounding kernel is DocDec's
// own file (vendor/docdecdemo/kernel.mjs, pinned; mutation-gated in its private engine repo); the before/after data is
// its measured benchmark (vendor/docdecdemo/demo-data.json, SQuAD 2.0, a public corpus — a benchmark, not a client
// result). This file is only the wiring and the display. The production engine deepens the routing privately; the
// behaviours shown here — cite, or abstain — do not change.
import D from '../vendor/docdecdemo/kernel.mjs';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
const pct = (x) => (x == null ? '—' : Math.round(x * 100) + '%');

// the vector-RAG baseline: cosine over the precomputed local-embedding vectors, nearest chunk, never abstains
const cosine = (a, b) => { let d = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return na && nb ? d / (Math.sqrt(na) * Math.sqrt(nb)) : 0; };

export async function startDocdec({ net, signal } = {}) {
  const root = $('docdec');
  if (!root) return;
  let data;
  try { data = await (await fetch(new URL('../vendor/docdecdemo/demo-data.json', import.meta.url))).json(); }
  catch { $('docdec-state').textContent = 'the benchmark data did not load'; return; }

  const DOCS = data.docsCorpus || [];
  const BYID = new Map(DOCS.map((d) => [d.id, d]));
  const IDF = new Map(data.idf || []);
  const VEC = data.vectors || {};
  const gate = data.gate || { minScore: 1 };
  const docText = (id) => { const d = BYID.get(id); return d && d.text ? d.text : '(document ' + id + ')'; };
  const snippet = (id, terms) => {
    const t = docText(id);
    return t.length > 260 ? t.slice(0, 257) + '…' : t;
  };

  // the measured headline, straight from the record (no hand-typed numbers)
  const m = data.measured || {};
  const dd = m.docdec || {}, rag = m.vectorRag || {};
  const n = (m.counts && m.counts.eval) || (data.counts && data.counts.evalQuestions) || '—';
  $('docdec-measured').replaceChildren(
    el('tr', {}, el('th', { textContent: 'on ' + n + ' eval questions' }), el('th', { textContent: 'DocDec' }), el('th', { textContent: 'a plain search' })),
    el('tr', {}, el('td', { textContent: 'says it can\'t tell when the documents don\'t answer' }), el('td', { className: 'good', textContent: pct(dd.groundedAbstention) }), el('td', { className: 'bad', textContent: pct(rag.groundedAbstention) })),
    el('tr', {}, el('td', { textContent: 'answers when the documents don\'t' }), el('td', { className: 'good', textContent: pct(dd.hallucinationRate) }), el('td', { className: 'bad', textContent: pct(rag.hallucinationRate) })),
    el('tr', {}, el('td', { textContent: 'right, when it does answer' }), el('td', { className: 'good', textContent: pct(dd.precisionWhenAnswering) }), el('td', { className: 'bad', textContent: pct(rag.precisionWhenAnswering) })),
  );
  $('docdec-source').textContent = m.corpus ? ('Measured on ' + m.corpus + ' — a public test set, not a client result.') : '';

  // render one question's before/after
  const out = $('docdec-out');
  const verdict = (q) => {
    const dec = D.route(q.qterms, DOCS, IDF, { ...gate, confidence: q.conf || null });
    let ragCard;
    if (q.qvec && Object.keys(VEC).length) {
      const scored = DOCS.map((d) => ({ id: d.id, score: VEC[d.id] ? cosine(q.qvec, VEC[d.id]) : -1 }));
      const r = D.top1(scored);
      const wrong = q.impossible === true; // the documents do not answer it
      ragCard = el('div', { className: 'pane ' + (wrong ? 'miss' : '') },
        el('h3', {}, 'A plain search'),
        el('p', { className: 'tag', textContent: wrong ? 'answers anyway — and the documents don\'t support it' : 'returns its nearest piece of text' }),
        el('p', { className: 'src', textContent: r.answer }),
        el('p', { className: 'snip', textContent: snippet(r.answer) }));
    } else {
      ragCard = el('div', { className: 'pane' }, el('h3', {}, 'A plain search'), el('p', { className: 'empty', textContent: 'The plain search needs each question prepared ahead of time, so it runs on the test-set questions above, not on typed text.' }));
    }
    const ddCard = dec.abstain
      ? el('div', { className: 'pane abstain' }, el('h3', {}, 'DocDec'), el('p', { className: 'tag', textContent: 'says it can\'t tell' }), el('p', { className: 'say', textContent: '“Not in your documents.”' }), el('p', { className: 'why', textContent: dec.why }))
      : el('div', { className: 'pane ground' }, el('h3', {}, 'DocDec'), el('p', { className: 'tag', textContent: 'answers, with its source' }), el('p', { className: 'src', textContent: dec.answer }), el('p', { className: 'cite', textContent: 'on the terms: ' + dec.cite.join(', ') }), el('p', { className: 'snip', textContent: snippet(dec.answer, dec.cite) }));
    return el('div', { className: 'twin' }, ddCard, ragCard);
  };

  const show = (q) => { out.replaceChildren(el('p', { className: 'q', textContent: q.text }), verdict(q)); if (signal && signal.flare) signal.flare('ai-nativesolutions', q.impossible ? 'amber' : 'lume'); };

  // the benchmark questions, tagged by what they show
  const order = { win: 0, 'both-right': 1, 'dd-missed': 2, 'dd-hallucinated': 3 };
  const label = { win: 'DocDec says it can\'t tell · the plain search answers anyway', 'both-right': 'both answer · DocDec shows its source', 'dd-missed': 'DocDec misses (kept on the record)', 'dd-hallucinated': 'both fooled by a trick question (kept)' };
  const qs = [...(data.demoQuestions || [])].sort((a, b) => (order[a.label] ?? 9) - (order[b.label] ?? 9));
  const chips = $('docdec-chips');
  chips.replaceChildren(...qs.map((q) => el('button', { type: 'button', className: 'chip', title: label[q.label] || '', onclick: () => { chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false')); chips.lastClicked && null; q._b.setAttribute('aria-pressed', 'true'); show(q); } }, q.text.length > 54 ? q.text.slice(0, 51) + '…' : q.text)).map((b, i) => (qs[i]._b = b, b)));

  // free-type: DocDec grounds against the same corpus, live, with no model
  const ask = $('docdec-ask'), run = $('docdec-run');
  const askOne = () => {
    const text = ask.value.trim();
    if (!text) return;
    // free text has no query embedding, so DocDec grounds on structure alone (its base layer): a document whose
    // distinctive terms the question shares, clearing the bar, is cited; a question the documents don't cover clears
    // nothing and abstains. The full product adds the embedding veto (needs a model) to pick between close matches.
    const dec = D.route(D.tokens(text), DOCS, IDF, { minScore: gate.minScore || 1 });
    out.replaceChildren(el('p', { className: 'q', textContent: text },
      el('span', { className: 'free', textContent: 'typed text — matched on its words alone. A document that shares a word is shown; that is a match, not yet an answer. The measured questions above use the full check.' })),
      dec.abstain
        ? el('div', { className: 'twin' }, el('div', { className: 'pane abstain' }, el('h3', {}, 'DocDec'), el('p', { className: 'tag', textContent: 'no document matches' }), el('p', { className: 'say', textContent: '“Not in your documents.”' }), el('p', { className: 'why', textContent: dec.why })))
        : el('div', { className: 'twin' }, el('div', { className: 'pane ground' }, el('h3', {}, 'DocDec'), el('p', { className: 'tag', textContent: 'a document matches your words' }), el('p', { className: 'src', textContent: dec.answer }), el('p', { className: 'cite', textContent: 'on the terms: ' + dec.cite.join(', ') }), el('p', { className: 'snip', textContent: snippet(dec.answer, dec.cite) }))));
    if (signal && signal.flare) signal.flare('ai-nativesolutions', dec.abstain ? 'amber' : 'lume');
  };
  run.addEventListener('click', askOne);
  ask.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); askOne(); } });

  if (qs[0]) { qs[0]._b.setAttribute('aria-pressed', 'true'); show(qs[0]); }
  $('docdec-state').textContent = '';
  if (net) { const s = net.summary ? net.summary() : null; if (s) $('docdec-net').textContent = 'While this ran: ' + s.total + ' fetched, ' + s.withBody + ' sent up. The documents never leave the browser.'; }
}

export default { startDocdec };
