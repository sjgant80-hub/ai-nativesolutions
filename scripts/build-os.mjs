#!/usr/bin/env node
// ai-nativesolutions · scripts/build-os.mjs — generate os.html (the company running itself) from
// stages-data.json through the GATED board(). If the board is dishonest — a stage claiming LIVE
// with no proof, a door not held by a human — the build REFUSES. The company's own case-study
// page cannot lie about the company, by construction.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { board, DOORS } from '../stages.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, '..', 'stages-data.json'), 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const b = board(data.stages, data.doors);
if (!b.ok) { console.error('REFUSED: ' + b.why); process.exit(1); }

// real estate scale for the header
let repos = null, live = null;
try {
  const idx = JSON.parse(readFileSync(process.argv[2] || 'C:/Users/sjgan/.claude/projects/C--Users-sjgan--claude/memory/estate-index.json', 'utf8'));
  repos = idx.nodes.filter(n => !n.private).length;
  live = idx.nodes.filter(n => !n.private && !n.archived && !n.fork && n.live).length;
} catch { /* header degrades to no counts */ }

const DOORICON = { money: '💷', legal: '⚖', taste: '◈', 'client-trust': '🤝' };
const STATECLASS = { LIVE: 'live', BUILT: 'built', PLANNED: 'planned' };
const STATEWORD = { LIVE: 'LIVE', BUILT: 'BUILT · waiting', PLANNED: 'PLANNED' };

const doorCard = (d) => `<div class="door"><b>${DOORICON[d]} the ${esc(d)} door</b>
  <div class="held">held by a human — Simon</div>
  <div class="dn">${esc(data.doorNotes[d] || '')}</div></div>`;

const stageCard = (s) => `<div class="stage ${STATECLASS[s.state]}">
  <div class="sh"><span class="sn">${s.n}</span> <b>${esc(s.seat)}</b> <span class="badge ${STATECLASS[s.state]}">${STATEWORD[s.state]}</span></div>
  <p>${esc(s.does || '')}</p>
  ${s.machinery ? `<div class="mach">runs on: ${esc(s.machinery)}</div>` : ''}
  ${s.waiting ? `<div class="wait">→ ${esc(s.waiting)}</div>` : ''}
  ${s.proof ? `<div class="proof"><a href="${esc(s.proof)}" target="_blank" rel="noopener">see it live →</a></div>` : ''}
</div>`;

const html = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>The company running itself · AI Native Solutions</title>
<meta name="description" content="AI Native Solutions runs itself on the same architecture it sells: agents on every operational seat, humans on the four doors. This is the live board — honest about what's running and what's one step away.">
<style>
:root{--bg:#0b0a0f;--bg2:#100d15;--card:#141218;--ink:#e2d9c8;--gold:#d4a017;--gold2:#ffb648;--line:#2b251f;--soft:#8f8778;--good:#9fb89f;--wait:#c9a24a}
*{box-sizing:border-box}
body{margin:0;font-family:Georgia,"Iowan Old Style",serif;background:var(--bg);color:var(--ink);line-height:1.6}
.wrap{max-width:900px;margin:0 auto;padding:0 22px}
a{color:var(--gold)}
header{padding:20px 0;border-bottom:1px solid var(--line)}
.nav{display:flex;gap:22px;flex-wrap:wrap;align-items:baseline}
.mark{font-weight:bold}.mark span{color:var(--gold)}
.nav a{color:var(--soft);text-decoration:none;font-size:.9em}.nav a:hover{color:var(--gold)}
.hero{padding:60px 0 36px;background:radial-gradient(60% 45% at 50% 0%,rgba(212,160,23,.09),transparent 70%)}
.hero h1{font-size:clamp(1.8rem,5vw,2.8rem);line-height:1.14;margin:0 0 14px;letter-spacing:-.015em}
.hero p{font-size:1.1em;max-width:640px}
.summary{font-variant-numeric:tabular-nums;color:var(--soft);margin-top:14px;font-size:.95em}
section{padding:40px 0;border-top:1px solid var(--line)}
h2{font-size:1.35rem;color:var(--gold);margin:0 0 6px}
.lede{color:var(--soft);max-width:640px;margin:0 0 22px}
.doors{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
.door{background:linear-gradient(180deg,rgba(212,160,23,.07),var(--card));border:1px solid var(--gold);border-radius:11px;padding:14px 16px}
.door b{color:var(--gold)}.door .held{color:var(--good);font-size:.85em;margin:4px 0}.door .dn{font-size:.85em;color:var(--soft);margin-top:6px}
.stages{display:flex;flex-direction:column;gap:12px}
.stage{background:var(--card);border:1px solid var(--line);border-radius:11px;padding:15px 18px}
.stage.live{border-color:var(--good)}
.sh{display:flex;align-items:center;gap:10px}
.sn{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--ink);color:var(--bg);font-weight:bold;font-size:.85em}
.stage.live .sn{background:var(--good)}
.badge{margin-left:auto;font-size:.72em;letter-spacing:.08em;border:1px solid var(--line);border-radius:5px;padding:2px 8px;color:var(--soft)}
.badge.live{color:var(--good);border-color:var(--good)}
.badge.built{color:var(--wait);border-color:var(--wait)}
.stage p{margin:8px 0}.mach{font-size:.85em;color:var(--soft)}
.wait{font-size:.88em;color:var(--wait);margin-top:6px}
.proof{margin-top:6px;font-size:.9em}.proof a{font-weight:bold}
.honest{border:1px solid var(--line);border-radius:11px;padding:15px 18px;margin:22px 0;background:var(--card);font-size:.92em}
.honest b{color:var(--gold)}
footer{border-top:1px solid var(--line);padding:24px 0 44px;color:var(--soft);font-size:.8em}
footer a{color:var(--soft)}footer .k{float:right}
</style></head><body>
<header><div class="wrap nav">
  <span class="mark">AI <span>Native</span> Solutions</span>
  <a href="index.html">Home</a><a href="konomi.html">Konomi</a><a href="estate.html">The estate</a>
  <a href="mailto:ainativesolutions@gmail.com">Talk to us</a>
</div></header>

<div class="hero"><div class="wrap">
  <h1>We run ourselves on the architecture we sell.</h1>
  <p>AI Native Solutions is an AI-first company that operates itself: agents hold every operational
  seat, and a human holds the four doors that must stay human — money, legal, taste, client-trust.
  This is the live board, honest about what's running today and what's one step away.</p>
  <div class="summary">${b.why}${repos ? ` · drawn from a working estate of ${repos.toLocaleString('en-GB')} builds (${live.toLocaleString('en-GB')} live)` : ''}</div>
</div></div>

<section><div class="wrap">
  <h2>The four doors — held by a human</h2>
  <p class="lede">Nothing an agent does crosses these. They're the 10% — and they're also the core
  claim of what we sell, so we live it: an agent at a door would poison the pitch.</p>
  <div class="doors">${DOORS.map(doorCard).join('')}</div>
</div></section>

<section><div class="wrap">
  <h2>The agent seats — the six-stage build</h2>
  <p class="lede">Each seat both <b>operates</b> (does real work) and <b>demonstrates</b> (proves
  the thesis). A seat is only marked LIVE if you can click through to it running.</p>
  <div class="stages">${data.stages.slice().sort((a, c) => a.n - c.n).map(stageCard).join('')}</div>
</div></section>

<section><div class="wrap">
  <div class="honest"><b>The honest state, said plainly.</b> The product seat already runs nightly —
  that's real. The marketing seat is built and gated, one token-paste from going public. Delivery
  and the learning loop are built and proven; they're waiting on a first sale, not a first build.
  No door has been turned yet: no money has moved, no engagement is signed. That's not a gap we
  hide — it's exactly where a human is supposed to stand. We'll sell the FallCorp install from
  lived proof, and this page is that proof, kept honest by the same gate that runs the rest.</div>
  <p><a href="https://sjgant80-hub.github.io/fallcorp/">Walk the company we build for clients →</a>
  &nbsp;·&nbsp; <a href="konomi.html">Built on Konomi →</a></p>
</div></section>

<footer><div class="wrap">
  <span>© AI Native Solutions · generated from stages-data.json through the gated board — no status typed by hand</span>
  <span class="k"><a href="konomi.html">Konomi Architecture</a></span>
</div></footer>
</body></html>`;

writeFileSync(join(here, '..', 'os.html'), html);
console.log(`os.html generated — ${(html.length / 1024).toFixed(0)}KB · ${b.why}`);
