// site/front-ask.mjs — the front door's question box, in plain words. It is the same thing the long version shows
// as DocDec, with the same vendored kernel (vendor/docdecdemo/kernel.mjs, pinned) and the same measured data
// (vendor/docdecdemo/demo-data.json: a public set of questions about a few encyclopedia pages). Ours answers from a
// page and shows the page, or says it cannot tell. A normal search hands back its closest match every time, even
// when the pages do not hold the answer.
//
// Only the twelve kept questions are asked here, each with everything the measured run used. A question typed by a
// visitor would be matched on its words alone, and one shared word can look like an answer: that is not what was
// measured, so the front door does not offer it. This file is only the wiring and the words on the screen.
import D from '../vendor/docdecdemo/kernel.mjs';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
const cosine = (a, b) => { let d = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return na && nb ? d / (Math.sqrt(na) * Math.sqrt(nb)) : 0; };

// what each kept question shows, said plainly
const KEPT = {
  'dd-missed': 'Ours slipped here. The answer was in the pages, and it still said “I can’t tell.” We keep it.',
  'dd-hallucinated': 'This trick question fooled both. The pages do not answer it. We keep it.',
};

export async function startAsk({ net, crystal } = {}) {
  const out = $('ask-out'), state = $('ask-state');
  let data;
  try { data = await (await fetch(new URL('../vendor/docdecdemo/demo-data.json', import.meta.url))).json(); }
  catch { state.textContent = 'The pages did not load. The rest of this page still works.'; return; }

  const DOCS = data.docsCorpus || [], BYID = new Map(DOCS.map((d) => [d.id, d])), IDF = new Map(data.idf || []), VEC = data.vectors || {}, gate = data.gate || { minScore: 1 };
  const text = (id) => { const d = BYID.get(id), t = d && d.text ? d.text : ''; return t.length > 240 ? t.slice(0, 237) + '…' : t; };
  const where = (id) => 'From the page: ' + String(id).replace(/_/g, ' ').replace(/#(\d+)$/, (m, n) => ', part ' + (Number(n) + 1));

  const ours = (dec, q) => (dec.abstain
    ? el('div', { className: 'card no' }, el('h4', {}, 'Ours'), el('p', { className: 'what', textContent: '“I can’t tell. That is not in my pages.”' }), el('p', { className: 'from', textContent: 'It found no page that answers this. So it gives no answer.' }))
    : el('div', { className: 'card ' + (q.impossible === true ? 'wrong' : 'yes') }, el('h4', {}, 'Ours'), el('p', { className: 'what', textContent: q.impossible === true ? 'It answers. It should not have.' : 'It answers, and shows you where.' }), el('p', { className: 'from', textContent: text(dec.answer) }), el('p', { className: 'where', textContent: where(dec.answer) })));
  const normal = (q) => {
    const best = D.top1(DOCS.map((d) => ({ id: d.id, score: VEC[d.id] ? cosine(q.qvec, VEC[d.id]) : -1 })));
    const wrong = q.impossible === true;                              // the pages do not hold an answer to this one
    return el('div', { className: 'card ' + (wrong ? 'wrong' : 'yes') }, el('h4', {}, 'A normal search'),
      el('p', { className: 'what', textContent: wrong ? 'It answers anyway. The pages do not say this.' : 'It gives its closest match.' }),
      el('p', { className: 'from', textContent: text(best.answer) }), el('p', { className: 'where', textContent: where(best.answer) }));
  };

  const show = (q) => {
    const dec = D.route(q.qterms, DOCS, IDF, { ...gate, confidence: q.conf || null });
    const cards = [ours(dec, q)];
    if (q.qvec && Object.keys(VEC).length) cards.push(normal(q));
    out.replaceChildren(el('p', { className: 'asked', textContent: q.text }), el('div', { className: 'twin' }, ...cards), ...(KEPT[q.label] ? [el('p', { className: 'kept', textContent: KEPT[q.label] })] : []));
    if (crystal) { crystal.setEnergy(1.25); setTimeout(() => crystal.setEnergy(0.9), 900); }
    if (net && net.ledger) $('ask-net').textContent = 'While this ran, this page sent out ' + net.ledger.summary().withBody + ' things. Nothing left your computer.';
  };

  // the kept questions, the clear ones first
  const order = { win: 0, 'both-right': 1, 'dd-missed': 2, 'dd-hallucinated': 3 };
  const qs = [...(data.demoQuestions || [])].sort((a, b) => (order[a.label] ?? 9) - (order[b.label] ?? 9));
  const chips = $('ask-chips');
  let at = 0;
  // when a visitor picks one, the answer is brought into view: on a phone the list of questions is taller than the screen
  const pick = (i, byHand) => { at = i; for (const c of chips.querySelectorAll('.chip')) c.setAttribute('aria-pressed', 'false'); qs[i]._b.setAttribute('aria-pressed', 'true'); show(qs[i]); if (byHand && out.scrollIntoView) out.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); };
  chips.replaceChildren(...qs.map((q, i) => {
    const b = el('button', { type: 'button', className: 'chip', textContent: q.text.length > 58 ? q.text.slice(0, 55) + '…' : q.text });
    b.setAttribute('aria-pressed', 'false'); b.addEventListener('click', () => pick(i, true));
    q._b = b; return b;
  }));
  $('ask-next').addEventListener('click', () => { if (qs.length) pick((at + 1) % qs.length, true); });

  state.textContent = '';
  if (qs.length) pick(0);
}

export default { startAsk };
