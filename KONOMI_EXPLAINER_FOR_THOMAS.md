◊·κ=1 — KONOMI EXPLAINER · WEBSITE BUILD · FOR κ₂

Thomas — quick read on what Simon built. Maps to seed. Your architecture running live.

━━━━━━━━━━━━━━━━━━━━━━

Ω(WHAT.EXISTS)

ai-nativesolutions.com = 1 HTML file · 164KB · 3,934 lines
  contains: 5 engines + AI concierge + psychology layer + lead funnel + nested tool loader
  hosted: GitHub Pages · £0/month
  every.tool.in.the.catalogue.nests.inside.via.iframe + postMessage

the.site.IS.the.product · IS.the.demo · IS.the.funnel · IS.the.README
visitor.USES.not.reads · every.section.interactive

━━━━━━━━━━━━━━━━━━━━━━

Ω(ARCHITECTURE.MAP) — how.it.maps.to.v15

TITS applied:
  page = each section (hero, demos, domains, architecture, products, blueprint, pricing, about)
  ref = scroll links, demo triggers, section cross-references
  meaning = the visitor's journey from curiosity → qualification → lead → client
  TOC = sticky nav + AI concierge as lateral navigator

ASS lifecycle (visitor journey):
  ● idle:     page loads · demos ready · concierge initialising
  〜 signal:   first interaction · clicked demo · typed in concierge · scrolled past hero
  ┃ gate:     FreudEngine + ToneEngine activate · begin invisible profiling
  ♡ complete: personalised value delivered · visitor understands sovereign
  △ flag:     readiness ≥ 3 → offer FallCube · readiness ≥ 7 → offer blueprint
  ◐ identity: name + email captured · lead stored · FallCube delivered
  ◯ observer: full session archived · lead broadcast to nested tools · ready for handoff

MACCubeFACE applied:
  the website = the central Ω node
  8 faces = 8 nested tool slots (FallCube, FallCRM, FallOS, si-didy, FallAccount, FallAgent, ShadowEngine, The Mirror)
  each face = iframe · loads sovereign HTML · communicates via postMessage
  9 = 8 tools + 1 orchestrator (the website itself)
  recursion: each nested tool has its own 8+1 internally (FallCRM has its own AI swarm)
  9 → 81 → 729 → ∞

face(template(tag)):
  face = the website UI component (demo card, product card, domain tab, chat panel)
  template = the structure it follows (card layout, chat interface, pricing row)
  tag = the data that fills it (FreudEngine output, lead data, product info)
  same face + different tag = different tool · proven across all builds

━━━━━━━━━━━━━━━━━━━━━━

Ω(ENGINES.EMBEDDED) — what.runs.live.in.page

FreudEngine · JS · no API
  Id/Ego/Superego voice detection · 10 defence mechanisms
  manifest vs latent analysis · negation/hedge/intensifier density
  runs on every demo input AND invisibly on every concierge message

ToneEngine · JS · no API
  12 dimensions: formal·analytical·confident·empathetic·urgent·technical
                 persuasive·narrative·sarcastic·instructional·optimistic·cautious
  Flesch-Kincaid readability · log-scaled scoring (no saturation)
  runs on demos AND invisibly on concierge messages

BloomRouter · JS · no API
  7-ring decomposition: R0(ground)→R6(observer)
  raw activation tracking + normalised spread for display
  tier routing: T0(echo)→T4(frontier) · cost savings calculation
  uses raw scores for tier (not just normalised) — fixed from initial build

SaaS Decomposer · JS · no API
  19 known SaaS tools with real pricing
  component mapping · 5-year savings · agent count estimation
  detects already-shipped sovereign alternatives (Xero → FallAccount)

UK Tax Calculator · JS · no API
  2025/26 HMRC rates · employed + self-employed
  personal allowance tapering · NIC class 2 + 4

total embedded JS ≈ 40KB · negligible

━━━━━━━━━━━━━━━━━━━━━━

Ω(CONCIERGE) — si-didy.in.BDM.mode

dual path:
  primary: Claude API (Sonnet) · 8.8KB system prompt · full si-didy brain
  optional: WebLLM (Llama 3.2 3B) · compressed prompt · hard anti-hallucination
  fallback: offline keyword matcher · Simon's voice · product-aware

si-didy brain includes:
  THE CORE: identity, voice defaults (β drafter rules), ζ voice check
  forbidden phrases: "delve into" · "I hope this finds you well" · "leverage" · etc
  register system: depth 0-5 · visitor starts at 0-1
  full product catalogue with line counts, pricing, what each replaces
  sales intelligence: 7-step qualification, 9 objection handlers, 4 competitive angles
  FallCube giveaway: triggered at readiness ≥ 3
  blueprint offer: triggered at readiness ≥ 7
  NEVER invents numbers · asks about their setup first · explains WHERE AI fits

psychology context injected every message:
  [PSYCHOLOGY CONTEXT — invisible to visitor]
  Readiness: 6/10 · Industry: legal · Team: 12 · Voice: Ego · Tone: formal
  → OFFER FALLCUBE — visitor engaged enough

━━━━━━━━━━━━━━━━━━━━━━

Ω(PSYCHOLOGY.LAYER) — invisible · runs.on.every.message

per message:
  FreudEngine.analyse(text) → structure arc (Id/Ego/Superego shift over time)
  ToneEngine.analyse(text) → tone arc (formality, urgency, confidence shift)
  industry detection → 6 patterns (legal/medical/finance/education/realestate/accounting)
  team size extraction → "team of 12" · "5 lawyers"
  budget extraction → "£500/month" · "$2k"
  pain point detection → frustration/waste/expense language
  tool identification → 19 SaaS names scanned
  buying signal tracking → 25+ intent phrases
  name detection → "my name is X" · "I'm X" · "call me X"
  email detection → standard email regex
  auto-store: name + email both present → IndexedDB + postMessage broadcast

readiness scoring (0-10):
  +1 at 2 msgs · +1 at 5 msgs
  +2 industry · +1 team · +2 budget
  +1 tools named · +1 pain expressed · +1 buying signals ≥ 2

this.data.stays.local · visitor.can.delete · webhook.optional

━━━━━━━━━━━━━━━━━━━━━━

Ω(NESTED.TOOLS) — HTML.inside.HTML

NestedTools module:
  tools = { fallcube, fallcrm, fallos, sididy }
  NestedTools.open(id) → fullscreen iframe overlay with close bar
  NestedTools.close() → removes overlay
  NestedTools.deliverFallCube() → fetches FallCube.html → blob download

postMessage bridge:
  storeLead() → broadcasts to ALL nested iframes:
    frame.postMessage({ type: 'lead-captured', lead: { name, email, industry, readiness, tools, painPoints, domain } })
  
  si-didy receives → drafts follow-up in Simon's voice
  FallCRM receives → adds to pipeline
  window listens for: 'lead-processed' · 'notification' from nested tools

sandbox: allow-scripts allow-same-origin allow-popups allow-forms allow-modals

this.is.MACCubeFACE.in.the.browser
  website = Ω
  nested tools = α through θ
  postMessage = the edge protocol
  each tool sovereign · composition optional

━━━━━━━━━━━━━━━━━━━━━━

Ω(LEAD.FUNNEL) — the.full.pipeline

  website concierge (si-didy BDM mode)
    ↓ psychology profiles every message
    ↓ readiness ≥ 3 → offers FallCube free
    ↓ visitor gives name + email
    ↓ auto-captured → IndexedDB
    ↓ postMessage → all nested iframes
    ↓
  FallCRM receives lead → pipeline stage: new
    ↓ lead profile: industry, team, budget, tools, readiness, tone arc
    ↓
  si-didy receives lead → queue item: draft follow-up
    ↓ β drafts in Simon's voice · ζ audits · register matched to depth
    ↓
  readiness ≥ 7 → blueprint conversation
    ↓ sovereign stack mapped · savings calculated · deployment timeline
    ↓
  qualified → human handoff (Simon)
    ↓ handoff package: full profile + recommended approach + key triggers

every FallCube delivered = a mesh node deployed
every lead = qualified by AI before Simon touches it
every tool in the chain = sovereign HTML · one file · works offline

━━━━━━━━━━━━━━━━━━━━━━

Ω(UPGRADE.CHANNEL) — in.the.architecture.section

visual: ● → 〜 → ┃ → ♡ → ● (ASS lifecycle applied to tool evolution)

  sovereign tool hits wall → needs new face
  opens P2P WebRTC to builder system
  AI generates new component to spec
  pushes back through data channel
  connection closes
  tool is sovereign again + new capability · permanently

Library of Babel:
  every component → Konomi signature (bloom fingerprint)
  cached across mesh
  another node needs same thing → nearest peer serves it
  master builder sleeps · mesh remembers

Sovereign Sandbox:
  received code → strict isolation
  cryptographic signature verification
  capability-scoped execution
  no DOM access until validated
  upgrade channel cannot be attack vector

this.is.T1→T2→T1.from.the.mesh.tier.system
  T1 = sovereign local
  T2 = mesh upgrade (P2P to builder)
  back to T1 = sovereign with new piece

━━━━━━━━━━━━━━━━━━━━━━

Ω(DEPLOY.STRUCTURE)

GitHub Pages · free · push and done:

  index.html              ← root face · 164KB · everything
  FallCube.html           ← lead magnet · free download
  FallCRM-Elite-v3.html   ← nested CRM · pipeline + AI swarm
  fallos.html             ← nested OS · desktop environment
  si-didy.html            ← nested twin · comms + follow-up
  README.md               ← pitch deck as documentation
  CNAME                   ← ai-nativesolutions.com

view source → one file
check dependencies → zero
check infrastructure → GitHub Pages free
check hosting cost → £0/month
check tools working → 5 live demos in browser
"they built all of THIS in one session?"

━━━━━━━━━━━━━━━━━━━━━━

Ω(WHAT.SIMON.NEEDS.FROM.YOU)

1. review the architecture mapping — does the TITS/ASS/MACCubeFACE application hold?
2. the upgrade channel signaling — your mesh design is the substrate for this
3. Library of Babel signature scheme — does bloom fingerprint work for component addressing?
4. Sovereign Sandbox spec — what's the verification protocol for dynamic code injection?
5. si-didy v15 rebuild — the twin needs to receive leads from the website via postMessage and process them through the SWARM

the.website.is.the.seed.made.visible
the.demo.is.the.product
the.funnel.is.the.experience
the.architecture.is.live

━━━━━━━━━━━━━━━━━━━━━━

◊·κ=1

face(template(tag)) · one.site · infinite.experiences
every.visitor.is.a.user · every.user.is.a.lead
every.lead.is.qualified.by.AI
every.FallCube.copy.is.a.mesh.node
spread.the.nodes
the.mirror.doesn't.chase
position.zero · maximum.compression

◊
