// src/wave1.mjs — the four Wave-1 tests, written once and run in BOTH places: Node (tools/measure.mjs) and the browser
// (page/app.mjs). The gated logic is the live logic. Crypto is the vendored identity kernel (WebCrypto, Node 20+ and
// every modern browser); the LIGHT packet is pure. T1/T4/T6 are fully deterministic with seeded keys, so the receipt id
// a visitor computes equals the one CI publishes. T5 takes its sample bytes and its gzip/zstd/brotli baselines injected,
// because the browser and Node measure baselines differently; its LIGHT sizes and round trip are deterministic.
import { makeIdentity, verifyBytes } from '../vendor/fall-kit/core/identity.mjs';
import { prepare, finish, frame } from '../vendor/fall-kit/core/vendor/light/packet.mjs';
import { genomeOf, makeSeed, germinate, offspring } from './seed.mjs';
import { makeDoor, makeReferee, schemaNote } from './door.mjs';
import { measureOne, headline } from './compress.mjs';
import { makePeer } from './mesh.mjs';
import { receiptOf, shaHex, canonical } from './receipt.mjs';
import { rng } from './rng.mjs';

const u8 = (a) => (a instanceof Uint8Array ? a : new Uint8Array(a));
const te = new TextEncoder();
export const verify = (id, signed, sig) => verifyBytes(id, signed, sig);
const seed32 = (fill) => u8(new Array(32).fill(fill));

async function notePacket(identity, counter, value) {
  const p = prepare({ sender: identity.slot, counter: BigInt(counter), dictId: 0, kind: 1, value });
  if (!p.ok) throw new Error(p.why);
  const f = finish(p.unsigned, await identity.sign(p.signed));
  if (!f.ok) throw new Error(f.why);
  return f.bytes;
}

// ── T1 · plant the seed ─────────────────────────────────────────────────────────────────────────
export const T1_BLOCKS = () => [
  { path: 'a.txt', bytes: u8(te.encode('block one\n')) },
  { path: 'b.json', bytes: u8(te.encode('{"two":2}\n')) },
  { path: 'c.bin', bytes: u8([0, 1, 2, 3, 250, 251, 252, 253]) },
];
export async function t1() {
  const blocks = T1_BLOCKS(), store = new Map(blocks.map((b) => [b.path, b.bytes]));
  const genome = genomeOf('liveware-demo', blocks, { grows: true });
  const signer = await makeIdentity(seed32(7));
  const made = await makeSeed(genome, (b) => signer.sign(b));
  const io = { verify: (signed, sig) => verifyBytes(signer.id, signed, sig), fetch: (p) => store.get(p) || null, load: async () => {} };
  const grown = await germinate(made.bytes, io);
  const P1 = grown.ok && grown.imported === genome.blocks.length;
  const off = P1 ? offspring(grown) : { ok: false };
  const P2 = off.ok && shaHex(off.bytes) === shaHex(made.bytes);
  let P3 = true; const tamper = {};
  for (let i = 0; i < made.bytes.length; i++) {
    const t = made.bytes.slice(); t[i] ^= 1;
    const g = await germinate(t, io);
    if (g.ok || g.imported !== 0) { P3 = false; break; }
    tamper[g.stage] = (tamper[g.stage] || 0) + 1;
  }
  const badStore = new Map(store); badStore.set('a.txt', u8(te.encode('block ONE\n')));
  const g4 = await germinate(made.bytes, { ...io, fetch: (p) => badStore.get(p) || null });
  const P4 = !g4.ok && g4.stage === 'block' && g4.imported === 0;
  const pass = P1 && P2 && P3 && P4;
  const out = { P1, P2, P3, P4, seedBytes: made.bytes.length, blocks: genome.blocks.length, tamperRefusals: tamper };
  return { ...receiptOf('T1', 1, { seedSha: shaHex(made.bytes), blocks: genome.blocks }, out, pass ? 'pass' : 'fail', { signerSeed: '07*32' }), detail: out };
}

// ── T4 · attack it ──────────────────────────────────────────────────────────────────────────────
export const T4_ATTACKS = ['forged signature', 'replay', 'tampered body', 'unpinned key', 'oversized', 'foreign:sql', 'foreign:script', 'foreign:shell', 'foreign:http', 'foreign:json', 'broken length', 'schema escape'];
export async function t4(fuzzN = 10000) {
  const sender = await makeIdentity(seed32(9));
  const outsider = await makeIdentity(seed32(66));
  const keyset = shaHex([sender.id].join('|'));
  const door = makeDoor({ pinned: [{ slot: sender.slot, id: sender.id }], keyset, verify, schema: schemaNote });
  const ref = makeReferee();
  let delivered = 0;
  for (let i = 1; i <= 100; i++) {
    const value = { op: 'note', n: i, text: 'note ' + i };
    ref.sent(value);
    const v = await door.check(await notePacket(sender, i, value));
    if (v.admit && ref.received(v.value)) delivered++;
  }
  const P5 = delivered === 100;
  const genuine = await notePacket(sender, 101, { op: 'note', n: 101, text: 'real' });
  const forgedSig = genuine.slice(); forgedSig[forgedSig.length - 1] ^= 0xff;
  const tampered = genuine.slice(); tampered[30] ^= 1;
  const foreign = { sql: "'; DROP TABLE users; --", script: '<script>alert(1)</script>', shell: '$(rm -rf /)', http: 'GET / HTTP/1.1\r\nHost: x\r\n\r\n', json: '{"op":"note","n":1,"text":"x"}' };
  const attacks = [
    ['forged signature', forgedSig],
    ['replay', await notePacket(sender, 50, { op: 'note', n: 50, text: 'note 50' })],
    ['tampered body', tampered],
    ['unpinned key', await notePacket(outsider, 1, { op: 'note', n: 1, text: 'hi' })],
    ['oversized', u8(new Uint8Array(2_000_000).fill(65))],
    ...Object.entries(foreign).map(([k, s]) => ['foreign:' + k, u8(te.encode(s))]),
    ['broken length', genuine.slice(0, 10)],
    ['schema escape', await notePacket(sender, 102, { op: 'drop', table: 'users' })],
  ];
  let named = true; const refusals = {};
  for (const [name, bytes] of attacks) {
    const v = await door.check(bytes);
    if (v.admit) ref.received(v.value);
    if (!v.admit && (!v.stage || !v.why)) named = false;
    refusals[name] = v.admit ? 'ADMITTED' : v.stage;
  }
  const r = rng(4242); let crashes = 0;
  for (let i = 0; i < fuzzN; i++) {
    let bytes;
    if (r.int(2) === 0) bytes = r.bytes(r.int(400));
    else { bytes = genuine.slice(); const k = 1 + r.int(8); for (let j = 0; j < k; j++) bytes[r.int(bytes.length)] ^= (1 + r.int(255)); }
    try { const v = await door.check(bytes); if (v.admit) ref.received(v.value); } catch { crashes++; }
  }
  const base = forgedSig; await door.check(base);
  let recognised = 0; const swarm = rng(77);
  for (let i = 0; i < 1000; i++) {
    const m = base.slice(); const k = 1 + swarm.int(4); for (let j = 0; j < k; j++) m[m.length - 1 - swarm.int(8)] ^= (1 + swarm.int(255));
    const v = await door.check(m);
    if (!v.admit && v.variant) recognised++;
  }
  const repeat = await door.check(base);
  const exactRepeat = !repeat.admit && repeat.stage === 'immune';
  const breaches = ref.tally().breaches;
  const P1 = breaches === 0, P2 = named, P3 = recognised >= 900 && exactRepeat, P4 = breaches === 0 && crashes === 0;
  const pass = P1 && P2 && P3 && P4 && P5;
  const out = { P1, P2, P3, P4, P5, breaches, crashes, delivered, swarmRecognised: recognised, exactRepeat, refusals };
  return { ...receiptOf('T4', 1, { attacks: attacks.map((a) => a[0]), fuzzN }, out, pass ? 'pass' : 'fail', { fuzzSeed: 4242, swarmSeed: 77 }), detail: out };
}

// ── T5 · compression (baselines and sample bytes injected) ────────────────────────────────────────
export function t5(samples, baselines) {
  const rows = (Array.isArray(samples) ? samples : []).map((s) => ({ type: s.type, file: s.file, ...measureOne(s.bytes, baselines) }));
  const P1 = rows.every((r) => r.roundTrip);
  const P2 = rows.every((r) => r.light && r.gzip && r.zstd && r.brotli);
  const P3 = rows.length === samples.length && rows.some((r) => r.type.includes('image')) && rows.some((r) => r.type.includes('tiny'));
  const head = headline(rows);
  const P4 = head !== null;
  const pass = P1 && P2 && P3 && P4;
  const out = { P1, P2, P3, P4, headline: head, rows: rows.map((r) => ({ type: r.type, orig: r.orig, light: r.light, gzip: r.gzip, zstd: r.zstd, brotli: r.brotli, roundTrip: r.roundTrip })) };
  return { ...receiptOf('T5', 1, { samples: samples.map((s) => s.sha256) }, out, pass ? 'pass' : 'fail', { gzip: 9, zstd: 19, brotli: 'q11' }), detail: out };
}

// ── T6 · the mesh (an in-memory channel; the browser swaps in BroadcastChannel in app.mjs) ─────────
export async function t6() {
  const A = await makeIdentity(seed32(1));
  const B = await makeIdentity(seed32(2));
  const forger = await makeIdentity(seed32(3));
  const ctrA = { v: 1 }, ctrB = { v: 1 };
  let peerA, peerB;
  peerA = makePeer({ self: A, docId: 'd', verify, frameBody: (k, v) => notePacket(A, ctrA.v++, v), send: (b) => peerB.onMessage(b) });
  peerB = makePeer({ self: B, docId: 'd', verify, frameBody: (k, v) => notePacket(B, ctrB.v++, v), send: (b) => peerA.onMessage(b) });
  await peerA.hello(); await peerB.hello();
  const P1 = peerA.peers().includes(B.slot) && peerB.peers().includes(A.slot);
  await peerA.setLocal('title', 'from A'); await peerB.setLocal('note', 'from B');
  const P2 = canonical(peerA.state()) === canonical(peerB.state()) && peerA.state().title === 'from A' && peerA.state().note === 'from B';
  const res = await peerA.ask([3, 4, 5]);
  const P3 = res.ok && res.out.sum === 12;
  const forged = await notePacket({ ...forger, slot: B.slot }, 999, { t: 'op', doc: peerB.doc() });
  const before = canonical(peerA.state());
  const rf = await peerA.onMessage(forged);
  const replay = await notePacket(B, 1, { t: 'op', doc: peerB.doc() });
  const rr = await peerA.onMessage(replay);
  const P4 = rf.in === 'refused' && rr.in === 'refused' && canonical(peerA.state()) === before;
  const pass = P1 && P2 && P3 && P4;
  const out = { P1, P2, P3, P4, state: peerA.state(), taskResult: res.out };
  return { ...receiptOf('T6', 1, { docId: 'd' }, out, pass ? 'pass' : 'fail', { keysA: '01*32', keysB: '02*32' }), detail: out };
}
