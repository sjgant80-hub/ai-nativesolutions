// site/kernel/netwatch.mjs — the ledger behind "nothing leaves your browser" (pure; no clock, no DOM, no network).
// The page and its workers report every network request the browser tells them about. This file keeps the ledger and
// answers the only questions the claim rests on, from the entries alone:
//   · who did this page talk to, and how much came DOWN from each
//   · did any request carry a body UP (a request with a body is the only way your words could leave)
//   · how many requests were made between two marks (for example: while the model was reading your text)
// It classifies hosts by a fixed, readable table. An unknown host is named as unknown, never folded into a friendly row.

const str = (v) => (typeof v === 'string' ? v : '');
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** HOSTS: what each outside host is for. Anything not here is 'unknown'. */
export const HOSTS = Object.freeze([
  { test: /^cdn\.jsdelivr\.net$/, kind: 'model-runtime', say: 'the open-source WebLLM library (loaded when you ask for the model)' },
  { test: /(^|\.)huggingface\.co$|(^|\.)hf\.co$/, kind: 'model-weights', say: 'the open model\'s weights (downloaded once, then kept by your browser)' },
  { test: /^raw\.githubusercontent\.com$/, kind: 'model-runtime', say: 'the model\'s compiled WebGPU program' },
]);

/** classify(url, pageOrigin) → { origin, host, party, kind, say } */
export function classify(url, pageOrigin) {
  let u = null;
  try { u = new URL(str(url), str(pageOrigin) || undefined); } catch { u = null; }
  if (!u) return { origin: '', host: '', party: 'unknown', kind: 'unreadable', say: 'an address this page could not read' };
  if (u.protocol === 'data:' || u.protocol === 'blob:') return { origin: u.protocol, host: '', party: 'local', kind: 'in-memory', say: 'made inside this tab, never sent' };
  if (str(pageOrigin) && u.origin === pageOrigin) return { origin: u.origin, host: u.host, party: 'first', kind: 'this-site', say: 'this site\'s own files' };
  for (const h of HOSTS) if (h.test.test(u.hostname)) return { origin: u.origin, host: u.host, party: 'third', kind: h.kind, say: h.say };
  return { origin: u.origin, host: u.host, party: 'third', kind: 'unknown', say: 'a host this page does not expect' };
}

/** createLedger(pageOrigin) → the ledger. Entries are kept in the order they arrive.
 *  add({ url, bytesDown, body, method, source, at }) · mark(label, at) · between(a, b) · summary() · entries() */
export function createLedger(pageOrigin) {
  const origin = str(pageOrigin);
  const list = [], marks = new Map();
  const api = {
    /** add(e) → the stored entry, or null when it has no readable address */
    add(e) {
      if (!isObj(e) || !str(e.url)) return null;
      const c = classify(e.url, origin);
      if (c.kind === 'unreadable') return null;
      const down = Number.isFinite(e.bytesDown) ? Math.max(0, Math.floor(e.bytesDown)) : 0;
      const method = str(e.method).toUpperCase() || 'GET';
      const row = { n: list.length + 1, url: str(e.url), host: c.host, party: c.party, kind: c.kind, say: c.say, bytesDown: down,
        body: e.body === true, method, source: str(e.source) || 'page', at: Number.isFinite(e.at) ? e.at : 0 };
      list.push(row);
      return row;
    },
    /** mark(label, at) → remembers how many entries existed at this moment */
    mark(label, at) { marks.set(str(label), { n: list.length, at: Number.isFinite(at) ? at : 0 }); return list.length; },
    /** between(a, b) → { requests, withBody, thirdParty, unknown, rows } for entries after mark a and up to mark b (b omitted: until now) */
    between(a, b) {
      const from = marks.has(str(a)) ? marks.get(str(a)).n : null;
      if (from === null) return null;
      const to = b === undefined ? list.length : marks.has(str(b)) ? marks.get(str(b)).n : null;
      if (to === null || to < from) return null;
      const rows = list.slice(from, to).filter((r) => r.party !== 'local');
      return { requests: rows.length, withBody: rows.filter((r) => r.body).length, thirdParty: rows.filter((r) => r.party === 'third').length, unknown: rows.filter((r) => r.kind === 'unknown').length, rows };
    },
    /** summary() → { total, withBody, unknown, bytesDown, hosts: [{ host, party, kind, say, requests, bytesDown }] } (in-memory rows left out) */
    summary() {
      const rows = list.filter((r) => r.party !== 'local');
      const by = new Map();
      for (const r of rows) {
        const k = r.host;
        if (!by.has(k)) by.set(k, { host: r.host, party: r.party, kind: r.kind, say: r.say, requests: 0, bytesDown: 0 });
        const h = by.get(k); h.requests++; h.bytesDown += r.bytesDown;
      }
      const hosts = [...by.values()].sort((x, y) => (x.party === y.party ? y.requests - x.requests : x.party === 'first' ? -1 : 1));
      return { total: rows.length, withBody: rows.filter((r) => r.body).length, unknown: rows.filter((r) => r.kind === 'unknown').length,
        bytesDown: rows.reduce((s, r) => s + r.bytesDown, 0), hosts };
    },
    entries() { return list.slice(); },
  };
  return api;
}

/** verdict(summary) → the one honest line for the panel, from the ledger's own numbers */
export function verdict(s) {
  if (!isObj(s) || !Number.isInteger(s.total)) return 'The ledger has nothing to report yet.';
  if (s.unknown > 0) return 'This page contacted ' + s.unknown + ' address' + (s.unknown === 1 ? '' : 'es') + ' it does not expect. Treat everything below as unproven until that is explained.';
  if (s.withBody > 0) return s.withBody + ' request' + (s.withBody === 1 ? '' : 's') + ' carried data up. This page is built to send none, so that is a fault: tell us.';
  return 'Every request so far was a download. None carried anything up: 0 of ' + s.total + '.';
}

export default { HOSTS, classify, createLedger, verdict };
