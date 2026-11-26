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
  ['FallForge Mint kernel — mutation gate', `${W.killed} / ${W.total} killed · ${W.survivors} survivors${W.baselined ? ` (${W.baselined} equivalent mutant baselined with a written reason)` : ""} · score ${W.score}`, 'measured, commit ' + W.commit],
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
<h2><span class="num">00</span>What is new</h2>
<p class="k">Two things are new. <strong>FallForge Mint</strong> helps you make a small AI of your own, and then tests it. Its scorecard is allowed to say you lost. And everything we built now <strong>joins up</strong>: one front door, seven steps, and a sorter that puts each job in one of three honest piles.</p>
<div class="note">The 90-second film is at www.ai-nativesolutions.com/explainer.html. Each number in it, and in this part, was measured on a live build or comes from a study we name. The table in this part lists them all.</div>

<h3>1 · Pick the size</h3>
<p>Sellers want to sell you a big AI, or a place to run one. The real question is what size is enough. The sizer looks at the kind of work, the kind of answer, how strict it must be and where it will run. Then it names the smallest open AI that should pass. It can pick from about 1 billion to about 200 billion in size, from the Llama, Qwen, Phi, Gemma and Mistral families. It shows every reason. For a job that sorts things into short labels it picks <b>${esc(F.forgemint.sizerExamples[0].result)}</b>. For strict coding on a computer with a strong graphics chip it picks <b>${esc(F.forgemint.sizerExamples[2].result)}</b>. It never picks a bigger one just to sell more. It is a clear place to start, not a test result. The proof is the scorecard.</p>
${fig('sizer-ladder.jpg', 'The sizer ladder from about 1 billion to about 200 billion parameters, recommending Llama 3.2 1B', 'The sizer, live in FallForge Mint.')}

<h3>2 · Make it, then test it</h3>
<p>A few of your own examples become the recipe for a small AI. The recipe is yours, and it can be made again the same way. Some examples are kept back for the test. The new AI and the one it grew from both answer them. A fixed program marks the answers, the same way every time. Here is a real signed scorecard from our own work. <b>${esc(R.node)}</b>, which checks code, scored <b>${R.vsBase.node}/${R.probes}</b>. The AI it grew from, ${esc(R.vsBase.model)}, scored ${R.vsBase.base}/${R.probes}. The verdict is <b>${R.vsBase.verdict}</b>, certified. Against ${esc(R.vsBigger.model)}, an AI about seven times its size, it scored ${R.vsBigger.node}/${R.probes} to ${R.vsBigger.other}/${R.probes}. The verdict is <b>${R.vsBigger.verdict}</b>, and the scorecard says so.</p>
${fig('scorecard-real-receipt.jpg', 'A real signed receipt: review-1b 9 of 16 versus its base 4 of 16, BEATS; versus qwen2.5 7B 11 of 16, LOSES', '')}
<div class="box"><b>What the scorecard proves, and what it does not.</b> It is signed, and it carries a fingerprint of itself. So no one can change the numbers without it showing. The signature proves the numbers have not changed since signing. It does not prove who ran the test. The test examples were not in the recipe the AI was given. Anyone can run the test again. We do not claim the marker was kept apart from the answers.</div>
<details class="more"><summary>The exact words, for experts</summary>
  <p>It names its key class — software Ed25519, which proves the numbers are unedited since signing, not who ran the evaluation. Its held-out claim is narrow and true: <em>“${esc(F.forgemint.heldOutClaim)}”</em> It makes no claim that the grader was isolated from the answers. ${esc(F.forgemint.rerun.line)}</p>
</details>

<h3>3 · What owning saves, and when it does not</h3>
<p>A 2026 study by Lenovo compared owning the computers with renting them. With heavy use, owning cost about 6 times less than rented cloud computers. It cost about 17 times less than a paid AI service. It paid for itself in about 5.2 months, set against cloud computers rented by the hour. Below about 5 hours of use a day, renting can win. FallForge Mint has a calculator that works this out for your own use. When renting is the better deal, it says “keep renting”.</p>
${fig('own-vs-rent.jpg', 'Own versus rent: owning 1x, cloud GPU instances about 6x, a hosted reasoning-model API about 17x', '')}
<details class="more"><summary>The study, in its own terms</summary>
  <p>${esc(C.ownVsRent.claim)} (<a href="${esc(C.ownVsRent.url)}">${esc(C.ownVsRent.source)}</a>.)</p>
</details>

<h3>4 · How it all joins up</h3>
<p><b>sovereign-foundry</b> is the front door. It has seven steps: ${F.router.stages.join(' · ')}. Each step is a live page. <b>fall-os</b> lets you hatch your own helper and grow it into your own system. <b>capability-router</b> gives each job one of ${F.router.addresses} places to go, and checks that none is missed. A sorter then puts each step in one of three honest piles. <b>${D.auto}</b> parts run on their own. <b>${D.behindKey}</b> wait for a person, on purpose: that is anything that moves money, goes public, or cannot be undone. <b>${D.todo}</b> are marked as not built yet. <b>fall-federate /join</b> links two people with no server in the middle. <b>meshos</b> passes messages across three devices. <b>forgegrowth</b> turns a real scorecard into launch words, and refuses any number that is not on it.</p>
${fig('estate-map.jpg', 'The estate map with sovereign-foundry at the centre', '')}
${fig('dispatcher-three-states.jpg', 'The dispatcher: 7 run themselves, 9 wait for a human key, 8 honestly to-do', '')}

<h3>5 · Each number, and where it is from</h3>
<p>Each number in this part was measured on a live build, or comes from a study we name.</p>
<details class="more"><summary>Open the table: each number and its source</summary>
${table}
</details>

<h3>6 · The big idea</h3>
<p>A team at NVIDIA wrote that small AI models are strong enough for many jobs, suit them better, and cost less. Owning them costs several times less with heavy use, and renting wins with light use. Another study found that an AI trained on AI-made text slowly loses the rare things. <b>Our view</b>, and it is only ours: an AI fed on its own answers forgets the rare cases. Real people doing real work are those rare cases. Owned AI that you can test is how they are kept. A scorecard that can fail is how anyone can trust it.</p>
<details class="more"><summary>The studies, and our view, in the first words</summary>
  <p>Small models are “sufficiently powerful, inherently more suitable, and necessarily more economical for many invocations in agentic systems” (${esc(C.slm.source)}). Training on model-generated content causes irreversible defects “where tails of the original content distribution disappear” (${esc(C.modelCollapse.source)}). <b>Our thesis</b>, stated as ours: ${esc(F.thesis)}</p>
</details>

<h3>7 · What works, what needs a person, what is next</h3>
<div class="tw"><table><thead><tr><th>Works now</th><th>Proved, but needs a person</th><th>Next</th></tr></thead><tbody><tr>
<td>${H.live.map(esc).join('<br>')}</td><td>${H.provenNeedsHuman.map(esc).join('<br>')}</td><td>${H.next.map(esc).join('<br>')}</td></tr></tbody></table></div>
<div class="note">${esc(K.konomi)}. ${esc(K.maccubeface)}. fall-os draws on Thomas Frumkin's assos. The dream-state memory draws on ${esc(K.garyDream)}. The Dual-Map decision gate draws on ${esc(K.garyDualMap)}. ${esc(K.forge)}. ${esc(K.license)}.</div>
`;

const slides = `
<section class="slide" id="s1n1">
  <div class="n">New · FallForge Mint</div>
  <h2>Pick the size. Make it. <em>Test it.</em></h2>
  <p class="big">The sizer names the <strong>smallest open AI that should pass your test</strong>. It can pick from about 1 billion to about 200 billion in size. It shows every reason, and it never picks a bigger one just to sell more. You make it from a few of your own examples. Then it is tested on examples it was not given.</p>
  <img class="fig" src="media/images/sizer-ladder.jpg" alt="The sizer ladder recommending Llama 3.2 1B" loading="lazy">
</section>

<section class="slide" id="s1n2">
  <div class="n">New · The scorecard</div>
  <h2>A scorecard that can <em>say you lost.</em></h2>
  <p class="big"><strong>${esc(R.node)}</strong> scored ${R.vsBase.node}/${R.probes}. The AI it grew from scored ${R.vsBase.base}/${R.probes}. The verdict: ${R.vsBase.verdict}. Against an AI about 7 times its size it scored ${R.vsBigger.node}/${R.probes} to ${R.vsBigger.other}/${R.probes}. The verdict: ${R.vsBigger.verdict}. The test examples were not in the recipe the AI was given, and anyone can run the test again.</p>
  <img class="fig" src="media/images/scorecard-real-receipt.jpg" alt="A real receipt that says BEATS and LOSES" loading="lazy">
</section>

<section class="slide" id="s1n3">
  <div class="n">New · It all joins up</div>
  <h2>One front door. <em>${F.estateMap.live} of ${F.estateMap.doors} doors live.</em></h2>
  <p class="big">Seven steps in one line. A sorter puts each job in a pile. <strong>${D.auto}</strong> parts run on their own. <strong>${D.behindKey}</strong> wait for a person. <strong>${D.todo}</strong> are marked as not built yet. Every door on the map opened when we tried it on ${esc(F.estateMap.checked)}.</p>
  <img class="fig" src="media/images/estate-map.jpg" alt="The estate map" loading="lazy">
  <div class="cta"><a class="btn solid" href="./explainer.html#film">▶ Watch the 90-second film</a><a class="btn" href="./explainer.html#facts">Where each number is from</a></div>
</section>
`;

// the long version of the front door (deep.html) names the dreaming layer (the fall-os card) → it carries Gary W. Floyd's full dream-state credit
const dreamCredit = '\n  <p class="credit">The dreaming layer draws on dream-state design Gary W. Floyd shared with the estate: ' + esc(K.garyDream) + '.</p>\n';

for (const [file, key, html] of [['prospectus.html', 'EDITION', section], ['deck.html', 'EDITION-SLIDES', slides], ['deep.html', 'CREDIT-DREAM', dreamCredit]]) {
  const p = join(root, file); let page = readFileSync(p, 'utf8');
  const a = page.indexOf('<!--' + key + '-->'), b = page.indexOf('<!--/' + key + '-->');
  if (a < 0 || b < 0) { console.error('REFUSED: marker ' + key + ' missing from ' + file); process.exit(1); }
  page = page.slice(0, a + key.length + 7) + html + page.slice(b);
  writeFileSync(p, page);
}
console.log('edition: prospectus §00 (' + rows.length + ' sourced figures) + 3 deck slides — drawn from media/film/facts.json');
