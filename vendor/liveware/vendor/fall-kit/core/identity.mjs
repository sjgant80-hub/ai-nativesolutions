// ════════════════════════════════════════════════════════════════
// core/identity.mjs — one Ed25519 key, in every form the foundation's kernels take it. The adapter between platform
// crypto (WebCrypto: Node 20+ and every modern browser) and the pure kernels. It decides nothing.
//
//   makeIdentity(seed?)   → { id (hex raw public key), raw, slot, sign(bytes) → 64-byte signature,
//                             ledgerKeys (the contribution ledger's form), wallet { pk, sk } (the wallet's form) }
//                           A 32-byte seed makes the same key every time (receipts that re-run byte for byte);
//                           without one the key is random. The private key never leaves WebCrypto except as the
//                           wallet's string form, which the wallet kernel needs to sign its budget tokens.
//   verifyBytes(id, bytes, sig) → boolean, never throws
//   slotOf(raw)           → the one-byte sender slot a LIGHT packet carries: the first byte of SHA-256(key)
//   keysetOf(ids)         → the SHA-256 that names a set of pinned keys (order does not matter)
//   walletCrypto(identity)→ the { generate, sign, verify } the wallet kernel is injected with, bound to this key
// ════════════════════════════════════════════════════════════════
import { sha256 } from './vendor/light/sha256.mjs';

const PKCS8 = '302e020100300506032b657004220420';   // the fixed DER prefix of an Ed25519 private key; the seed follows
const HEX64 = /^[0-9a-f]{64}$/;
const hex64 = (s) => typeof s === 'string' && HEX64.test(s);
export const hex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('');
export const unhex = (h) => Uint8Array.from(String(h).match(/../g) || [], (x) => parseInt(x, 16));
const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
const subtle = () => globalThis.crypto.subtle;
const ED = { name: 'Ed25519' };

export const slotOf = (raw) => sha256(raw instanceof Uint8Array ? raw : new Uint8Array(0))[0];

export function keysetOf(ids) {
  const list = (Array.isArray(ids) ? ids : []).filter((x) => typeof x === 'string' && HEX64.test(x)).sort();
  return hex(sha256(new TextEncoder().encode(list.join('|'))));
}

export async function makeIdentity(seed) {
  const s = seed instanceof Uint8Array && seed.length === 32 ? seed : globalThis.crypto.getRandomValues(new Uint8Array(32));
  const priv = await subtle().importKey('pkcs8', unhex(PKCS8 + hex(s)), ED, true, ['sign']);
  const jwk = await subtle().exportKey('jwk', priv);
  const raw = unb64u(jwk.x);
  return Object.freeze({
    id: hex(raw), raw, slot: slotOf(raw),
    sign: async (bytes) => new Uint8Array(await subtle().sign(ED, priv, bytes)),
    ledgerKeys: Object.freeze({ pub: hex(raw), priv }),
    wallet: Object.freeze({ pk: jwk.x, sk: jwk.d + '.' + jwk.x }),
  });
}

/** Does sig verify over bytes for the key whose raw public key is id (hex)? Never throws. */
export async function verifyBytes(id, bytes, sig) {
  if (!hex64(id)) return false;   // one canonical form of a key: lower-case hex. Everything else WebCrypto refuses itself
  try {
    const key = await subtle().importKey('raw', unhex(id), ED, false, ['verify']);
    return (await subtle().verify(ED, key, sig, bytes)) === true;
  } catch { return false; }
}

/** The wallet kernel's crypto, bound to this identity (its generate() returns this key, so wallet id = this key). */
export function walletCrypto(identity) {
  return {
    async generate() { return { pk: identity.wallet.pk, sk: identity.wallet.sk }; },
    async sign(msg, sk) {
      const [d, x] = String(sk).split('.');
      const key = await subtle().importKey('jwk', { kty: 'OKP', crv: 'Ed25519', d, x }, ED, false, ['sign']);
      return hex(new Uint8Array(await subtle().sign(ED, key, new TextEncoder().encode(msg))));
    },
    async verify(msg, sigHex, pk) {
      try {
        const key = await subtle().importKey('jwk', { kty: 'OKP', crv: 'Ed25519', x: pk }, ED, false, ['verify']);
        return (await subtle().verify(ED, key, unhex(sigHex), new TextEncoder().encode(msg))) === true;
      } catch { return false; }
    },
  };
}

export { b64u, unb64u };
