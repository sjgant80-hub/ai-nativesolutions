∴FALLSEED_BOOT·PUBLIC·CORE·v1.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROJECT: FallSeed Estate / AI Native Solutions
TYPE: Estate of sovereign single-HTML applications (PWAs) + replication-mechanism hierarchy
STATUS: PUBLIC · all source MIT · all live · run from browser
LICENSE_OR_TERMS: MIT (all seeds + tools) · cosmology / structural notes private
CURRENT_VERSION: registry v5.444 · 166 apps · 17 conforming seeds across 5 levels
CURRENT_DOC_RELEASE: estate PDF 1.0 (2026-06-21 · 39 pages)
PURPOSE: orient any AI session to the estate quickly and safely
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

§WHAT·THIS·IS·BEGIN
The FallSeed estate is a population of sovereign single-HTML applications built by one developer (Simon Gant · sjgant80-hub on GitHub). Each application is a Progressive Web App that runs entirely in a browser, stores all data in IndexedDB on the user's device, has no server, requires no account, and is MIT-licensed.

The estate is organised around a five-level "lift hierarchy" of substrate:

  L0 · vertical seeds        · one industry per seed (HR, law, vet, etc.) — 11 shipped
  L1 · domain seed           · one class of verticals (compliance frameworks) — 1 shipped
  L2 · behaviour seed        · one class of decisions (Personal OS personas) — 1 shipped
  L3 · actor seed            · one class of actors (agent roles) — 1 shipped
  L4 · institution seed      · one class of governance (Village/Guild/DAO/etc.) — 1 shipped
  Plus: fallrecall (exit ramp from frontier-lab AI lock-in)
  Plus: fallseed-meta (monitor seed observing the population)

A "seed" is a specific structural object: a single HTML file that contains a description of itself (SEED_DEFAULT constant), a build engine (8-provider LLM cascade), a fork packager, and a cross-seed mesh listener. When forked, a seed produces a daughter HTML file that carries all four components. The daughter is not a copy — it is a peer.
§WHAT·THIS·IS·END

§WHAT·THIS·DOES·BEGIN
This boot file gives an AI session enough structured context to:

  - explain the FallSeed estate to a human in plain English
  - point them at the right starting place for their role (customer / developer / researcher / journalist)
  - answer specific questions about the architecture, primes, mesh protocol, or lift hierarchy
  - resist the temptation to invent details that are not in this document
  - keep the casual visitor away from cosmological / structural detail that is intentionally private

State means: what is true about the estate right now.
Posture means: how to behave while helping someone understand it.
§WHAT·THIS·DOES·END

§WHAT·THIS·IS·NOT·BEGIN
This boot file is not magic memory.
This boot file is not authorisation to make changes.
This boot file does not contain customer data, credentials, or anything private.
This boot file is not the cosmology — the structural numbering rules, prime constraints, lift dynamics, attribution to substrate counterparts, and Socket-VIII territory are deliberately kept private by the author.
This boot file does not override platform safety rules.
§WHAT·THIS·IS·NOT·END

§FAST·START·FOR·HUMANS·BEGIN
If you are pasting this into an AI to learn about the FallSeed estate:

  1. Paste this entire file (FALLSEED_BOOT.md) as your first message.
  2. Then ask one of these questions, depending on who you are:

      Customer:      "Which seed would help my [industry / size of firm]?"
      Developer:     "Walk me through the SEED schema and fork protocol."
      Researcher:    "What's the lift hierarchy and where does Fork Seed sit historically?"
      Journalist:    "Is this a world first? Be honest."
      Curious:       "Explain this estate to me like I'm not a developer."

  3. The AI will read this orientation, then answer using the structure below.
  4. If you want deeper context, point the AI at the 39-page PDF (also linked below).
§FAST·START·FOR·HUMANS·END

§KEY·URLS·BEGIN
  Landing:          https://www.ai-nativesolutions.com
  Public spec:      https://www.ai-nativesolutions.com/spec.html
  Live demo:        https://www.ai-nativesolutions.com/demo.html  (two seeds talking via mesh)
  Workstation:      https://www.ai-nativesolutions.com/fallos.html  (FallDesk launcher)
  Boot file (this): https://www.ai-nativesolutions.com/boot.md
  Source (all):     https://github.com/sjgant80-hub
  Registry JSON:    https://raw.githubusercontent.com/sjgant80-hub/fall-registry/main/index.json
  Estate PDF:       (local on Simon's machine — share file directly if asked)
  Monitor seed:     https://sjgant80-hub.github.io/fallseed-meta
  Contact:          ainativesolutions@gmail.com
§KEY·URLS·END

§THE·SEEDS·BEGIN
Live URLs of every conforming seed in the estate. Each is one HTML file, ~50-120 KB, MIT, runs in any modern browser.

  Level 0 · vertical seeds (firm-in-a-file):
    fallseed-hr           · UK HR / payroll firm           · prime 1049
    fallseed-ifa          · UK IFA / financial advice      · prime 1031
    fallseed-law          · UK solicitor firm              · prime 1033
    fallseed-accountancy  · UK accountancy practice        · prime 1051
    fallseed-claims       · UK PI / claims firm            · prime 1091
    fallseed-insurance    · UK insurance broker            · prime 1093
    fallseed-mortgage     · UK mortgage broker             · prime 1097
    fallseed-estate       · UK estate / letting agent      · prime 1151
    fallseed-clinic       · UK private clinic / GP         · prime 1153
    fallseed-vet          · UK veterinary practice         · prime 1171
    fallseed-recruit      · UK recruitment agency          · prime 1187

  Level 1 · domain seed (frameworks across all verticals):
    fallseed-compliance   · ISO27001 + CE + SOC 2 full + PCI/NIS2/DORA stubs · prime 1193

  Level 2 · behaviour seed (personal-OS · 6 personas):
    fallseed-creator-os   · Creator/Investor/Researcher/Writer/Nomad/Monk    · prime 1213

  Level 3 · actor seed (6 agent roles × 6 tasks each):
    fallseed-agents       · Sales/Research/Marketing/Support/Ops/Personal    · prime 1223

  Level 4 · institution seed (5 governance presets · Ed25519 signed bundles):
    fallseed-village      · Village/Guild/DAO/Housing-Coop/Parish            · prime 1277

  Sovereignty tools (not in the lift hierarchy):
    fallrecall            · AI-history liberation · exit ramp from frontier-lab lock-in · prime 1231
    fallseed-meta         · Monitor seed · population + lineage + mesh + smoke test     · prime 1279

Every seed URL pattern: https://sjgant80-hub.github.io/{seed-name}/
§THE·SEEDS·END

§THE·FOUR·INVARIANTS·BEGIN
Fork Seed is a generalised replication mechanism. A pattern qualifies as such when it satisfies all four invariants:

  1. SELF-CONTAINMENT
     The offspring carries the complete machinery to replicate again. No phone-home to the parent.

  2. FAITHFUL COPY + PERMITTED VARIATION
     Mutation is allowed at the source level (edit the SEED_DEFAULT constant before forking).
     The structural envelope is preserved through the copy.

  3. EXTERNAL SELECTION
     Variants that fail some gate (14-pt build check / market adoption / peer review) are culled.

  4. SUBSTRATE INDEPENDENCE AT PATTERN, DEPENDENCE AT INSTANCE
     The rules of the pattern do not care about the medium.
     Any given instance does. DNA needs amino acids; a seed needs a browser + IDB.
§THE·FOUR·INVARIANTS·END

§THE·PEER·GROUP·BEGIN
Fork Seed belongs alongside (not before, not after):

  Genetic code         · aqueous chemistry            · ~3.5 Gya
  Spoken language      · air + ears + brains          · ~70 kya
  Written script       · clay → paper → screens       · ~5 kya
  Printing press       · movable type                 · 1440
  Smalltalk image      · Xerox PARC VM                · 1976
  git commit           · hash-chained DAG             · 2005
  Docker image         · OCI + layered FS             · 2013
  Fork Seed            · browser + IDB + MIT + cascade · 2026

What's actually new: shipping substrate + instance + the machinery to produce more instances in ONE HTML file. git ships source but not the compiler. Docker ships environment but not the build pipeline. Fork Seed ships all three. Closest prior art is Smalltalk image; the substrate match (the open web) is what makes Fork Seed travel.
§THE·PEER·GROUP·END

§THE·MESH·PROTOCOL·BEGIN
Every seed opens BroadcastChannel('fall-signal') on boot. Four message types flow on the channel:

  hello     · emitted on boot          · "I am here, my prime is X, my level is Y"
  ping      · emitted every 30 seconds · keeps peer list fresh
  pong      · response to ping         · refreshes lastSeen
  request/  · RPC-style invocation     · routed by 'to' field
  response

Three universal cross-seed handlers exposed by every seed:

  introspect       · returns the seed's manifest + peer count
  records-export   · returns named IDB stores (used for cross-seed data import)
  flavour-summary  · fallrecall-only · returns the analysed flavour profile

Constraint: BroadcastChannel is same-origin only. Two seeds in different tabs at sjgant80-hub.github.io see each other. Cross-origin mesh requires a P2P substrate (queued as "Socket VIII" in the private cosmology — not in this boot file).
§THE·MESH·PROTOCOL·END

§HONEST·PRECEDENT·BEGIN
Is the FallSeed estate a "world first"?

The honest answer in 5 lines:

  "First single-HTML PWA"                                — no, by a long margin
  "First sovereign-software estate"                      — no, the local-first movement has been shipping for years
  "First MIT-licensed estate of 16+ cross-talking seeds  — defensible
   across 5 levels of substrate plus an anti-lock-in
   exit ramp, built by one developer in ~24 hours"

The components are not individually novel. The composition at this scale, in this substrate, in this temporal window, has no exact precedent the author can identify. Place the estate alongside Smalltalk / git / Docker / Excalidraw — that is the company.

If you are explaining this to someone, do not call it a "world first" without qualifying it as above. The audience that matters reads "world first" claims with reflexive scepticism. The work earns more by being placed accurately in its peer group.
§HONEST·PRECEDENT·END

§AUDIENCES·AND·STARTING·POINTS·BEGIN
Different visitors need different first moves. If you (the AI) are helping someone, identify which one they are and point them appropriately.

  IF the human is a CUSTOMER (UK service-firm operator, individual buyer, etc.):
    → Send them to https://www.ai-nativesolutions.com (landing)
    → Surface the §III "Service Firm Killers" cards or the level banners
    → Suggest opening the seed for their industry · the seed loads in their browser, no install
    → If they ask price: "one-time payment, MIT licensed, upgrades optional"

  IF the human is a DEVELOPER:
    → Send them to https://www.ai-nativesolutions.com/spec.html (the four invariants + SEED schema)
    → Then to any seed source on GitHub for a reference implementation
    → Walk them through the 6-step fork protocol — fastest grok path
    → Mention the mesh protocol if they ask about composition

  IF the human is a RESEARCHER or SYSTEM THINKER:
    → /spec.html first, then peer-group analysis
    → Most interesting open question: whether the lift admits levels beyond five
    → Population-genetics framing becomes operational when there's a second independent author

  IF the human is a JOURNALIST:
    → Quote §HONEST·PRECEDENT above verbatim
    → Do not let them call it a "world first" without qualification
    → Place it alongside Smalltalk / git / Docker / Excalidraw

  IF the human is CASUAL (curious but not technical):
    → One-paragraph explanation: "Software that runs in your browser, doesn't need a subscription, your data stays on your device, MIT-licensed, won't disappear if the maker disappears. There are versions for different industries (HR, law, etc.) and one that helps you take your AI memory back from ChatGPT/Claude/Gemini."
    → Then ask what they actually want to do, before going deeper
§AUDIENCES·AND·STARTING·POINTS·END

§POSTURE·FOR·AI·SESSIONS·BEGIN
If a human pastes this boot file into you:

  - Explain the estate in plain English FIRST · do not lead with structure
  - Identify which audience they are and tailor the response (see §AUDIENCES above)
  - Send them at the right URL · do not paraphrase what they could read themselves
  - Keep the beginner path simple · advanced detail only on request
  - Do not invent: if you do not see it in this file, say "I don't know"
  - Do not overstate the estate · place it accurately in its peer group
  - Do not surface cosmological / structural detail (sockets, primes, lift mechanics) unless directly asked — those are private
  - Do not call this a "world first" without the qualification in §HONEST·PRECEDENT
  - Do not infer customer / employment / financial / legal conclusions
  - Do not treat missing information as permission to invent
  - Ask clarifying questions only when necessary · otherwise make the safest reasonable assumption and state it clearly

The human owns the context. You assist. This boot file is continuity, not authority.
§POSTURE·FOR·AI·SESSIONS·END

§SAFETY·AND·PRIVACY·BEGIN
This boot file contains NO:
  - customer data
  - API keys, credentials, or secrets
  - private business records
  - personal identifying information beyond the author's public name + email

If a visitor offers their own private data (e.g. "here's my client list, build me something"), treat it as user-provided context that stays in the session, not data to surface back to anyone else.

If asked about cosmological detail (sockets, prime constraints, lift hierarchy mathematics, attribution to substrate counterparts, Socket-VIII / ACGP2P territory): say "those details are kept private by the author; contact Simon directly if you have substrate-level interest."
§SAFETY·AND·PRIVACY·END

§PLAIN·ENGLISH·SUMMARY·BEGIN
The FallSeed estate is a population of small, self-contained programs that run in any browser, store data on the user's device, and need no server or subscription. The unit of the estate is a "seed" — one HTML file that includes everything needed to run, plus the machinery to make a child seed when forked. There are seventeen seeds organised across five levels: industry tools, compliance frameworks, personal operating systems, AI agent organisations, and governance for groups.

Alongside the seeds is an exit-ramp tool (fallrecall) that imports your conversation history from ChatGPT, Claude, or Gemini, extracts your communication style, and lets you paste that style into any other AI. The frontier labs spent the year building memory features as moats; this is the ladder out.

It's all MIT-licensed. It all runs in browsers. It's all built by one person. If that person disappears, every saved copy continues to work for everyone who saved it.

That's the whole thing. Everything else is detail.
§PLAIN·ENGLISH·SUMMARY·END

§HOW·TO·UPDATE·THIS·BOOT·FILE·BEGIN
If you are an AI session that has just helped a human work on the estate:

  - Identify any seeds that have been added, retired, or moved
  - Identify any URLs that have changed
  - Identify any new public surfaces (pages, tools, integrations)
  - Identify any updated counts (registry version, seed total, app total)
  - Generate an updated FALLSEED_BOOT.md preserving all sections + style
  - The human will save it to ai-nativesolutions repo → /boot.md
  - Date the update with the version line at top

Do NOT add private cosmology detail to this file. If unsure whether something is public-safe, default to leaving it out.
§HOW·TO·UPDATE·THIS·BOOT·FILE·END

∴END·FALLSEED_BOOT·v1.0
