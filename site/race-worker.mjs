// site/race-worker.mjs — the compression race, off the main thread. Four lanes squeeze the SAME bytes. A lane only
// counts if what it wrote decodes back to the exact input (checked here, byte for byte). The bytes never leave this
// worker: there is no upload anywhere in this file, and the ledger watches it like the rest of the page.
//   LIGHT (cold)   vendor/konomi-tongue/layered/src/fold.mjs — the estate's codec, the very file its tests gate
//   Brotli 11      vendor/brotli-wasm (WebAssembly)
//   Zstandard 19   vendor/zstd-wasm   (WebAssembly)
//   gzip           the browser's own CompressionStream
import { watch } from './worker-watch.mjs';
import * as F from '../vendor/konomi-tongue/layered/src/fold.mjs';
import initBrotli, { compress as brotliCompress, decompress as brotliDecompress } from '../vendor/brotli-wasm/pkg.web/brotli_wasm.js';
import { Module as Z } from '../vendor/zstd-wasm/dist/web/zstd.js';
watch();

const same = (a, b) => { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
const through = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

let ready = null;
const prepare = () => ready || (ready = (async () => {
  const [bw, zw] = await Promise.all([fetch(new URL('../vendor/brotli-wasm/pkg.web/brotli_wasm_bg.wasm', import.meta.url)), fetch(new URL('../vendor/zstd-wasm/dist/common/zstd.wasm', import.meta.url))]);
  await initBrotli(await bw.arrayBuffer());
  const started = new Promise((resolve) => { Z.onRuntimeInitialized = resolve; });
  Z.init(new Uint8Array(await zw.arrayBuffer()));
  await started;
})());

const zstd = {
  compress(bytes, level) {
    const bound = Z._ZSTD_compressBound(bytes.length), dst = Z._malloc(bound), src = Z._malloc(bytes.length || 1);
    try { Z.HEAPU8.set(bytes, src); const n = Z._ZSTD_compress(dst, bound, src, bytes.length, level); if (Z._ZSTD_isError(n)) throw new Error('zstd refused the input'); return new Uint8Array(Z.HEAPU8.buffer, dst, n).slice(); }
    finally { Z._free(dst); Z._free(src); }
  },
  decompress(frame, size) {
    const dst = Z._malloc(size || 1), src = Z._malloc(frame.length);
    try { Z.HEAPU8.set(frame, src); const n = Z._ZSTD_decompress(dst, size, src, frame.length); if (Z._ZSTD_isError(n)) throw new Error('zstd could not decode its own output'); return new Uint8Array(Z.HEAPU8.buffer, dst, n).slice(); }
    finally { Z._free(dst); Z._free(src); }
  },
};

const LANES = {
  light: async (b) => { const e = F.encode(b, { mask: F.COLD }); if (!e.ok) throw new Error(e.why); const d = F.decode(e.bytes, {}); return { out: e.bytes, back: d.ok ? d.bytes : new Uint8Array(0) }; },
  brotli: async (b) => { const out = brotliCompress(b, { quality: 11 }); return { out, back: brotliDecompress(out) }; },
  zstd: async (b) => { const out = zstd.compress(b, 19); return { out, back: zstd.decompress(out, b.length) }; },
  gzip: async (b) => { const out = await through(b, new CompressionStream('gzip')); return { out, back: await through(out, new DecompressionStream('gzip')) }; },
};

self.onmessage = async (ev) => {
  const m = ev.data || {};
  if (m.type !== 'race') return;
  const bytes = new Uint8Array(m.bytes);
  try { await prepare(); } catch (e) { self.postMessage({ type: 'race-error', run: m.run, message: 'the baseline codecs could not load: ' + String(e && e.message ? e.message : e) }); return; }
  for (const id of m.order) {
    self.postMessage({ type: 'lane-start', run: m.run, id });
    const t0 = performance.now();
    try {
      const { out, back } = await LANES[id](bytes);
      self.postMessage({ type: 'lane', run: m.run, id, bytes: out.length, ms: performance.now() - t0, identical: same(back, bytes) });
    } catch (e) { self.postMessage({ type: 'lane', run: m.run, id, bytes: 0, ms: performance.now() - t0, identical: false, error: String(e && e.message ? e.message : e).slice(0, 160) }); }
  }
  self.postMessage({ type: 'race-done', run: m.run });
};
