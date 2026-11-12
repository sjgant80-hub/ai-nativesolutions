// site/breach-worker.mjs — the sealed attack test, run whole on the visitor's machine. This is Liveware's own test T4
// (vendor/liveware/src/wave1.mjs, pinned by hash): 100 genuine notes, 12 attack classes, 10,000 seeded random inputs
// and a 1,000-strong swarm of mutated forgeries. It is deterministic, so the receipt id computed here must equal the
// one Liveware published.
import { watch } from './worker-watch.mjs';
import { t4 } from '../vendor/liveware/src/wave1.mjs';
watch();
self.onmessage = async (ev) => {
  if (!ev.data || ev.data.type !== 't4') return;
  const t0 = performance.now();
  try { const r = await t4(10000); self.postMessage({ type: 't4', id: r.id, verdict: r.record.verdict, detail: r.detail, ms: performance.now() - t0 }); }
  catch (e) { self.postMessage({ type: 't4-error', message: String(e && e.message ? e.message : e).slice(0, 200) }); }
};
