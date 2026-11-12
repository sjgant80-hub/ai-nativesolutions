// ════════════════════════════════════════════════════════════════
// light/packet.mjs — the LIGHT door: a signed LIGHT packet, and the gate it must pass before one byte of its body is
// decoded. This is where the language barrier is real: bytes in any other language fail at the magic number, bytes in
// LIGHT's own format from someone without a pinned key fail at the sender or the signature, and the decoder is never
// called for either. Only a packet signed by a pinned sender, with a counter it has not used, is ever read.
//
// Layout, version 1, big-endian:
//     0  'LGT1'           4   magic
//     4  1                1   version
//     5  dictionary id    4   the first four bytes of SHA-256(dictionary); 0 = no dictionary
//     9  sender           1
//    10  counter          8   u64, from 1
//    18  kind             1   0 = bytes, 1 = a JSON value
//    19  body length      4   u32
//    23  body             n   LIGHT codec bytes (codec.mjs)
//  23+n  signature       64   Ed25519 over DOMAIN ‖ bytes[0, 23+n)
//
//   open(bytes, ctx)   → { admit:true, decoded:true, sender, counter, kind, value|bytes } | { admit:false, decoded, stage, reason }
//                         stages, in order, all on raw bytes: size → magic → version → length → dictionary → sender →
//                         signature → counter; then (and only then) body. `decoded` says whether the decoder ever ran.
//   frame(bytes, ctx)  → the first four stages alone (a browser verifies the signature asynchronously, then calls open)
//   prepare(p)         → { ok, unsigned, signed } a packet without its signature; finish(unsigned, sig) puts it on
//   seal(p, sign)      → prepare, sign, finish in one step, for a synchronous signer
//   dictIdOf(dict)     → the dictionary's four-byte id
// ctx = { keyFor(sender) → key|null, verify(signed, sig, key) → bool, dictFor(id) → primed model|null,
//         lastCounter(sender) → bigint, maxPacket?, maxBody? }. Pure: no I/O, no clock, no crypto of its own.
// ════════════════════════════════════════════════════════════════
import { encode, decode } from './codec.mjs';
import { sha256 } from './sha256.mjs';

export const MAGIC = Object.freeze([0x4c, 0x47, 0x54, 0x31]);   // 'LGT1'
export const VERSION = 1, HEADER = 23, SIG = 64;
export const DOMAIN = 'LIGHT/packet/v1\u0000';
export const KINDS = Object.freeze({ BYTES: 0, JSON: 1 });
export const MAX_PACKET = 1 << 20, MAX_BODY = 1 << 22;
export const STAGES = Object.freeze(['size', 'magic', 'version', 'length', 'dictionary', 'sender', 'signature', 'counter', 'body', 'error']);
const DOMAIN_BYTES = Uint8Array.from(DOMAIN, (c) => c.charCodeAt(0));
const U64 = 2n ** 64n;

const refuse = (stage, reason, decoded = false) => ({ admit: false, decoded, stage, reason });
const bound = (v, d) => (Number.isSafeInteger(v) && v > 0 && v <= d ? v : d);

/** A dictionary's id: the first four bytes of its SHA-256, never 0 (0 means "no dictionary"). */
export function dictIdOf(dict) {
  const h = sha256(dict instanceof Uint8Array ? dict : new Uint8Array(0));
  const id = ((h[0] << 24) | (h[1] << 16) | (h[2] << 8) | h[3]) >>> 0;
  return id === 0 ? 1 : id;
}

/** The exact bytes the signature covers: DOMAIN ‖ header ‖ body. */
export function signedBytes(bytes, n) {
  const out = new Uint8Array(DOMAIN_BYTES.length + HEADER + n);
  out.set(DOMAIN_BYTES, 0);
  out.set(bytes.subarray(0, HEADER + n), DOMAIN_BYTES.length);
  return out;
}

/** The first four stages, on raw bytes, trusting nothing. */
export function frame(bytes, ctx) {
  const c = ctx && typeof ctx === 'object' ? ctx : {}, max = bound(c.maxPacket, MAX_PACKET);
  if (!(bytes instanceof Uint8Array)) return refuse('size', 'not bytes');
  if (bytes.length < HEADER + SIG || bytes.length > max) return refuse('size', 'a LIGHT packet is ' + (HEADER + SIG) + '–' + max + ' bytes');
  for (let i = 0; i < 4; i++) if (bytes[i] !== MAGIC[i]) return refuse('magic', 'not a LIGHT packet: it does not begin with LGT1');
  if (bytes[4] !== VERSION) return refuse('version', 'LIGHT version ' + bytes[4] + ' is not spoken here');
  if (bytes[18] !== KINDS.BYTES && bytes[18] !== KINDS.JSON) return refuse('version', 'body kind ' + bytes[18] + ' is not spoken here');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), n = dv.getUint32(19);
  if (HEADER + n + SIG !== bytes.length) return refuse('length', 'the body length (' + n + ') does not match the packet (' + bytes.length + ' bytes)');
  return { ok: true, dictId: dv.getUint32(5), sender: bytes[9], counter: dv.getBigUint64(10), kind: bytes[18], n, signed: signedBytes(bytes, n), sig: bytes.subarray(HEADER + n) };
}

/** The door: every stage on raw bytes, then the body. */
export function open(bytes, ctx) {
  const c = ctx && typeof ctx === 'object' ? ctx : {};
  try {
    const f = frame(bytes, c);
    if (!f.ok) return f;
    const primed = f.dictId === 0 ? null : typeof c.dictFor === 'function' ? c.dictFor(f.dictId) : null;
    if (f.dictId !== 0 && !primed) return refuse('dictionary', 'dictionary ' + f.dictId.toString(16).padStart(8, '0') + ' is not held here');
    const key = typeof c.keyFor === 'function' ? c.keyFor(f.sender) : null;
    if (!key) return refuse('sender', 'sender ' + f.sender + ' is not pinned here');
    if (!(typeof c.verify === 'function' && c.verify(f.signed, f.sig, key) === true)) return refuse('signature', 'the signature does not verify for sender ' + f.sender);
    const last = typeof c.lastCounter === 'function' ? c.lastCounter(f.sender) : 0n;
    if (typeof last !== 'bigint' || f.counter <= last) return refuse('counter', 'counter ' + f.counter + ' is not after ' + last + ': a replay, or out of order');
    const d = decode(bytes.subarray(HEADER, HEADER + f.n), primed || undefined, { max: bound(c.maxBody, MAX_BODY) });
    if (!d.ok) return refuse('body', 'the body does not decode: ' + d.why, true);
    const head = { admit: true, decoded: true, stage: 'admitted', sender: f.sender, counter: f.counter, kind: f.kind, dictId: f.dictId };
    if (f.kind === KINDS.BYTES) return { ...head, bytes: d.bytes };
    let value;
    try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(d.bytes)); } catch { return refuse('body', 'the body is not JSON', true); }
    return { ...head, value };
  } catch {
    return refuse('error', 'the door failed closed');
  }
}

/** A packet without its signature: the bytes to sign, and where the signature goes. */
export function prepare(p) {
  const o = p && typeof p === 'object' ? p : {};
  if (!Number.isInteger(o.sender) || o.sender < 0 || o.sender > 255) return { ok: false, why: 'sender is a whole number 0–255' };
  if (typeof o.counter !== 'bigint' || o.counter < 1n || o.counter >= U64) return { ok: false, why: 'counter is a u64 from 1' };
  if (!Number.isInteger(o.dictId) || o.dictId < 0 || o.dictId > 0xffffffff) return { ok: false, why: 'dictId is a u32 (0 = no dictionary)' };
  if (o.dictId !== 0 && !o.primed) return { ok: false, why: 'a dictionary id needs its primed model' };
  let body, kind;
  if (o.kind === KINDS.JSON) {
    let json;
    try { json = JSON.stringify(o.value); } catch { json = undefined; }
    if (typeof json !== 'string') return { ok: false, why: 'the value is not JSON' };
    body = new TextEncoder().encode(json); kind = KINDS.JSON;
  } else if (o.kind === KINDS.BYTES) {
    if (!(o.bytes instanceof Uint8Array)) return { ok: false, why: 'the body is not bytes' };
    body = o.bytes; kind = KINDS.BYTES;
  } else return { ok: false, why: 'kind is 0 (bytes) or 1 (JSON)' };
  const e = encode(body, o.dictId === 0 ? undefined : o.primed);
  if (!e.ok) return { ok: false, why: e.why };
  const n = e.bytes.length, total = HEADER + n + SIG;
  if (total > bound(o.maxPacket, MAX_PACKET)) return { ok: false, why: 'too large for one packet (' + total + ' bytes)' };
  const out = new Uint8Array(total), dv = new DataView(out.buffer);
  out.set(MAGIC, 0); out[4] = VERSION; dv.setUint32(5, o.dictId); out[9] = o.sender; dv.setBigUint64(10, o.counter); out[18] = kind; dv.setUint32(19, n);
  out.set(e.bytes, HEADER);
  return { ok: true, unsigned: out, signed: signedBytes(out, n) };
}

/** Put the signature on. */
export function finish(unsigned, sig) {
  if (!(unsigned instanceof Uint8Array) || unsigned.length < HEADER + SIG) return { ok: false, why: 'not an unsigned packet' };
  if (!(sig instanceof Uint8Array) || sig.length !== SIG) return { ok: false, why: 'a signature is 64 bytes' };
  const out = unsigned.slice();
  out.set(sig, out.length - SIG);
  return { ok: true, bytes: out };
}

/** prepare → sign → finish, for a synchronous signer: sign(signedBytes) → Uint8Array(64). */
export function seal(p, sign) {
  const r = prepare(p);
  if (!r.ok) return r;
  let sig = null;
  try { sig = typeof sign === 'function' ? sign(r.signed) : null; } catch { sig = null; }
  return finish(r.unsigned, sig);
}
