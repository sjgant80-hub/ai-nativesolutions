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

// ── the numbers, injected into the landing between markers ──
const landingPath = join(here, '..', 'index.html');
let landing = readFileSync(landingPath, 'utf8');
const stamp = (key, value) => {
  const OPEN = '<!--' + key + '-->', CLOSE = '<!--/' + key + '-->';
  const a = landing.indexOf(OPEN), b = landing.indexOf(CLOSE);
  if (a < 0 || b < 0) { console.error('REFUSED: marker ' + key + ' missing from index.html'); process.exit(1); }
  landing = landing.slice(0, a + OPEN.length) + value + landing.slice(b);
};
stamp('N-PUBLIC', pub.length.toLocaleString('en-GB'));
stamp('N-LIVE', live.length.toLocaleString('en-GB'));
stamp('GENERATED', String(idx.generated || '').slice(0, 10));
writeFileSync(landingPath, landing);

// ── the portal: flagships curated (real links only), the whole live estate searchable ──
const FLAGSHIPS = [
  { name: 'fallcorp', line: 'The konomified company — a 100-person firm designed AI-first, seat by seat, with the human doors named' },
  { name: 'fallcorp-demo', line: 'Northgate Claims — that company RUNNING: a fictional working day, live in your browser' },
  { name: 'fallforce', line: 'FallForce — the whole owned stack: CRM flagship, the catalogue, the regulated shelf' },
  { name: 'fallworld', line: 'Fall World — the estate as a place: install a didy, fit tools, play the ladder' },
  { name: 'fallkard-forge', line: 'The Forge — software that travels as pictures: a PNG that openly carries a runnable build' },
  { name: 'sididy-catalogue', line: 'The si-didy catalogue — tools composed autonomously by the estate\u2019s operator, released through signed doors' },
  { name: 'falljustice', line: 'falljustice — consumer legal letters and data-request deadlines, computed not guessed' },
  { name: 'generative-estate', line: 'The generative estate — a field of possibilities that collapses to verified code on demand' },
];
const byName = Object.fromEntries(idx.nodes.map(n => [n.name, n]));
for (const f of FLAGSHIPS) {
  const n = byName[f.name];
  if (!n || !n.live) { console.error('REFUSED: flagship "' + f.name + '" is not a live public page — the portal does not decorate'); process.exit(1); }
}

const data = live.map(n => ({ n: n.name, d: (n.desc || '').slice(0, 140) }));
const portal = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Enter the estate · AI Native Solutions</title>
<meta name="description" content="The whole estate, live: ${live.length} running builds, drawn from the index — never typed.">
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
<h1>The estate</h1>
<p class="sub">${live.length.toLocaleString('en-GB')} live builds of ${pub.length.toLocaleString('en-GB')} public repositories —
this page is generated from the estate index of ${esc(String(idx.generated || '').slice(0, 10))}, never typed.
Every link below answered a live check on ${esc(String(idx.verified || deadlist.verified || 'the last verification'))}. Programmatic companion surfaces (API/MCP/SDK mirrors) are not listed here.</p>

<h2 style="color:var(--gold);font-size:1.05rem">Start here</h2>
<div class="flag">
${FLAGSHIPS.map(f => `<div class="fcard"><a href="https://sjgant80-hub.github.io/${esc(f.name)}/">${esc(f.name)} →</a><p>${esc(f.line)}</p></div>`).join('\n')}
</div>

<h2 style="color:var(--gold);font-size:1.05rem">All of it</h2>
<div class="search"><input id="q" placeholder="search ${live.length.toLocaleString('en-GB')} live builds…" aria-label="search the estate"></div>
<div class="count" id="count"></div>
<div class="grid" id="grid"></div>

<footer>Generated from the estate index — no number typed by hand. Every build is MIT-licensed source
you can read, fork, and keep. · <a href="index.html">AI Native Solutions</a> · <a href="konomi.html">Konomi Architecture</a></footer>

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
console.log(`landing stamped (${pub.length} public · ${live.length} live) · estate.html generated (${(portal.length / 1024).toFixed(0)}KB, ${data.length} builds)`);
