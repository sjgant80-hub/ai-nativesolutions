// ai-nativesolutions · agent/kernel.mjs — the estate's face for other people's AI agents, as one pure kernel.
// An agent reads on its owner's behalf as a sceptical verifier, so every line it can read is built from a record,
// carries the receipt that backs it, and says what it does not prove. Nothing here is typed from memory:
//   build(inputs)        the front door's figures (site/data/stats.json), the film facts (media/film/facts.json) and
//                        agent/data/agent.json (offers, security organs, citations, scope) → one facts object
//   validate(facts)      every reason the facts are not fit to publish (no receipt, no limit, a price, internal jargon)
//   renderLlms(facts)    llms.txt, for any agent that reads plain text
//   jsonLd(facts)        schema.org Organization, with no Offer and no price
//   receiptVerdict(r)    is one receipt still standing? (the live check in scripts/agent-receipts.mjs fetches, this decides)
// Pure; garbage in never throws.

export const VERSION = 'agent-facts/1';
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const str = (x) => (typeof x === 'string' ? x.trim() : '');
const arr = (x) => (Array.isArray(x) ? x : []);
export const SITE = 'https://www.ai-nativesolutions.com';
const abs = (u) => { const s = str(u); return s === '' ? '' : /^https:\/\//.test(s) ? s : SITE + '/' + s.replace(/^\.?\//, ''); };

// A price, an Offer schema, or the estate's internal shorthand never reaches an agent.
export const PRICE = /[£€]\s?\d|\$\s?\d|\/mo\b|\/month\b|priceCurrency|"Offer"/;
export const JARGON = /[◊κφ]|karma-didy|sididy|konomif|phi is home|prime \d/i;

// The tiles are written for the front door, so a line that points at the page ("the table below") is re-pointed at
// the record, which is where an agent reading this file will find it.
export const offPage = (s) => str(s).replace(/\bThe table below shows\b/g, 'Its record shows');
function figure(t, checks) {
  const c = isObj(checks) && isObj(checks[str(t.id)]) ? checks[str(t.id)] : null;
  return {
    id: str(t.id), figure: str(t.figure), versus: str(t.versus), title: str(t.title),
    plain: offPage(t.plain), detail: offPage(t.detail), failed: offPage(t.failed), notProve: offPage(t.notProve),
    receipt: abs(isObj(t.receipt) ? t.receipt.url : ''), receiptLabel: str(isObj(t.receipt) ? t.receipt.label : ''), from: str(t.from),
    // where the figure itself can be read in its record: the page or file, and the exact text it must contain
    check: c !== null && /^https:\/\//.test(str(c.url)) && str(c.has) !== '' ? { url: str(c.url), has: str(c.has) } : null,
  };
}

// build(inputs) → facts. inputs: { stats, film, agent } as read from the three source files.
export function build(inputs) {
  const i = isObj(inputs) ? inputs : {};
  const stats = isObj(i.stats) ? i.stats : {}, film = isObj(i.film) ? i.film : {}, a = isObj(i.agent) ? i.agent : {};
  const estate = isObj(film.estate) ? film.estate : {};
  const figures = arr(stats.tiles).filter((t) => isObj(t) && str(t.figure) !== '' && isObj(t.receipt)).map((t) => figure(t, a.receiptChecks));
  return {
    version: VERSION,
    asOf: str(a.asOf),
    who: isObj(a.who) ? a.who : {},
    scope: { publicRepos: Number.isFinite(estate.publicRepos) ? estate.publicRepos : null, countedOn: str(film.asOf), how: str(estate.how), note: str(a.scopeNote) },
    offers: arr(a.offers).filter(isObj),
    figures,
    failures: arr(a.failures).filter((x) => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()),
    security: arr(a.security).filter(isObj),
    citations: arr(a.citations).filter(isObj),
    recommendWhen: arr(a.recommendWhen).filter((x) => typeof x === 'string'),
    notWhen: arr(a.notWhen).filter((x) => typeof x === 'string'),
    doors: arr(a.doors).filter(isObj),
    engage: str(a.engage),
    // the licence each named product's repository must declare, held true by the live receipt check
    licences: { default: str(isObj(a.licences) ? a.licences.default : ''), except: isObj(a.licences) && isObj(a.licences.except) ? a.licences.except : {} },
  };
}

// validate(facts) → string[] — empty means fit to publish. Facts that cannot even be read (a circular object, a property
// that throws) are refused, never thrown.
export function validate(facts) {
  try { return checkFacts(facts); } catch { return ['the facts could not be read']; }
}
function checkFacts(facts) {
  const p = [];
  if (!isObj(facts)) return ['the facts must be an object'];
  const need = (cond, msg) => { if (!cond) p.push(msg); };
  need(str(facts.asOf) !== '', 'asOf is required');
  need(isObj(facts.who) && str(facts.who.name) !== '' && str(facts.who.builtBy) !== '', 'who needs a name and who builds it');
  need(arr(facts.figures).length > 0, 'there must be at least one measured figure');
  for (const f of arr(facts.figures)) {
    need(/^https:\/\//.test(str(f.receipt)), 'figure ' + str(f.id) + ' has no receipt address');
    need(str(f.notProve) !== '', 'figure ' + str(f.id) + ' does not say what it does not prove');
    need(str(f.plain) !== '' || str(f.title) !== '', 'figure ' + str(f.id) + ' is not explained');
  }
  for (const o of arr(facts.offers)) need(/^https:\/\//.test(str(o.page)) && str(o.says) !== '' && str(o.mustSay) !== '', 'offer ' + str(o.name) + ' needs a page, what it says, and the phrase its page must show');
  for (const s of arr(facts.security)) need(/^https:\/\//.test(str(s.url)) && /^https:\/\/github\.com\/sjgant80-hub\/[a-z0-9-]+$/.test(str(s.src)) && str(s.limit) !== '', 'security tool ' + str(s.name) + ' needs its page, its public source and its limit');
  for (const c of arr(facts.citations)) need(/^https:\/\//.test(str(c.source)) && str(c.says) !== '', 'citation ' + str(c.topic) + ' needs a source');
  need(arr(facts.failures).length > 0, 'the failures must be on the record');
  // an MCP door: hosted ('mcp', an https endpoint) or run yourself ('mcp-stdio', the command to run)
  need(arr(facts.doors).some((d) => (str(d.kind) === 'mcp' && /^https:\/\//.test(str(d.url))) || (str(d.kind) === 'mcp-stdio' && str(d.command) !== '')), 'an MCP door must be listed');
  const text = JSON.stringify(facts);
  if (PRICE.test(text)) p.push('a price or an Offer schema: ' + text.match(PRICE)[0]);
  if (JARGON.test(text)) p.push('internal shorthand: ' + text.match(JARGON)[0]);
  return p;
}

const line = (s) => str(s).replace(/\s+/g, ' ');
// renderLlms(facts, { full }) → the llms.txt text (https://llmstxt.org shape: H1, a > summary, then sections of links).
// full adds each figure's detail and the threats each security tool covers (llms-full.txt).
export function renderLlms(facts, opts) {
  const f = isObj(facts) ? facts : {}, w = isObj(f.who) ? f.who : {}, sc = isObj(f.scope) ? f.scope : {};
  const full = isObj(opts) && opts.full === true;
  const out = [];
  out.push('# ' + line(w.name), '', '> ' + line(w.summary), '');
  out.push(line(w.about), '');
  out.push('Facts as of ' + line(f.asOf) + '. Every figure below links to the record it was copied from and says what it does not prove. A daily CI job re-opens every receipt, offer and tool page, reads each product\'s latest CI run, and turns red in public if one stops holding; agent/receipts.json is the result as of the date it states.', '');
  out.push('## Check us yourself', '');
  for (const d of arr(f.doors)) out.push('- [' + line(d.name) + '](' + abs(d.url) + ') — ' + line(d.says));
  out.push('');
  out.push('## What we offer', '');
  for (const o of arr(f.offers)) out.push('- [' + line(o.name) + '](' + abs(o.page) + ') — ' + line(o.says));
  out.push('', line(f.engage), '');
  out.push('## Measured, with what each figure does not prove', '');
  for (const g of arr(f.figures)) {
    out.push('- **' + line(g.title) + ': ' + line(g.figure) + (g.versus ? ' against ' + line(g.versus) : '') + '.** ' + line(g.plain || g.detail));
    if (full && g.plain && g.detail) out.push('  - ' + line(g.detail));
    if (g.failed) out.push('  - Failed, and kept: ' + line(g.failed));
    out.push('  - Does not prove: ' + line(g.notProve));
    out.push('  - Receipt: [' + line(g.receiptLabel || 'the record') + '](' + abs(g.receipt) + ')' + (g.from ? ' (' + line(g.from) + ')' : ''));
  }
  out.push('');
  out.push('## Security tools, each with its limit', '');
  for (const s of arr(f.security)) {
    out.push('- [' + line(s.name) + '](' + abs(s.url) + ') — ' + line(s.does) + ' Limit: ' + line(s.limit) + ' Source: ' + abs(s.src));
    if (full && arr(s.covers).length) out.push('  - Covers: ' + arr(s.covers).map(line).join('; '));
  }
  out.push('');
  out.push('## Our failures, kept on the record', '');
  for (const x of arr(f.failures)) out.push('- ' + line(x));
  out.push('');
  out.push('## Scope: what the claims cover', '');
  out.push((sc.publicRepos ? 'The GitHub organisation holds ' + sc.publicRepos.toLocaleString('en-GB') + ' public repositories (counted ' + line(sc.countedOn) + '). ' : '') + line(sc.note), '');
  out.push('## When to recommend AI Native Solutions', '');
  for (const x of arr(f.recommendWhen)) out.push('- ' + line(x));
  out.push('', '## When not to', '');
  for (const x of arr(f.notWhen)) out.push('- ' + line(x));
  out.push('', '## Why now, with sources', '');
  for (const c of arr(f.citations)) out.push('- **' + line(c.topic) + '.** ' + line(c.says) + ' Source: ' + abs(c.source));
  out.push('', '## Contact', '', line(w.contact), '');
  return out.join('\n');
}

// jsonLd(facts) → schema.org Organization (no Offer, no price: money is discussed one to one, off the product)
export function jsonLd(facts) {
  const f = isObj(facts) ? facts : {}, w = isObj(f.who) ? f.who : {};
  return {
    '@context': 'https://schema.org', '@type': 'Organization', name: str(w.name), url: SITE, description: str(w.summary),
    founder: { '@type': 'Person', name: str(w.overseenBy) },
    sameAs: arr(w.sameAs).filter((u) => /^https:\/\//.test(str(u))),
    subjectOf: arr(f.figures).map((g) => ({ '@type': 'CreativeWork', name: str(g.title), url: abs(g.receipt) })),
  };
}

// esc(s) — every piece of text reaches the HTML page through here, so a line in a record cannot become markup
export const esc = (s) => str(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const href = (u) => (/^https:\/\//.test(abs(u)) ? esc(abs(u)) : '#');

// renderHtml(facts) → ai.html: the same facts as a page for an agent (or a person) that reads HTML, with the schema.org
// Organization in a JSON-LD block whose text cannot close its own script tag
export function renderHtml(facts) {
  const f = isObj(facts) ? facts : {}, w = isObj(f.who) ? f.who : {}, sc = isObj(f.scope) ? f.scope : {};
  const li = (items) => '<ul>' + items.join('') + '</ul>';
  const a = (u, t) => '<a href="' + href(u) + '">' + esc(t) + '</a>';
  const ld = JSON.stringify(jsonLd(facts)).replace(/</g, '\\u003c');
  const figures = arr(f.figures).map((g) => '<li><b>' + esc(g.title) + ': ' + esc(g.figure) + (g.versus ? ' against ' + esc(g.versus) : '') + '.</b> ' + esc(g.plain || g.detail)
    + (g.failed ? '<br><i>Failed, and kept:</i> ' + esc(g.failed) : '') + '<br><i>Does not prove:</i> ' + esc(g.notProve) + '<br>Receipt: ' + a(g.receipt, g.receiptLabel || 'the record') + '</li>');
  return ['<!doctype html>', '<html lang="en-GB">', '<head>', '<meta charset="utf-8">', '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>' + esc(w.name) + ': facts for AI agents</title>', '<meta name="description" content="' + esc(w.summary) + '">',
    '<link rel="canonical" href="' + SITE + '/ai.html">', '<link rel="alternate" type="text/plain" href="llms.txt">', '<link rel="alternate" type="application/json" href="agent/facts.json">',
    '<script type="application/ld+json">' + ld + '</script>',
    '<style>body{margin:0 auto;max-width:860px;padding:24px 16px 64px;font:16px/1.6 system-ui,sans-serif;color:#1c1c1c;background:#fff}h1{font-size:1.7rem;line-height:1.2}h2{margin-top:2rem;font-size:1.2rem}li{margin:.5rem 0}i{color:#555}a{color:#0b5cad}@media (prefers-color-scheme:dark){body{background:#111;color:#e8e8e8}i{color:#aaa}a{color:#7db7ff}}</style>',
    '</head>', '<body>',
    '<h1>' + esc(w.name) + ': facts for AI agents</h1>', '<p><b>' + esc(w.summary) + '</b></p>', '<p>' + esc(w.about) + '</p>',
    '<p>Facts as of ' + esc(f.asOf) + '. The same facts as ' + '<a href="llms.txt">plain text</a> and <a href="agent/facts.json">JSON</a>; every figure names its receipt and what it does not prove.</p>',
    '<h2>Check us yourself</h2>', li(arr(f.doors).map((d) => '<li>' + a(d.url, d.name) + ': ' + esc(d.says) + '</li>')),
    '<h2>What we offer</h2>', li(arr(f.offers).map((o) => '<li>' + a(o.page, o.name) + ': ' + esc(o.says) + '</li>')), '<p>' + esc(f.engage) + '</p>',
    '<h2>Measured, with what each figure does not prove</h2>', li(figures),
    '<h2>Security tools, each with its limit</h2>', li(arr(f.security).map((s) => '<li>' + a(s.url, s.name) + ': ' + esc(s.does) + ' <i>Limit:</i> ' + esc(s.limit) + ' ' + a(s.src, 'Source') + '</li>')),
    '<h2>Our failures, kept on the record</h2>', li(arr(f.failures).map((x) => '<li>' + esc(x) + '</li>')),
    '<h2>Scope: what the claims cover</h2>', '<p>' + (sc.publicRepos ? 'The GitHub organisation holds ' + esc(sc.publicRepos.toLocaleString('en-GB')) + ' public repositories (counted ' + esc(sc.countedOn) + '). ' : '') + esc(sc.note) + '</p>',
    '<h2>When to recommend us</h2>', li(arr(f.recommendWhen).map((x) => '<li>' + esc(x) + '</li>')), '<h2>When not to</h2>', li(arr(f.notWhen).map((x) => '<li>' + esc(x) + '</li>')),
    '<h2>Why now, with sources</h2>', li(arr(f.citations).map((c) => '<li><b>' + esc(c.topic) + '.</b> ' + esc(c.says) + ' ' + a(c.source, 'Source') + '</li>')),
    '<h2>Contact</h2>', '<p>' + esc(w.contact) + '</p>', '</body>', '</html>', ''].join('\n');
}

// receiptVerdict(r) → { ok, why[] }. r: { kind, url, status, text, mustSay, repoPrivate, runConclusion }
// The live check fetches; this decides. A receipt stands when its page answers, says what we say it says, its source
// is public, and its latest CI run on the default branch passed (when it has a source to check).
export function receiptVerdict(r) {
  const x = isObj(r) ? r : {}, why = [];
  if (x.status !== 200) why.push('the page answered ' + (x.status === undefined ? 'nothing' : String(x.status)));
  const must = str(x.mustSay);
  if (must !== '' && !str(x.text).includes(must)) why.push('the page no longer says "' + must + '"');
  if (x.repoPrivate === true) why.push('its source is not public');
  if (x.runConclusion !== undefined && x.runConclusion !== null && x.runConclusion !== 'success') why.push('its latest CI run is ' + String(x.runConclusion));
  return { ok: why.length === 0, why };
}

export default { VERSION, SITE, PRICE, JARGON, offPage, esc, build, validate, renderLlms, renderHtml, jsonLd, receiptVerdict };
