// site/worker-watch.mjs — a worker's side of the network ledger. A worker's requests do not show up on the page's
// own timeline, so each worker reports its own: what it downloaded, and (before it goes) anything that would carry
// data up. Call watch() first thing in the worker.
export function watch() {
  const post = (m) => self.postMessage(m);
  try {
    new PerformanceObserver((list) => post({ type: 'net', entries: list.getEntries().map((e) => ({ url: e.name, bytesDown: e.transferSize || e.encodedBodySize || 0 })) }))
      .observe({ type: 'resource', buffered: true });
  } catch { /* no observer in this worker */ }
  const realFetch = self.fetch;
  self.fetch = function (input, init) {
    const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    const body = !!(init && init.body != null) || (typeof Request !== 'undefined' && input instanceof Request && !/^(GET|HEAD)$/.test(input.method));
    if (body || !/^(GET|HEAD)$/.test(method)) post({ type: 'net-sent', url: typeof input === 'string' ? input : input && input.url ? input.url : String(input), method });
    return realFetch.apply(this, arguments);
  };
}
