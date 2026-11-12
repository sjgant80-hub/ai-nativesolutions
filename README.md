# AI Native Solutions

**LIVE: https://www.ai-nativesolutions.com** (also https://sjgant80-hub.github.io/ai-nativesolutions/)

The client-facing front door. It is not a brochure about the estate: it runs the estate, in the
visitor's own browser, and nothing they type or drop leaves their machine.

## What is on the front door

| Section | What it is | What runs |
|---|---|---|
| The organism | The whole public estate as one living thing: every dot a real build, the named organs threaded by real links | WebGPU (layout in a compute shader, bloom); a plainer 2D canvas without it |
| The door (tier 1) | A reader, a source check, a verified law library and a gate that abstains | `vendor/slm-suite` (the SLM Suite's own gate, memo, library and law table) + `site/kernel/ground.mjs`; optionally a stock open model through WebLLM |
| The race | Four codecs on the visitor's own file, each verified by decoding back | `vendor/konomi-tongue` (LIGHT, layered), Brotli and Zstandard as WebAssembly, the browser's gzip |
| Try to break it | A real signed door, and Liveware's sealed 11,112-attempt test | `vendor/liveware` (door, immune library, referee, identity) |
| The receipts | Nine measured figures, each with its receipt and what it does not prove | generated from `site/data/stats.json` and `media/film/facts.json` |
| The network ledger | Every request the page makes, and whether anything was sent up | `site/kernel/netwatch.mjs` + a Content-Security-Policy that forbids any other host |

## How it is built

- `site/page.html` is the template; **`node scripts/build-front.mjs`** draws `index.html` and
  `site/data/bundle.mjs` from it and from the records. No figure is typed by hand; `--check` fails
  the build if the page and the records disagree.
- `node scripts/build-front.mjs --estate <estate-index.json>` refreshes `site/data/estate.json`
  (public, non-archived, non-fork builds only; a private build can never enter it).
- `node scripts/vendor-site.mjs` vendors the real kernels byte for byte from their repositories
  and pins each file by SHA-256 in `vendor/SOURCES.json`; `--check` verifies the pins.
- `node scripts/gate-site.mjs <witness.mjs>` breaks the front door's own kernels on purpose
  (witness v0.6) and writes `site/data/witness.json`, which the page prints; CI re-derives it.
- `node scripts/surface-gate.mjs` holds every page to the site's rules: no price anywhere,
  credits in full, no internal shorthand, figures matching the facts file, links that resolve.
- `node tools/serve.mjs` serves the site on 127.0.0.1 for local work.

Other pages: `estate.html` (every public build, searchable; `scripts/build-site.mjs`),
`explainer.html` / `prospectus.html` / `deck.html` (the film package, from `media/film/facts.json`),
`classic.html` (the previous front door, kept so nothing is lost), `legacy/` and the remaining
product pages (kept in place so no inbound link breaks).

Built by Kar for AI Native Solutions. MIT.
