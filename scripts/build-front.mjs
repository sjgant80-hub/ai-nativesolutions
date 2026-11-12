#!/usr/bin/env node
// ai-nativesolutions · scripts/build-front.mjs — the living front door, generated.
// One rule: no figure on the front door is typed by a hand. This script draws index.html from site/page.html and
//   · site/data/stats.json and organs.json   (each figure copied from a named record)
//   · media/film/facts.json                   (the facts file the film, brochure and surface gate already share)
//   · the vendored sealed records             (LIGHT's per-type table, the SLM claims, the law table)
//   · site/data/estate.json                   (the public estate, refreshed from the estate index with --estate)
// and writes site/data/bundle.mjs, the one data module the page's code imports.
//
//   node scripts/build-front.mjs                       build index.html + site/data/bundle.mjs
//   node scripts/build-front.mjs --check               fail if either differs from what the sources give (CI)
//   node scripts/build-front.mjs --estate <index.json> first refresh site/data/estate.json from the estate index
//   node scripts/build-front.mjs --out living.html     write the page under another name (staging)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import E from '../site/kernel/estate.mjs';
import R from '../site/kernel/race.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => { const i = process.argv.indexOf(k); return i === -1 ? null : process.argv[i + 1] || ''; };
const CHECK = process.argv.includes('--check');
const OUT = arg('--out') || 'index.html';
const read = (p) => readFileSync(join(root, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const refuse = (m) => { console.error('REFUSED: ' + m); process.exit(1); };
const num = (n) => n.toLocaleString('en-GB');

// the same price pattern the surface gate enforces: a description that carries one is dropped, never shown
const PRICE = /[£€]\s?\d[\d,.]*\s*[kKmM]?|\$\d{2,}[\d,.]*|\$\s?\d[\d,.]*\s*(?:\/|per\b|k\b|m\b)|\/mo\b|\/month\b/;
// internal shorthand never rides on a public page
const SHORTHAND = /\s*·?\s*◊\s*·\s*κ\s*=\s*\S+|\s*·\s*prime \d{1,4}\b|\bprime \d{1,4}\s*·\s*|\bprime \d{1,4}\b|[κφ]|◊\s*/g;

const url = (name, live) => (live ? 'https://sjgant80-hub.github.io/' + name + '/' : 'https://github.com/sjgant80-hub/' + name);

// ── 1 · the estate, from the index (only when asked: CI has no index, it checks the committed copy) ──────────────
const estatePath = join(root, 'site', 'data', 'estate.json');
if (arg('--estate') !== null) {
  const idx = JSON.parse(readFileSync(arg('--estate') || 'C:/Users/sjgan/.claude/projects/C--Users-sjgan--claude/memory/estate-index.json', 'utf8'));
  if (!Array.isArray(idx.nodes) || idx.nodes.length < 100) refuse('the estate index looks thin (' + (idx.nodes?.length ?? 'no') + ' nodes)');
  const pub = idx.nodes.filter((n) => n && n.private === false && !n.archived && !n.fork && typeof n.name === 'string' && n.name && !n.name.startsWith('_'));
  if (pub.some((n) => n.private !== false)) refuse('a private build reached the public list');
  const clean = (d) => { const t = String(d || '').replace(SHORTHAND, '').replace(/\s+/g, ' ').trim(); return PRICE.test(t) ? '' : t.slice(0, 140); };
  // The index's `live` is GitHub's CLAIM that a repository serves a page. A front door links only to doors that open,
  // so each claimed page is asked, now, whether it answers. Only a 200 counts; the rest are written to deadlist.json.
  const claimed = pub.filter((n) => n.live), answered = new Set(), failed = [];
  const ask = async (n) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try { const r = await fetch(url(n.name, 1), { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(20000) }); if (r.status === 200) { answered.add(n.name); return; } if (r.status === 404) break; }
      catch { /* try once more */ }
    }
    failed.push(n.name);
  };
  for (let i = 0; i < claimed.length; i += 24) await Promise.all(claimed.slice(i, i + 24).map(ask));
  // most API / MCP / SDK companion repositories claim a page and serve none (measured 2026-11-12: 13 of 14 sampled gave 404),
  // so the sanity check is on the ordinary builds: if fewer than four in five of THOSE answer, the network is the likely cause
  const core = claimed.filter((n) => !/-(api|mcp|sdk)$/.test(n.name)), coreUp = core.filter((n) => answered.has(n.name)).length;
  if (coreUp < core.length * 0.8) refuse('only ' + coreUp + ' of ' + core.length + ' ordinary builds answered: the network, not the estate, is the likely cause. Nothing written.');
  const today = new Date().toISOString().slice(0, 10);
  writeFileSync(join(root, 'deadlist.json'), JSON.stringify({ verified: today, checked: claimed.length, dead: failed.sort(), how: 'scripts/build-front.mjs --estate: every public, non-archived, non-fork repository that GitHub says serves a page was sent a HEAD request; these did not answer 200' }, null, 1) + '\n');
  const nodes = pub.map((n) => [n.name, clean(n.desc), answered.has(n.name) ? 1 : 0]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const estate = { _rule: 'The public estate, from the estate index. Private, archived and forked repositories never enter this file. [name, description, its live page answered when checked].',
    generated: String(idx.generated || '').slice(0, 10), checked: today, repos: idx.total, publicRepos: idx.public, nodes };
  writeFileSync(estatePath, JSON.stringify(estate) + '\n');
  console.log('estate.json — ' + nodes.length + ' public builds; ' + claimed.length + ' claim a page, ' + answered.size + ' answered, ' + failed.length + ' did not (deadlist.json)');
}
if (!existsSync(estatePath)) refuse('site/data/estate.json is missing: run with --estate <index.json> once');
const estateRaw = json('site/data/estate.json');
if (!Array.isArray(estateRaw.nodes) || estateRaw.nodes.length < 100) refuse('site/data/estate.json looks thin');

// ── 2 · the sources ─────────────────────────────────────────────────────────────────────────────────────────────
const F = json('media/film/facts.json'), STATS = json('site/data/stats.json'), ORG = json('site/data/organs.json');
const MODEL = json('site/data/model.json');
const lightRecord = json('vendor/konomi-tongue/layered/data/record.json');
const slmRecord = json('vendor/slm-suite/data/record.json');
const law = json('vendor/slm-suite/verticals/legal/law.json');
const wave1 = json('vendor/liveware/receipts/wave1.json');
const pins = json('vendor/SOURCES.json');
const witness = existsSync(join(root, 'site', 'data', 'witness.json')) ? json('site/data/witness.json') : { kernels: [] };

const estate = { nodes: estateRaw.nodes.map(([name, desc, live]) => ({ name, desc, url: live ? url(name, 1) : '' })) };
const names = new Set(estate.nodes.map((n) => n.name));
for (const o of ORG.organs) if (!names.has(o.id)) refuse('organ "' + o.id + '" is not a public build in site/data/estate.json');
const shape = E.shape(estate, ORG.organs);
const counted = E.counts(estate);
const companions = estateRaw.nodes.filter((n) => /-(api|mcp|sdk)$/.test(n[0])).length;
const rows = R.table(lightRecord);
if (rows.length < 5) refuse('the LIGHT record gave fewer than five types');

// ── 3 · the generated blocks ────────────────────────────────────────────────────────────────────────────────────
const RR = F.realReceipt, D = F.dispatcher;
const factText = {
  // these exact phrases are the ones scripts/surface-gate.mjs holds to facts.json
  receipt: 'Our minted model scored ' + RR.vsBase.node + '/' + RR.probes + " against its base's " + RR.vsBase.base + '/' + RR.probes + ' on a test it had never seen. Then we put the same test to a bigger model: ours got '
    + RR.vsBigger.node + '/' + RR.probes + ' against a model ~7× its size, which scored ' + RR.vsBigger.other + '/' + RR.probes + '. Ours lost that one, and the receipt says so.',
  dispatcher: 'Of the ' + D.organs + ' organs Kar can call, ' + D.auto + ' run themselves, ' + D.behindKey + ' wait for a human key, and ' + D.todo + ' are marked not built yet (counted ' + F.asOf + ').',
  estate: num(counted.builds) + ' public builds, ' + num(counted.live) + ' with a live page that answered when we checked, from ' + num(estateRaw.repos) + ' repositories in all. About ' + num(Math.round(companions / 10) * 10) + ' of the builds are the API, MCP and SDK companions of other builds. Counted ' + estateRaw.generated + '.',
};
const tile = (t) => {
  const figure = t.facts === 'estate' ? num(counted.builds) : t.figure;
  const plain = t.facts ? factText[t.facts] + (t.plain && t.facts === 'estate' ? ' ' + t.plain : '') : t.plain;
  const also = (t.also || []).map((a) => ' · <a href="' + esc(a.url) + '">' + esc(a.label) + '</a>').join('');
  return '\n      <article class="tile" id="stat-' + esc(t.id) + '">\n'
    + '        <p class="tile-fig"><span class="fig">' + esc(figure) + '</span>' + (t.versus ? '<span class="vs">vs</span><span class="fig low">' + esc(t.versus) + '</span>' : '') + (t.unit ? '<span class="unit">' + esc(t.unit) + '</span>' : '') + '</p>\n'
    + '        <h3>' + esc(t.title) + '</h3>\n'
    + '        <p class="plain">' + esc(plain) + '</p>\n'
    + (t.detail ? '        <p class="detail">' + esc(t.detail) + '</p>\n' : '')
    + (t.failed ? '        <p class="kept"><b>What failed, and is kept:</b> ' + esc(t.failed) + '</p>\n' : '')
    + '        <p class="not"><b>What this does not prove:</b> ' + esc(t.notProve) + '</p>\n'
    + '        <p class="rcpt"><a href="' + esc(t.receipt.url) + '">' + esc(t.receipt.label) + ' →</a>' + also + (t.try ? ' · <a class="try" href="' + esc(t.try) + '">run it on this page ↑</a>' : '') + '</p>\n'
    + '        <p class="src">Source: ' + esc(t.from) + '</p>\n'
    + '      </article>';
};
const lightTable = rows.map((r) => '\n          <tr><th scope="row">' + esc(r.label) + '<span>' + r.items + ' items · ' + esc(R.bytes(r.raw)) + '</span></th>'
  + '<td class="' + (r.cold.lightWins ? 'win' : 'loss') + '">' + r.cold.light.toFixed(2) + '×</td><td>' + r.cold.best.toFixed(2) + '× <span>' + esc(r.cold.who) + '</span></td>'
  + '<td class="call">' + (r.cold.lightWins ? 'LIGHT' : esc(r.cold.who) + ' wins') + '</td>'
  + '<td class="' + (r.seeded.lightWins ? 'win' : 'loss') + '">' + r.seeded.light.toFixed(2) + '×</td><td>' + r.seeded.zstd.toFixed(2) + '×</td>'
  + '<td class="call">' + (r.seeded.lightWins ? 'LIGHT' : 'Zstandard wins') + '</td></tr>').join('');
const coldLosses = rows.filter((r) => !r.cold.lightWins).length;
const slmClaims = slmRecord.verdicts.map((v) => '\n          <tr class="' + (v.pass ? 'held' : 'failed') + '"><th scope="row">' + esc(v.id) + '</th><td>' + esc(v.what) + '</td><td>'
  + esc(Array.isArray(v.measured) ? v.measured.map((m) => (typeof m === 'number' && m > 1000 ? Math.round(m / 1048576) + ' MB' : m)).join(' · ') : v.measured) + '</td><td>' + esc(v.bar) + '</td><td class="call">' + (v.pass ? 'held' : 'FAILED, kept') + '</td></tr>').join('');
const lawTable = law.provisions.map((p) => '\n          <li id="law-' + esc(p.id) + '"><a href="' + esc(p.url) + '">' + esc(p.cite) + '</a><span>' + esc(p.says) + '</span></li>').join('');
const liveOf = new Map(estateRaw.nodes.map((n) => [n[0], n[2]]));
const organIndex = ORG.organs.map((o) => '\n        <li><a href="' + esc(o.from && /^https:\/\/sjgant80-hub\.github\.io\//.test(o.from) ? o.from : url(o.id, liveOf.get(o.id))) + '">' + esc(o.name) + '</a> — ' + esc(o.gloss) + '</li>').join('');
const dreamCredit = '\n  <p class="credit">The dreaming layer draws on dream-state design Gary W. Floyd shared with the estate: ' + esc(F.credits.garyDream).replace(/&quot;/g, '"') + '.</p>\n';
const pinRows = pins.sources.map((s) => '\n          <tr><th scope="row">' + esc(s.id) + '</th><td>' + esc(s.what) + '</td><td>' + (s.commit ? '<a href="https://github.com/' + esc(s.repo) + '/tree/' + esc(s.commit) + '">' + esc(s.commit.slice(0, 7)) + '</a>' : esc(s.version)) + '</td><td>' + Object.keys(s.files).length + '</td><td>' + esc(s.licence) + '</td></tr>').join('');
const pinCount = pins.sources.reduce((n, s) => n + Object.keys(s.files).length, 0);
const gateRows = (witness.kernels || []).map((k) => '\n          <tr><th scope="row">' + esc(k.file) + '</th><td>' + esc(k.what) + '</td><td>' + k.killed + ' of ' + k.total + '</td><td>' + (k.survivors && k.survivors.length ? esc(k.survivors.join('; ')) : 'none') + '</td></tr>').join('');
const gateTotal = (witness.kernels || []).reduce((a, k) => [a[0] + k.killed, a[1] + k.total], [0, 0]);

const BLOCKS = {
  STATS: STATS.tiles.map(tile).join('') + '\n    ',
  'N-BUILDS': num(counted.builds), 'N-LIVE': num(counted.live), 'N-REPOS': num(estateRaw.repos), GENERATED: estateRaw.generated,
  'N-ORGANS': String(shape.organCount), 'N-LINKS': String(shape.links.length),
  'LIGHT-TABLE': lightTable + '\n        ', 'LIGHT-LOSSES': String(coldLosses), 'LIGHT-TYPES': String(rows.length),
  'SLM-CLAIMS': slmClaims + '\n        ', 'LAW-TABLE': lawTable + '\n        ', 'LAW-N': String(law.provisions.length), 'LAW-VERIFIED': esc(law.verified),
  'ORGAN-INDEX': organIndex + '\n      ', 'CREDIT-DREAM': dreamCredit,
  'MODEL-MB': String(Math.round(MODEL.bytes / 1048576)), 'MODEL-ID': esc(MODEL.id), 'MODEL-MEASURED': esc(MODEL.measured),
  'T4-ID': esc(wave1.T4.id.slice(0, 8)), 'PIN-ROWS': pinRows + '\n        ', 'PIN-COUNT': String(pinCount),
  'GATE-ROWS': gateRows + '\n        ', 'GATE-KILLED': String(gateTotal[0]), 'GATE-TOTAL': String(gateTotal[1]),
  'KONOMI-CREDIT': esc(F.credits.konomi),
};
let page = read('site/page.html');
for (const [key, value] of Object.entries(BLOCKS)) {
  const open = '<!--' + key + '-->', close = '<!--/' + key + '-->';
  let from = 0, hits = 0;
  for (;;) {
    const a = page.indexOf(open, from); if (a === -1) break;
    const b = page.indexOf(close, a); if (b === -1) refuse('marker ' + key + ' is opened but not closed in site/page.html');
    page = page.slice(0, a + open.length) + value + page.slice(b); from = a + open.length + value.length + close.length; hits++;
  }
  if (!hits) refuse('marker ' + key + ' is missing from site/page.html');
}
const stray = page.match(/<!--([A-Z0-9-]+)--><!--\/\1-->/);
if (stray) refuse('marker ' + stray[1] + ' was left empty');

// ── 4 · the data module the page's code imports ─────────────────────────────────────────────────────────────────
const bundle = '// site/data/bundle.mjs — GENERATED by scripts/build-front.mjs from the sources it names. Do not edit by hand.\n'
  + 'export const ESTATE = ' + JSON.stringify({ generated: estateRaw.generated, repos: estateRaw.repos, nodes: estateRaw.nodes }) + ';\n'
  + 'export const ORGANS = ' + JSON.stringify(ORG.organs) + ';\n'
  + 'export const MODEL = ' + JSON.stringify(MODEL) + ';\n'
  + 'export const T4_PUBLISHED = ' + JSON.stringify({ id: wave1.T4.id, sealedAt: wave1.sealedAt }) + ';\n'
  + 'export default { ESTATE, ORGANS, MODEL, T4_PUBLISHED };\n';

const targets = [[OUT, page], ['site/data/bundle.mjs', bundle]];
if (CHECK) {
  let bad = 0;
  for (const [f, want] of targets) if (!existsSync(join(root, f)) || read(f) !== want) { bad++; console.error('✗ ' + f + ' is stale: run node scripts/build-front.mjs and commit'); }
  if (bad) process.exit(1);
  console.log('FRONT DOOR CHECK CLEAN — ' + OUT + ' and site/data/bundle.mjs are exactly what their sources give');
} else {
  for (const [f, want] of targets) writeFileSync(join(root, f), want);
  console.log(OUT + ' built — ' + STATS.tiles.length + ' figures, ' + shape.organCount + ' organs, ' + num(counted.builds) + ' builds, ' + rows.length + ' LIGHT types (' + coldLosses + ' cold losses shown), ' + pinCount + ' pinned files');
}
