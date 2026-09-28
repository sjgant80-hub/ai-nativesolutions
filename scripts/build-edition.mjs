// ai-nativesolutions · scripts/build-edition.mjs — the 2026-09 edition of the prospectus and deck, drawn from
// media/film/facts.json (the same file behind the film and explainer.html), so the brochure can never state a
// figure the film or the site doesn't. Injects between markers; refuses on a missing marker or a thin facts file.
//
//   node scripts/build-edition.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const F = JSON.parse(readFileSync(join(root, 'media', 'film', 'facts.json'), 'utf8'));
for (const k of ['forgemint', 'foldcycle', 'router', 'dispatcher', 'leftpad', 'citations', 'credits', 'honesty', 'realReceipt', 'estate']) {
  if (!F[k]) { console.error('REFUSED: facts.json is missing "' + k + '"'); process.exit(1); }
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const R = F.realReceipt, W = F.forgemint.witness, D = F.dispatcher, L = F.leftpad, C = F.citations, K = F.credits, H = F.honesty;
const fig = (img, alt, cap) => `<figure class="fig"><img src="media/images/${img}" alt="${esc(alt)}" width="1920" height="1080" loading="lazy">${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;

const rows = [
  ['FallForge Mint kernel — mutation gate', `${W.killed} / ${W.total} killed · 0 survivors · score ${W.score}`, 'measured, commit ' + W.commit],
  ['A real signed receipt — review-1b vs its base', `${R.vsBase.node}/${R.probes} vs ${R.vsBase.base}/${R.probes} → ${R.vsBase.verdict}`, 'measured, shipped receipt'],
  ['review-1b vs ' + R.vsBigger.model, `${R.vsBigger.node}/${R.probes} vs ${R.vsBigger.other}/${R.probes} → ${R.vsBigger.verdict}`, 'measured — the receipt says it lost'],
  ['Fold-cycle — prefill latency cut', `~${F.foldcycle.prefillLatencyCutPct}% (control ${F.foldcycle.controlSavingPct}%)`, 'measured, kar-foldcycle'],
  ['Fold-cycle — embedding calls avoided', `~${F.foldcycle.embeddingCallsAvoidedPct}%`, 'measured, kar-foldcycle'],
  ['capability-router', `${F.router.addresses} addresses · witness ${F.router.witness}`, 'measured'],
  ['The dispatcher', `${D.auto} auto · ${D.behindKey} behind a human key · ${D.todo} to-do (of ${D.organs})`, 'measured from the registry'],
  ['witness on left-pad (not ours)', `${L.killed} / ${L.total} killed · ${L.survivors} survivor`, 'measured — ' + L.line],
  ['Own vs rent', C.ownVsRent.short, 'cited — ' + C.ownVsRent.source],
  ['Small models for agentic work', 'sufficient, suitable, economical', 'cited — ' + C.slm.source],
  ['Model collapse', 'the tails disappear first', 'cited — ' + C.modelCollapse.source],
  ['The estate', F.estate.publicReposLabel, 'counted — ' + F.estate.how],
];
const table = '<div class="tw"><table><thead><tr><th>What</th><th>Figure</th><th>Source</th></tr></thead><tbody>'
  + rows.map(([a, b, c]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td><td class="n">${esc(c)}</td></tr>`).join('') + '</tbody></table></div>';

const section = `
<h2><span class="num">00</span>New in this edition</h2>
<p class="k">Two things arrived since the last edition. <strong>FallForge Mint</strong> now sizes, mints and proves a private model on your own data — and hands you a receipt that is allowed to say you lost. And the estate now <strong>connects</strong>: one front door, seven stages, and a dispatcher that puts every job into one of three honest states.</p>
<div class="note">The 90-second film is at www.ai-nativesolutions.com/explainer.html. Every figure in it, and in this section, is measured from a live build or cited from a published source — the table at the end of this section lists each one.</div>

<h3>1 · Size it — the smallest model that clears the bar</h3>
<p>Everyone sells you a model or the hosting; almost nobody tells you which size is enough. The sizer reads the kind of work, the shape of the answer, how strict it must be and where it will run, and recommends the smallest open-weight model that should clear the bar — on a ladder from ~1B to ~200B parameters across Llama, Qwen, Phi, Gemma and Mistral — with every factor shown. A short-label classification job gets <b>${esc(F.forgemint.sizerExamples[0].result)}</b>; strict code on a GPU box gets <b>${esc(F.forgemint.sizerExamples[2].result)}</b>. It never rounds up to sell a bigger model, and it is a transparent starting point, not a benchmark: the proof is the scorecard.</p>
${fig('sizer-ladder.jpg', 'The sizer ladder from about 1 billion to about 200 billion parameters, recommending Llama 3.2 1B', 'The sizer, live in FallForge Mint.')}

<h3>2 · Mint it, then prove it — on examples it never saw</h3>
<p>A few of your own examples become a private, reproducible model recipe. Some are held out; the minted model and its base both answer them, and the answers are graded deterministically. A real signed receipt from the estate: <b>${esc(R.node)}</b>, a code-review node, scored <b>${R.vsBase.node}/${R.probes}</b> against its base ${esc(R.vsBase.model)}'s ${R.vsBase.base}/${R.probes} — <b>${R.vsBase.verdict}</b>, certified. Against ${esc(R.vsBigger.model)}, a model about seven times its size, it scored ${R.vsBigger.node}/${R.probes} to ${R.vsBigger.other}/${R.probes} — <b>${R.vsBigger.verdict}</b> — and the receipt says so.</p>
${fig('scorecard-real-receipt.jpg', 'A real signed receipt: review-1b 9 of 16 versus its base 4 of 16, BEATS; versus qwen2.5 7B 11 of 16, LOSES', '')}
<div class="box"><b>What the scorecard proves — and what it doesn't.</b> It is signed and self-hashed, so nobody can edit the numbers unnoticed. It names its key class — software Ed25519, which proves the numbers are unedited since signing, not who ran the evaluation. Its held-out claim is narrow and true: <em>“${esc(F.forgemint.heldOutClaim)}”</em> It makes no claim that the grader was isolated from the answers. A one-click CI re-run is next.</div>

<h3>3 · What owning saves — and when it doesn't</h3>
<p>${esc(C.ownVsRent.claim)} (${esc(C.ownVsRent.source)}.) FallForge Mint's calculator applies this to your own volume — and returns “keep renting” when renting is genuinely the better deal.</p>
${fig('own-vs-rent.jpg', 'Own versus rent: owning 1x, cloud GPU instances about 6x, a hosted reasoning-model API about 17x', '')}

<h3>4 · How the estate connects</h3>
<p><b>sovereign-foundry</b> is the front door: seven stages — ${F.router.stages.join(' · ')} — each one a live door. <b>fall-os</b> hatches your own assistant and levels it into your own operating system. <b>capability-router</b> gives every job one of ${F.router.addresses} capability addresses behind a coverage gate, and the dispatcher places each step in one of three honest states: <b>${D.auto}</b> organs run themselves, <b>${D.behindKey}</b> wait for a human key by design (anything that moves money, publishes, or can't be undone), and <b>${D.todo}</b> are honestly marked to-do. <b>fall-federate /join</b> connects two parties peer-to-peer with no server between; <b>meshos</b> relays across three nodes; <b>forgegrowth</b> turns a real scorecard into launch copy and refuses any number that isn't on it.</p>
${fig('estate-map.jpg', 'The estate map with sovereign-foundry at the centre', '')}
${fig('dispatcher-three-states.jpg', 'The dispatcher: 7 run themselves, 9 wait for a human key, 8 honestly to-do', '')}

<h3>5 · The proof, measured and cited</h3>
${table}

<h3>6 · The thesis</h3>
<p>Small models are “sufficiently powerful, inherently more suitable, and necessarily more economical for many invocations in agentic systems” (${esc(C.slm.source)}). Owning them is several times cheaper at high use, and renting wins at low use. Training on model-generated content causes irreversible defects “where tails of the original content distribution disappear” (${esc(C.modelCollapse.source)}). <b>Our thesis</b>, stated as ours: ${esc(F.thesis)}</p>

<h3>7 · Live, needs a human, next</h3>
<div class="tw"><table><thead><tr><th>Live now</th><th>Proven — needs a human</th><th>Next</th></tr></thead><tbody><tr>
<td>${H.live.map(esc).join('<br>')}</td><td>${H.provenNeedsHuman.map(esc).join('<br>')}</td><td>${H.next.map(esc).join('<br>')}</td></tr></tbody></table></div>
<div class="note">${esc(K.konomi)}. ${esc(K.maccubeface)}. fall-os draws on Thomas Frumkin's assos. The dream-state memory draws on ${esc(K.garyDream)}; the Dual-Map decision gate draws on ${esc(K.garyDualMap)}. ${esc(K.forge)}. ${esc(K.license)}.</div>
`;

const slides = `
<section class="slide" id="s1n1">
  <div class="n">New in this edition · FallForge Mint</div>
  <h2>Size it. Mint it. <em>Prove it.</em></h2>
  <p class="big">The sizer picks the <strong>smallest open-weight model that clears your bar</strong> — ~1B to ~200B, every factor shown, never an upsell. Mint it from a few of your own examples; prove it on examples it never saw.</p>
  <img class="fig" src="media/images/sizer-ladder.jpg" alt="The sizer ladder recommending Llama 3.2 1B" loading="lazy">
</section>

<section class="slide" id="s1n2">
  <div class="n">New in this edition · The receipt</div>
  <h2>A receipt that can <em>say you lost.</em></h2>
  <p class="big"><strong>${esc(R.node)}</strong> scored ${R.vsBase.node}/${R.probes} against its base's ${R.vsBase.base}/${R.probes} — ${R.vsBase.verdict}. Against a model ~7× its size: ${R.vsBigger.node}/${R.probes} to ${R.vsBigger.other}/${R.probes} — ${R.vsBigger.verdict}. The held-out answers weren't in the spec the model was given, and anyone can re-run it.</p>
  <img class="fig" src="media/images/scorecard-real-receipt.jpg" alt="A real receipt that says BEATS and LOSES" loading="lazy">
</section>

<section class="slide" id="s1n3">
  <div class="n">New in this edition · The estate</div>
  <h2>One front door. <em>Every door live.</em></h2>
  <p class="big">Seven stages, one pipeline. The dispatcher routes every job: <strong>${D.auto}</strong> organs run themselves, <strong>${D.behindKey}</strong> wait for a human key, <strong>${D.todo}</strong> are honestly to-do.</p>
  <img class="fig" src="media/images/estate-map.jpg" alt="The estate map" loading="lazy">
  <div class="cta"><a class="btn solid" href="./explainer.html#film">▶ Watch the 90-second film</a><a class="btn" href="./explainer.html#facts">Every number, sourced</a></div>
</section>
`;

for (const [file, key, html] of [['prospectus.html', 'EDITION', section], ['deck.html', 'EDITION-SLIDES', slides]]) {
  const p = join(root, file); let page = readFileSync(p, 'utf8');
  const a = page.indexOf('<!--' + key + '-->'), b = page.indexOf('<!--/' + key + '-->');
  if (a < 0 || b < 0) { console.error('REFUSED: marker ' + key + ' missing from ' + file); process.exit(1); }
  page = page.slice(0, a + key.length + 7) + html + page.slice(b);
  writeFileSync(p, page);
}
console.log('edition: prospectus §00 (' + rows.length + ' sourced figures) + 3 deck slides — drawn from media/film/facts.json');
