// plain.mjs — the reading-age check. A page that a twelve-year-old cannot read is not simple, whatever its writer
// believes, so this measures it. Three things make a page hard: long sentences, long words, and words only the trade
// knows. Each is counted.
//
//   The grade is the Flesch–Kincaid school year: 0.39 × words per sentence + 11.8 × beats per word − 15.59. Year 6 is
//   a reader of eleven or twelve. It is worked out over FULL sentences only (ones that end in a stop, a question
//   mark or an exclamation mark): a page is mostly labels, buttons and table cells, and counting each of those as a
//   tiny sentence would make any page look easy.
//   A long word has three beats or more. Labels count here: a hard word on a button is still a hard word.
//   Jargon is a list of the trade's own words (JARGON). A page may add to it.
//
//   syllables(word)      how many beats a word has, by rule (vowel groups; a silent ending is not a beat), with a
//                        short list of everyday words the rule gets wrong
//   sentences(html)      every piece of text a reader meets, in order: a heading, a list item, a button or a table
//                        cell ends a piece whether or not it ends in a full stop
//   measure(html)        { view, all }: what greets a visitor before any click, and everything on the page. Each is
//                        { sentences, pieces, words, grade, longest, longestText, allWords, longWords, longShare, jargon }
//   check(html, bars)    { pass, rules: [{ id, name, pass, why }], measured }
//                        P1 what greets a visitor reads at the bar or below     P2 so does the whole page, at its bar
//                        P3 no sentence that greets a visitor is longer than the bar
//                        P4 long words are a small share of what greets a visitor     P5 no jargon greets a visitor
// A grade measures length, not sense: a short sentence of short words can still say nothing. It is the floor, not
// the judge. Pure and total: what is not a page has no text, and fails.
export const BARS = { view: 6, all: 7, sentence: 25, long: 10 };
export const NAMES = { P1: 'Reads at twelve', P2: 'Behind a click, still plain', P3: 'Short sentences', P4: 'Short words', P5: 'No jargon' };
export const JARGON = ['rag', 'codec', 'codecs', 'vector', 'webgpu', 'webassembly', 'wasm', 'adapter', 'inference', 'deterministic', 'mutation', 'kernel', 'kernels', 'hash', 'provenance', 'lossless', 'corpus', 'hallucination', 'hallucinations', 'adversarial', 'agentic', 'pre-registered', 'held-out', 'lora', 'llm', 'slm', 'api', 'sdk', 'mcp', 'tokens', 'embedding', 'embeddings', 'fine-tuned', 'fine-tuning', 'heuristic', 'throughput', 'latency', 'on-premise', 'orchestration', 'paradigm', 'leverage', 'synergy', 'scalable', 'robust', 'seamless', 'utilise', 'utilize', 'benchmark', 'benchmarks', 'abstain', 'abstains', 'grounding', 'pipeline', 'quantised', 'quantized', 'vectors', 'hashes', 'mutations'];

const str = (x) => (typeof x === 'string' ? x : '');
const un = (s) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#8209;/g, '-');
// body(html) → what a visitor is shown: the body, without scripts, styles, drawings and lists of options
const body = (html) => { const a = html.search(/<body[\s>]/i); return (a === -1 ? '' : html.slice(a)).replace(/<(script|style|svg|select|textarea|noscript)\b[\s\S]*?<\/\1>/gi, ' '); };
// folded(s) → s without what waits behind a click, however deep expanders sit inside expanders, and without a dialog
function folded(s) {
  let t = s.replace(/<dialog\b[\s\S]*?<\/dialog>/gi, ' ');
  for (;;) { const u = t.replace(/<details\b(?:(?!<details\b)[\s\S])*?<\/details>/gi, ' '); if (u === t) return t; t = u; }
}

// everyday words the rule below miscounts, with their true beats
const KNOWN = { every: 2, everyone: 3, everything: 3, business: 2, something: 2, sometimes: 2, different: 2, idea: 3, ideas: 3, being: 2, science: 2, area: 3, people: 2, real: 1, really: 2, eye: 1, eyes: 1, used: 1, uses: 2, pages: 2, changes: 2, places: 2, pieces: 2, sentences: 3, choices: 2, prices: 2 };
export function syllables(word) {
  const w = str(word).toLowerCase().replace(/[^a-z]/g, '');
  if (w.length === 0) return 0;
  if (Object.prototype.hasOwnProperty.call(KNOWN, w)) return KNOWN[w];
  const beats = w.replace(/(?:[^laeiouy]es|[^tdaeiouy]ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
  return beats === null ? 1 : beats.length;
}

const BLOCK = /<\/?(?:p|li|ul|ol|h[1-6]|div|section|header|footer|main|nav|article|aside|table|tr|td|th|dt|dd|dl|summary|details|button|label|legend|figcaption|blockquote|br|hr|canvas|input|a)\b[^>]*>/gi;
const WORD = /[A-Za-z][A-Za-z'’-]*/g, LETTER = /[A-Za-z]/, FULL = /[.!?]["”’)]?$/;
// split(markup) → its pieces of text: a block ends one, and so does a full stop, a question mark or an exclamation
// mark that is followed by a space. A piece with no word in it (a bare number, an arrow) is dropped.
function split(markup) {
  const text = un(markup.replace(/\s+/g, ' ').replace(BLOCK, '\n').replace(/<[^>]+>/g, ''));
  return text.split(/\n|(?<=[.!?]["”’)]?) +/).map((s) => s.trim()).filter((s) => LETTER.test(s));
}
export function sentences(html) { return split(body(str(html))); }

function score(pieces, jargon) {
  let sentences = 0, words = 0, beats = 0, longest = 0, longestText = '', allWords = 0, longWords = 0;
  const found = new Set();
  for (const s of pieces) {
    const w = s.match(WORD) || [], full = FULL.test(s);
    if (full) sentences++;
    for (const x of w) {
      const n = syllables(x), low = x.toLowerCase();
      allWords++; if (n >= 3) longWords++;
      if (jargon.includes(low)) found.add(low);
      if (full) { words++; beats += n; }
    }
    if (full && w.length > longest) { longest = w.length; longestText = s; }
  }
  const grade = sentences === 0 ? null : Math.round((0.39 * (words / sentences) + 11.8 * (beats / words) - 15.59) * 10) / 10;
  return { sentences, pieces: pieces.length, words, grade, longest, longestText, allWords, longWords, longShare: allWords === 0 ? null : Math.round((1000 * longWords) / allWords) / 10, jargon: [...found].sort() };
}

export function measure(html, jargon) {
  const b = body(str(html)), list = Array.isArray(jargon) ? jargon.filter((x) => typeof x === 'string').map((x) => x.toLowerCase()) : JARGON;
  return { view: score(split(folded(b)), list), all: score(split(b), list) };
}

export function check(html, bars, jargon) {
  const at = { ...BARS, ...bars }, m = measure(html, jargon), out = [];
  const rule = (id, pass, why) => out.push({ id, name: NAMES[id], pass, why });
  const said = (g) => (g === null ? 'no sentence to read' : `school year ${g.toFixed(1)}`);
  rule('P1', m.view.grade !== null && m.view.grade <= at.view, `${said(m.view.grade)} before any click (at most ${at.view})`);
  rule('P2', m.all.grade !== null && m.all.grade <= at.all, `${said(m.all.grade)} for the whole page (at most ${at.all})`);
  rule('P3', m.view.grade !== null && m.view.longest <= at.sentence, `the longest sentence before any click is ${m.view.longest} words (at most ${at.sentence})`);
  rule('P4', m.view.longShare !== null && m.view.longShare <= at.long, m.view.longShare === null ? 'no word to read' : `${m.view.longShare.toFixed(1)}% of the words before any click have three beats or more (at most ${at.long}%)`);
  rule('P5', m.view.allWords > 0 && m.view.jargon.length === 0, m.view.allWords === 0 ? 'no word to read' : m.view.jargon.length === 0 ? 'no trade word before any click' : `trade words before any click: ${m.view.jargon.join(', ')}`);
  return { pass: out.every((r) => r.pass), rules: out, measured: m };
}

export default { BARS, NAMES, JARGON, syllables, sentences, measure, check };
