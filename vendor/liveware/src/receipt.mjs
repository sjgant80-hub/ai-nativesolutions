// src/receipt.mjs — the receipt every Liveware test writes, as CLAIMS.md seals it:
//   { test, version, inputs_sha256, outputs_sha256, verdict, params }, and its id is the SHA-256 of that record as
//   canonical JSON (keys sorted at every level). The same record built in Node, in CI and in a visitor's browser has the
//   same id, so a deterministic run is checked by comparing one string. Pure and total.
import { sha256, hex } from '../vendor/fall-kit/core/vendor/light/sha256.mjs';

const enc = new TextEncoder();

/** canonical JSON: keys sorted at every level; anything JSON cannot hold becomes null */
export function canonical(x) {
  if (Array.isArray(x)) return '[' + x.map(canonical).join(',') + ']';
  if (x !== null && typeof x === 'object') return '{' + Object.keys(x).sort().map((k) => JSON.stringify(k) + ':' + canonical(x[k])).join(',') + '}';
  if (typeof x === 'number') return Number.isFinite(x) ? JSON.stringify(x) : 'null';
  if (typeof x === 'string' || typeof x === 'boolean' || x === null) return JSON.stringify(x);
  return 'null';
}

/** the SHA-256 of bytes or of a string's UTF-8, as hex */
export const shaHex = (x) => hex(sha256(x instanceof Uint8Array ? x : enc.encode(typeof x === 'string' ? x : canonical(x))));

/** a receipt: the record and its id. verdict is 'pass' or 'fail'; params holds the seeds and settings */
export function receiptOf(test, version, inputs, outputs, verdict, params) {
  const record = {
    test: String(test), version: String(version),
    inputs_sha256: shaHex(canonical(inputs === undefined ? null : inputs)),
    outputs_sha256: shaHex(canonical(outputs === undefined ? null : outputs)),
    verdict: verdict === 'pass' ? 'pass' : 'fail',
    params: params !== null && typeof params === 'object' && !Array.isArray(params) ? params : {},
  };
  return { record, id: shaHex(canonical(record)) };
}
