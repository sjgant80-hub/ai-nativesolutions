#!/usr/bin/env node
// ai-nativesolutions · scripts/build-front.mjs — the living front door, generated.
// One rule: no figure on the front door is typed by a hand. This script draws two pages:
//   index.html, the front door, from site/front.html: short, in plain words, on the house kit (vendored, pinned)
//   deep.html, the long version, from site/page.html: every demo and every number
// from
//   · site/data/stats.json and organs.json   (each figure copied from a named record)
//   · media/film/facts.json                   (the facts file the film, brochure and surface gate already share)
//   · the vendored sealed records             (LIGHT's per-type table, the SLM claims, the law table)
//   · site/data/estate.json                   (the public estate, refreshed from the estate index with --estate)
// and writes site/data/bundle.mjs, the one data module the page's code imports.
//
//   node scripts/build-front.mjs                       build index.html + deep.html + site/data/bundle.mjs
//   node scripts/build-front.mjs --check               fail if either differs from what the sources give (CI)
//   node scripts/build-front.mjs --estate <index.json> first refresh site/data/estate.json from the estate index
//   node scripts/build-front.mjs --out living.html     write the front door under another name (staging)
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
  estate: num(counted.builds) + ' public builds, ' + num(counted.live) + ' with a live page that answered when we checked, from ' + num(estateRaw.repos) + ' repositories in all. About ' + num(Math.round(companions / 10) * 10) + ' of the builds are helpers: each lets other programs use a main build. Counted ' + estateRaw.generated + '.',
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
// the sealed headline (claim S2), in words, straight from the record: "69/80" becomes "69 of 80"
const S2 = slmRecord.verdicts.find((v) => v.id === 'S2');
const frac = /^[0-9]+[/][0-9]+$/;
if (!S2 || !Array.isArray(S2.measured) || !frac.test(S2.measured[0]) || !frac.test(S2.measured[1])) refuse('the SLM record has no readable S2');
const inWords = (s) => s.replace('/', ' of ');
const slmHeadline = '<b>Measured, sealed:</b> the full stack was right, or rightly said it could not tell, on ' + inWords(S2.measured[0]) + ' complaints it had never seen. A model 14 times its size, asked to do it alone, managed ' + inWords(S2.measured[1]) + '.';
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
  'SLM-HEADLINE': slmHeadline,
  'SLM-CLAIMS': slmClaims + '\n        ', 'LAW-TABLE': lawTable + '\n        ', 'LAW-N': String(law.provisions.length), 'LAW-VERIFIED': esc(law.verified),
  'ORGAN-INDEX': organIndex + '\n      ', 'CREDIT-DREAM': dreamCredit,
  'MODEL-MB': String(Math.round(MODEL.bytes / 1048576)), 'MODEL-ID': esc(MODEL.id), 'MODEL-MEASURED': esc(MODEL.measured),
  'T4-ID': esc(wave1.T4.id.slice(0, 8)), 'PIN-ROWS': pinRows + '\n        ', 'PIN-COUNT': String(pinCount),
  'GATE-ROWS': gateRows + '\n        ', 'GATE-KILLED': String(gateTotal[0]), 'GATE-TOTAL': String(gateTotal[1]),
  'KONOMI-CREDIT': esc(F.credits.konomi),
};
// fill(template, blocks) → that template with every one of its blocks' markers filled; a missing or unfilled marker stops the build
function fill(file, blocks) {
  let page = read(file);
  for (const [key, value] of Object.entries(blocks)) {
    const open = '<!--' + key + '-->', close = '<!--/' + key + '-->';
    let from = 0, hits = 0;
    for (;;) {
      const a = page.indexOf(open, from); if (a === -1) break;
      const b = page.indexOf(close, a); if (b === -1) refuse('marker ' + key + ' is opened but not closed in ' + file);
      page = page.slice(0, a + open.length) + value + page.slice(b); from = a + open.length + value.length + close.length; hits++;
    }
    if (!hits) refuse('marker ' + key + ' is missing from ' + file);
  }
  const stray = page.match(/<!--([A-Z0-9-]+)--><!--\/\1-->/);
  if (stray) refuse('marker ' + stray[1] + ' was left empty in ' + file);
  return page;
}
const page = fill('site/page.html', BLOCKS);

// ── 3b · the front door: the newest builds' results, each read from the page that proves it (vendored, pinned) ──
const FL = json('vendor/house-standard/data/flagships.json'), DOCDEC = json('vendor/docdecdemo/demo-data.json');
const flag = (repo) => { const b = (FL.builds || []).find((x) => x.repo === repo); if (!b) refuse('the flagship record has no ' + repo); return b; };
const extra = (b, key) => { const x = b.extra.find((e) => e.key === key); if (!x) refuse(b.repo + ' states no "' + key + '" on its page'); return x; };
const V = flag('the-verifier-set'), C = flag('the-crystal'), K = flag('the-climb'), S = flag('the-seed'), L = flag('the-distillation');
// which round of the learning test the score is from, and whether that round's weights were kept: from the record
const ROUND = FL.loop && Number.isInteger(FL.loop.round) && FL.loop.round > 0 ? FL.loop.round : 1;
const KEPT = !(FL.loop && Array.isArray(FL.loop.verdict) && FL.loop.verdict.some((v) => v.pass === false));
const TIMES = ['', 'once', 'twice'][ROUND] || ROUND + ' times';
const testName = ROUND === 1 ? 'Its first real test.' : 'Its real test, round ' + ROUND + '.';
const before = ROUND === 1 ? 'before it studied' : 'before this round of study';
if (!V.headline || !C.headline || !K.headline) refuse('a sealed build states no headline result on its page');
const face = (state, say) => ' data-face="' + state + '" data-say="' + esc(say) + '"';
const stat = (n, lab, href, what, state, say) => '\n      <div class="stat reveal"' + face(state, say) + '><div class="n">' + n + '</div><div class="lab">' + lab + '</div><a class="src" href="' + esc(href) + '">' + esc(what) + ' ↗</a></div>';
const arrow = (was, now, cls) => '<span class="was">' + esc(was) + '</span><span class="arrow">→</span><span class="' + (cls || 'now') + '">' + esc(now) + '</span>';
const small = (x) => '<span class="was" style="font-size:.42em"> /' + esc(x) + '</span>';
const unans = extra(V, 'unanswerable'), forged = extra(C, 'forged'), sealed = extra(S, 'sealed'), dissolved = extra(S, 'dissolved');
const receipts = stat(arrow(unans.value, unans.after), '<b>Made-up answers.</b> We asked ' + unans.of + ' questions that have no answer. Alone, the AI made one up ' + esc(unans.value) + ' times. With the checker: ' + (unans.after === '0' ? 'never' : esc(unans.after) + ' times') + '.', V.live, 'proof: The Verifier Set', 1, 'Made-up answers: ' + unans.value + ' alone, ' + unans.after + ' with the checker')
  + stat(arrow(V.headline.was, V.headline.now), '<b>Right answers, out of ' + V.headline.of + '.</b> Alone it got ' + esc(V.headline.was) + ' right. With the checker it got ' + esc(V.headline.now) + '.', V.live, 'proof: The Verifier Set', 1, 'Right answers: ' + V.headline.was + ' alone, ' + V.headline.now + ' with the checker, of ' + V.headline.of)
  + stat('<span class="' + (forged.value === '0' ? 'now' : 'bad') + '">' + esc(forged.value) + '</span>' + small(num(forged.of)), '<b>Fakes that got through.</b> We threw ' + num(forged.of) + ' fake answers at the checker. ' + (forged.value === '0' ? 'It caught them all.' : esc(forged.value) + ' got through.'), C.live, 'proof: The Crystal', forged.value === '0' ? 1 : 3, 'Fakes that got through: ' + forged.value + ' of ' + num(forged.of));
const SEALING = '<span class="tag gd">sealing now</span>';
const dev = FL.dev && FL.dev.cold ? FL.dev.cold : null;
const loop = (L.headline
  ? stat(arrow(L.headline.was, L.headline.now), '<b>' + testName + '</b> On ' + L.headline.of + ' new problems, it got ' + esc(L.headline.was) + ' right ' + before + ', and ' + esc(L.headline.now) + ' after.' + (KEPT ? '' : ' <span class="bad">It did not get better, so that round was dropped and the learning stopped.</span>'), L.live, 'proof: The Distillation', 1, testName + ' ' + L.headline.was + ' ' + before + ', ' + L.headline.now + ' after')
  : '\n      <div class="stat reveal"' + face(2, 'Its first real test is running now') + '><div class="n"><span class="wait">—</span></div><div class="lab"><b>Its first real test is running now.</b> The score goes here when it is done, pass or fail. ' + SEALING + '</div><a class="src" href="' + esc(L.live) + '">watch it: The Distillation ↗</a></div>')
  + (dev ? stat(arrow(String(dev.base.right), String(dev.distilled.right), 'wait'), '<b>The practice run</b>, on ' + dev.n + ' new problems. It helped us set up the real test. It is not a score we claim. <span class="tag gd">not a claim</span>', L.live, 'the practice run: The Distillation', 2, 'The practice run: ' + dev.base.right + ' right, then ' + dev.distilled.right + ', of ' + dev.n + '. Not a score we claim') : '')
  + stat('<span class="now">0</span>', '<b>Changes to the AI with no person saying yes.</b> A new version waits for a human.', L.live + '#loop', 'proof: the lock on new versions', 1, 'No change to the AI without a person saying yes');
const card = (i, b, verb, line, state, say) => '\n      <a class="act reveal" href="' + esc(b.live) + '"' + face(state, say) + '><span class="num">0' + i + ' — ' + esc(b.name.toUpperCase()) + '</span><h3>' + verb + '</h3><p>' + line + '</p><span class="go">Open the proof →</span></a>';
const goals = (b) => (b.claims.fail ? ' <span class="bad">' + b.claims.fail + ' of its ' + b.claims.n + ' goals failed. ' + (b.claims.fail === 1 ? 'It is' : 'They are') + ' kept, in red.</span>' : '');
const score = (b, unit) => '<b style="color:var(--ink)">' + esc(b.headline.was) + ' → ' + esc(b.headline.now) + '</b> right, ' + unit + ' ' + b.headline.of + ' problems.';
const builds = card(1, K, 'It climbs.', 'It fails a hard sum. So it breaks the sum into small steps, and checks each one. ' + score(K, 'on') + goals(K), K.claims.fail ? 3 : 1, 'The Climb: ' + K.headline.was + ' right at first, ' + K.headline.now + ' after the climb' + (K.claims.fail ? '. ' + K.claims.fail + ' goal failed, and is kept' : ''))
  + card(2, C, 'It grows the answer.', 'It builds the answer from pieces it has proved. A piece it cannot prove melts away. ' + score(C, 'on') + goals(C), C.claims.fail ? 3 : 1, 'The Crystal: ' + C.headline.was + ' right at first, ' + C.headline.now + ' grown piece by piece')
  + card(3, V, 'It will not lie.', 'Each answer is checked against the maths, or the page it came from. If it cannot be checked, you do not get it. ' + score(V, 'of') + goals(V), V.claims.fail ? 3 : 1, 'The Verifier Set: ' + V.headline.was + ' right alone, ' + V.headline.now + ' with the checker')
  + card(4, S, 'It plants itself.', 'A few small files that grow working software, one checked piece at a time. <b style="color:var(--ink)">' + esc(sealed.value) + ' of ' + sealed.of + '</b> pieces passed. ' + esc(dissolved.value) + ' failed and were thrown away.', 1, 'The Seed: ' + sealed.value + ' of ' + sealed.of + ' pieces passed, ' + dissolved.value + ' thrown away')
  + card(5, L, 'It learns until the gains stop.', 'It studies only its own proved work. Then it takes a test it has never seen. ' + (L.headline ? score(L, 'on') + goals(L) : SEALING), L.headline ? 1 : 2, 'The Distillation: ' + (L.headline ? L.headline.was + ' before it studied, ' + L.headline.now + ' after' : 'its first real test is running now'));
const reuse = FL.reuse ? Math.round((100 * FL.reuse.taken) / (FL.reuse.taken + FL.reuse.worked)) : null;
if (reuse === null) refuse('the flagship record has no reuse figure');
const schoolRow = '<div class="srow' + (L.headline ? '' : ' gold') + '"' + face(L.headline ? 1 : 2, 'A school: it studies its own proved work' + (L.headline ? '' : '. Its first real test is running now')) + '><div class="d">05</div><div class="nm"><b>A school</b><span>It studies its own proved work to get better.</span>' + (L.headline ? '<span class="tag cy">' + esc(L.headline.was) + ' → ' + esc(L.headline.now) + '</span>' : SEALING) + '</div></div>';
const failedBuilds = FL.builds.filter((b) => b.claims.fail > 0);
const fails = failedBuilds.length
  ? failedBuilds.map((b) => esc(b.name) + ' failed ' + b.claims.fail + ' of its ' + b.claims.n + ' goals.').join(' ') + ' Each failed goal is still on its page, in red. <a href="deep.html#receipts">The long version lists more.</a>'
  : 'None of these five has a failed goal so far. When one fails, it stays on its page, in red. <a href="deep.html#receipts">The long version lists older ones.</a>';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(FL.read));
if (!day) refuse('the flagship record carries no date');
// the question box's own full test, from its record: what each did with the questions the pages cannot answer
const DD = DOCDEC.measured && DOCDEC.measured.docdec, RAG = DOCDEC.measured && DOCDEC.measured.vectorRag;
if (!DD || !RAG || DD.unanswerable.total !== RAG.unanswerable.total || DD.unanswerable.abstained + DD.unanswerable.answered !== DD.unanswerable.total) refuse('the question box\'s record does not add up');
const askScore = '<b>The full test:</b> ' + DD.unanswerable.total + ' questions the pages cannot answer. A normal search answered ' + (RAG.unanswerable.answered === RAG.unanswerable.total ? 'all ' : '') + RAG.unanswerable.answered + '. Ours said “I can’t tell” to ' + DD.unanswerable.abstained + '. It still answered ' + DD.unanswerable.answered + ' that it should not have.';
const kept = { wrong: (DOCDEC.demoQuestions || []).filter((q) => q.label === 'dd-missed' || q.label === 'dd-hallucinated').length, all: (DOCDEC.demoQuestions || []).length };
if (kept.all !== 12 || kept.wrong !== 4) refuse('the question box\'s kept questions changed: the page says twelve, and four that ours gets wrong');
const houseCss = read('vendor/house-standard/kit/house.css').trim();
if (houseCss.includes('</style')) refuse('the house style sheet cannot be put on the page as it is');
// the honest line about the learning test: what the record holds, and no more
const learnLine = L.headline
  ? 'The learning test has been run ' + TIMES + '. ' + (ROUND === 1 ? 'It got ' : 'In round ' + ROUND + ' it got ') + esc(L.headline.was) + ' right ' + before + ' and ' + esc(L.headline.now) + ' after, on ' + L.headline.of + ' new problems. ' + (KEPT ? '' : 'It did not get better, so that round was dropped and the learning stopped. ') + 'That is one kind of problem. Its own page shows every round, and where it did not get better.'
  : 'The learning test is still running. Its score goes on this page when it is done, pass or fail.';
const FRONT = {
  'HOUSE-STYLE': '<style>\n' + houseCss + '\n</style>',
  RECEIPTS: receipts + '\n    ', LOOP: loop + '\n    ', BUILDS: builds + '\n    ', 'SCHOOL-ROW': schoolRow,
  REUSE: reuse + '% of its reading kept, in a speed test', FAILS: fails, 'READ-ON': Number(day[3]) + ' ' + MONTHS[Number(day[2]) - 1] + ' ' + day[1],
  'DOC-N': String(DOCDEC.counts.paragraphs), 'LEARN-LINE': learnLine, 'ASK-SCORE': askScore, 'N-BUILDS': num(counted.builds), 'KONOMI-CREDIT': esc(F.credits.konomi) + '.',
};
const front = fill('site/front.html', FRONT);

// ── 4 · the data module the page's code imports ─────────────────────────────────────────────────────────────────
const bundle = '// site/data/bundle.mjs — GENERATED by scripts/build-front.mjs from the sources it names. Do not edit by hand.\n'
  + 'export const ESTATE = ' + JSON.stringify({ generated: estateRaw.generated, repos: estateRaw.repos, nodes: estateRaw.nodes }) + ';\n'
  + 'export const ORGANS = ' + JSON.stringify(ORG.organs) + ';\n'
  + 'export const MODEL = ' + JSON.stringify(MODEL) + ';\n'
  + 'export const T4_PUBLISHED = ' + JSON.stringify({ id: wave1.T4.id, sealedAt: wave1.sealedAt }) + ';\n'
  + 'export default { ESTATE, ORGANS, MODEL, T4_PUBLISHED };\n';

const targets = [[OUT, front], ['deep.html', page], ['site/data/bundle.mjs', bundle]];
if (CHECK) {
  let bad = 0;
  for (const [f, want] of targets) if (!existsSync(join(root, f)) || read(f) !== want) { bad++; console.error('✗ ' + f + ' is stale: run node scripts/build-front.mjs and commit'); }
  if (bad) process.exit(1);
  console.log('FRONT DOOR CHECK CLEAN — ' + OUT + ', deep.html and site/data/bundle.mjs are exactly what their sources give');
} else {
  for (const [f, want] of targets) writeFileSync(join(root, f), want);
  console.log(OUT + ' and deep.html built — ' + STATS.tiles.length + ' figures, ' + shape.organCount + ' organs, ' + num(counted.builds) + ' builds, ' + rows.length + ' LIGHT types (' + coldLosses + ' cold losses shown), ' + pinCount + ' pinned files');
}
