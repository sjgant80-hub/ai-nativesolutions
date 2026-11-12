// ════════════════════════════════════════════════════════════════
// layered/src/fold.mjs — LIGHT, LAYERED: one lossless codec, five dimensions of prediction over the same stream.
//
//   D1 symbol      how often each byte occurs (order 0): the flat layer
//   D2 token       the word being written (case folded), and the word before it
//   D3 structure   the field a value belongs to (the token before a ':'), the same field's last value, the byte above
//   D4 prediction  the last 1, 2, 3, 4 and 6 bytes, the longest earlier repeat, and a second-stage refinement (APM)
//   D5 context     no new input: every layer above is first taught what both ends already hold (the SEED)
//
// Each layer adds inputs to one mixer; the mixed probability drives one 32-bit binary arithmetic coder. A frame names
// the layers it used (a mask, D1 always on), so a cold message to a stranger (D1..D4, no shared state) and a whisper
// between two ends that share a seed (D1..D5) are read by the same decode. A D5 frame names its seed by id; a decoder
// holding another seed refuses it, and the 4-byte check of the original refuses any frame it did not read exactly.
//
// Integers only (no Math.exp/log, no float that could round differently in another engine): the encoder in Node and the
// decoder in a browser make the same prediction for every bit. Pure and total: junk in is { ok:false, why }, never a
// throw. The one call that changes its argument is grow(seed, bytes), which teaches a seed more (both ends call it).
//
//   seed(chunks, { mask, bits })   → { ok, seed }    a model taught `chunks` (Uint8Array or an array of them), in order
//   grow(seed, bytes)              → { ok, id }      teach the seed more; its id moves on (a hash chain of what it read)
//   encode(bytes, { mask, bits, seed }) → { ok, bytes }   frame: F1 · mask · bits · [seed id, 4] · varint n · check · code
//   decode(frame, { seed, max })   → { ok, bytes, mask } | { ok:false, why }
//   peek(frame)                    → { ok, mask, bits, id, n, at }    the header alone, nothing decoded
//   negotiate(seed, peerId)        → the deepest mask both ends can read (with D5 only when the ids agree)
// ════════════════════════════════════════════════════════════════
import { sha256, hex } from '../../light/sha256.mjs';

export const D1 = 1, D2 = 2, D3 = 4, D4 = 8, D5 = 16;
export const COLD = 15, FULL = 31;
export const LADDER = Object.freeze([1, 3, 7, 15, 31]);
export const NAMES = Object.freeze(['symbol', 'token', 'structure', 'prediction', 'context']);
export const MAGIC = 0xf1, MIN_BITS = 16, MAX_BITS = 24, BITS = 22, MAX_BYTES = 64 * 1024 * 1024;
export const NIN = 13;                                   // bias, o0 · w0 w1 · key 2d field · o1 o2 o3 o4 o6 match
const LIMIT = 30, LR = 12, W_INIT = 12000, W_MAX = 1 << 19, MINLEN = 6, FKBITS = 12;
const NSETS = 1024, APM_CTX = 1 << 16;
const EXTRA = 256 + 64 + 64;                             // direct slots after the hashed table: o0, match, field match

// the logistic 4096/(1+e^(-d/256)) as 33 fixed points and straight lines between them (LIGHT v1's table)
const SQ = [1, 2, 3, 6, 10, 16, 27, 45, 73, 120, 194, 310, 488, 747, 1101, 1546, 2047, 2549, 2994, 3348, 3607, 3785, 3901, 3975, 4022, 4050, 4068, 4079, 4085, 4089, 4092, 4093, 4094];
export function squash(d) {
  const c = Math.max(-2047, Math.min(2047, Math.trunc(Number(d)) || 0));
  const w = c & 127, i = (c >> 7) + 16;
  return (SQ[i] * (128 - w) + SQ[i + 1] * w + 64) >> 7;
}
// stretch(p): the least d whose squash reaches p (2047 when none does)
const ST = new Int16Array(4096);
{
  let x = -2047;
  for (let p = 0; p !== 4096; p++) { while (x !== 2047 && squash(x) < p) x++; ST[p] = x; }
}
export const stretch = (p) => ST[p];
const DT = new Int32Array(LIMIT + 1);
for (let n = 0; n <= LIMIT; n++) DT[n] = Math.floor(65536 / (2 * n + 3));
const ROW = new Uint16Array(33);                         // one APM context's starting row: the identity curve
for (let i = 0; i !== 33; i++) ROW[i] = squash((i - 16) * 128) * 16;

const fmix = (h) => {
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
};
const hc = (salt, a, b) => fmix(Math.imul(fmix(Math.imul(salt, 0x632be5ab) ^ a) ^ b, 0x9e3779b1) ^ salt);
const wordy = (c) => (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c >= 128;
const tokch = (c) => wordy(c) || c === 95 || c === 45;
const SEED0 = new TextEncoder().encode('LIGHT layered seed v1');

const validMask = (m) => Number.isInteger(m) && m >= 1 && m <= FULL && (m & D1) === D1;
const validBits = (b) => Number.isInteger(b) && b >= MIN_BITS && b <= MAX_BITS;
const isObj = (o) => o !== null && typeof o === 'object';
/** the table size a cold frame of n bytes is coded with: about 512 slots a byte, between 2^18 and 2^22 */
export const coldBits = (n) => { let b = 18; while (b < BITS && (1 << b) < n * 512) b++; return b; };

function freshModel(mask, bits, room) {
  const size = (1 << bits) + EXTRA, A = new Uint16Array(APM_CTX * 33);
  for (let c = 0; c < APM_CTX; c++) A.set(ROW, c * 33);
  const W = new Int32Array(NSETS * NIN).fill(W_INIT);
  for (let s = 0; s !== NSETS; s++) W[s * NIN] = 0;        // the bias starts at no opinion
  return { mask, bits, P: new Uint32Array(size).fill(32768 << 8), W, A,
    ht: new Int32Array(1 << (bits - 2)), fk: new Int32Array(1 << FKBITS), buf: new Uint8Array(room), len: 0, mptr: 0,
    st: new Int32Array(16) };
}
function copyModel(m, room) {
  const buf = new Uint8Array(m.len + room); buf.set(m.buf.subarray(0, m.len));
  return { mask: m.mask, bits: m.bits, P: m.P.slice(), W: m.W.slice(), A: m.A.slice(), ht: m.ht.slice(),
    fk: m.fk.slice(), buf, len: m.len, mptr: m.mptr, st: m.st.slice() };
}
// P holds each slot's state in one word, so a 16-slot block is one cache line: probability (16 bits) << 8 | count
// the running byte-level state, kept in st between calls
const C4 = 0, C8 = 1, WORD = 2, PWORD = 3, INSTR = 4, ESC = 5, TOK = 6, LTOK = 7, KEY = 8, VPOS = 9, FPTR = 10,
  FAGREE = 11, LSTART = 12, PSTART = 13, PLEN = 14, MLEN = 15;
const TEACH = 0, ENC = 1, DEC = 2;

// ONE loop for teaching a seed, encoding and decoding, so the three can never predict differently. mode TEACH: learn
// `src` (no coder); ENC: learn `src` and return the arithmetic code; DEC: read `n` bytes from `frame` at `at0`.
// The model is changed in place (callers pass a fresh model or a copy; only TEACH saves the running state).
function run(m, mode, src, n, frame, at0) {
  const P = m.P, W = m.W, A = m.A, ht = m.ht, fk = m.fk, buf = m.buf, st = m.st, mask = m.mask, bits = m.bits;
  const R0 = 1 << bits, RM = R0 + 256, RF = RM + 64, HB = bits - 2, FKM = (1 << FKBITS) - 1, shift = 32 - bits + 4;
  const on2 = (mask & D2) !== 0, on3 = (mask & D3) !== 0, on4 = (mask & D4) !== 0;
  const act = [0, 1];
  if (on2) act.push(2, 3);
  if (on3) act.push(4, 5, 6);
  if (on4) act.push(7, 8, 9, 10, 11, 12);
  const NA = act.length, ACT = Int32Array.from(act), HASHED = Int32Array.from(act.filter((j) => j !== 0 && j !== 1 && j !== 6 && j !== 12));
  const NH = HASHED.length, CTX = new Uint32Array(NIN), B = new Int32Array(NIN), S = new Int32Array(NIN).fill(-1), T = new Int32Array(NIN);
  let c4 = st[C4] >>> 0, c8 = st[C8] >>> 0, word = st[WORD] >>> 0, pword = st[PWORD] >>> 0, inStr = st[INSTR], esc = st[ESC];
  let tok = st[TOK] >>> 0, ltok = st[LTOK] >>> 0, key = st[KEY] >>> 0, vpos = st[VPOS], fptr = st[FPTR], fagree = st[FAGREE];
  let lstart = st[LSTART], pstart = st[PSTART], plen = st[PLEN], mlen = st[MLEN], mptr = m.mptr, len = m.len;
  const out = mode === ENC ? [] : null, got = mode === DEC ? new Uint8Array(n) : null;
  let x1 = 0, x2 = 0xffffffff, x = 0, at = at0;
  if (mode === DEC) for (let j = 0; j !== 4; j++) x = ((x << 8) | (frame[at++] | 0)) >>> 0;
  for (let i = 0; i !== n; i++) {
    // the contexts of the byte about to come
    const c1 = c4 & 255;
    if (on2) { CTX[2] = word !== 0 ? hc(2, word, 0) : hc(2, pword, 1); CTX[3] = hc(3, word, pword); }
    if (on3) { const col = len - lstart; CTX[4] = hc(4, key, (c1 << 2) | vpos); CTX[5] = hc(5, col < plen ? buf[pstart + col] : 0, c1); }
    if (on4) { CTX[7] = hc(7, c1, 0); CTX[8] = hc(8, c4 & 0xffff, 0); CTX[9] = hc(9, c4 & 0xffffff, 0); CTX[10] = hc(10, c4, 0); CTX[11] = hc(11, c4, c8 & 0xffff); }
    for (let h = 0; h !== NH; h++) { const j = HASHED[h]; B[j] = (fmix(CTX[j]) >>> shift) << 4; }
    const byte = mode === DEC ? 0 : src[i];
    let c0 = 1, nib = 1;
    for (let k = 0; k !== 8; k++) {
      if (k === 4) { nib = 1; const hi = Math.imul(c0, 0x2545f491); for (let h = 0; h !== NH; h++) { const j = HASHED[h]; B[j] = (fmix(CTX[j] ^ hi) >>> shift) << 4; } }
      // predict: every active input's guess, mixed
      S[1] = R0 + c0;
      for (let h = 0; h !== NH; h++) { const j = HASHED[h]; S[j] = B[j] + nib; }
      if (on3) {
        S[6] = -1;
        if (fptr !== 0) { const e = buf[fptr]; if (((e | 256) >> (8 - k)) === c0) S[6] = RF + fagree * 2 + ((e >> (7 - k)) & 1); }
      }
      let mb = 0;
      if (on4) {
        S[12] = -1;
        if (mlen !== 0) {
          const e = buf[mptr];
          if (((e | 256) >> (8 - k)) === c0) {
            S[12] = RM + (mlen < 16 ? mlen : Math.min(31, 17 + ((mlen - 16) >> 3))) * 2 + ((e >> (7 - k)) & 1);   // bucket 16 is never used: a step, so the boundary shows
            mb = mlen < 16 ? 1 : mlen < 32 ? 2 : 3;
          }
        }
      }
      const ws = (c0 + 256 * mb) * NIN;
      T[0] = 256;
      let dot = 256 * W[ws];
      for (let a = 1; a !== NA; a++) { const j = ACT[a], s = S[j], t = s === -1 ? 0 : ST[P[s] >>> 12]; T[j] = t; dot += t * W[ws + j]; }
      const d = Math.max(-2047, Math.min(2047, Math.floor(dot / 65536)));
      const f = d & 127, si = (d >> 7) + 16, pm = (SQ[si] * (128 - f) + SQ[si + 1] * f + 64) >> 7;
      let q = pm, ax = 0;
      if (on4) {
        const sx = d + 2048, aw = sx & 127, ai = (c1 << 8 | c0) * 33 + (sx >> 7);
        q = Math.max(1, Math.min(4095, (pm + 3 * ((A[ai] * (128 - aw) + A[ai + 1] * aw) >> 11) + 2) >> 2));
        ax = aw < 64 ? ai : ai + 1;
      }
      // the bit: read from the input, or from the code
      let y;
      if (mode === TEACH) y = (byte >> (7 - k)) & 1;
      else {
        const r = x2 - x1, mid = x1 + (r >>> 12) * q + (((r & 4095) * q) >>> 12);
        y = mode === ENC ? (byte >> (7 - k)) & 1 : x <= mid ? 1 : 0;
        if (y) x2 = mid; else x1 = mid + 1;
        while (((x1 ^ x2) & 0xff000000) === 0) {                       // at most twice: q is 1..4095 of 4096
          if (mode === ENC) out.push(x2 >>> 24); else x = ((x << 8) | (frame[at++] | 0)) >>> 0;
          x1 = (x1 << 8) >>> 0; x2 = ((x2 << 8) | 255) >>> 0;
        }
      }
      // learn: the mixer's weights, every guess's state, the refinement
      const err = ((y << 12) - pm) * LR;
      for (let a = 0; a !== NA; a++) {
        const j = ACT[a], wi = ws + j;
        W[wi] = Math.max(-W_MAX, Math.min(W_MAX, W[wi] + ((T[j] * err + 32768) >> 16)));
      }
      for (let a = 1; a !== NA; a++) {
        const s = S[ACT[a]];
        if (s !== -1) { const u = P[s], p = u >>> 8, c = u & 255; P[s] = ((p + (((y ? 65535 - p : -p) * DT[c]) >> 15)) << 8) | (c < LIMIT ? c + 1 : c); }
      }
      if (on4) A[ax] += ((y ? 65535 : 0) - A[ax]) >> 6;
      c0 = (c0 << 1) | y; nib = (nib << 1) | y;
    }
    // the byte is known: move every layer's state on
    const v = c0 & 255;
    if (got) got[i] = v;
    buf[len] = v; len++;
    c8 = ((c8 << 8) | (c4 >>> 24)) >>> 0; c4 = ((c4 << 8) | v) >>> 0;
    if (on4) {
      if (mlen !== 0) { if (buf[mptr] === v) { mlen++; mptr++; } else mlen = 0; }
      if (len >= MINLEN) {
        const h = fmix(Math.imul(c4, 0x9e3779b1) ^ (c8 & 0xffff)) >>> (32 - HB);
        if (mlen === 0) {
          const back = ht[h];
          if (back !== 0) {
            const top = Math.min(back, 32);
            let L = 0;
            while (L !== top && buf[back - 1 - L] === buf[len - 1 - L]) L++;
            if (L >= MINLEN) { mlen = L; mptr = back; }
          }
        }
        ht[h] = len;
      }
    }
    if (on2) {
      if (wordy(v)) word = Math.imul((word || 0x811c9dc5) ^ (v >= 65 && v <= 90 ? v + 32 : v), 0x01000193) >>> 0;
      else if (word !== 0) { pword = word; word = 0; }
    }
    if (on3) {
      if (fptr !== 0) { if (buf[fptr] === v) { fptr++; fagree = fagree < 15 ? fagree + 1 : 15; } else { fptr = 0; fagree = 0; } }
      vpos = vpos < 3 ? vpos + 1 : 3;
      if (inStr !== 0) {
        if (esc !== 0) esc = 0;
        else if (v === 92) esc = 1;
        else if (v === 34) { inStr = 0; ltok = tok; tok = 0; }
        else tok = Math.imul((tok || 0x811c9dc5) ^ v, 0x01000193) >>> 0;
      } else if (v === 34) { inStr = 1; tok = 0x811c9dc5; }
      else if (tokch(v)) tok = Math.imul((tok || 0x811c9dc5) ^ v, 0x01000193) >>> 0;
      else {
        if (tok !== 0) { ltok = tok; tok = 0; }
        if (v === 58 && ltok !== 0) { key = ltok; vpos = 0; fptr = fk[key & FKM]; fagree = 0; fk[key & FKM] = len; }
      }
      if (v === 10) { pstart = lstart; plen = len - 1 - lstart; lstart = len; }
    }
  }
  if (mode === TEACH) {
    st[C4] = c4 | 0; st[C8] = c8 | 0; st[WORD] = word | 0; st[PWORD] = pword | 0; st[INSTR] = inStr; st[ESC] = esc;
    st[TOK] = tok | 0; st[LTOK] = ltok | 0; st[KEY] = key | 0; st[VPOS] = vpos; st[FPTR] = fptr; st[FAGREE] = fagree;
    st[LSTART] = lstart; st[PSTART] = pstart; st[PLEN] = plen; st[MLEN] = mlen; m.mptr = mptr; m.len = len;
    return null;
  }
  // one byte ends the stream: the decoder reads zeros past the end, and x1's top byte + 1 (followed by zeros) lies in
  // [x1, x2], because after renormalising the two differ in their top byte
  if (mode === ENC) { out.push((x1 >>> 24) + 1); return out; }
  return got;
}

function teach(m, bytes) {
  const g = new Uint8Array(m.len + bytes.length);              // the history, exactly as long as what was read
  g.set(m.buf.subarray(0, m.len)); m.buf = g;
  run(m, TEACH, bytes, bytes.length, null, 0);
}
const chain = (id, bytes) => { const x = new Uint8Array(64); x.set(id); x.set(sha256(bytes), 32); return sha256(x); };
const chunksOf = (c) => (c instanceof Uint8Array ? [c] : Array.isArray(c) && c.every((x) => x instanceof Uint8Array) ? c : null);
const isSeed = (s) => isObj(s) && s.kind === 'fold.seed' && isObj(s.model) && s.model.P instanceof Uint32Array && s.id instanceof Uint8Array;

/** A seed: a model taught `chunks` (what both ends already hold), oldest first. D5 is added to the mask. */
export function seed(chunks, opts) {
  const o = isObj(opts) ? opts : {}, list = chunksOf(chunks === undefined ? [] : chunks);
  if (!list) return { ok: false, why: 'chunks are a Uint8Array or an array of them' };
  let total = 0;
  for (const c of list) total += c.length;
  if (total > MAX_BYTES) return { ok: false, why: 'a seed holds at most ' + MAX_BYTES + ' bytes' };
  const m0 = o.mask === undefined ? FULL : o.mask, bits = o.bits === undefined ? BITS : o.bits;
  if (!validMask(m0)) return { ok: false, why: 'mask is 1..31 with D1 on' };
  if (!validBits(bits)) return { ok: false, why: 'bits is ' + MIN_BITS + '..' + MAX_BITS };
  const mask = m0 | D5, model = freshModel(mask, bits, 0), all = new Uint8Array(total);
  let id = sha256(SEED0), at = 0;
  for (const c of list) { all.set(c, at); at += c.length; id = chain(id, c); }
  teach(model, all);                                             // one walk over the chunks in order: the same as one by one
  return { ok: true, seed: { kind: 'fold.seed', mask, bits, id, model, bytes: total } };
}

/** Teach a seed more (both ends call it with the same bytes, so their ids stay equal). Changes `s` in place. */
export function grow(s, bytes) {
  if (!isSeed(s)) return { ok: false, why: 'not a seed' };
  if (!(bytes instanceof Uint8Array)) return { ok: false, why: 'not bytes' };
  if (s.bytes + bytes.length > MAX_BYTES) return { ok: false, why: 'a seed holds at most ' + MAX_BYTES + ' bytes' };
  teach(s.model, bytes); s.id = chain(s.id, bytes); s.bytes += bytes.length;
  return { ok: true, id: idOf(s) };
}
/** A copy of a seed that can be grown apart from the original (the drift test uses it). */
export function fork(s) {
  if (!isSeed(s)) return { ok: false, why: 'not a seed' };
  return { ok: true, seed: { kind: 'fold.seed', mask: s.mask, bits: s.bits, id: s.id.slice(), model: copyModel(s.model, 0), bytes: s.bytes } };
}
/** The seed's id as a frame carries it: its first four bytes, hex. */
export const idOf = (s) => (isSeed(s) ? hex(s.id.subarray(0, 4)) : null);

const check4 = (bytes) => sha256(bytes).subarray(0, 4);

/** bytes → a frame. opts.mask (default COLD, or FULL when a seed is given); opts.seed is required for a D5 mask. */
export function encode(bytes, opts) {
  if (!(bytes instanceof Uint8Array)) return { ok: false, why: 'not bytes' };
  if (bytes.length > MAX_BYTES) return { ok: false, why: 'more than ' + MAX_BYTES + ' bytes' };
  const o = isObj(opts) ? opts : {}, sd = o.seed;
  const mask = o.mask === undefined ? (sd === undefined ? COLD : FULL) : o.mask;
  if (!validMask(mask)) return { ok: false, why: 'mask is 1..31 with D1 on' };
  let model, bits;
  if ((mask & D5) !== 0) {
    if (!isSeed(sd)) return { ok: false, why: 'a D5 frame needs the shared seed' };
    if (sd.mask !== mask) return { ok: false, why: 'the seed was taught with another mask' };
    bits = sd.bits; model = copyModel(sd.model, bytes.length);
  } else {
    bits = o.bits === undefined ? coldBits(bytes.length) : o.bits;
    if (!validBits(bits)) return { ok: false, why: 'bits is ' + MIN_BITS + '..' + MAX_BITS };
    model = freshModel(mask, bits, bytes.length);
  }
  const head = [MAGIC, mask, bits];
  if ((mask & D5) !== 0) head.push(sd.id[0], sd.id[1], sd.id[2], sd.id[3]);
  for (let n = bytes.length; ; ) { const b = n % 128; n = Math.floor(n / 128); if (n === 0) { head.push(b); break; } head.push(b | 128); }
  const c = check4(bytes), code = run(model, ENC, bytes, bytes.length, null, 0);
  const frame = new Uint8Array(head.length + 4 + code.length);
  frame.set(head); frame.set(c, head.length); frame.set(code, head.length + 4);
  return { ok: true, bytes: frame };
}

/** A frame's header alone: which layers, which table size, which seed, how many bytes. */
export function peek(frame) {
  if (!(frame instanceof Uint8Array)) return { ok: false, why: 'not bytes' };
  if (frame.length < 3 || frame[0] !== MAGIC) return { ok: false, why: 'not a layered LIGHT frame' };
  const mask = frame[1], bits = frame[2];
  if (!validMask(mask)) return { ok: false, why: 'mask is 1..31 with D1 on' };
  if (!validBits(bits)) return { ok: false, why: 'bits is ' + MIN_BITS + '..' + MAX_BITS };
  let at = 3, id = null;
  if ((mask & D5) !== 0) {
    if (frame.length < 7) return { ok: false, why: 'no seed id' };
    id = hex(frame.subarray(3, 7)); at = 7;
  }
  let n = 0, scale = 1, done = false;
  for (let k = 0; k !== 5 && !done; k++) {
    if (at === frame.length) return { ok: false, why: 'no length' };
    const b = frame[at++];
    n += (b & 127) * scale; scale *= 128;
    done = b < 128;
  }
  if (!done) return { ok: false, why: 'no length' };
  if (frame.length < at + 4) return { ok: false, why: 'no check' };
  return { ok: true, mask, bits, id, n, at };
}

/** A frame → its bytes, or a reason. opts.seed: the shared seed (D5 frames); opts.max bounds what a frame may claim. */
export function decode(frame, opts) {
  const h = peek(frame);
  if (!h.ok) return h;
  const o = isObj(opts) ? opts : {}, max = Number.isSafeInteger(o.max) && o.max >= 0 ? Math.min(o.max, MAX_BYTES) : MAX_BYTES;
  if (h.n > max) return { ok: false, why: 'more than ' + max + ' bytes' };
  let model;
  if ((h.mask & D5) !== 0) {
    const sd = o.seed;
    if (!isSeed(sd)) return { ok: false, why: 'this frame needs the shared seed ' + h.id };
    if (idOf(sd) !== h.id) return { ok: false, why: 'this frame needs seed ' + h.id + '; this end holds ' + idOf(sd) };
    if (sd.mask !== h.mask || sd.bits !== h.bits) return { ok: false, why: 'the seed was taught with another mask or table size' };
    model = copyModel(sd.model, h.n);
  } else model = freshModel(h.mask, h.bits, h.n);
  const want = frame.subarray(h.at, h.at + 4), out = run(model, DEC, null, h.n, frame, h.at + 4), have = check4(out);
  for (let j = 0; j !== 4; j++) if (have[j] !== want[j]) return { ok: false, why: 'the check does not match: another seed, or the frame was changed' };
  return { ok: true, bytes: out, mask: h.mask };
}

/** The deepest mask both ends can read: the seed's own mask when the peer holds the same seed, else the cold layers. */
export function negotiate(s, peerId) {
  if (!isSeed(s)) return COLD;
  return typeof peerId === 'string' && peerId === idOf(s) ? s.mask : s.mask & COLD;
}

/** "D1+D2+D3" for a mask. */
export function label(mask) {
  if (!validMask(mask)) return null;
  const on = [];
  for (let i = 0; i !== 5; i++) if ((mask & (1 << i)) !== 0) on.push('D' + (i + 1));
  return on.join('+');
}
