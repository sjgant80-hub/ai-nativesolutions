// site/breach-demo.mjs — "try to break it", live. The door, the immune library, the referee, the packet format and
// the identity kernel are Liveware's and Fall Kit's own files (vendor/liveware, pinned). The key is made in this
// browser, now. This file only builds the visitor's moves and shows what the door did with each.
import { T4_PUBLISHED } from './data/bundle.mjs';
import { makeIdentity, verifyBytes } from '../vendor/liveware/vendor/fall-kit/core/identity.mjs';
import { prepare, finish } from '../vendor/liveware/vendor/fall-kit/core/vendor/light/packet.mjs';
import { makeDoor, makeReferee, schemaNote, STAGES } from '../vendor/liveware/src/door.mjs';
import { shaHex } from '../vendor/liveware/src/receipt.mjs';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
const SAY = {
  immune: 'Have these exact bytes been refused before? Then there is no need to look twice.',
  size: 'Is it a sane size?', magic: 'Does it even start like one of our messages?', version: 'Is it a version this door speaks?',
  length: 'Does the length it claims match what arrived?', dictionary: 'Does it use a dictionary both ends share?',
  sender: 'Is the signer one of the keys this door trusts?', signature: 'Does the signature really belong to these exact bytes?',
  counter: 'Is it newer than the last message from this sender? (This is what stops a replay.)', body: 'Does the body unpack cleanly?',
  schema: 'Only now is it read. Is it the one kind of request the program accepts?',
};
const RUNGS = STAGES.filter((s) => s !== 'error');

export async function startBreach({ signal, caps, net }) {
  if (!caps.sign) throw new Error('this browser has no Ed25519 signatures');
  const seed = () => crypto.getRandomValues(new Uint8Array(32));
  const sender = await makeIdentity(seed());
  let outsider = await makeIdentity(seed());
  while (outsider.slot === sender.slot) outsider = await makeIdentity(seed());
  const door = makeDoor({ pinned: [{ slot: sender.slot, id: sender.id }], keyset: shaHex([sender.id].join('|')), verify: (id, signed, sig) => verifyBytes(id, signed, sig), schema: schemaNote });
  const ref = makeReferee();
  const note = async (who, n, value) => {
    const p = prepare({ sender: who.slot, counter: BigInt(n), dictId: 0, kind: 1, value });
    if (!p.ok) throw new Error(p.why);
    const f = finish(p.unsigned, await who.sign(p.signed));
    if (!f.ok) throw new Error(f.why);
    return f.bytes;
  };
  let counter = 0, last = null, tries = 0, refused = 0;
  const fresh = async () => note(sender, counter + 1, { op: 'note', n: counter + 1, text: 'note ' + (counter + 1) });
  const MOVES = [
    ['Send a genuine note', 'good', async () => { counter++; const value = { op: 'note', n: counter, text: 'note ' + counter }; ref.sent(value); last = await note(sender, counter, value); return [last, 'a genuine note, signed with the trusted key']; }],
    ['Replay it', 'bad', async () => (last ? [last.slice(), 'the last genuine note, sent a second time'] : null)],
    ['Flip one byte', 'bad', async () => { const b = await fresh(); b[30] ^= 1; return [b, 'a correctly signed note with one bit of its body changed']; }],
    ['Forge the signature', 'bad', async () => { const b = await fresh(); b[b.length - 1] ^= 0xff; return [b, 'a note whose signature was altered']; }],
    ['Sign with a stranger\'s key', 'bad', async () => [await note(outsider, 1, { op: 'note', n: 1, text: 'hi' }), 'a well-formed note signed by a key the door does not know']],
    ['Smuggle a command', 'bad', async () => [await note(sender, counter + 1, { op: 'drop', table: 'users' }), 'the RIGHT key, signing a request the program must never run']],
    ['Cut it short', 'bad', async () => [(await fresh()).slice(0, 10), 'the first ten bytes of a real note']],
    ['2 MB of junk', 'bad', async () => [new Uint8Array(2000000).fill(65), 'two million bytes of the letter A']],
  ];

  const ladder = $('breach-ladder'), log = $('breach-log'), tally = $('breach-tally');
  const rung = new Map(RUNGS.map((s) => { const li = el('li', {}, el('b', { textContent: s === 'immune' ? 'memory' : s }), el('span', { textContent: SAY[s] })); return [s, li]; }));
  ladder.replaceChildren(...rung.values());
  const showTally = () => {
    const t = ref.tally();
    tally.replaceChildren('genuine notes delivered: ', el('b', { textContent: String(t.delivered) }), ' · attacks refused: ', el('b', { textContent: String(refused) }), ' · breaches: ', el('b', { textContent: String(t.breaches), style: t.breaches ? 'color:var(--red)' : '' }));
  };
  const throwIt = async (bytes, what) => {
    const v = await door.check(bytes);
    tries++;
    let breach = false;
    if (v.admit) breach = !ref.received(v.value); else refused++;
    const stop = v.admit ? null : v.stage;
    let passed = true;
    for (const s of RUNGS) {
      const li = rung.get(s); li.classList.remove('pass', 'stop', 'skip');
      if (stop === 'error') { li.classList.add('skip'); continue; }
      if (s === stop) { li.classList.add('stop'); passed = false; } else li.classList.add(passed ? 'pass' : 'skip');
    }
    const line = el('li', { className: v.admit && !breach ? 'in' : '' }, '#' + tries + ' ' + what + ' → ',
      el('b', { textContent: breach ? 'BREACH: it got through' : v.admit ? 'ADMITTED' : 'REFUSED at ' + (stop === 'immune' ? 'memory' : stop) }),
      v.admit ? '' : ': ' + v.why + (v.variant && stop !== 'immune' ? ' (and recognised as a variant of an attack it has seen)' : ''));
    log.prepend(line);
    showTally();
    if (breach) signal.flare('break-it', 'refuse');
    else if (v.admit) { signal.pulse('break-it', 'kar-hub', 'keep'); signal.flare('break-it', 'keep'); }
    else signal.flare('break-it', 'refuse');
  };
  $('breach-moves').replaceChildren(...MOVES.map(([name, kind, make]) => {
    const b = el('button', { type: 'button', className: kind, textContent: name });
    b.addEventListener('click', async () => {
      const m = await make();
      if (!m) { log.prepend(el('li', { textContent: 'Send a genuine note first: there is nothing to replay yet.' })); return; }
      await throwIt(m[0], m[1]);
    });
    return b;
  }));
  const raw = $('breach-raw');
  const throwRaw = () => { const s = raw.value || raw.placeholder; throwIt(new TextEncoder().encode(s), 'your own text: “' + s.slice(0, 40) + (s.length > 40 ? '…' : '') + '”'); };
  $('breach-throw').addEventListener('click', throwRaw);
  raw.addEventListener('keydown', (e) => { if (e.key === 'Enter') throwRaw(); });
  showTally();

  // ── the whole sealed test ──
  const all = $('breach-all'), allState = $('breach-all-state'), out = $('breach-result');
  all.addEventListener('click', () => {
    all.disabled = true; allState.className = 'state'; out.replaceChildren();
    const t0 = performance.now(), tick = setInterval(() => { allState.textContent = 'attacking… ' + ((performance.now() - t0) / 1000).toFixed(1) + ' s'; }, 100);
    const w = new Worker(new URL('./breach-worker.mjs', import.meta.url), { type: 'module' });
    net.wireWorker(w, 'attack worker');
    const done = () => { clearInterval(tick); all.disabled = false; w.terminate(); };
    w.addEventListener('error', (e) => { done(); allState.className = 'state bad'; allState.textContent = 'The test could not start: ' + (e.message || 'the worker failed to load'); });
    w.addEventListener('message', (ev) => {
      const m = ev.data || {};
      if (m.type === 't4-error') { done(); allState.className = 'state bad'; allState.textContent = 'The test failed to run: ' + m.message; return; }
      if (m.type !== 't4') return;
      done();
      const d = m.detail, match = m.id === T4_PUBLISHED.id;
      allState.className = 'state ' + (m.verdict === 'pass' ? 'good' : 'bad');
      allState.textContent = 'Finished in ' + (m.ms / 1000).toFixed(1) + ' s on your machine: ' + m.verdict + '.';
      const cell = (n, label, bad) => el('div', {}, el('b', { textContent: String(n), style: bad ? 'color:var(--red)' : '' }), label);
      out.replaceChildren(el('div', { className: 'result' },
        cell(d.breaches, 'breaches', d.breaches > 0), cell(d.crashes, 'crashes', d.crashes > 0), cell(d.delivered + ' / 100', 'genuine notes delivered', d.delivered !== 100),
        cell(d.swarmRecognised + ' / 1,000', 'mutated forgeries recognised on sight'),
        el('div', { className: 'match ' + (match ? 'good' : 'bad'), textContent: 'Your receipt: ' + m.id.slice(0, 16) + '… ' + (match ? '= the one we published, exactly. Your machine just reproduced our result.' : '≠ the one we published (' + T4_PUBLISHED.id.slice(0, 16) + '…). That should not happen: tell us.') })));
      signal.flare('break-it', m.verdict === 'pass' ? 'keep' : 'refuse'); signal.flare('liveware', m.verdict === 'pass' ? 'keep' : 'refuse');
    });
    w.postMessage({ type: 't4' });
  });
}
