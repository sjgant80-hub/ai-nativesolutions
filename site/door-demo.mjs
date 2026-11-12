// site/door-demo.mjs — tier 1, live: a reader, the source check, the verified library, the gate, the memo.
// The gate, the memo, the library and the law table are the SLM Suite's own files (vendor/slm-suite, pinned). The
// source check is this site's kernel (site/kernel/ground.mjs, gated). This file is only the wiring and the display.
import { MODEL } from './data/bundle.mjs';
import G from '../vendor/slm-suite/stack/gate.mjs';
import M from '../vendor/slm-suite/stack/memo.mjs';
import L from '../vendor/slm-suite/verticals/legal/library.mjs';
import V from '../vendor/slm-suite/verticals/legal/vertical.mjs';
import Gr from './kernel/ground.mjs';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
const pad = (n) => String(n).padStart(2, '0');
const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const words = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const NAMES = { kind: 'Goods or a service', channel: 'Bought', price: 'Price, in pounds', paidBy: 'Paid by', bought: 'Bought on', delivered: 'Delivered, or done, on', faultFound: 'Fault appeared on', repairsTried: 'Repairs tried', changedMind: 'Simply changed mind' };
// the exact shape the model must write: the library's own fact schema as a grammar it cannot step outside, so the
// gate can always read what comes back. (The grammar fixes the SHAPE. Whether each value is true is the source check's
// job, and the human reviewer's.)
const opt = (list) => list.map((v) => JSON.stringify(JSON.stringify(v))).join(' | ');
const GRAMMAR = [
  "root ::= \"{\\\"kind\\\": \" kind \", \\\"channel\\\": \" channel \", \\\"price\\\": \" number \", \\\"paidBy\\\": \" paid \", \\\"bought\\\": \" date \", \\\"delivered\\\": \" date \", \\\"faultFound\\\": \" date \", \\\"repairsTried\\\": \" [0-9] \", \\\"changedMind\\\": \" bool \", \\\"summary\\\": \\\"\" text \"\\\"}\"",
  'kind ::= ' + opt(V.SCHEMA.kind),
  'channel ::= ' + opt(V.SCHEMA.channel),
  'paid ::= ' + opt(V.SCHEMA.paidBy),
  // a date is copied as it is written (day, month name, year); the source check's kernel turns it into a calendar date
  "date ::= \"null\" | \"\\\"\" [1-9] [0-9]? \" \" month \" 20\" [0-9] [0-9] \"\\\"\"",
  'month ::= ' + Gr.MONTHS.map((m) => JSON.stringify(m[0].toUpperCase() + m.slice(1))).join(' | '),
  "number ::= [0-9] [0-9]* (\".\" [0-9] [0-9]?)?",
  "bool ::= \"true\" | \"false\"",
  "text ::= [^\"\\\\\\n]*",
].join(String.fromCharCode(10));

/** what the model is asked: copy the facts out, dates exactly as written. (The sealed test used the suite's own prompt
 *  with its tuned reader; this is the page's prompt for the stock model, and it is shown here in full.) */
const promptFor = (text, today) => 'Today is ' + words(today) + '. Copy the facts out of this UK consumer complaint as JSON.\n'
  + 'Write each date as day, month, year, like "5 March 2026". If the complaint does not give a date, write null. Do not guess.\n'
  + 'Keys: kind (goods or service), channel (shop, online or phone), price (a number), paidBy (credit card, debit card, cash or bank transfer), '
  + 'bought (date), delivered (the date it arrived, or the date the service was done), faultFound (the date the fault first appeared), '
  + 'repairsTried (how many repairs have already failed), changedMind (true only if nothing is wrong and they simply changed their mind), summary (one short sentence, no dates).\n\n'
  + 'Example complaint: I bought a kettle in a shop on 5 March 2026 for 30 pounds in cash. It stopped working on 9 March 2026.\n'
  + 'Example JSON: {"kind": "goods", "channel": "shop", "price": 30, "paidBy": "cash", "bought": "5 March 2026", "delivered": null, "faultFound": "9 March 2026", "repairsTried": 0, "changedMind": false, "summary": "A kettle stopped working."}\n\n'
  + 'Complaint: ' + text + '\n\nJSON:';

/** the made-up complaints: dated from today, so the deadlines the library works out are always live ones */
function samples(today) {
  const ago = (n) => L.addDays(today, -n);
  return [
    { name: 'A faulty laptop', text: 'I ordered a laptop from Northway Computers on their website on ' + words(ago(16)) + ' and paid 849 pounds by credit card. It was delivered on ' + words(ago(12)) + '. On ' + words(ago(3)) + ' the screen started flickering and now it will not turn on at all. I have not let them attempt a repair. I want my money back.',
      facts: { kind: 'goods', channel: 'online', price: 849, paidBy: 'credit card', bought: ago(16), delivered: ago(12), faultFound: ago(3), repairsTried: 0, changedMind: false } },
    { name: 'A date is missing', text: 'My new washing machine stopped spinning after a few weeks. I paid 399 pounds by credit card in the shop on ' + words(ago(40)) + '. They say it is my fault. What can I do?',
      facts: { kind: 'goods', channel: 'shop', price: 399, paidBy: 'credit card', bought: ago(40), delivered: null, faultFound: null, repairsTried: 0, changedMind: false } },
    { name: 'Changed my mind', text: 'I bought a coat online for 120 pounds with my debit card on ' + words(ago(9)) + '. It arrived on ' + words(ago(5)) + '. Nothing is wrong with it, I have simply changed my mind. Can I send it back?',
      facts: { kind: 'goods', channel: 'online', price: 120, paidBy: 'debit card', bought: ago(9), delivered: ago(5), faultFound: null, repairsTried: 0, changedMind: true } },
    { name: 'A botched boiler service', text: 'I booked a boiler service with QuickFlow Heating over the phone and paid 180 pounds by bank transfer on ' + words(ago(20)) + ', the day the engineer came. On ' + words(ago(19)) + ' it began leaking and it has leaked ever since. He will not come back.',
      facts: { kind: 'service', channel: 'phone', price: 180, paidBy: 'bank transfer', bought: ago(20), delivered: ago(20), faultFound: ago(19), repairsTried: 0, changedMind: false } },
  ];
}

export async function startDoor({ net, signal, caps }) {
  const law = await (await fetch(new URL('../vendor/slm-suite/verticals/legal/law.json', import.meta.url))).json();
  const today = todayISO(), list = samples(today);
  const text = $('slm-text'), state = $('slm-state'), run = $('slm-run');
  const steps = Object.fromEntries([...document.querySelectorAll('#slm .steps li')].map((li) => [li.dataset.step, li]));
  const step = (name, cls = 'on') => { for (const [k, li] of Object.entries(steps)) { li.classList.remove('on', 'stop'); if (k === name) li.classList.add(cls); } };

  // ── "I will read it": the facts, entered by the visitor ──
  const form = $('slm-self'), fields = {};
  const select = (opts) => el('select', {}, ...opts.map(([v, t]) => el('option', { value: v, textContent: t })));
  const make = (key, control) => { fields[key] = control; form.append(el('label', {}, NAMES[key], control)); };
  make('kind', select(V.SCHEMA.kind.map((v) => [v, v])));
  make('channel', select(V.SCHEMA.channel.map((v) => [v, v === 'shop' ? 'in a shop' : v === 'online' ? 'online' : 'by phone'])));
  make('price', el('input', { type: 'number', min: '0', step: '0.01', inputMode: 'decimal' }));
  make('paidBy', select(V.SCHEMA.paidBy.map((v) => [v, v])));
  for (const k of Gr.DATE_KEYS) make(k, el('input', { type: 'date', max: today }));
  make('repairsTried', el('input', { type: 'number', min: '0', max: '9', step: '1' }));
  make('changedMind', select([['false', 'no'], ['true', 'yes']]));
  form.append(el('p', { className: 'note', style: 'grid-column:1/-1;margin:0', textContent: 'Filled in to match the sample. Change anything: clear the delivery date and watch it refuse to guess.' }));
  const fill = (f) => { for (const [k, c] of Object.entries(fields)) c.value = f[k] === null || f[k] === undefined ? '' : String(f[k]); };
  const entered = () => ({ kind: fields.kind.value, channel: fields.channel.value, price: fields.price.value === '' ? 0 : Number(fields.price.value), paidBy: fields.paidBy.value,
    bought: fields.bought.value || null, delivered: fields.delivered.value || null, faultFound: fields.faultFound.value || null,
    repairsTried: Math.min(9, Math.max(0, Math.round(Number(fields.repairsTried.value) || 0))), changedMind: fields.changedMind.value === 'true', summary: '' });

  const chips = $('slm-samples');
  const pick = (i) => { text.value = list[i].text; fill(list[i].facts); [...chips.children].forEach((b, k) => b.setAttribute('aria-pressed', String(k === i))); };
  chips.replaceChildren(...list.map((s, i) => { const b = el('button', { type: 'button', textContent: s.name }); b.addEventListener('click', () => pick(i)); return b; }));
  pick(1);
  text.addEventListener('input', () => [...chips.children].forEach((b) => b.setAttribute('aria-pressed', 'false')));

  // ── "a small model, in this browser" ──
  const reader = () => document.querySelector('input[name=reader]:checked').value;
  const modelBox = $('slm-model'), loadBtn = $('slm-load'), loadState = $('slm-load-state'), bar = $('slm-bar');
  let worker = null, ready = false, pending = null;
  const radios = [...document.querySelectorAll('input[name=reader]')];
  if (!caps.gpu) { radios[1].disabled = true; $('slm-model-note').textContent = 'This browser has no WebGPU, so the model cannot run here. Being the reader yourself uses the same gate, library and law.'; }
  const sync = () => { const m = reader() === 'model'; modelBox.hidden = !m; form.hidden = m; run.disabled = m && !ready; };
  radios.forEach((r) => r.addEventListener('change', sync)); sync();
  loadBtn.addEventListener('click', () => {
    if (worker) return;
    loadBtn.disabled = true; bar.hidden = false; loadState.className = 'state'; loadState.textContent = 'starting…';
    worker = new Worker(new URL('./llm-worker.mjs', import.meta.url), { type: 'module' });
    net.wireWorker(worker, 'model worker');
    worker.addEventListener('message', (ev) => {
      const m = ev.data || {};
      if (m.type === 'progress') { bar.firstElementChild.style.width = Math.round(m.progress * 100) + '%'; loadState.textContent = m.text.replace(/\s+/g, ' ').slice(0, 110); }
      else if (m.type === 'ready') { ready = true; bar.hidden = true; loadState.className = 'state good'; loadState.textContent = 'Loaded. It now runs on your graphics card; reading makes no network request.'; sync(); signal.flare('slm-suite', 'keep'); }
      else if (m.type === 'token' && pending && m.id === pending.id) pending.onToken(m.delta);
      else if (m.type === 'done' && pending && m.id === pending.id) { const p = pending; pending = null; p.resolve(m); }
      else if (m.type === 'error') {
        if (pending && m.id === pending.id) { const p = pending; pending = null; p.reject(new Error(m.message)); }
        else { loadState.className = 'state bad'; loadState.textContent = 'The model could not load: ' + m.message; loadBtn.disabled = false; bar.hidden = true; worker.terminate(); worker = null; }
      }
    });
    worker.postMessage({ type: 'load', library: MODEL.library, model: MODEL.id });
  });
  let seq = 0;
  const ask = (prompt, onToken) => new Promise((resolve, reject) => { const id = ++seq; pending = { id, onToken, resolve, reject }; worker.postMessage({ type: 'read', id, prompt, grammar: GRAMMAR }); });

  // ── one run ──
  const readPane = $('slm-read'), memoPane = $('slm-memo'), netLine = $('slm-net');
  const lawRows = [...document.querySelectorAll('.law li')];
  run.addEventListener('click', async () => {
    const complaint = text.value.trim();
    if (!complaint) { state.className = 'state bad'; state.textContent = 'There is nothing to read yet.'; return; }
    run.disabled = true; state.className = 'state'; netLine.textContent = ''; netLine.className = 'net-proof';
    lawRows.forEach((li) => li.classList.remove('cited'));
    const mode = reader();
    net.mark('slm-run');
    signal.pulse('kar-hub', 'slm-suite', 'work');
    try {
      // 1 · read
      step('read'); let modelText, raw = null, took = '', wordNotes = [];
      if (mode === 'model') {
        state.textContent = 'the model is reading…';
        raw = el('pre', { className: 'raw' });
        readPane.replaceChildren(el('h3', { textContent: 'What the reader gave' }), raw);
        signal.ease(4);                                      // the organism eases off while the model has the graphics card
        let out;
        try { out = await ask(promptFor(complaint, today), (d) => { raw.textContent += d; raw.scrollTop = raw.scrollHeight; }); } finally { signal.ease(1); }
        took = ' The model wrote ' + out.chunks + ' tokens in ' + (out.ms / 1000).toFixed(1) + ' s.';
        // the model copies dates as written; the kernel turns them into calendar dates (or refuses them)
        const turned = Gr.datesFromWords(G.firstObject(out.text));
        modelText = turned.obj ? JSON.stringify(turned.obj) : out.text; wordNotes = turned.notes;
      } else modelText = JSON.stringify(entered());
      const facts = G.readFacts(modelText, V.SCHEMA);
      // 2 · source check (the model's facts only: a person reading is allowed to work a date out)
      step('ground');
      const g = mode === 'model' && facts ? Gr.ground(facts, complaint, today) : { facts, notes: [], angles: true };
      g.notes = wordNotes.concat(g.notes);
      // 3 · the library, through the gate
      step('library');
      signal.pulse('slm-suite', 'witness', 'work');
      let result = G.decide(g.facts ? JSON.stringify(g.facts) : modelText, { today, schema: V.SCHEMA, answer: L.answer, table: law.provisions });
      result = Gr.applyAngles(result, g);
      // 4 · the memo
      const memo = M.render(result, { words: V.WORDS });
      step('memo', result.abstain ? 'stop' : 'on');
      showFacts(readPane, raw, facts, g, mode, complaint);
      showMemo(memoPane, memo, result, g);
      for (const c of result.cites || []) { const li = $('law-' + c.id); if (li) li.classList.add('cited'); }
      const seen = net.between('slm-run');
      netLine.textContent = 'Network requests while this ran: ' + seen.requests + ' · sent up: ' + seen.withBody + '. ' + (mode === 'model' ? 'The model read your text on this machine.' : 'The gate and the library ran on this machine.') + took;
      if (seen.withBody > 0 || seen.thirdParty > 0) netLine.classList.add('bad');
      state.className = 'state ' + (result.abstain ? '' : 'good'); state.textContent = result.abstain ? 'It abstained, and said why.' : 'Answered, from the verified table only.';
      setTimeout(() => { if (result.abstain) signal.flare('witness', 'learn'); else { signal.flare('witness', 'keep'); signal.pulse('witness', 'pattern-libraries', 'keep'); } }, 900);
    } catch (e) { state.className = 'state bad'; state.textContent = 'That run failed: ' + (e && e.message ? e.message : e); }
    run.disabled = reader() === 'model' && !ready;
  });

  function showFacts(pane, raw, facts, g, mode, complaint) {
    const kids = [el('h3', { textContent: 'What the reader gave' })];
    if (raw) kids.push(raw);
    if (!facts) { kids.push(el('p', { className: 'empty', textContent: 'The gate could not read that as facts in the shape the library accepts, so nothing went further.' })); pane.replaceChildren(...kids); return; }
    const note = new Map(g.notes.map((n) => [n.key, n]));
    const body = el('tbody');
    for (const k of V.FACT_KEYS) {
      const v = facts[k], n = note.get(k), isDate = Gr.DATE_KEYS.includes(k);
      let cls = '', why;
      if (mode !== 'model') why = 'entered by you';
      else if (n) { cls = 'no'; why = Gr.WHY[n.why]; }
      else if (isDate) { if (v === null) why = 'not stated'; else { cls = 'ok'; why = 'found in your text'; } }
      else if (k === 'price') { if (v > 0) { cls = 'ok'; why = 'found in your text'; } else why = 'none given'; }
      else if (k === 'paidBy' && v === 'credit card') { cls = 'ok'; why = 'your text says so'; }
      else why = 'as read: a judgement call, shown so you can check it';
      body.append(el('tr', { className: cls }, el('th', { scope: 'row', textContent: NAMES[k] }), el('td', { className: 'val', textContent: v === null ? '—' : typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v) }), el('td', { className: 'why', textContent: why })));
    }
    kids.push(el('table', { className: 'facts' }, body));
    pane.replaceChildren(...kids);
  }
  function showMemo(pane, memo, result, g) {
    const p = el('p', { className: 'memo' });
    for (const line of memo.split('\n')) {
      const cls = line.startsWith('ABSTAINED') ? 'abst' : line.startsWith('CLAIM') ? 'claim' : line.startsWith(M.PROPOSAL) ? 'prop' : line === M.LABEL ? 'label' : '';
      p.append(cls ? el('span', { className: cls, textContent: line }) : line, cls === 'abst' || cls === 'claim' || cls === 'label' ? '' : '\n');
    }
    const kids = [el('h3', { textContent: 'The memo' }), p];
    if (result.withheldAngles && result.withheldAngles.length) kids.push(el('p', { className: 'note', textContent: 'One proposal was held back: ' + g.notes.filter((n) => n.key === 'price' || n.key === 'paidBy').map((n) => Gr.WHY[n.why]).join('; ') + '.' }));
    pane.replaceChildren(...kids);
  }
}
