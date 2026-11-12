// src/door.mjs — T4, the door in front of a deliberately naive core, as CLAIMS.md seals it.
//
// The order, all on raw bytes until the last two:
//   immune   — an EXACT antibody (bytes refused before) is refused on sight, without paying for a signature check
//   the LIGHT door (vendor packet.mjs): size → magic → version → length → dictionary → sender → signature → counter → body
//   schema   — the decoded value must be a note: { op: 'note', n: whole number, text: string up to 200 characters }
// Every refusal at a door stage becomes antibodies (vendor antibody.mjs): the exact bytes, and their shape, so a near
// copy is named as a VARIANT of a family it has met. Shape antibodies never refuse; only the door and the schema do.
// The core behind the door does whatever it is given. The referee holds the ledger of what the genuine sender really
// signed with a valid body; anything else reaching the core, or anything reaching it twice, is a BREACH.
// Crypto is injected (verify is async); this file decides.
import { frame, open, STAGES as PACKET_STAGES } from '../vendor/fall-kit/core/vendor/light/packet.mjs';
import { mint, adopt, recognise, emptyLibrary, familyOf } from '../vendor/fall-kit/core/antibody.mjs';
import { canonical } from './receipt.mjs';

export const STAGES = Object.freeze(['immune', ...PACKET_STAGES, 'schema']);
export const MAX_TEXT = 200;

/** the one shape the core accepts */
export function schemaNote(v) {
  const ok = v !== null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join(',') === 'n,op,text' &&
    v.op === 'note' && Number.isSafeInteger(v.n) && v.n >= 0 && typeof v.text === 'string' && v.text.length <= MAX_TEXT;
  return ok ? { ok: true } : { ok: false, why: 'not a note: { op: "note", n, text } is the only shape the core takes' };
}

/**
 * A door. opts = { pinned: [{ slot, id }], keyset (hex), verify(id, signed, sig) → bool (async), schema? }.
 * → { check(bytes) → verdict (async), library() }. A verdict is { admit: true, sender, counter, value } or
 *   { admit: false, stage, why, family, decoded, variant } (variant: the known family this looked like, or null).
 */
export function makeDoor(opts) {
  const o = opts !== null && typeof opts === 'object' ? opts : {};
  const keys = new Map((Array.isArray(o.pinned) ? o.pinned : []).filter((p) => p && Number.isInteger(p.slot)).map((p) => [p.slot, p.id]));
  const keyset = typeof o.keyset === 'string' ? o.keyset : '';
  const schema = typeof o.schema === 'function' ? o.schema : schemaNote;
  const last = new Map();
  let library = emptyLibrary();
  const learn = (bytes, stage) => { const m = mint(bytes, { stage, keyset }); library = adopt(library, [m.exact, m.shape].filter(Boolean)).library; };
  const refused = (bytes, stage, why, decoded) => {
    const variant = recognise(library, bytes, { keyset, stage }).variant;
    learn(bytes, stage);
    return { admit: false, stage, why, family: familyOf(stage), decoded: decoded === true, variant };
  };
  async function check(bytes) {
    try {
      const seen = recognise(library, bytes, { keyset });
      if (seen.exact) return { admit: false, stage: 'immune', why: 'recognised on sight: these exact bytes were refused at ' + seen.exact.stage + ' before', family: seen.exact.family, decoded: false, variant: { of: seen.exact.hash, family: seen.exact.family, distance: 0 } };
      const f = frame(bytes, {});
      if (!f.ok) return refused(bytes, f.stage, f.reason, false);
      const id = keys.has(f.sender) ? keys.get(f.sender) : null;
      const good = id !== null && typeof o.verify === 'function' ? (await o.verify(id, f.signed, f.sig)) === true : false;
      const r = open(bytes, { keyFor: (s) => (keys.has(s) ? keys.get(s) : null), verify: () => good, dictFor: () => null, lastCounter: (s) => (last.has(s) ? last.get(s) : 0n) });
      if (!r.admit) return refused(bytes, r.stage, r.reason, r.decoded);
      const s = schema(r.value);
      if (!s.ok) return { admit: false, stage: 'schema', why: s.why, family: 'escape', decoded: true, variant: null };
      last.set(r.sender, r.counter);
      return { admit: true, sender: r.sender, counter: r.counter, value: r.value };
    } catch { return { admit: false, stage: 'error', why: 'the door failed closed', family: 'fault', decoded: false, variant: null }; }
  }
  return { check, library: () => library };
}

/** the referee: the ledger of genuine, valid bodies; a body the core receives that is not in it (or a second time) is a breach */
export function makeReferee() {
  const ledger = new Map();   // canonical value → times it may still arrive
  let breaches = 0, delivered = 0;
  return {
    sent(value) { const k = canonical(value); ledger.set(k, (ledger.get(k) || 0) + 1); },
    received(value) {
      const k = canonical(value), left = ledger.get(k) || 0;
      if (left > 0) { ledger.set(k, left - 1); delivered++; return true; }
      breaches++; return false;
    },
    tally: () => ({ breaches, delivered }),
  };
}
