// ai-nativesolutions · scripts/build-explainer.mjs — inject the "every number, and where it comes from"
// table, the live / needs-a-human / next states and the credits into explainer.html FROM media/film/facts.json.
// One kernel rule: the facts file is the only place a figure is written; the page is drawn from it, so the
// film, the brochure and this page can never disagree. Refuses to run on a missing marker or a thin facts file.
//
//   node scripts/build-explainer.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..');
const F = JSON.parse(readFileSync(join(root, 'media', 'film', 'facts.json'), 'utf8'));
for (const k of ['forgemint', 'foldcycle', 'router', 'dispatcher', 'leftpad', 'citations', 'credits', 'honesty', 'realReceipt']) {
  if (!F[k]) { console.error('REFUSED: facts.json is missing "' + k + '"'); process.exit(1); }
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const link = (url, text) => '<a href="' + esc(url) + '">' + esc(text) + '</a>';
const R = F.realReceipt, W = F.forgemint.witness, D = F.dispatcher, L = F.leftpad, C = F.citations, RR = F.forgemint.rerun;
// the rail's proof runs must be real GitHub Actions run links — refuse to draw the table from anything else
const RUN = /^https:\/\/github\.com\/sjgant80-hub\/fallforgemint(?:-rerun)?\/actions\/runs\/[1-9][0-9]{0,19}$/;
if (!RR || ![RR.genuine, RR.tampered, RR.forged].every((x) => x && RUN.test(x.run) && x.label && x.outcome)) { console.error('REFUSED: facts.json forgemint.rerun needs genuine/tampered/forged, each a real Actions run link'); process.exit(1); }
const rows = [
  ['FallForge Mint kernel — mutation gate', W.killed + ' / ' + W.total + ' killed · ' + W.survivors + ' survivors' + (W.baselined ? ' (' + W.baselined + ' equivalent mutant baselined with a written reason)' : '') + ' · score ' + W.score, 'Measured: ' + F.forgemint.how + ' · ' + link(F.forgemint.url, 'live')],
  ['FallForge Mint kernel — tests', F.forgemint.tests + ' passing', 'Measured: node --test on commit ' + W.commit],
  ['A real signed receipt (review-1b, ' + R.task + ')', R.vsBase.node + '/' + R.probes + ' vs its base ' + R.vsBase.model + ' ' + R.vsBase.base + '/' + R.probes + ' → ' + R.vsBase.verdict, 'Measured: ' + R.how],
  ['…and the same node against a model ~7× its size', R.vsBigger.node + '/' + R.probes + ' vs ' + R.vsBigger.model + ' ' + R.vsBigger.other + '/' + R.probes + ' → ' + R.vsBigger.verdict, 'The receipt is allowed to say it lost — and does'],
  ['The held-out claim on every scorecard', 'narrow-true', esc(F.forgemint.heldOutClaim) + ' It makes no claim that the grader was isolated from the answers.'],
  ['FallForge Mint — launched', F.forgemint.launch.version + ' · ' + F.forgemint.launch.date, 'Released: ' + link(F.forgemint.launch.release, 'the ' + F.forgemint.launch.version + ' release') + ' — ' + esc(F.forgemint.launch.how)],
  ['The CI re-run rail — a shared scorecard, re-run in the open', RR.genuine.label + ' passes · ' + RR.tampered.label + ' and ' + RR.forged.label + ' fail',
    'Real GitHub Actions runs: ' + [RR.genuine, RR.tampered, RR.forged].map((x) => link(x.run, x.label + ' → ' + x.outcome)).join(' · ') + '. ' + esc(RR.how) + ' · ' + link(RR.url, 'live') + ' · ' + link(RR.template, 'run it yourself')],
  ['Fold-cycle — prefill latency cut', '~' + F.foldcycle.prefillLatencyCutPct + '%', 'Measured (control ' + F.foldcycle.controlSavingPct + '%): ' + F.foldcycle.how + ' · ' + link(F.foldcycle.url, 'live')],
  ['Fold-cycle — embedding calls avoided', '~' + F.foldcycle.embeddingCallsAvoidedPct + '%', 'Measured (capacity-pooling). Balance condition: ' + F.foldcycle.balanceCondition],
  ['capability-router — addresses / gate', F.router.addresses + ' addresses · ' + F.router.witness, 'Measured: ' + F.router.how + ' · ' + link(F.router.url, 'live')],
  ['The dispatcher — three honest states', D.auto + ' auto · ' + D.behindKey + ' behind a human key · ' + D.todo + ' to-do', 'Measured: ' + D.how],
  ['witness on someone else’s code (' + L.repo + ')', L.killed + ' / ' + L.total + ' killed · ' + L.survivors + ' survivor', 'Measured: ' + L.how + '. ' + L.line],
  ['Own vs rent', C.ownVsRent.short, 'Cited: ' + link(C.ownVsRent.url, C.ownVsRent.source) + '. ' + C.ownVsRent.claim],
  ['Small models for agentic work', 'sufficient, suitable, economical', 'Cited: ' + link(C.slm.url, C.slm.source) + '. ' + C.slm.claim],
  ['Model collapse', 'the tails disappear first', 'Cited: ' + link(C.modelCollapse.url, C.modelCollapse.source) + '. ' + C.modelCollapse.claim],
  ['The estate', F.estate.publicReposLabel, 'Counted: ' + F.estate.how + '. ' + F.estate.note],
];
const table = '\n  <table class="facts"><thead><tr><th>What</th><th>Figure</th><th>How it was measured, or where it is cited</th></tr></thead><tbody>\n'
  + rows.map(([a, b, c]) => '    <tr><td>' + esc(a) + '</td><td>' + esc(b) + '</td><td>' + c + '</td></tr>').join('\n') + '\n  </tbody></table>\n';
const H = F.honesty;
const states = '\n  <div class="states">\n'
  + '    <div class="state live"><h3>Live now</h3><ul>' + H.live.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>\n'
  + '    <div class="state human"><h3>Proven — needs a human</h3><ul>' + H.provenNeedsHuman.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>\n'
  + '    <div class="state next"><h3>Next</h3><ul>' + H.next.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>\n  </div>\n';
const K = F.credits;
const credits = '\n  <p class="credits">' + esc(K.konomi) + '. ' + esc(K.maccubeface) + '. fall-os draws on Thomas Frumkin’s assos. '
  + 'The estate’s dream-state memory draws on ' + esc(K.garyDream) + '; its Dual-Map decision gate draws on ' + esc(K.garyDualMap) + '. '
  + esc(K.forge) + '. The film, the brochure and every build here are ' + esc(K.license) + '-licensed; the cited works remain their authors’ own.</p>\n';
const path = join(root, 'explainer.html'); let page = readFileSync(path, 'utf8');
for (const [key, html] of [['FACTS', table], ['STATES', states], ['CREDITS', credits]]) {
  const a = page.indexOf('<!--' + key + '-->'), b = page.indexOf('<!--/' + key + '-->');
  if (a < 0 || b < 0) { console.error('REFUSED: marker ' + key + ' missing from explainer.html'); process.exit(1); }
  page = page.slice(0, a + key.length + 7) + html + page.slice(b);
}
writeFileSync(path, page);
console.log('explainer.html: ' + rows.length + ' sourced facts, 3 honest states, credits — drawn from media/film/facts.json');
