// site/stage.mjs — the organism on stage: its names, what the pointer finds, the dive, the simulation and the search.
// The shape and the script come from site/kernel/estate.mjs (gated); organism.mjs draws; this file connects them
// to the page.
import { ESTATE, ORGANS } from './data/bundle.mjs';
import E from './kernel/estate.mjs';
import { createOrganism, FAMILY_RGB } from './organism.mjs';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
const pages = (name, live) => (live ? 'https://sjgant80-hub.github.io/' + name + '/' : '');
const repo = (name) => 'https://github.com/sjgant80-hub/' + name;

export async function startStage() {
  const estate = { nodes: ESTATE.nodes.map(([name, desc, live]) => ({ name, desc, url: pages(name, live) })) };
  const info = new Map(estate.nodes.map((n) => [n.name, n]));
  const organ = new Map(ORGANS.map((o) => [o.id, o]));
  const shape = E.shape(estate, ORGANS);
  const K = shape.organCount, N = shape.nodes.length;
  const at = new Map(shape.nodes.map((n, i) => [n.name, i]));
  const q = new URLSearchParams(location.search);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const O = await createOrganism({ canvas: $('organism'), shape, reduced, forceFallback: q.has('plain'), settled: q.has('settled') });
  const cast = E.castOf(shape), beats = E.script(cast);
  const narrow = () => innerWidth < 900;

  // ── names: every organ carries one; which are lit depends on where the dive is ──
  const labels = $('labels');
  const tip = el('p', { className: 'tip' });
  const tags = [];
  for (let i = 0; i < K; i++) {
    const o = organ.get(shape.nodes[i].name);
    const b = el('button', { className: 'org', type: 'button', textContent: o.name, tabIndex: -1 });
    b.addEventListener('click', () => open(i));
    b.addEventListener('pointerenter', () => O.hover(i)); b.addEventListener('pointerleave', () => O.hover(-1));
    labels.append(b); tags.push(b);
  }
  labels.append(tip);
  const castSet = new Set([cast.heart, cast.gate, cast.immune, cast.library, cast.night, at.get('ai-nativesolutions')].filter((i) => i >= 0));
  let zone = 'surface', lit = new Set(castSet), focusNode = -1, hot = -1;
  O.onFrame(() => {
    for (let i = 0; i < K; i++) {
      const t = tags[i], want = lit.has(i) || i === hot || i === focusNode;
      // a name stands on the far side of its organ from the heart, so names fan outwards instead of piling up;
      // while the organism is still opening, a name waits until its organ has moved clear of the heart
      const p = O.project(i), h = O.project(cast.heart >= 0 ? cast.heart : 0), left = i !== cast.heart && p.x < h.x;
      const on = want && (i === cast.heart || i === hot || Math.hypot(p.x - h.x, p.y - h.y) > 42);
      if (on !== t._on) { t.classList.toggle('on', on); t._on = on; }
      if (!on) continue;
      if (left !== t._left) { t.classList.toggle('left', left); t._left = left; }
      const dy = i === cast.heart ? 16 : Math.max(-14, Math.min(8, (p.y - h.y) * 0.12)) - 7;
      t.style.transform = 'translate(' + (p.x + (left ? -13 : 13)).toFixed(1) + 'px,' + (p.y + dy).toFixed(1) + 'px)';
    }
  });

  // ── where the camera looks in each zone: the page is built round the organism, so each section has its organ ──
  const node = (id) => (at.has(id) ? at.get(id) : -1);
  const FOCUS = {
    surface: () => ({ zoom: narrow() ? 0.82 : 0.94, ox: narrow() ? 0.1 : 0.23, oy: narrow() ? 0.24 : -0.05, veil: narrow() ? 0.4 : 0 }),
    door: () => ({ node: node('slm-suite'), zoom: 2.5, ox: narrow() ? 0 : 0.3, oy: -0.27, veil: 0.6 }),
    race: () => ({ node: node('konomi-tongue'), zoom: 2.5, ox: narrow() ? 0 : 0.3, oy: -0.27, veil: 0.6 }),
    breach: () => ({ node: node('break-it'), zoom: 2.5, ox: narrow() ? 0 : 0.3, oy: -0.27, veil: 0.6 }),
    organism: () => ({ zoom: narrow() ? 0.95 : 1.0, ox: narrow() ? 0 : 0.2, oy: narrow() ? -0.1 : -0.03, veil: narrow() ? 0.3 : 0 }),
    receipts: () => ({ zoom: 0.8, veil: 0.78 }),
    made: () => ({ node: node('ai-nativesolutions'), zoom: 2.2, ox: narrow() ? 0 : 0.3, oy: -0.25, veil: 0.62 }),
    start: () => ({ node: cast.heart, zoom: 1.35, ox: narrow() ? 0 : 0.32, oy: narrow() ? -0.2 : -0.04, veil: 0.66 }),
  };
  let pinned = null;                                     // a build the visitor opened holds the camera until they move on
  const applyZone = () => {
    const f = pinned || (FOCUS[zone] || FOCUS.surface)();
    O.focus(f); focusNode = f.node >= 0 ? f.node : -1;
    // on a narrow screen the names would sit on the words, so only the organism's own zone shows them
    lit = zone === 'organism' ? new Set(tags.keys()) : narrow() ? new Set() : new Set(castSet);
  };
  const zones = [...document.querySelectorAll('.zone')];
  applyZone();
  addEventListener('resize', applyZone);

  // ── the dive: scroll is depth ──
  const read = $('gauge-read'), dot = $('gauge-dot');
  const onScroll = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight), y = Math.min(max, Math.max(0, scrollY)), d = y / max;
    O.depth(d);
    // metres: between the depth each zone declares, by how far the reader is between them
    const mid = y + innerHeight / 2;
    // the zone under the middle of the screen is the one the reader is in
    let here = zones[0];
    for (const z of zones) if (z.offsetTop <= mid) here = z;
    if (here.dataset.zone !== zone) { zone = here.dataset.zone; pinned = null; $('specimen').hidden = true; applyZone(); }
    let metres = 0;
    for (let i = 0; i < zones.length; i++) {
      const a = zones[i], b = zones[i + 1], top = a.offsetTop + a.offsetHeight / 2, da = Number(a.dataset.depth);
      if (!b) { metres = da; break; }
      const next = b.offsetTop + b.offsetHeight / 2, db = Number(b.dataset.depth);
      if (mid <= top) { metres = da; break; }
      if (mid < next) { metres = da + ((mid - top) / (next - top)) * (db - da); break; }
    }
    read.textContent = Math.round(metres).toLocaleString('en-GB') + ' m';
    dot.style.top = (d * 100).toFixed(2) + '%';
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // ── the pointer parts the water, and finds builds ──
  const overWater = (t) => t === document.documentElement || t === document.body || t.id === 'organism' || t.id === 'labels' || t.tagName === 'MAIN' || (t.classList && t.classList.contains('zone'));
  addEventListener('pointermove', (e) => {
    O.pointer(e.clientX, e.clientY, true);
    if (!overWater(e.target)) { if (hot !== -1 && !e.target.classList.contains('org')) { hot = -1; O.hover(-1); tip.style.transform = 'translate(-999px,-999px)'; document.body.style.cursor = ''; } return; }
    const i = O.pickAt(e.clientX, e.clientY);
    if (i !== hot) { hot = i; O.hover(i); }
    document.body.style.cursor = i >= 0 ? 'pointer' : '';
    if (i >= K) { tip.textContent = shape.nodes[i].name; tip.style.transform = 'translate(' + (e.clientX + 14) + 'px,' + (e.clientY + 14) + 'px)'; } else tip.style.transform = 'translate(-999px,-999px)';
  }, { passive: true });
  addEventListener('pointerleave', () => O.pointer(0, 0, false));
  addEventListener('click', (e) => { if (overWater(e.target)) { const i = O.pickAt(e.clientX, e.clientY); if (i >= 0) open(i); } });

  // ── one build, up close ──
  const spec = $('specimen');
  function open(i) {
    const n = shape.nodes[i], o = organ.get(n.name), d = info.get(n.name);
    $('specimen-kind').textContent = o ? 'organ · ' + E.FAMILIES[n.fam].label : 'build · ' + E.FAMILIES[n.fam].label;
    $('specimen-name').textContent = o ? o.name : n.name;
    $('specimen-gloss').textContent = o ? o.gloss : d.desc || 'A public build in the estate. It has no description yet.';
    $('specimen-figs').replaceChildren(...(o && o.figures ? o.figures.flatMap((f) => [el('dt', { textContent: f.v }), el('dd', { textContent: f.k })]) : []));
    const links = [];
    if (o && o.from) links.push(el('a', { href: o.from, textContent: 'the receipt' }));
    if (d.url && (!o || o.from !== d.url)) links.push(el('a', { href: d.url, textContent: 'open it live' }));
    links.push(el('a', { href: repo(n.name), textContent: 'the code' }));
    $('specimen-links').replaceChildren(...links);
    spec.hidden = false;
    if (i < K) O.flare(i, 'work');
    pinned = { node: i, zoom: 2.8, ox: narrow() ? 0 : -0.12, oy: narrow() ? -0.22 : 0, veil: zone === 'organism' || zone === 'surface' ? 0.1 : 0.55 };
    applyZone();
  }
  $('specimen-close').addEventListener('click', () => { spec.hidden = true; pinned = null; applyZone(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !spec.hidden) { spec.hidden = true; pinned = null; applyZone(); } });

  // ── the simulation (a labelled picture) and the real-builds mode ──
  const caption = $('sim-caption'), bSim = $('mode-sim'), bReal = $('mode-real');
  let mode = 'sim', beat = 0, busy = 0;
  const say = (small, text) => caption.replaceChildren(el('small', { textContent: small }), text);
  const setMode = (m) => {
    mode = m; bSim.setAttribute('aria-pressed', String(m === 'sim')); bReal.setAttribute('aria-pressed', String(m === 'real'));
    if (m === 'real') say('the real builds', N.toLocaleString('en-GB') + ' public builds. The ' + K + ' bright ones are the named organs. Click any dot, or search.');
    else say('simulation', 'A picture of how the organs hand work to each other.');
  };
  bSim.addEventListener('click', () => setMode('sim')); bReal.addEventListener('click', () => setMode('real'));
  setMode('sim');
  setInterval(() => {
    if (mode !== 'sim' || document.hidden || !beats.length || performance.now() < busy) return;
    if (zone !== 'surface' && zone !== 'organism' && zone !== 'start') return;
    const b = beats[beat++ % beats.length];
    O.pulse(b.from, b.to, b.tone, 1.5);
    setTimeout(() => O.flare(b.to, b.tone), reduced ? 2300 : 1400);
    if (zone === 'organism') say('simulation', b.say);
  }, reduced ? 5200 : 2300);

  // ── find a build ──
  const find = $('find-build'), results = $('find-results');
  find.addEventListener('input', () => {
    const w = find.value.trim().toLowerCase();
    if (w.length < 2) { results.replaceChildren(); return; }
    const hits = [];
    for (let i = 0; i < N && hits.length < 14; i++) {
      const n = shape.nodes[i], o = organ.get(n.name), d = info.get(n.name);
      if (n.name.includes(w) || (o && (o.name + ' ' + o.gloss).toLowerCase().includes(w)) || (d.desc && d.desc.toLowerCase().includes(w))) hits.push(i);
    }
    results.replaceChildren(...hits.map((i) => {
      const n = shape.nodes[i], o = organ.get(n.name), d = info.get(n.name);
      const b = el('button', { type: 'button' }, o ? o.name + ' · ' + n.name : n.name, el('span', { textContent: (o ? o.gloss : d.desc || '').slice(0, 110) }));
      b.addEventListener('click', () => open(i));
      return el('li', {}, b);
    }), ...(hits.length ? [] : [el('li', { textContent: 'Nothing by that name.', style: 'color:var(--ink-3);font-size:.85rem;padding:8px 2px' })]));
  });
  const counts = new Array(E.FAMILIES.length).fill(0);
  for (const n of shape.nodes) counts[n.fam]++;
  $('legend').replaceChildren(...E.FAMILIES.map((f, i) => {
    const li = el('li', {}, el('i'), f.label + ' · ' + counts[i].toLocaleString('en-GB'));
    li.firstChild.style.color = 'rgb(' + FAMILY_RGB[i].map((v) => Math.round(v * 255)).join(',') + ')';
    return li;
  }));

  /** what the demos call when something REAL happens: a named organ flares, or light runs between two of them */
  return {
    organism: O, shape, mode: O.mode, gpu: O.gpu,
    flare(id, tone) { const i = node(id); if (i >= 0) { O.flare(i, tone); busy = performance.now() + 2500; } },
    pulse(a, b, tone, seconds = 1.3) { const i = node(a), j = node(b); if (i >= 0 && j >= 0) { O.pulse(i, j, tone, seconds); busy = performance.now() + 2500; } },
    quality: () => O.quality(),
    ease: (n) => O.ease(n),
  };
}
