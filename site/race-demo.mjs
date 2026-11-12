// site/race-demo.mjs — the compression race, on the visitor's own file. The lanes run in site/race-worker.mjs; the
// placing and the sentence under it come from site/kernel/race.mjs (gated), so a loss can never be drawn as a win.
import R from './kernel/race.mjs';
import E from './kernel/estate.mjs';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };

/** a made-up ledger, the same every time (seeded): the kind of structured records a firm's systems pass around */
function madeUpLedger() {
  const rnd = E.mulberry32(2026), pick = (a) => a[Math.floor(rnd() * a.length)];
  const accounts = ['4000 Sales', '4010 Services', '5000 Purchases', '6100 Rent', '6200 Utilities', '7000 Wages', '1200 Bank', '2100 VAT'];
  const who = ['Northway Ltd', 'Harbour & Co', 'Greenfield Supplies', 'Aster Partners', 'Bell Yard Studio', 'Quay Logistics'];
  const rows = [];
  for (let i = 0; i < 900; i++) {
    const day = 1 + Math.floor(rnd() * 28), month = 1 + Math.floor(rnd() * 12), amount = Math.round(rnd() * 250000) / 100, debit = rnd() < 0.5;
    rows.push(JSON.stringify({ id: 10000 + i, date: '2026-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0'), account: pick(accounts), party: pick(who),
      debit: debit ? amount : 0, credit: debit ? 0 : amount, ref: 'INV-' + String(1000 + Math.floor(rnd() * 9000)), posted: rnd() < 0.93 }));
  }
  return new TextEncoder().encode(rows.join('\n') + '\n');
}

export async function startRace({ net, signal }) {
  const drop = $('race-drop'), input = $('race-file'), state = $('race-state'), lanesBox = $('race-lanes'), verdict = $('race-verdict'), speed = $('race-speed');
  let worker = null, run = 0, results = [], raw = 0;
  const rows = new Map();
  const ensureWorker = () => {
    if (worker) return worker;
    worker = new Worker(new URL('./race-worker.mjs', import.meta.url), { type: 'module' });
    net.wireWorker(worker, 'race worker');
    worker.addEventListener('message', (ev) => {
      const m = ev.data || {};
      if (m.run !== run) return;
      if (m.type === 'lane-start') rows.get(m.id).row.classList.add('running');
      else if (m.type === 'lane') { results.push(m); finishLane(m); }
      else if (m.type === 'race-done') finish();
      else if (m.type === 'race-error') { state.className = 'state bad'; state.textContent = m.message; }
    });
    worker.addEventListener('error', (e) => { state.className = 'state bad'; state.textContent = 'The race could not start: ' + (e.message || 'the worker failed to load'); });
    return worker;
  };
  const finishLane = (m) => {
    const r = rows.get(m.id); r.row.classList.remove('running');
    if (!m.identical) { r.row.classList.add('out'); r.num.textContent = m.error ? 'failed: ' + m.error : 'DISQUALIFIED: did not return your exact bytes'; return; }
    r.fill.style.width = Math.max(1.5, (m.bytes / raw) * 100).toFixed(2) + '%';
    r.num.replaceChildren(el('b', { textContent: R.ratio(raw, m.bytes).toFixed(2) + '×' }), ' · ' + R.bytes(m.bytes) + ' · ' + Math.round(m.ms).toLocaleString('en-GB') + ' ms · exact ✓');
  };
  const finish = () => {
    const placed = R.placing(raw, results);
    for (const l of placed.lanes) if (l.place === 1) rows.get(l.id).row.classList.add('first');
    verdict.textContent = R.sentence(raw, results);
    speed.textContent = R.speedLine(results);
    const seen = net.between('race');
    state.className = 'state good';
    state.textContent = 'Done. Network requests that carried your file anywhere: ' + (seen ? seen.withBody : 0) + '.';
    const light = placed.lanes.find((l) => l.id === 'light');
    signal.flare('konomi-tongue', light && light.place === 1 ? 'keep' : 'learn');
  };
  const race = (bytes, label) => {
    const plan = R.plan(bytes.length);
    if (plan.bytes === 0) { state.className = 'state bad'; state.textContent = 'That file is empty.'; return; }
    const cut = bytes.subarray(0, plan.bytes);
    raw = cut.length; results = []; run++;
    net.mark('race');
    state.className = 'state'; state.textContent = 'Racing ' + label + ': ' + R.bytes(raw) + (plan.cut ? ' (the first 1 MB of ' + R.bytes(bytes.length) + ')' : '') + '…';
    verdict.textContent = ''; speed.textContent = '';
    rows.clear();
    lanesBox.replaceChildren(...R.LANES.map((l) => {
      const fill = el('i'), num = el('span', { className: 'num', textContent: 'waiting' });
      const row = el('div', { className: 'lane' + (l.id === 'light' ? ' light' : '') }, el('span', { className: 'name' }, l.name, el('span', { textContent: l.note })), el('span', { className: 'track' }, fill), num);
      rows.set(l.id, { row, fill, num });
      return row;
    }));
    signal.pulse('kar-hub', 'konomi-tongue', 'work');
    const copy = cut.slice();
    ensureWorker().postMessage({ type: 'race', run, bytes: copy.buffer, order: ['gzip', 'zstd', 'brotli', 'light'] }, [copy.buffer]);
  };
  const take = async (file) => { if (file) race(new Uint8Array(await file.arrayBuffer()), '“' + file.name.slice(0, 60) + '”'); };
  input.addEventListener('change', () => take(input.files[0]));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); take(e.dataTransfer.files[0]); });
  drop.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === drop) { e.preventDefault(); input.click(); } });
  $('race-page').addEventListener('click', () => race(new TextEncoder().encode(document.querySelector('main').innerText), 'this page\'s own words'));
  $('race-records').addEventListener('click', () => race(madeUpLedger(), 'a made-up ledger of 900 records'));
}
