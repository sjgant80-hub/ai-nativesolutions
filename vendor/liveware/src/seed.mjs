// src/seed.mjs — T1, the seed that grows the system, as CLAIMS.md seals it.
//
// A seed is   'LWS1' · genome length (u32, big-endian) · LIGHT(genome) · seal = SHA-256(genome) · Ed25519 signature
// where the genome is the canonical JSON of { kind, v, name, blocks: [{ path, sha256 }], config }: every file the system
// runs, pinned by hash. The signature covers the whole seed EXCEPT the signature itself (domain-separated) — every byte
// that will be decoded is authenticated, not just the genome's hash, so a flipped trailing byte of the LIGHT stream
// that happens to decode to the same genome is still refused. Germination checks, in order, magic → length → decode →
// genome → seal → signature → every block's hash, and only when all of them pass does it load a single block. The grown
// system writes its seed back out from the blocks it verified; encode() is deterministic, so if those blocks are the
// ones the genome named, the offspring is byte-identical to the parent and the parent's signature still verifies on it.
// Crypto and I/O are injected; this file decides.
import { encode, decode } from '../vendor/fall-kit/core/vendor/light/codec.mjs';
import { sha256, hex } from '../vendor/fall-kit/core/vendor/light/sha256.mjs';
import { canonical } from './receipt.mjs';

export const MAGIC = Object.freeze([0x4c, 0x57, 0x53, 0x31]);           // 'LWS1'
export const HEAD = 8, SEAL = 32, SIG = 64, MAX_SEED = 1 << 20;
export const MIN_SEED = HEAD + 1 + SEAL + SIG;                          // header + at least one LIGHT byte + seal + signature
export const DOMAIN = 'LIVEWARE/seed/v1\u0000';
export const STAGES = Object.freeze(['size', 'magic', 'length', 'decode', 'genome', 'seal', 'signature', 'block', 'load']);
const enc = new TextEncoder(), dec = new TextDecoder('utf-8', { fatal: true });
const HEX64 = /^[0-9a-f]{64}$/;
const refuse = (stage, why) => ({ ok: false, stage, why, imported: 0 });

/** a block path a genome may name: relative, no climbing, no drive letters */
export const safePath = (p) => typeof p === 'string' && p.length <= 256 && /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(p) && !p.split('/').includes('..');

/** the genome of a set of blocks: each path with the SHA-256 of its bytes, sorted by path */
export function genomeOf(name, blocks, config) {
  const list = (Array.isArray(blocks) ? blocks : []).filter((b) => b && safePath(b.path) && b.bytes instanceof Uint8Array)
    .map((b) => ({ path: b.path, sha256: hex(sha256(b.bytes)) })).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { kind: 'liveware.genome', v: 1, name: String(name), blocks: list, config: config !== null && typeof config === 'object' && !Array.isArray(config) ? config : {} };
}

/** is this a genome, in canonical shape? */
export function validGenome(g) {
  if (g === null || typeof g !== 'object' || g.kind !== 'liveware.genome' || g.v !== 1 || typeof g.name !== 'string' || !Array.isArray(g.blocks)) return false;
  if (g.config === null || typeof g.config !== 'object' || Array.isArray(g.config)) return false;
  const paths = g.blocks.map((b) => b && b.path);
  return g.blocks.every((b) => b && safePath(b.path) && HEX64.test(b.sha256) && Object.keys(b).length === 2) && new Set(paths).size === paths.length;
}

/** what the signature covers: the domain tag then the whole seed up to (not including) the signature */
export function signedOf(prefix) {
  const d = enc.encode(DOMAIN), p = prefix instanceof Uint8Array ? prefix : new Uint8Array(0), out = new Uint8Array(d.length + p.length);
  out.set(d, 0); out.set(p, d.length);
  return out;
}

/** the seed's content prefix (everything but the signature) for a genome → { ok, prefix, seal } */
export function prefixOf(genomeBytes) {
  if (!(genomeBytes instanceof Uint8Array)) return { ok: false, why: 'genome bytes are needed' };
  const e = encode(genomeBytes);
  if (!e.ok) return { ok: false, why: e.why };
  const seal = sha256(genomeBytes), n = e.bytes.length, prefix = new Uint8Array(HEAD + n + SEAL);
  prefix.set(MAGIC, 0); new DataView(prefix.buffer).setUint32(4, n); prefix.set(e.bytes, HEAD); prefix.set(seal, HEAD + n);
  return { ok: true, prefix, seal };
}

/** assemble seed bytes from a genome's canonical bytes and a signature over its prefix → { ok, bytes, seal } */
export function assemble(genomeBytes, sig) {
  if (!(sig instanceof Uint8Array) || sig.length !== SIG) return { ok: false, why: 'a 64-byte signature is needed' };
  const p = prefixOf(genomeBytes);
  if (!p.ok) return p;
  const out = new Uint8Array(p.prefix.length + SIG);
  out.set(p.prefix, 0); out.set(sig, p.prefix.length);
  return { ok: true, bytes: out, seal: p.seal };
}

/** make a seed: sign(bytes) is async and returns 64 bytes → { ok, bytes, seal } */
export async function makeSeed(genome, sign) {
  if (!validGenome(genome) || typeof sign !== 'function') return { ok: false, why: 'a valid genome and a signer are needed' };
  const p = prefixOf(enc.encode(canonical(genome)));
  if (!p.ok) return p;
  let sig;
  try { sig = await sign(signedOf(p.prefix)); } catch { return { ok: false, why: 'the signer failed' }; }
  return assemble(enc.encode(canonical(genome)), sig instanceof Uint8Array ? sig : new Uint8Array(0));
}

/** read a seed, every check but the signature and the blocks → { ok, genome, genomeBytes, seal, sig } | refusal */
export function readSeed(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < MIN_SEED || bytes.length > MAX_SEED) return refuse('size', 'a seed is ' + MIN_SEED + '–' + MAX_SEED + ' bytes');
  for (let i = 0; i < 4; i++) if (bytes[i] !== MAGIC[i]) return refuse('magic', 'not a Liveware seed: it does not begin with LWS1');
  const n = new DataView(bytes.buffer, bytes.byteOffset, bytes.length).getUint32(4);
  if (HEAD + n + SEAL + SIG !== bytes.length) return refuse('length', 'the genome length (' + n + ') does not match the seed (' + bytes.length + ' bytes)');
  const d = decode(bytes.subarray(HEAD, HEAD + n), undefined, { max: MAX_SEED });
  if (!d.ok) return refuse('decode', 'the genome does not decode: ' + d.why);
  let genome;
  try { genome = JSON.parse(dec.decode(d.bytes)); } catch { return refuse('genome', 'the genome is not JSON'); }
  if (!validGenome(genome) || canonical(genome) !== dec.decode(d.bytes)) return refuse('genome', 'the genome is not a canonical Liveware genome');
  const seal = bytes.subarray(HEAD + n, HEAD + n + SEAL), want = sha256(d.bytes);
  if (!want.every((b, i) => seal[i] === b)) return refuse('seal', 'the seal is not the SHA-256 of the genome');
  return { ok: true, genome, genomeBytes: d.bytes, seal: seal.slice(), signed: signedOf(bytes.subarray(0, HEAD + n + SEAL)), sig: bytes.slice(HEAD + n + SEAL) };
}

/**
 * Germinate: io = { verify(signedBytes, sig) → bool (async), fetch(path) → bytes | null (async), load(path, bytes) (async) }.
 * Nothing is loaded until every check has passed. → { ok, imported, genome, blocks } | { ok:false, stage, why, imported }
 */
export async function germinate(bytes, io) {
  const o = io !== null && typeof io === 'object' ? io : {};
  try {
    const r = readSeed(bytes);
    if (!r.ok) return r;
    if (!(typeof o.verify === 'function' && (await o.verify(r.signed, r.sig)) === true)) return refuse('signature', 'the signature does not verify for the pinned key');
    const blocks = [];
    for (const b of r.genome.blocks) {
      const got = typeof o.fetch === 'function' ? await o.fetch(b.path) : null;
      if (!(got instanceof Uint8Array) || hex(sha256(got)) !== b.sha256) return refuse('block', 'block ' + b.path + ' is not the one the genome names');
      blocks.push({ path: b.path, bytes: got });
    }
    let imported = 0;
    for (const b of blocks) {
      try { if (typeof o.load === 'function') await o.load(b.path, b.bytes); } catch { return { ok: false, stage: 'load', why: 'block ' + b.path + ' did not load', imported }; }
      imported++;
    }
    return { ok: true, imported, genome: r.genome, blocks, seal: r.seal, sig: r.sig };
  } catch { return refuse('size', 'the seed could not be read'); }
}

/** the grown system's own seed: its genome re-derived from the blocks it verified, carrying the signature it grew from */
export function offspring(grown) {
  const g = grown !== null && typeof grown === 'object' ? grown : {};
  if (!g.genome || !validGenome(g.genome) || !(g.sig instanceof Uint8Array)) return { ok: false, why: 'a grown system is needed' };
  const genome = genomeOf(g.genome.name, g.blocks, g.genome.config);
  return assemble(enc.encode(canonical(genome)), g.sig);
}
