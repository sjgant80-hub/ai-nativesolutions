// site/net.mjs — the network ledger, wired to the browser. The ledger's logic is site/kernel/netwatch.mjs (gated);
// this file only feeds it what the browser reports and draws the chip and the panel.
//   · every resource the page loads (PerformanceObserver), and the page itself
//   · every way a page can SEND: fetch with a body, XMLHttpRequest.send with a body, sendBeacon, WebSocket.
//     Each is noted as "carried data up" before it goes. This page makes none; the ledger is how you can tell.
//   · the page's workers report their own requests the same way (see wireWorker)
import N from './kernel/netwatch.mjs';
import R from './kernel/race.mjs';

export function startLedger() {
  const ledger = N.createLedger(location.origin);
  const sentUp = new Set();
  let timer = 0;
  const chip = document.getElementById('net-chip'), chipText = document.getElementById('net-chip-text');
  const dialog = document.getElementById('ledger');
  const draw = () => {
    timer = 0;
    const s = ledger.summary();
    chipText.textContent = 'network: ' + s.total + ' down · ' + s.withBody + ' sent up';
    chip.classList.toggle('bad', s.withBody > 0 || s.unknown > 0);
    if (!dialog.open) return;
    document.getElementById('ledger-verdict').textContent = N.verdict(s);
    const body = document.querySelector('#ledger-table tbody');
    body.replaceChildren(...s.hosts.map((h) => {
      const tr = document.createElement('tr');
      const up = ledger.entries().filter((e) => e.host === h.host && e.body).length;
      for (const [text, head] of [[h.host || '(this page)', true], [h.say], [String(h.requests)], [h.bytesDown ? R.bytes(h.bytesDown) : h.party === 'first' ? 'from cache' : 'size not reported by that host'], [up === 0 ? '0' : up + ' request' + (up === 1 ? '' : 's')]]) {
        const c = document.createElement(head ? 'th' : 'td'); if (head) c.scope = 'row'; c.textContent = text; tr.append(c);
      }
      return tr;
    }));
    document.getElementById('ledger-rows').replaceChildren(...ledger.entries().filter((e) => e.party !== 'local').map((e) => {
      const li = document.createElement('li');
      li.textContent = '#' + e.n + ' ' + (e.body ? 'SENT UP ' : 'down ') + e.method + ' ' + e.url.replace(location.origin, '') + (e.source === 'page' ? '' : '  [' + e.source + ']');
      if (e.body) li.style.color = 'var(--red)';
      return li;
    }));
  };
  const schedule = () => { if (!timer) timer = setTimeout(draw, 120); };
  const add = (e) => {
    if (!e.body && sentUp.delete(e.url)) return;          // already counted when it was sent
    ledger.add({ ...e, at: e.at ?? performance.now() }); schedule();
  };
  const noteSent = (url, method, source) => {
    let abs = String(url); try { abs = new URL(String(url), location.href).href; } catch { /* keep as given */ }
    sentUp.add(abs); ledger.add({ url: abs, body: true, method, source: source || 'page', at: performance.now() }); schedule();
  };

  const nav = performance.getEntriesByType('navigation')[0];
  add({ url: location.href, bytesDown: nav ? nav.transferSize || nav.encodedBodySize || 0 : 0, at: 0, source: 'page' });
  try {
    new PerformanceObserver((list) => { for (const en of list.getEntries()) add({ url: en.name, bytesDown: en.transferSize || en.encodedBodySize || 0, at: en.startTime, source: 'page' }); }).observe({ type: 'resource', buffered: true });
  } catch { /* no observer: the chip then only counts what the wrappers below see */ }

  // the ways a page can send data up, each noted before it goes
  const hasBody = (input, init) => !!(init && init.body != null) || (typeof Request !== 'undefined' && input instanceof Request && !/^(GET|HEAD)$/i.test(input.method));
  const urlOf = (input) => (typeof input === 'string' ? input : input && input.url ? input.url : String(input));
  const realFetch = window.fetch;
  window.fetch = function (input, init) {
    const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    if (hasBody(input, init) || !/^(GET|HEAD)$/.test(method)) noteSent(urlOf(input), method);
    return realFetch.apply(this, arguments);
  };
  const open = XMLHttpRequest.prototype.open, send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) { this.__m = String(method).toUpperCase(); this.__u = url; return open.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function (body) { if (body != null || !/^(GET|HEAD)$/.test(this.__m || 'GET')) noteSent(this.__u, this.__m || 'POST'); return send.apply(this, arguments); };
  if (navigator.sendBeacon) { const beacon = navigator.sendBeacon.bind(navigator); navigator.sendBeacon = (url, data) => { noteSent(url, 'BEACON'); return beacon(url, data); }; }
  if (window.WebSocket) window.WebSocket = new Proxy(window.WebSocket, { construct(T, args) { noteSent(args[0], 'WEBSOCKET'); return new T(...args); } });

  chip.addEventListener('click', () => { dialog.showModal(); draw(); });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  schedule();

  return {
    ledger,
    mark: (label) => ledger.mark(label, performance.now()),
    between: (a, b) => ledger.between(a, b),
    /** wireWorker(worker, name): a worker posts { type: 'net', entries } and { type: 'net-sent', url, method } */
    wireWorker(worker, name) {
      worker.addEventListener('message', (ev) => {
        const m = ev.data;
        if (!m || typeof m !== 'object') return;
        if (m.type === 'net') for (const e of m.entries || []) add({ ...e, source: name });
        if (m.type === 'net-sent') noteSent(m.url, m.method, name);
      });
    },
  };
}
