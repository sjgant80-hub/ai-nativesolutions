// site/llm-worker.mjs — the small model, off the main thread. The open-source WebLLM library and the model's weights
// are downloaded only when the visitor asks (the page shows the size first). After that the model runs on this
// machine's own graphics card: reading a complaint makes no network request, and the ledger shows it.
import { watch } from './worker-watch.mjs';
watch();

let engine = null;
self.onmessage = async (ev) => {
  const m = ev.data || {};
  try {
    if (m.type === 'load') {
      const webllm = await import(m.library);
      engine = await webllm.CreateMLCEngine(m.model, { initProgressCallback: (p) => self.postMessage({ type: 'progress', text: String(p.text || ''), progress: Number(p.progress) || 0 }) });
      self.postMessage({ type: 'ready' });
    } else if (m.type === 'read') {
      if (!engine) throw new Error('the model is not loaded');
      const t0 = performance.now();
      const stream = await engine.chat.completions.create({ messages: [{ role: 'user', content: m.prompt }], temperature: 0, max_tokens: 260, stream: true,
        response_format: { type: 'grammar', grammar: m.grammar } });
      let text = '', chunks = 0;
      for await (const part of stream) {
        const d = (part.choices && part.choices[0] && part.choices[0].delta && part.choices[0].delta.content) || '';
        if (d) { text += d; chunks++; self.postMessage({ type: 'token', id: m.id, delta: d }); }
      }
      self.postMessage({ type: 'done', id: m.id, text, chunks, ms: performance.now() - t0 });
    } else if (m.type === 'stop' && engine) engine.interruptGenerate();
  } catch (e) { self.postMessage({ type: 'error', id: m.id, message: String(e && e.message ? e.message : e).slice(0, 300) }); }
};
