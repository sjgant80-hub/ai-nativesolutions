// ════════════════════════════════════════════════════════════════
// light/codec.mjs — LIGHT's codec: any bytes ⇄ LIGHT bytes, lossless. The one codec the estate's organs import.
//
// A context-mixing arithmetic coder. Each bit of the input is predicted from what came before it at seven depths —
// the bit's place in its byte; the last 1, 2, 3 and 4 bytes; the current word; and the longest earlier stretch that
// matches the last few bytes (the match model, which carries long repeats) — the seven guesses are mixed by weights
// that learn as they go, and the mixed probability drives a 32-bit binary arithmetic coder. Prediction IS the
// compression: the better the model knows the material, the fewer bits it spends. A shared dictionary primes the model
// (its tables AND its match history) before the first byte, so a short message that both sides partly know costs little.
// That is what "a language both sides speak" means, measured in bytes.
//
// Integers only. No Math.exp, no Math.log, no float that could round differently in another engine: the encoder in
// Node and the decoder in a browser must make the same prediction for every bit, or the stream is noise. Every value
// stays a whole number below 2^53. Pure and total: junk in is { ok:false, why }, never a throw.
//
//   prime(dictBytes)          → a model that has read the dictionary (a snapshot; encode and decode copy it, never change it)
//   encode(bytes, primed?, opts?)  → { ok, bytes }   varint length · 4-byte check of the input · the arithmetic code
//   decode(light, primed?, opts?)  → { ok, bytes } | { ok:false, why }   the check must match, or nothing is returned;
//                                   opts.max bounds what a stream may claim to hold (callers decoding a stranger's
//                                   bytes pass their own small bound)
//   squash(d), stretch(p)     → the integer logistic and its inverse (exported for the tests)
// ════════════════════════════════════════════════════════════════

export const MAX_BYTES = 64 * 1024 * 1024;
export const fits = (n) => n <= MAX_BYTES;
export const TBITS = 20;                                       // each hashed context table: 2^20 bit-states
export const INPUTS = 7;                                       // o0, o1, o2, o3, o4, word, match
const T = 1 << TBITS;
const OFF = [0, 256, 65792, 65792 + T, 65792 + 2 * T, 65792 + 3 * T, 65792 + 4 * T];
const MATCH = OFF[6], TOTAL = MATCH + 64;                      // match states: 32 length buckets × the bit it expects
const HBITS = 18, MINLEN = 6;                                  // the match model's index: 2^18 contexts of 6 bytes
// the table sizes are fixed. Pinned so that a mutation to the constants above throws at load — a killed mutant — rather
// than computing a vast TOTAL and allocating gigabytes (which would OOM a small CI runner instead of failing a test).
if (TOTAL !== 4260160) throw new RangeError('codec TOTAL out of range');
if (HBITS !== 18) throw new RangeError('codec HBITS out of range');
const LIMIT = 20, W_INIT = 16384, W_MAX = 1 << 19, LR = 14;

// the logistic 4096/(1+e^(-d/256)), as 33 fixed points and straight-line interpolation between them
const SQ = [1, 2, 3, 6, 10, 16, 27, 45, 73, 120, 194, 310, 488, 747, 1101, 1546, 2047, 2549, 2994, 3348, 3607, 3785, 3901, 3975, 4022, 4050, 4068, 4079, 4085, 4089, 4092, 4093, 4094];
export function squash(d) {
  const c = Math.max(-2047, Math.min(2047, Math.trunc(Number(d)) || 0));
  const w = c & 127, i = (c >> 7) + 16;
  return (SQ[i] * (128 - w) + SQ[i + 1] * w + 64) >> 7;
}
const ST = new Int16Array(4096);
{
  let at = 0;
  for (let x = -2047; x <= 2047; x++) { const v = squash(x); for (let j = at; j <= v; j++) ST[j] = x; at = v + 1; }
  ST.fill(2047, at);
}
export const stretch = (p) => ST[p];
// how far a state moves towards each new bit, in 1/32768ths: 2/(2n+3) of the way, fast while young, slower with age
const DT = new Int32Array(LIMIT + 1);
for (let n = 0; n <= LIMIT; n++) DT[n] = Math.floor(65536 / (2 * n + 3));

function freshModel(room) {
  return { P: new Uint16Array(TOTAL).fill(32768), N: new Uint8Array(TOTAL), W: new Int32Array(512 * INPUTS).fill(W_INIT),
    ht: new Int32Array(1 << HBITS), buf: new Uint8Array(room), len: 0, hist: 0, hist2: 0, word: 0, mptr: 0, mlen: 0 };
}
function copyModel(m, room) {
  const buf = new Uint8Array(m.len + room); buf.set(m.buf.subarray(0, m.len));
  return { P: m.P.slice(), N: m.N.slice(), W: m.W.slice(), ht: m.ht.slice(), buf, len: m.len, hist: m.hist, hist2: m.hist2, word: m.word, mptr: m.mptr, mlen: m.mlen };
}

// LENDING a primed model to one message, so a short message does not pay for copying 14 MB of tables: the message
// writes straight into the primed tables, the first write to each slot records what the slot held, and giveBack puts
// every one of them back before encode or decode returns. The weights (14 KB) and the history are copied as before.
// A message over IN_PLACE copies the whole model instead. Both paths make the same predictions bit for bit (tested).
export const IN_PLACE = 1 << 20;
function lend(m, room) {
  if (!m.E) { m.E = new Uint32Array(TOTAL); m.EH = new Uint32Array(1 << HBITS); m.ep = 0; }
  m.ep = (m.ep + 1) >>> 0;
  if (m.ep === 0) { m.E.fill(0); m.EH.fill(0); m.ep = 1; }        // the stamp wrapped after 2^32 messages: start clean
  const buf = new Uint8Array(m.len + room); buf.set(m.buf.subarray(0, m.len));
  return { model: { P: m.P, N: m.N, W: m.W.slice(), ht: m.ht, buf, len: m.len, hist: m.hist, hist2: m.hist2, word: m.word, mptr: m.mptr, mlen: m.mlen },
    log: { ep: m.ep, E: m.E, EH: m.EH, J: new Int32Array(4096), jn: 0, H: new Int32Array(1024), hn: 0 } };
}
function giveBack(m, log) {
  for (let i = 0; i !== log.jn; i += 2) { const v = log.J[i + 1]; m.P[log.J[i]] = v & 0xffff; m.N[log.J[i]] = v >>> 16; }
  for (let i = 0; i !== log.hn; i += 2) m.ht[log.H[i]] = log.H[i + 1];
}
const block = (x, salt) => ((Math.imul(x, 0x9E3779B1) ^ Math.imul(salt, 0x85EBCA77)) >>> (32 - TBITS + 8)) << 8;   // a 256-slot block per context

// One model walking one stream: p() is the probability that the next bit is 1; learn(y, p) takes the bit in; save()
// writes the walker's running state back into the model (prime keeps it; encode and decode throw their copy away).
// Written out input by input: this loop runs eight times a byte, and every name below is a local.
function walker(m, log) {
  const P = m.P, N = m.N, W = m.W, buf = m.buf, ht = m.ht, E = log ? log.E : null, EH = log ? log.EH : null, ep = log ? log.ep : 0;
  let hist = m.hist, hist2 = m.hist2, word = m.word, mptr = m.mptr, mlen = m.mlen, len = m.len;
  let c0 = 1, k = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, bw = 0, ws = 0;
  let s0 = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0, s5 = 0, s6 = -1, t0 = 0, t1 = 0, t2 = 0, t3 = 0, t4 = 0, t5 = 0, t6 = 0;
  const bases = () => {
    b1 = OFF[1] + ((hist & 0xff) << 8); b2 = OFF[2] + block(hist & 0xffff, 2); b3 = OFF[3] + block(hist & 0xffffff, 3);
    b4 = OFF[4] + block(hist, 4); bw = OFF[5] + block(word, 5);
  };
  bases();
  const keep = (s) => {                                            // a lent model: what this slot held, the first time only
    E[s] = ep;
    if (log.jn === log.J.length) { const g = new Int32Array(log.J.length * 2); g.set(log.J); log.J = g; }
    log.J[log.jn] = s; log.J[log.jn + 1] = P[s] | (N[s] << 16); log.jn += 2;
  };
  const state = (s, y) => { if (E && E[s] !== ep) keep(s); const n = N[s]; P[s] += ((y ? 65535 - P[s] : -P[s]) * DT[n]) >> 15; if (n < LIMIT) N[s] = n + 1; };
  const weight = (i, t, err) => { W[ws + i] = Math.max(-W_MAX, Math.min(W_MAX, W[ws + i] + ((t * err + 32768) >> 16))); };
  return {
    p() {
      s0 = c0; s1 = b1 | c0; s2 = b2 | c0; s3 = b3 | c0; s4 = b4 | c0; s5 = bw | c0; s6 = -1;
      if (mlen !== 0) { const e = buf[mptr]; if (((e | 256) >> (8 - k)) === c0) s6 = MATCH + Math.min(mlen, 31) * 2 + ((e >> (7 - k)) & 1); }
      ws = (c0 + (s6 !== -1 ? 256 : 0)) * INPUTS;
      t0 = ST[P[s0] >>> 4]; t1 = ST[P[s1] >>> 4]; t2 = ST[P[s2] >>> 4]; t3 = ST[P[s3] >>> 4]; t4 = ST[P[s4] >>> 4]; t5 = ST[P[s5] >>> 4];
      t6 = s6 !== -1 ? ST[P[s6] >>> 4] : 0;
      const dot = t0 * W[ws] + t1 * W[ws + 1] + t2 * W[ws + 2] + t3 * W[ws + 3] + t4 * W[ws + 4] + t5 * W[ws + 5] + t6 * W[ws + 6];
      const d = Math.max(-2047, Math.min(2047, Math.floor(dot / 65536)));   // squash, inlined: 1..4094
      const f = d & 127, i = (d >> 7) + 16;
      return (SQ[i] * (128 - f) + SQ[i + 1] * f + 64) >> 7;
    },
    learn(y, q) {
      const err = ((y << 12) - q) * LR;                                // |t·err| < 2^26: each shift below is an exact floor
      weight(0, t0, err); weight(1, t1, err); weight(2, t2, err); weight(3, t3, err); weight(4, t4, err); weight(5, t5, err); weight(6, t6, err);
      state(s0, y); state(s1, y); state(s2, y); state(s3, y); state(s4, y); state(s5, y);
      if (s6 !== -1) state(s6, y);
      c0 = (c0 << 1) | y; k++;
      if (k === 8) {
        const byte = c0 & 255;
        buf[len] = byte; len++;
        if (mlen !== 0 && buf[mptr] === byte) { mlen = Math.min(mlen + 1, 65535); mptr++; } else mlen = 0;
        hist2 = ((hist2 << 8) | (hist >>> 24)) & 0xffff;
        hist = ((hist << 8) | byte) >>> 0;
        const wordy = (byte >= 48 && byte <= 57) || (byte >= 65 && byte <= 90) || (byte >= 97 && byte <= 122) || byte >= 128;
        word = wordy ? Math.imul(word ^ byte, 0x01000193) >>> 0 : 0;
        if (len >= MINLEN) {
          const h = ((Math.imul(hist, 0x9E3779B1) ^ Math.imul(hist2, 0x85EBCA77)) >>> 0) >>> (32 - HBITS);
          if (mlen === 0) {
            const at = ht[h];
            if (at !== 0) {
              const top = Math.min(32, at);                               // compare back at most 32 bytes, never before 0
              let L = 0;
              while (L !== top && buf[at - 1 - L] === buf[len - 1 - L]) L++;
              if (L >= MINLEN) { mlen = L; mptr = at; }
            }
          }
          if (EH && EH[h] !== ep) {
            EH[h] = ep;
            if (log.hn === log.H.length) { const g = new Int32Array(log.H.length * 2); g.set(log.H); log.H = g; }
            log.H[log.hn] = h; log.H[log.hn + 1] = ht[h]; log.hn += 2;
          }
          ht[h] = len;
        }
        c0 = 1; k = 0; bases();
      }
    },
    save() { m.hist = hist; m.hist2 = hist2; m.word = word; m.mptr = mptr; m.mlen = mlen; m.len = len; },
  };
}

/** A model that has read `dict`: pass it to encode and decode as the shared dictionary. */
export function prime(dict) {
  const d = dict instanceof Uint8Array ? dict : new Uint8Array(0);
  const m = freshModel(d.length), w = walker(m);
  for (let i = 0; i < d.length; i++) for (let b = 7; b >= 0; b--) { const y = (d[i] >> b) & 1; w.learn(y, w.p()); }
  w.save();
  return m;
}

// FNV-1a over the input: four bytes that let decode refuse a stream it did not read correctly
function check(bytes) {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 0x01000193);
  return h >>> 0;
}
const isPrimed = (m) => !!m && m.P instanceof Uint16Array && m.P.length === TOTAL && m.N instanceof Uint8Array && m.buf instanceof Uint8Array;
// the model a message is coded with: a lent primed model (short), a copy of it (long), or a fresh one (no dictionary)
function start(primed, room, copy) {
  if (!isPrimed(primed)) return { model: freshModel(room), log: null };
  return room <= IN_PLACE && copy !== true ? lend(primed, room) : { model: copyModel(primed, room), log: null };
}
const opt = (o) => (o && typeof o === 'object' ? o : {});

/** bytes → LIGHT bytes. opts.copy: code with a copy of the primed model even when short (the tests use it) */
export function encode(bytes, primed, opts) {
  if (!(bytes instanceof Uint8Array)) return { ok: false, why: 'not bytes' };
  if (!fits(bytes.length)) return { ok: false, why: 'more than ' + MAX_BYTES + ' bytes' };
  const out = [];
  for (let n = bytes.length; ; ) { const b = n % 128; n = Math.floor(n / 128); if (n === 0) { out.push(b); break; } out.push(b | 128); }
  const c = check(bytes);
  out.push(c >>> 24, (c >>> 16) & 255, (c >>> 8) & 255, c & 255);
  const run = start(primed, bytes.length, opt(opts).copy), w = walker(run.model, run.log);
  let x1 = 0, x2 = 0xffffffff;
  try {
    for (let i = 0; i < bytes.length; i++) {
      for (let b = 7; b >= 0; b--) {
        const y = (bytes[i] >> b) & 1, q = w.p(), r = x2 - x1;
        const mid = x1 + (r >>> 12) * q + (((r & 4095) * q) >>> 12);
        if (y) x2 = mid; else x1 = mid + 1;
        w.learn(y, q);
        for (let g = 0; g < 32 && ((x1 ^ x2) & 0xff000000) === 0; g++) { out.push(x2 >>> 24); x1 = (x1 << 8) >>> 0; x2 = ((x2 << 8) | 255) >>> 0; }   // the cap (max valid renorm is 2) only bounds a runaway, so no kernel can hang
      }
    }
  } finally { if (run.log) giveBack(primed, run.log); }
  out.push(x1 >>> 24, (x1 >>> 16) & 255, (x1 >>> 8) & 255, x1 & 255);
  return { ok: true, bytes: Uint8Array.from(out) };
}

/** LIGHT bytes → bytes, or a reason. opts.max: refuse a stream that says it holds more (default MAX_BYTES); opts.copy as encode */
export function decode(light, primed, opts) {
  if (!(light instanceof Uint8Array)) return { ok: false, why: 'not bytes' };
  let n = 0, at = 0, scale = 1, done = false;
  for (let k = 0; k !== 5 && !done; k++) {
    if (at === light.length) return { ok: false, why: 'no length' };
    const b = light[at++];
    n += (b & 127) * scale; scale *= 128;
    done = b < 128;
  }
  if (!done) return { ok: false, why: 'no length' };
  const o = opt(opts), max = Number.isSafeInteger(o.max) && o.max >= 0 ? Math.min(o.max, MAX_BYTES) : MAX_BYTES;
  if (n > max) return { ok: false, why: 'more than ' + max + ' bytes' };
  if (light.length < at + 4) return { ok: false, why: 'no check' };
  const want = ((light[at] << 24) | (light[at + 1] << 16) | (light[at + 2] << 8) | light[at + 3]) >>> 0;
  at += 4;
  const run = start(primed, n, o.copy), w = walker(run.model, run.log);
  let x1 = 0, x2 = 0xffffffff, x = 0;
  for (let j = 0; j !== 4; j++) x = ((x << 8) | (light[at++] | 0)) >>> 0;
  const out = new Uint8Array(n);
  try {
    for (let i = 0; i !== n; i++) {
      let c = 0;
      for (let b = 0; b < 8; b++) {
        const q = w.p(), r = x2 - x1;
        const mid = x1 + (r >>> 12) * q + (((r & 4095) * q) >>> 12);
        const y = x <= mid ? 1 : 0;
        if (y) x2 = mid; else x1 = mid + 1;
        w.learn(y, q);
        c = (c << 1) | y;
        for (let g = 0; g < 32 && ((x1 ^ x2) & 0xff000000) === 0; g++) { x1 = (x1 << 8) >>> 0; x2 = ((x2 << 8) | 255) >>> 0; x = ((x << 8) | (light[at++] | 0)) >>> 0; }   // same cap as encode, so the two stay in step
      }
      out[i] = c;
    }
  } finally { if (run.log) giveBack(primed, run.log); }
  if (check(out) !== want) return { ok: false, why: 'the check does not match: wrong dictionary, or the bytes were changed' };
  return { ok: true, bytes: out };
}
