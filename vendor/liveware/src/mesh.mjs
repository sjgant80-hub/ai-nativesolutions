// src/mesh.mjs — T6, two instances of the page as peers, as CLAIMS.md seals it.
//
// Each instance has its own Ed25519 key. They meet (a hello carries the sender's key, pinned trust-on-first-use), then
// every later message is a signed LIGHT packet checked against the pinned key and a per-sender counter. They share one
// document by the estate's CRDT merge law, and hand a task across: the doer runs it, signs the result, and the asker
// re-computes the result from the task and checks it matches. A forged peer (a key never pinned) is refused at the
// sender/signature stage; a replay is refused at the counter. The transport is injected (BroadcastChannel in the page,
// an in-memory channel in CI); this file is the peer's logic, pure but for the injected crypto.
import { frame, open } from '../vendor/fall-kit/core/vendor/light/packet.mjs';
import { emptyDoc, setKey, merge, valueOf } from '../vendor/fall-kit/core/vendor/sync/crdt.mjs';
import { canonical, shaHex } from './receipt.mjs';

export const HELLO = 'hello', OP = 'op', TASK = 'task', RESULT = 'result';

/** the task both sides agree on: sum a list of whole numbers (deterministic, re-computable by the asker) */
export const runTask = (t) => (t !== null && typeof t === 'object' && Array.isArray(t.nums) && t.nums.every(Number.isSafeInteger) ? { sum: t.nums.reduce((a, b) => a + b, 0) } : { sum: null });

/**
 * A peer. io = { self: identity (id, slot, sign), docId, verify(id, signed, sig) → bool (async), send(packetBytes),
 *   frameBody(kind, value) → packetBytes (async, signs a LIGHT packet), now() }.
 * → { hello(), onMessage(bytes) (async), setLocal(key,value) (async), ask(nums) (async), state(), peers() }
 */
export function makePeer(io) {
  const o = io !== null && typeof io === 'object' ? io : {};
  const self = o.self || {};
  const pinned = new Map();             // slot → { id }
  const counter = new Map();            // slot → last counter seen
  let doc = emptyDoc(typeof o.docId === 'string' ? o.docId : 'mesh');
  const asked = new Map();              // task hash → { nums, resolve }
  const log = [];
  const note = (e) => { log.push(e); return e; };

  // open against ONE known key, with the signature verdict already decided (open calls verify synchronously):
  // keyFor returns that key for the one sender, verify returns the precomputed boolean.
  const openWith = (bytes, sender, id, good, lastC) => open(bytes, {
    keyFor: (s) => (s === sender ? id : null),
    verify: () => good === true,
    dictFor: () => null,
    lastCounter: () => lastC,
  });

  async function hello() {
    const body = { t: HELLO, id: self.id };
    if (typeof o.frameBody === 'function') await o.send(await o.frameBody(HELLO, body));
  }

  async function onMessage(bytes) {
    const f = frame(bytes, {});
    if (!f.ok) return note({ in: 'refused', stage: f.stage, why: f.reason });
    const lastC = counter.has(f.sender) ? counter.get(f.sender) : 0n;
    let id = pinned.has(f.sender) ? pinned.get(f.sender).id : null;
    // a first-contact packet is read (TOFU) ONLY to learn a hello's key; its signature must then verify under that key
    if (id === null) {
      const peek = open(bytes, { keyFor: () => 'x', verify: () => true, dictFor: () => null, lastCounter: () => 0n });
      if (!(peek.admit && peek.value && typeof peek.value === 'object' && peek.value.t === HELLO && typeof peek.value.id === 'string')) {
        return note({ in: 'refused', stage: 'sender', why: 'sender ' + f.sender + ' is not pinned and did not say hello' });
      }
      id = peek.value.id;
    }
    const good = typeof o.verify === 'function' ? (await o.verify(id, f.signed, f.sig)) === true : false;
    const r = openWith(bytes, f.sender, id, good, lastC);
    if (!r.admit) return note({ in: 'refused', stage: r.stage, why: r.reason });
    if (!pinned.has(f.sender)) pinned.set(f.sender, { id });
    counter.set(f.sender, r.counter);
    return handle(f.sender, r.value);
  }

  async function handle(sender, v) {
    if (v === null || typeof v !== 'object') return note({ in: 'dropped', why: 'not an object' });
    if (v.t === HELLO) return note({ in: HELLO, sender });
    if (v.t === OP && v.doc) { doc = merge(doc, v.doc).doc; return note({ in: OP, sender }); }
    if (v.t === TASK && v.task) {
      const out = runTask(v.task), body = { t: RESULT, of: shaHex(canonical(v.task)), out };
      if (typeof o.frameBody === 'function') await o.send(await o.frameBody(RESULT, body));
      return note({ in: TASK, sender });
    }
    if (v.t === RESULT) {
      const a = asked.get(v.of);
      if (!a) return note({ in: 'dropped', why: 'a result for a task not asked' });
      const want = runTask({ nums: a.nums });
      const ok = canonical(want) === canonical(v.out);
      asked.delete(v.of); a.resolve({ ok, out: v.out, want });
      return note({ in: RESULT, sender, ok });
    }
    return note({ in: 'dropped', why: 'unknown message' });
  }

  const nodeId = String(self.id || self.slot || 'node');
  async function setLocal(key, value) {
    const w = setKey(doc, nodeId, key, value);
    if (!w.ok) return note({ op: 'refused', why: w.why });
    doc = w.doc;
    const body = { t: OP, doc };
    if (typeof o.frameBody === 'function') await o.send(await o.frameBody(OP, body));
  }

  async function ask(nums) {
    const task = { nums }, of = shaHex(canonical(task));
    const body = { t: TASK, task };
    const p = new Promise((resolve) => asked.set(of, { nums, resolve }));
    if (typeof o.frameBody === 'function') await o.send(await o.frameBody(TASK, body));
    return p;
  }

  return { hello, onMessage, setLocal, ask, state: () => valueOf(doc), doc: () => doc, peers: () => [...pinned.keys()], log: () => log };
}
