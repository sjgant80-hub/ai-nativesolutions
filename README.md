# AI Native Solutions

**LIVE: https://www.ai-nativesolutions.com** (also https://sjgant80-hub.github.io/ai-nativesolutions/)

The client-facing front door: AI-first software firms OWN — runs on their machines, data never
leaves, routine work automated, humans holding the four doors (money, legal, judgment, client
trust). Plain words, no estate jargon; every claim backed by a live build a visitor can walk
before we speak.

- `index.html` — the landing. Estate counts are stamped by the generator, never typed.
- `estate.html` — GENERATED from the estate index: flagships + every live public build, searchable.
- `scripts/build-site.mjs` — the one source for every number on both pages; refuses a thin index
  and refuses flagships that are not live (it caught fallcorp-demo missing from a stale index on
  its first run — regenerate the index, then build).
- `legacy/` + the remaining product/spec pages — kept in place so no inbound link breaks.

Regenerate after an index refresh: `node scripts/build-site.mjs`
