#!/usr/bin/env node
// ai-nativesolutions · scripts/build-site.mjs — generate the front door's numbers and the
// estate portal from the estate index. One kernel rule: no count on either page is typed by a
// hand; the index is the territory and both pages are drawn from it. The build REFUSES to run
// on a thin or missing index — a front door with invented numbers is the SaaS lie in a suit.
//
//   node scripts/build-site.mjs [path-to-estate-index.json]

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const INDEX = process.argv[2] || 'C:/Users/sjgan/.claude/projects/C--Users-sjgan--claude/memory/estate-index.json';
const idx = JSON.parse(readFileSync(INDEX, 'utf8'));
if (!Array.isArray(idx.nodes) || idx.nodes.length < 100) {
  console.error('REFUSED: the estate index looks thin (' + (idx.nodes?.length ?? 'no') + ' nodes) — regenerate it first.');
  process.exit(1);
}

const pub = idx.nodes.filter(n => !n.private && !n.archived && !n.fork);
// the human shelf: companion -api/-mcp/-sdk surfaces are programmatic mirrors, and the audit
// found their Pages widely disabled while the index flag lags — a front door must not 404
const companion = (n) => /-(api|mcp|sdk)$/.test(n.name);
// every candidate page was HEAD-verified; the ones that did not answer live in deadlist.json —
// a front door lists only doors that open
let deadlist = { dead: [] };
try { deadlist = JSON.parse(readFileSync(join(here, '..', 'deadlist.json'), 'utf8')); } catch {}
const deadSet = new Set(deadlist.dead || []);
const live = pub.filter(n => n.live && !companion(n) && !deadSet.has(n.name));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// the portal lists builds whose descriptions name dreaming → it carries Gary W. Floyd's full credit, from the facts file
const GARY_DREAM = JSON.parse(readFileSync(join(here, '..', 'media', 'film', 'facts.json'), 'utf8')).credits.garyDream;
if (!/Lumiea Systems Research Division/.test(GARY_DREAM || '')) { console.error('REFUSED: facts.json credits.garyDream is missing or not in full form'); process.exit(1); }

// (The front door itself is drawn by scripts/build-front.mjs from site/page.html since 2026-11-12; this script keeps the
// estate portal below.)


// ── the portal: flagships curated (real links only), the whole live estate searchable ──
const FLAGSHIPS = [
  { name: 'fallcorp', line: 'A firm of 100 people, planned around AI from the start. It shows, seat by seat, which jobs still need a person.' },
  { name: 'fallcorp-demo', line: 'That firm at work. A made-up working day at Northgate Claims, running live in your browser.' },
  { name: 'fallforce', line: 'FallForce: all the software a firm needs, and the firm owns it. A tool for customer records, a catalogue, and a shelf of tools for regulated work.' },
  { name: 'fallworld', line: 'Fall World: all we built, as a place you can walk round. Set up a helper, fit it with tools, and climb the ladder.' },
  { name: 'fallkard-forge', line: 'The Forge: software that travels as a picture. One picture file openly carries a build you can run.' },
  { name: 'sididy-catalogue', line: 'The si-didy catalogue: tools put together by the system\u2019s own operator, with no one steering. Each one is let out through a signed door.' },
  { name: 'falljustice', line: 'falljustice: letters about a shopper\u2019s legal rights, and the date a firm must answer a data request by. Worked out, not guessed.' },
  { name: 'generative-estate', line: 'The generative estate: a field of things that could be built. Ask for one, and it turns into checked code.' },
];
const byName = Object.fromEntries(idx.nodes.map(n => [n.name, n]));
for (const f of FLAGSHIPS) {
  const n = byName[f.name];
  if (!n || !n.live) { console.error('REFUSED: flagship "' + f.name + '" is not a live public page — the portal does not decorate'); process.exit(1); }
}

const data = live.map(n => ({ n: n.name, d: (n.desc || '').slice(0, 140) }));
const portal = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>All we built · AI Native Solutions</title>
<meta name="description" content="All we built, live: ${live.length} running builds. A program made the list. No one typed the numbers.">
<style>
:root{--bg:#0b0a0f;--card:#141218;--ink:#d8d2c4;--gold:#d4a017;--line:#2b251f;--soft:#8a8272}
*{box-sizing:border-box}
body{font-family:Georgia,serif;background:var(--bg);color:var(--ink);max-width:1080px;margin:0 auto;padding:26px 18px;line-height:1.5}
h1{font-size:1.8rem;color:var(--gold);margin:0 0 4px;letter-spacing:-.01em}
.sub{color:var(--soft);margin-bottom:20px}
a{color:var(--gold)}
.flag{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;margin:18px 0 26px}
.fcard{background:linear-gradient(180deg,#17131f,var(--card));border:1px solid var(--line);border-radius:11px;padding:15px 17px;transition:border-color .15s}
.fcard:hover{border-color:var(--gold)}
.fcard a{font-size:1.02em;text-decoration:none}
.fcard p{margin:5px 0 0;font-size:.88em;color:var(--soft)}
.search{position:sticky;top:0;background:var(--bg);padding:10px 0;z-index:2}
.search input{width:100%;font:inherit;font-size:1em;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:9px;padding:11px 15px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:9px;margin-top:14px}
.cell{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:9px 12px;font-size:.86em}
.cell a{text-decoration:none;font-weight:bold}
.cell div{color:var(--soft);font-size:.92em;margin-top:2px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.count{color:var(--soft);font-size:.88em;margin:8px 0}
footer{margin-top:30px;padding-top:14px;border-top:1px solid var(--line);font-size:.8em;color:var(--soft)}
</style></head><body>
<p><a href="index.html" style="text-decoration:none">← AI Native Solutions</a></p>
<h1>All we built</h1>
<p class="sub">We have ${pub.length.toLocaleString('en-GB')} public projects. ${live.length.toLocaleString('en-GB')} of them are main builds with a live page.
A program made this list on ${esc(String(idx.generated || '').slice(0, 10))}. No one typed the numbers.
We tried each link on ${esc(String(idx.verified || deadlist.verified || 'the last verification'))}, and each one opened. Helper builds, which let other programs use a main build, are not listed here.</p>

<h2 style="color:var(--gold);font-size:1.05rem">Start here</h2>
<div class="flag">
${FLAGSHIPS.map(f => `<div class="fcard"><a href="https://sjgant80-hub.github.io/${esc(f.name)}/">${esc(f.name)} →</a><p>${esc(f.line)}</p></div>`).join('\n')}
</div>

<h2 style="color:var(--gold);font-size:1.05rem">Every live build</h2>
<div class="search"><input id="q" placeholder="search ${live.length.toLocaleString('en-GB')} live builds…" aria-label="search the estate"></div>
<div class="count" id="count"></div>
<div class="grid" id="grid"></div>

<footer>A program made this page from our list of projects. No number was typed by hand. Every build is open code under the MIT licence.
You can read it, copy it and keep it. · <a href="index.html">AI Native Solutions</a> · Powered by the <a href="konomi.html">Konomi architecture</a>, created by Thomas Frumkin
<p>The estate's dream-state memory builds draw on dream-state design Gary W. Floyd shared with the estate: ${esc(GARY_DREAM)}.</p></footer>

<script>
const DATA = ${JSON.stringify(data)};
const grid = document.getElementById('grid'), count = document.getElementById('count'), q = document.getElementById('q');
const esc2 = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function draw(filter) {
  const f = (filter || '').toLowerCase();
  const hits = f ? DATA.filter(x => (x.n + ' ' + x.d).toLowerCase().includes(f)) : DATA;
  count.textContent = hits.length.toLocaleString('en-GB') + ' live build' + (hits.length === 1 ? '' : 's') + (f ? ' matching “' + filter + '”' : '');
  grid.innerHTML = hits.slice(0, 400).map(x =>
    '<div class="cell"><a href="https://sjgant80-hub.github.io/' + esc2(x.n) + '/">' + esc2(x.n) + '</a><div>' + esc2(x.d) + '</div></div>').join('');
  if (hits.length > 400) grid.innerHTML += '<div class="cell"><div>…and ' + (hits.length - 400).toLocaleString('en-GB') + ' more — narrow the search</div></div>';
}
q.addEventListener('input', () => draw(q.value));
draw('');
</script>
</body></html>`;
writeFileSync(join(here, '..', 'estate.html'), portal);
console.log(`estate.html generated (${pub.length} public · ${live.length} live) (${(portal.length / 1024).toFixed(0)}KB, ${data.length} builds)`);
