// site/app.mjs — the front door's entry point. It starts the network ledger first (so every later request is on
// it), then the organism, then each live section on its own, so one section failing in an odd browser never takes
// the others down. Nothing here decides anything a visitor relies on: that lives in site/kernel/*.mjs (gated) and
// in the vendored kernels (gated in their own repos, pinned here by hash).
import { startLedger } from './net.mjs';

const $ = (id) => document.getElementById(id);
const net = startLedger();

// what this browser can run, said plainly, before anything is asked of it
const caps = { gpu: false, gpuName: '', sign: false, gzip: typeof CompressionStream === 'function' };
try { const a = navigator.gpu ? await navigator.gpu.requestAdapter() : null; caps.gpu = !!a; caps.gpuName = a && a.info ? [a.info.vendor, a.info.architecture].filter(Boolean).join(' ') : ''; } catch { caps.gpu = false; }
try { await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']); caps.sign = true; } catch { caps.sign = false; }
const yes = (t) => '<b>✓ ' + t + '</b>', no = (t) => '<s>✗ ' + t + '</s>';
$('caps').innerHTML = 'Your browser can run: '
  + (caps.gpu ? yes('the organism on your graphics card') : no('WebGPU, so the organism is drawn the plain way')) + ' · '
  + (caps.gpu ? yes('the small model') : no('the small model (you can still be the reader)')) + ' · '
  + (caps.sign ? yes('real signatures') : no('Ed25519 signatures, so the door demo is off')) + ' · ' + yes('the race');

let stage = null;
try { stage = await (await import('./stage.mjs')).startStage(); }
catch (e) { console.warn('the organism could not start:', e); }
const signal = {
  flare: (id, tone) => { if (stage) stage.flare(id, tone); },
  pulse: (a, b, tone, s) => { if (stage) stage.pulse(a, b, tone, s); },
  ease: (n) => { if (stage) stage.ease(n); },
};

const start = async (file, fn, hostId) => {
  try { const m = await import(file); await m[fn]({ net, signal, caps }); }
  catch (e) {
    console.warn(fn + ' could not start:', e);
    const host = $(hostId);
    if (host) host.insertAdjacentHTML('afterbegin', '<p class="state bad">This demo could not start in this browser (' + String(e && e.message ? e.message : e).replace(/[<>&]/g, '').slice(0, 140) + '). The figures and links on this page do not depend on it.</p>');
  }
};
await Promise.all([start('./door-demo.mjs', 'startDoor', 'slm'), start('./race-demo.mjs', 'startRace', 'racer'), start('./breach-demo.mjs', 'startBreach', 'breacher')]);
window.__site = { stage, net, caps };
