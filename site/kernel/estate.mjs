// site/kernel/estate.mjs — the law of the living estate (pure; no clock, no DOM, no network).
// The organism on the front door is drawn from the estate's real public index. This file decides, and is gated:
//   · which family a build belongs to (by its name, nothing cleverer)
//   · the organism's shape: the named organs first, then every other public build, and ONLY links that are real
//   · where each cell starts (a deterministic spiral, so every visitor sees the same organism grow)
//   · the simulation's script (which organ hands work to which, in what order): a picture, labelled as one
//   · which cell a pointer is on
// Total: junk in gives an empty, well-formed answer, never a throw.

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v : '');

/** FAMILIES, tried in order: the first whose test matches the build's name. The last one takes everything else. */
export const FAMILIES = Object.freeze([
  { id: 'kar', label: "Kar's verifiers", test: /^kar-/ },
  { id: 'konomi', label: 'the Konomi line', test: /^konomi/ },
  { id: 'mind', label: 'the running mind', test: /^(si-didy|sididy)/ },
  { id: 'seed', label: 'seeds that grow', test: /^(fallseed|seed-|living-seed|fall-spore)/ },
  { id: 'guild', label: 'guild and ledger', test: /^(kcc-|acg-)/ },
  { id: 'fall', label: 'the Fall tools', test: /^fall/ },
  { id: 'open', label: 'open water', test: /^/ },
]);
export const FAMILY_IDS = Object.freeze(FAMILIES.map((f) => f.id));

/** familyOf(name) → the index of the build's family in FAMILIES */
export function familyOf(name) {
  const n = str(name).toLowerCase();
  return FAMILIES.findIndex((f) => f.test.test(n));          // the last family's test matches anything, so one is always found
}

/** CHARACTERS an organ can play in the simulation */
export const CHARACTERS = Object.freeze(['organ', 'heart', 'gate', 'immune', 'library', 'night', 'here']);

/** shape(estate, organs) → { nodes, links, organCount, heart }
 *  estate: { nodes: [{ name, desc, url }] } (public builds only; the build script refuses anything else)
 *  organs: [{ id, char, links: [id…] }] — the named organs, each a real build in the estate
 *  nodes: [{ name, fam, organ, char }] organs first, in the order given; then every other build, by name
 *  links: [[a, b]] index pairs, a < b, each once: an organ's real links, plus the heart to every organ */
export function shape(estate, organs) {
  const src = isObj(estate) && Array.isArray(estate.nodes) ? estate.nodes.filter((n) => isObj(n) && str(n.name)) : [];
  const byName = new Map(src.map((n) => [n.name, n]));
  const list = (Array.isArray(organs) ? organs : []).filter((o) => isObj(o) && byName.has(o.id));
  const seen = new Set(), nodes = [];
  for (const o of list) {
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    nodes.push({ name: o.id, fam: familyOf(o.id), organ: true, char: CHARACTERS.includes(o.char) ? o.char : 'organ' });
  }
  const organCount = nodes.length;
  const rest = src.filter((n) => !seen.has(n.name)).map((n) => n.name).sort();
  for (const name of rest) { if (seen.has(name)) continue; seen.add(name); nodes.push({ name, fam: familyOf(name), organ: false, char: 'organ' }); }
  const at = new Map(nodes.map((n, i) => [n.name, i]));
  const heart = nodes.findIndex((n) => n.char === 'heart');
  const keys = new Set(), links = [];
  const add = (a, b) => {
    if (a === b) return;
    const lo = Math.min(a, b), hi = Math.max(a, b), k = lo + ':' + hi;
    if (keys.has(k)) return;
    keys.add(k); links.push([lo, hi]);
  };
  for (const o of list) for (const id of Array.isArray(o.links) ? o.links : []) if (at.has(id) && at.get(id) < organCount) add(at.get(o.id), at.get(id));
  if (heart !== -1) for (let i = 0; i !== organCount; i++) add(heart, i);
  return { nodes, links, organCount, heart };
}

/** mulberry32(seed) → a function giving the same stream of numbers in [0, 1) on every engine */
export function mulberry32(seed) {
  let a = Number.isFinite(seed) ? seed >>> 0 : 0;       // anything that is not a number seeds as 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const GOLDEN = 2.399963229728653;          // the golden angle, in radians
export const WORLD = Object.freeze({ organRing: 235, spread: 13 });
/** LAYOUT, one entry per family in FAMILIES order: where the family lives in the organism.
 *  A 'blob' gathers round a point; a 'ring' spreads round the centre at a radius. k: how firmly it is held there. */
export const LAYOUT = Object.freeze([
  { mode: 'blob', x: -455, y: -265, r: 0, k: 0.030 },
  { mode: 'blob', x: 455, y: -265, r: 0, k: 0.030 },
  { mode: 'blob', x: -500, y: 215, r: 0, k: 0.030 },
  { mode: 'blob', x: 500, y: 215, r: 0, k: 0.030 },
  { mode: 'blob', x: 0, y: 520, r: 0, k: 0.030 },
  { mode: 'ring', x: 0, y: 0, r: 390, k: 0.022 },
  { mode: 'ring', x: 0, y: 0, r: 660, k: 0.012 },
]);

/** seedPositions(nodes, organCount) → Float32Array [x, y, z, 0] per node: where each cell settles from.
 *  Organs sit on a golden spiral near the centre (the heart at the centre); every other build sits in its family's
 *  place (LAYOUT): on a spiral round a blob's point, or round a ring. z in [0, 1): how deep the cell sits. */
export function seedPositions(nodes, organCount) {
  const list = Array.isArray(nodes) ? nodes : [];
  const k = Math.min(list.length, Math.max(0, Number.isInteger(organCount) ? organCount : 0));
  const out = new Float32Array(list.length * 4);
  const perFam = new Array(FAMILIES.length).fill(0);
  const rnd = mulberry32(1618);
  for (let i = 0; i !== list.length; i++) {
    const n = list[i], fam = isObj(n) && Number.isInteger(n.fam) && n.fam >= 0 && n.fam < FAMILIES.length ? n.fam : FAMILIES.length - 1;
    let x, y;
    if (i < k) {
      const heart = isObj(n) && n.char === 'heart';
      const r = heart ? 0 : WORLD.organRing * Math.sqrt((i + 1) / (k + 1)) + 40;
      x = r * Math.cos(i * GOLDEN); y = r * Math.sin(i * GOLDEN);
    } else {
      const j = perFam[fam]++, L = LAYOUT[fam];
      if (L.mode === 'ring') {
        const r = L.r + ((j % 7) - 3) * WORLD.spread;
        x = r * Math.cos(j * GOLDEN); y = r * Math.sin(j * GOLDEN);
      } else {
        const r = WORLD.spread * Math.sqrt(j + 1);
        x = L.x + r * Math.cos(j * GOLDEN); y = L.y + r * Math.sin(j * GOLDEN);
      }
    }
    out[i * 4] = x; out[i * 4 + 1] = y; out[i * 4 + 2] = i < k ? 0.1 + 0.2 * rnd() : rnd(); out[i * 4 + 3] = 0;
  }
  return out;
}

/** The simulation's script. One beat = one hand-off the picture shows. Deterministic, endless, and honest about what
 *  it is: a picture of how the organs work together, not telemetry.
 *  script(cast) → the repeating list of beats; cast: { heart, gate, immune, library, night, workers: [index…] }
 *  beat: { kind, from, to, tone, say } — say is the plain-words caption */
export const BEAT_KINDS = Object.freeze(['route', 'check', 'keep', 'refuse', 'learn', 'night']);
export function script(cast) {
  const c = isObj(cast) ? cast : {};
  const ok = (v) => Number.isInteger(v) && v >= 0;
  const workers = (Array.isArray(c.workers) ? c.workers : []).filter(ok);
  if (!ok(c.heart) || !ok(c.gate) || workers.length === 0) return [];
  const beats = [];
  workers.forEach((w, i) => {
    beats.push({ kind: 'route', from: c.heart, to: w, tone: 'work', say: 'Kar hands a job to the organ that owns it.' });
    beats.push({ kind: 'check', from: w, to: c.gate, tone: 'work', say: 'The work goes to the gate before anyone may call it done.' });
    if (i % 4 === 3 && ok(c.immune)) {
      beats.push({ kind: 'refuse', from: c.gate, to: c.immune, tone: 'refuse', say: 'The gate refuses it. The failure is kept and shown, never hidden.' });
      beats.push({ kind: 'learn', from: c.immune, to: c.heart, tone: 'learn', say: 'The immune system remembers the shape, so the next one like it is caught on sight.' });
    } else {
      beats.push({ kind: 'keep', from: c.gate, to: ok(c.library) ? c.library : c.heart, tone: 'keep', say: 'It passed. What was proven is kept in the library.' });
    }
    if (i % 5 === 4 && ok(c.night) && ok(c.library)) beats.push({ kind: 'night', from: c.night, to: c.library, tone: 'learn', say: 'Overnight the loop studies what was kept, and tests itself again.' });
  });
  return beats;
}

/** castOf(shape) → the simulation's cast, read from the shape's characters */
export function castOf(s) {
  const nodes = isObj(s) && Array.isArray(s.nodes) ? s.nodes : [];
  const k = Math.min(nodes.length, Math.max(0, isObj(s) && Number.isInteger(s.organCount) ? s.organCount : 0));
  const organs = nodes.slice(0, k);                      // only the organs are ever cast
  const first = (ch) => organs.findIndex((n) => isObj(n) && n.char === ch);
  const workers = [];
  organs.forEach((n, i) => { if (isObj(n) && n.char === 'organ') workers.push(i); });
  return { heart: first('heart'), gate: first('gate'), immune: first('immune'), library: first('library'), night: first('night'), workers };
}

/** pick(pos, count, x, y, radius, organCount) → the index of the cell under a point, or -1.
 *  pos: [x, y, …] with `stride` numbers per cell, already in screen space. An organ within reach wins over a nearer
 *  ordinary cell (organs are the ones with something to say). */
export function pick(pos, count, x, y, radius, organCount, stride = 2) {
  // (a count below one, or a pointer that is not a number, finds nothing below without needing a guard of its own)
  if (!pos || !Number.isInteger(count) || !(radius > 0) || !Number.isInteger(stride) || stride < 2) return -1;
  const k = Number.isInteger(organCount) ? organCount : 0;
  const n = Math.min(count, Math.floor(pos.length / stride));
  let best = -1, bestD = radius * radius, bestOrgan = -1, bestOrganD = radius * radius * 2.25;
  for (let i = 0; i < n; i++) {
    const dx = pos[i * stride] - x, dy = pos[i * stride + 1] - y, d = dx * dx + dy * dy;
    if (i < k) { if (d <= bestOrganD) { bestOrganD = d; bestOrgan = i; } } else if (d <= bestD) { bestD = d; best = i; }
  }
  return bestOrgan !== -1 ? bestOrgan : best;
}

/** counts(estate) → { builds, live }: the numbers the page prints, counted here from the same data the organism draws */
export function counts(estate) {
  const src = isObj(estate) && Array.isArray(estate.nodes) ? estate.nodes.filter((n) => isObj(n) && str(n.name)) : [];
  return { builds: src.length, live: src.filter((n) => str(n.url)).length };
}

export default { FAMILIES, FAMILY_IDS, CHARACTERS, BEAT_KINDS, GOLDEN, WORLD, LAYOUT, familyOf, shape, mulberry32, seedPositions, script, castOf, pick, counts };
