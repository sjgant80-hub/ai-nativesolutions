// patch-film.cjs — the on-screen text, checked against facts.json and the live product (2026-09-28 re-render):
// the CI re-run is live and link-bound; the held-out wording is narrow-true; no unbacked universal claims.
const fs = require('fs');
let s = fs.readFileSync('film.html', 'utf8');
const rep = (a, b) => { if (!s.includes(a)) { console.error('MISSING: ' + a.slice(0, 90)); process.exit(1); } s = s.replace(a, () => b); };
// argument — "nobody could" was an unbacked universal
rep("txt('Until now, nobody could give both a receipt.'", "txt('Both want a receipt they can check.'");
// sizer — the sizer recommends; the scorecard proves (the on-screen note already says so)
rep("txt('The smallest model that clears your bar.'", "txt('The smallest model that should clear your bar.'");
// prove — narrow-true held-out wording; the receipt's "certified" is its own gate's pass, not a certifier
rep("txt('HELD OUT — never shown to the model'", "txt('HELD OUT — not in the spec the model is given'");
rep("pill('BEATS its base — certified'", "pill('BEATS its base — passed its gate'");
// receipt — the CI re-run is live and link-bound (was "CI re-run: next.")
rep("['rerun', 'your browser · or a clean CI runner', C.ink]", "['rerun', 'a real CI run — link bound ✓', C.good]");
rep("shot('fallforgemint-verify', 1080, 300, 720, 540, { alpha: sa, zoom: 1.35, px: .62, py: .25, label: 'Live · re-check it yourself' });",
    "shot('fallforgemint-rerun', 1080, 300, 720, 540, { alpha: sa, zoom: 1.0, px: .5, py: 0, label: 'Live · re-run it on a clean GitHub runner' });");
rep("pill('✓ INTACT — matches its own fingerprint'", "pill('✓ BOUND — the run it names made it'");
rep("pill('✗ CAUGHT — one byte changed'", "pill('✗ TAMPERED — a borrowed CI link fails'");
rep("txt('A browser key proves the numbers are unedited — not who ran it.  A clean CI runner can re-run it.'",
    "txt('A software key proves the numbers are unedited — not who ran it.  CI re-run: live — the run it names must have made this exact scorecard.'");
// estate — the fold-cycle figure, stated as what it is, with its control (the LinkedIn lesson)
rep("txt('recycling cut prefill latency ~' + F.foldcycle.prefillLatencyCutPct + '% (measured)'",
    "txt('prefix caching, kept stable: ~' + F.foldcycle.prefillLatencyCutPct + '% less prefill time on a repeat'");
rep("fold-cycle: kar-foldcycle results.json'", "fold-cycle: standard prefix caching kept stable, vs a ' + F.foldcycle.controlSavingPct + '% control (kar-foldcycle results.json)'");
// trust — what the gate does, not "every test"
rep("txt('A gate that tries to break every test.'", "txt('A gate that breaks the code to test the tests.'");
// the new live capture the receipt scene uses
rep("const shotNames = ['fallforgemint-sizer', 'fallforgemint-verify', 'fallforgemint-get',", "const shotNames = ['fallforgemint-sizer', 'fallforgemint-verify', 'fallforgemint-rerun', 'fallforgemint-get',");
fs.writeFileSync('film.html', s);
console.log('film.html: on-screen text patched');
