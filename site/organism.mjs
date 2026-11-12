// site/organism.mjs — the living estate, drawn.
// One organism, fixed behind the whole page. Every cell is a real public build (site/kernel/estate.mjs decides the
// shape; this file only draws it). In WebGPU:
//   · the layout never stops: a compute shader moves every cell each frame (families hold together, organs keep
//     their distance, a slow current carries the plankton, the pointer parts the water)
//   · cells breathe; depth is real (nearer cells are larger and brighter); the dive (page scroll) darkens the water
//   · a pulse of light along a link, a flare round an organ: each is one event the page reported (a demo ran, a test
//     passed, a beat of the labelled simulation)
//   · HDR, bloom, tone map
// Without WebGPU the same shape is drawn on a 2D canvas, with a lighter version of the same forces: plainer, and real.
import E from './kernel/estate.mjs';

const TONES = Object.freeze({ work: 0, keep: 1, refuse: 2, learn: 3 });
const TRANSIENT = 28;                 // spare link slots for hand-offs between organs that share no standing link
const DUST = 1400;
const CHAR_CODE = Object.freeze({ organ: 0, heart: 1, gate: 2, immune: 3, library: 4, night: 5, here: 6 });
export const PERSP = 0.55;
// family colours (linear-ish RGB, 0..1): cold bioluminescence, one warm family
export const FAMILY_RGB = Object.freeze([[0.30, 1.0, 0.86], [0.66, 0.56, 1.0], [1.0, 0.74, 0.42], [0.48, 1.0, 0.66], [0.46, 0.70, 1.0], [0.20, 0.66, 1.0], [0.26, 0.52, 0.62]]);
const TONE_RGB = Object.freeze([[0.45, 0.95, 1.0], [0.5, 1.0, 0.62], [1.0, 0.30, 0.34], [0.78, 0.62, 1.0]]);

const wgslVec = (list) => 'array<vec3f, ' + list.length + '>(' + list.map((c) => 'vec3f(' + c.map((x) => x.toFixed(3)).join(', ') + ')').join(', ') + ')';

const COMMON = /* wgsl */`
struct Cam { a: vec4f, b: vec4f, c: vec4f, d: vec4f };   // a: centre.xy zoom time · b: res.xy offset.xy · c: depth veil persp breath · d: pointer.xy hover organs
@group(0) @binding(0) var<uniform> cam: Cam;
const FAM = ${wgslVec(FAMILY_RGB)};
const TONE = ${wgslVec(TONE_RGB)};
fn persp(z: f32) -> f32 { return 1.0 / (1.0 + cam.c.z * z); }
fn toPx(w: vec2f, z: f32) -> vec2f { return (w - cam.a.xy) * cam.a.z * persp(z) + cam.b.zw; }
fn toClip(px: vec2f) -> vec4f { return vec4f(px.x / (cam.b.x * 0.5), -px.y / (cam.b.y * 0.5), 0.0, 1.0); }
fn corner(vi: u32) -> vec2f { var q = array<vec2f, 6>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)); return q[vi]; }
fn hash1(n: f32) -> f32 { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
fn hash2(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn noise(p: vec2f) -> f32 { let i = floor(p); let f = fract(p); let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2f(1.0, 0.0)), u.x), mix(hash2(i + vec2f(0.0, 1.0)), hash2(i + vec2f(1.0, 1.0)), u.x), u.y); }
`;

const SIM = /* wgsl */`
struct Sim { a: vec4f, b: vec4f, anchors: array<vec4f, 8> };   // a: dt time count organs · b: links pointer.xy pointerK · anchors: x y ring k
@group(0) @binding(0) var<uniform> S: Sim;
@group(0) @binding(1) var<storage, read> src: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> dst: array<vec4f>;
@group(0) @binding(3) var<storage, read> cells: array<vec4f>;      // z size family char
@group(0) @binding(4) var<storage, read> links: array<vec4u>;     // a b rest transient
@compute @workgroup_size(64)
fn step(@builtin(global_invocation_id) g: vec3u) {
  let i = g.x; let n = u32(S.a.z);
  if (i >= n) { return; }
  let organs = u32(S.a.w);
  let me = src[i]; var p = me.xy; var v = me.zw; let m = cells[i];
  let isOrgan = i < organs;
  var f = vec2f(0.0);
  for (var j = 0u; j < organs; j++) {                       // every cell keeps clear of the organs
    if (j == i) { continue; }
    var reach = 64.0; var k = 140.0;
    if (isOrgan) { reach = 135.0; k = 420.0; }
    let d = p - src[j].xy; let r2 = dot(d, d);
    if (r2 < reach * reach) { let r = sqrt(r2) + 0.5; f += (d / r) * k * (1.0 - r / reach); }
  }
  if (!isOrgan) {                                           // plankton never push an organ around; each frame a cell
    let ph = u32(S.b.x) >> 16u;                             // checks a third of the others, at three times the push
    for (var j = organs + ((i + ph) % 3u); j < n; j += 3u) {
      if (j == i) { continue; }
      let d = p - src[j].xy; let r2 = dot(d, d);
      if (r2 < 900.0) { let r = sqrt(r2) + 0.5; f += (d / r) * 90.0 * (1.0 - r / 30.0); }
    }
  }
  if (isOrgan) {
    f += -p * select(0.02, 0.6, m.w == 1.0);              // organs lean to the centre; the heart is held there
    let L = u32(S.b.x) & 0xffffu;
    for (var e = 0u; e < L; e++) {
      let lk = links[e];
      if (lk.w != 0u) { continue; }
      var o = 0xffffffffu;
      if (lk.x == i) { o = lk.y; } else if (lk.y == i) { o = lk.x; }
      if (o != 0xffffffffu) { let d = src[o].xy - p; let r = length(d) + 0.001; f += (d / r) * (r - f32(lk.z)) * 0.035; }
    }
  } else {
    let A = S.anchors[u32(m.z)];
    if (A.z > 0.0) { let r = length(p) + 0.001; f += (p / r) * (A.z - r) * A.w * 60.0; f += vec2f(-p.y, p.x) / r * 1.4; }
    else { f += (A.xy - p) * A.w * 60.0; }
  }
  let t = S.a.y;
  let ang = sin(p.y * 0.0041 + t * 0.21) * 2.1 + cos(p.x * 0.0037 - t * 0.17) * 2.3 + m.x * 6.283;
  f += vec2f(cos(ang), sin(ang)) * select(9.0, 2.0, isOrgan);
  let dp = p - S.b.yz; let pr = length(dp);
  if (S.b.w > 0.0 && pr < 150.0) { f += (dp / (pr + 0.01)) * S.b.w * (1.0 - pr / 150.0); }
  let dt = S.a.x;
  v = (v + f * dt) * 0.90;
  let sp = length(v);
  if (sp > 90.0) { v = v * (90.0 / sp); }
  dst[i] = vec4f(p + v * dt, v);
}`;

const SCENE = COMMON + /* wgsl */`
@group(0) @binding(1) var<storage, read> pos: array<vec4f>;
@group(0) @binding(2) var<storage, read> cells: array<vec4f>;      // z size family char
@group(0) @binding(3) var<storage, read> fx: array<vec4f>;        // excite tone 0 0   (organs only carry any)
@group(0) @binding(4) var<storage, read> links: array<vec4u>;
@group(0) @binding(5) var<storage, read> linkFx: array<vec4f>;    // start duration tone direction

// ── the water ──
struct VBg { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
@vertex fn vsBg(@builtin(vertex_index) vi: u32) -> VBg {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var o: VBg; o.pos = vec4f(p[vi], 0.0, 1.0); o.uv = p[vi] * 0.5 + 0.5; return o;
}
@fragment fn fsBg(i: VBg) -> @location(0) vec4f {
  let depth = cam.c.x; let t = cam.a.w;
  let uv = vec2f(i.uv.x, 1.0 - i.uv.y);                    // y down the screen
  let top = mix(vec3f(0.0020, 0.0170, 0.0300), vec3f(0.0006, 0.0022, 0.0060), depth);
  let bottom = mix(vec3f(0.0005, 0.0030, 0.0070), vec3f(0.0008, 0.0005, 0.0026), depth);
  var col = mix(top, bottom, smoothstep(0.0, 1.0, uv.y));
  // light from the surface: slow shafts that fade as the dive goes down
  let sx = uv.x * 5.0 + uv.y * 1.3;
  let shafts = pow(noise(vec2f(sx + t * 0.03, t * 0.02)), 3.0) * pow(1.0 - uv.y, 2.2);
  col += vec3f(0.010, 0.050, 0.062) * shafts * pow(1.0 - depth, 3.0);
  // the organism's own glow in the water round it
  let c = (toPx(vec2f(0.0), 0.3) / cam.b.xy) + 0.5;
  let d = length((uv - c) * vec2f(cam.b.x / cam.b.y, 1.0));
  let glow = exp(-d * d * 3.2);
  col += mix(vec3f(0.0016, 0.0110, 0.0150), vec3f(0.0050, 0.0030, 0.0130), depth) * glow * (0.9 + 0.1 * sin(t * 0.9));
  col *= 0.85 + 0.3 * noise(uv * vec2f(3.0, 2.0) + vec2f(t * 0.01, -t * 0.013));
  return vec4f(col, 1.0);
}

// ── marine snow: plankton too small to be builds; it only shows that the water moves, and that you are diving ──
struct VDust { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) a: f32 };
@vertex fn vsDust(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VDust {
  let n = f32(ii); let layer = hash1(n * 1.7);                 // 0 far … 1 near
  let par = mix(0.25, 1.4, layer);
  var p = vec2f(hash1(n), hash1(n + 71.0));
  let t = cam.a.w;
  p.y = fract(p.y - t * 0.006 * par - cam.c.x * 2.2 * par);    // the dive lifts the snow past you
  p.x = fract(p.x + sin(t * 0.11 + n) * 0.012 - cam.a.x * 0.00018 * par);
  let px = (p - 0.5) * cam.b.xy * 1.15;
  let size = mix(0.45, 1.25, layer * layer) * (cam.b.y / 900.0 + 0.4);
  var o: VDust; let c = corner(vi);
  o.pos = toClip(px + c * size * 3.0); o.uv = c; o.a = mix(0.012, 0.11, layer) * (0.6 + 0.4 * sin(t * 0.7 + n * 3.1));
  return o;
}
@fragment fn fsDust(i: VDust) -> @location(0) vec4f {
  let r = length(i.uv); let a = exp(-r * r * 5.0) * i.a;
  return vec4f(vec3f(0.42, 0.78, 0.86) * a * (1.0 - cam.c.y * 0.6), 1.0);
}

// ── links: a faint thread between two organs, and the light that travels it when work really moves ──
struct VLink { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) k: vec4f };
@vertex fn vsLink(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VLink {
  let lk = links[ii]; let a = pos[lk.x]; let b = pos[lk.y];
  let pa = toPx(a.xy, cells[lk.x].x); let pb = toPx(b.xy, cells[lk.y].x);
  let dir = pb - pa; let len = length(dir) + 0.001; let nrm = vec2f(-dir.y, dir.x) / len;
  let c = corner(vi); let u = c.x * 0.5 + 0.5;
  let w = 5.0;
  var o: VLink; o.pos = toClip(mix(pa, pb, u) + nrm * c.y * w); o.uv = vec2f(u, c.y);
  let f = linkFx[ii]; o.k = vec4f(f.x, f.y, f.z, f.w * select(1.0, -1.0, lk.w != 0u));   // w<0: transient (no standing thread)
  return o;
}
@fragment fn fsLink(i: VLink) -> @location(0) vec4f {
  let across = exp(-i.uv.y * i.uv.y * 9.0);
  var col = vec3f(0.0);
  let transient = i.k.w < 0.0;
  if (!transient) { col += vec3f(0.10, 0.42, 0.50) * across * 0.05 * (1.0 - cam.c.y * 0.5); }
  if (i.k.y > 0.0) {
    let ph = (cam.a.w - i.k.x) / i.k.y;
    if (ph >= 0.0 && ph <= 1.0) {
      let e = ph * ph * (3.0 - 2.0 * ph);
      let at = select(e, 1.0 - e, abs(i.k.w) > 1.5);              // direction 2 runs b → a
      let d = i.uv.x - at;
      let head = exp(-d * d * 900.0) + 0.35 * exp(-d * d * 60.0) * step(d * select(1.0, -1.0, abs(i.k.w) > 1.5), 0.0);
      col += TONE[u32(i.k.z)] * head * across * 2.4;
      col += TONE[u32(i.k.z)] * across * 0.10 * sin(ph * 3.14159);
    }
  }
  return vec4f(col, 1.0);
}

// ── cells ──
struct VCell { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) col: vec3f, @location(2) k: vec4f, @location(3) tone: vec3f };
@vertex fn vsCell(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VCell {
  let p = pos[ii]; let m = cells[ii]; let f = fx[ii];
  let organ = f32(ii) < cam.d.w;
  let t = cam.a.w;
  let breath = 1.0 + cam.c.w * sin(t * 1.05 - length(p.xy) * 0.0065 + m.x * 2.0);
  let k = persp(m.x);
  var core = m.y * breath * k * cam.a.z;
  core = max(core, select(1.15, 3.0, organ) * (cam.b.y / 900.0 * 0.5 + 0.5));
  let hover = select(0.0, 1.0, f32(ii) == cam.d.z);
  let spread = select(4.2, 6.5, organ);
  let c = corner(vi);
  var o: VCell;
  o.pos = toClip(toPx(p.xy, m.x) + c * core * spread * (1.0 + 0.25 * hover));
  o.uv = c * spread;
  let fam = FAM[u32(m.z)];
  var col = mix(fam, vec3f(1.0), select(0.0, 0.22, organ));
  if (m.w == 1.0) { col = vec3f(1.0, 0.93, 0.78); }             // the heart runs warm
  let fade = mix(1.0, 0.34, m.x) * (1.0 - cam.c.y * 0.55);
  o.col = col * fade * select(0.9, 1.0, organ) * (1.0 + 0.9 * hover + 1.4 * f.x);
  o.k = vec4f(f.x, select(0.0, 1.0, organ), m.w, hover);
  o.tone = TONE[u32(f.y)];
  return o;
}
@fragment fn fsCell(i: VCell) -> @location(0) vec4f {
  let r = length(i.uv);
  var col = vec3f(0.0);
  if (i.k.y < 0.5) {                                              // plankton: a bright grain and a breath of light round it
    col = i.col * (exp(-r * r * 1.3) * 2.3 + exp(-r * 1.3) * 0.17);
  } else {                                                        // organs: nucleus, bell, membrane; a ring when something happens
    let nucleus = exp(-r * r * 7.0) * 2.2;
    let bell = exp(-r * r * 0.9) * 0.34;
    let dm = (r - 1.7) / 0.11;
    let mem = exp(-dm * dm) * 0.42;
    let far = exp(-r * 0.95) * 0.07;
    col = i.col * (nucleus + bell + mem + far);
    if (i.k.x > 0.001) {
      let rr = mix(6.2, 1.6, i.k.x);
      let dr = (r - rr) / 0.22;
      col += i.tone * exp(-dr * dr) * i.k.x * 1.6;
      col += i.tone * (nucleus * 0.5 + bell) * i.k.x * 1.2;
    }
  }
  return vec4f(col, 1.0);
}`;

const POST = /* wgsl */`
struct P { a: vec4f, b: vec4f };            // a: texel.xy strength time · b: veil depth 0 0
@group(0) @binding(0) var<uniform> U: P;
@group(0) @binding(1) var smp: sampler;
@group(0) @binding(2) var src: texture_2d<f32>;
struct V { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) vi: u32) -> V {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var o: V; o.pos = vec4f(p[vi], 0.0, 1.0); o.uv = vec2f(p[vi].x * 0.5 + 0.5, 0.5 - p[vi].y * 0.5); return o;
}
@fragment fn down(i: V) -> @location(0) vec4f {
  let t = U.a.xy;
  var c = textureSample(src, smp, i.uv) * 4.0;
  c += textureSample(src, smp, i.uv + vec2f(-t.x, -t.y)); c += textureSample(src, smp, i.uv + vec2f(t.x, -t.y));
  c += textureSample(src, smp, i.uv + vec2f(-t.x, t.y)); c += textureSample(src, smp, i.uv + vec2f(t.x, t.y));
  return c / 8.0;
}
@fragment fn bright(i: V) -> @location(0) vec4f {
  let t = U.a.xy;
  var c = textureSample(src, smp, i.uv) * 4.0;
  c += textureSample(src, smp, i.uv + vec2f(-t.x, -t.y)); c += textureSample(src, smp, i.uv + vec2f(t.x, -t.y));
  c += textureSample(src, smp, i.uv + vec2f(-t.x, t.y)); c += textureSample(src, smp, i.uv + vec2f(t.x, t.y));
  c = c / 8.0;
  let l = max(c.r, max(c.g, c.b));
  return vec4f(c.rgb * smoothstep(0.10, 0.75, l), 1.0);
}
@fragment fn up(i: V) -> @location(0) vec4f {
  let t = U.a.xy * 0.5;
  var c = textureSample(src, smp, i.uv + vec2f(-t.x * 2.0, 0.0)) + textureSample(src, smp, i.uv + vec2f(t.x * 2.0, 0.0));
  c += textureSample(src, smp, i.uv + vec2f(0.0, -t.y * 2.0)) + textureSample(src, smp, i.uv + vec2f(0.0, t.y * 2.0));
  c += (textureSample(src, smp, i.uv + vec2f(-t.x, -t.y)) + textureSample(src, smp, i.uv + vec2f(t.x, -t.y))
      + textureSample(src, smp, i.uv + vec2f(-t.x, t.y)) + textureSample(src, smp, i.uv + vec2f(t.x, t.y))) * 2.0;
  return vec4f(c.rgb / 12.0 * U.a.z, 1.0);
}`;
const FINAL = /* wgsl */`
struct P { a: vec4f, b: vec4f };
@group(0) @binding(0) var<uniform> U: P;
@group(0) @binding(1) var smp: sampler;
@group(0) @binding(2) var scene: texture_2d<f32>;
@group(0) @binding(3) var bloom: texture_2d<f32>;
struct V { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) vi: u32) -> V {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var o: V; o.pos = vec4f(p[vi], 0.0, 1.0); o.uv = vec2f(p[vi].x * 0.5 + 0.5, 0.5 - p[vi].y * 0.5); return o;
}
fn aces(x: vec3f) -> vec3f { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3f(0.0), vec3f(1.0)); }
@fragment fn fs(i: V) -> @location(0) vec4f {
  var c = textureSample(scene, smp, i.uv).rgb + textureSample(bloom, smp, i.uv).rgb * U.a.z;
  c = aces(c * 1.25);
  let q = i.uv - 0.5;
  c *= 1.0 - dot(q, q) * 0.85;                                   // the dark at the edge of the lamp
  c *= mix(1.0, 0.42, U.b.x);                                    // the veil: the page dims the water where words must be read
  let g = fract(sin(dot(i.uv * 913.0 + U.a.w, vec2f(12.9898, 78.233))) * 43758.5453) - 0.5;
  c += g * 0.012;
  return vec4f(pow(c, vec3f(1.0 / 2.2)), 1.0);
}`;

/** what the page gives the organism, and what it gets back:
 *  createOrganism({ canvas, shape, reduced, forceFallback }) → {
 *    mode: 'webgpu' | 'canvas', gpu: adapter description,
 *    focus({ node, x, y, zoom, ox, oy, veil }), depth(0..1), pointer(clientX, clientY, on), hover(i),
 *    pulse(a, b, tone, seconds), flare(i, tone), project(i) → { x, y, k } in CSS pixels, pickAt(clientX, clientY) → index,
 *    onFrame(fn), quality(), pause(bool), destroy() } */
export async function createOrganism(opts) {
  let { canvas } = opts;
  const { shape } = opts;
  const N = shape.nodes.length, K = shape.organCount;
  const seeds = E.seedPositions(shape.nodes, K);
  const rnd = E.mulberry32(77);
  const meta = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const n = shape.nodes[i], organ = i < K;
    meta[i * 4] = seeds[i * 4 + 2];
    meta[i * 4 + 1] = organ ? (n.char === 'heart' ? 11 : n.char === 'organ' ? 6.2 + rnd() * 1.6 : 8.5) : 1.5 + rnd() * rnd() * 2.6;
    meta[i * 4 + 2] = n.fam;
    meta[i * 4 + 3] = CHAR_CODE[n.char] || 0;
  }
  const realLinks = shape.links.length, LINKS = realLinks + TRANSIENT;
  const linkData = new Uint32Array(LINKS * 4), linkFx = new Float32Array(LINKS * 4);
  shape.links.forEach(([a, b], e) => {
    const heartLink = a === shape.heart || b === shape.heart;
    linkData.set([a, b, heartLink ? 150 : 110, 0], e * 4);
  });
  for (let e = realLinks; e < LINKS; e++) linkData.set([0, 0, 0, 1], e * 4);
  const linkAt = new Map(shape.links.map(([a, b], e) => [a + ':' + b, e]));
  let nextTransient = 0;

  // shared state both renderers read
  const S = {
    cam: { x: 0, y: 0, zoom: 0.5, ox: 0, oy: 0, veil: 0 }, target: { node: -1, x: 0, y: 0, zoom: 1, ox: 0, oy: 0, veil: 0 },
    depth: 0, pointer: { x: 0, y: 0, on: false }, hover: -1, t0: performance.now(), time: 0, paused: false,
    excite: new Float32Array(K), tone: new Uint8Array(K), cpu: new Float32Array(seeds), frameFns: [], w: 1, h: 1, dpr: 1, scale: 1,
    frames: [], reduced: !!opts.reduced, every: 1, tick: 0,
  };
  const api = {
    mode: 'canvas', gpu: '',
    focus(f) { Object.assign(S.target, { node: -1, x: 0, y: 0, ox: 0, oy: 0, veil: 0 }, f); },
    depth(d) { S.depth = Math.min(1, Math.max(0, d)); },
    pointer(cx, cy, on) { const r = canvas.getBoundingClientRect(); S.pointer = { x: cx - r.left, y: cy - r.top, on: !!on }; },
    hover(i) { S.hover = Number.isInteger(i) ? i : -1; },
    pulse(a, b, tone = 'work', seconds = 1.5) {
      if (!(a >= 0 && b >= 0 && a < K && b < K) || a === b) return;
      const lo = Math.min(a, b), hi = Math.max(a, b);
      let e = linkAt.get(lo + ':' + hi);
      if (e === undefined) { e = realLinks + (nextTransient++ % TRANSIENT); linkData.set([lo, hi, 0, 1], e * 4); api._linksDirty = true; }
      linkFx.set([S.time, S.reduced ? seconds * 1.6 : seconds, TONES[tone] ?? 0, a === lo ? 1 : 2], e * 4);
      api._fxDirty = true;
    },
    flare(i, tone = 'work') { if (i >= 0 && i < K) { S.excite[i] = 1; S.tone[i] = TONES[tone] ?? 0; } },
    project(i) {
      if (!(i >= 0 && i < N)) return null;
      const z = meta[i * 4], k = 1 / (1 + PERSP * z);
      return { x: S.w / 2 + (S.cpu[i * 4] - S.cam.x) * S.cam.zoom * k + S.cam.ox, y: S.h / 2 + (S.cpu[i * 4 + 1] - S.cam.y) * S.cam.zoom * k + S.cam.oy, k };
    },
    pickAt(cx, cy) {
      const r = canvas.getBoundingClientRect(), x = cx - r.left, y = cy - r.top;
      const scr = api._scr || (api._scr = new Float32Array(N * 2));
      for (let i = 0; i < N; i++) { const p = api.project(i); scr[i * 2] = p.x; scr[i * 2 + 1] = p.y; }
      return E.pick(scr, N, x, y, 13, K, 2);
    },
    onFrame(fn) { S.frameFns.push(fn); },
    pause(p) { S.paused = !!p; },
    /** ease(n): draw one frame in n (1 = every frame). The page eases the organism off while the model needs the graphics card. */
    ease(n) { S.every = Number.isInteger(n) && n >= 1 ? n : 1; },
    quality() { const f = S.frames; return { fps: f.length > 1 ? ((f.length - 1) * 1000) / (f[f.length - 1] - f[0]) : 0, scale: S.scale, cells: N, organs: K, links: realLinks }; },
    destroy() { api._dead = true; },
    _linksDirty: false, _fxDirty: false, _dead: false, _scr: null,
  };

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    S.w = Math.max(1, r.width); S.h = Math.max(1, r.height);
    S.dpr = Math.min(window.devicePixelRatio || 1, 1.5) * S.scale;
    const w = Math.max(2, Math.round(S.w * S.dpr)), h = Math.max(2, Math.round(S.h * S.dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; return true; }
    return false;
  };
  const baseZoom = () => Math.min(S.w, S.h * 1.25) / 1500;
  const tickCamera = (dt) => {
    const T = S.target, c = S.cam;
    let tx = T.x, ty = T.y;
    if (T.node >= 0 && T.node < N) { tx = S.cpu[T.node * 4]; ty = S.cpu[T.node * 4 + 1]; }
    const k = 1 - Math.exp(-dt * (S.reduced ? 8 : 2.2));
    c.x += (tx - c.x) * k; c.y += (ty - c.y) * k;
    c.zoom += (baseZoom() * (T.zoom || 1) - c.zoom) * k;
    c.ox += ((T.ox || 0) * S.w - c.ox) * k; c.oy += ((T.oy || 0) * S.h - c.oy) * k;
    c.veil += ((T.veil || 0) - c.veil) * k;
    for (let i = 0; i < K; i++) if (S.excite[i] > 0) S.excite[i] = Math.max(0, S.excite[i] - dt * 0.75);
  };
  const pointerWorld = () => ({ x: S.cam.x + (S.pointer.x - S.w / 2 - S.cam.ox) / S.cam.zoom, y: S.cam.y + (S.pointer.y - S.h / 2 - S.cam.oy) / S.cam.zoom });
  resize(); S.cam.zoom = baseZoom();

  let adapter = null;
  if (!opts.forceFallback && typeof navigator !== 'undefined' && navigator.gpu) {
    try { adapter = await navigator.gpu.requestAdapter(); } catch { adapter = null; }
  }
  if (adapter) {
    try { await startGPU(adapter); api.mode = 'webgpu'; return api; }
    catch (e) { console.warn('WebGPU organism could not start, drawing on a 2D canvas instead:', e && e.message ? e.message : e); freshCanvas(); }
  }
  startCanvas();
  return api;

  // a canvas that has held a WebGPU context cannot give a 2D one: swap in a clean copy
  function freshCanvas() { const c = canvas.cloneNode(false); canvas.replaceWith(c); canvas = c; }

  // ════ WebGPU ════════════════════════════════════════════════════════════════════════════════════════════════
  async function startGPU(adapter) {
    const device = await adapter.requestDevice();
    const ctx = canvas.getContext('webgpu');
    if (!ctx) throw new Error('no webgpu context');
    const format = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device, format, alphaMode: 'opaque' });
    api.gpu = (adapter.info && [adapter.info.vendor, adapter.info.architecture, adapter.info.description].filter(Boolean).join(' ')) || 'WebGPU';
    let lost = false;
    device.lost.then(() => { lost = true; });
    device.pushErrorScope('validation');
    const U = GPUBufferUsage, HDR = 'rgba16float';
    const buf = (size, usage, data) => { const b = device.createBuffer({ size: Math.max(16, size), usage }); if (data) device.queue.writeBuffer(b, 0, data); return b; };
    // the organism opens like a flower: every cell starts half-way in and swims out to its place (half-unfurled, so it is
    // recognisable from the first frame however slowly the frames come)
    const start = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) { const s = S.reduced || opts.settled ? 1 : 0.5; start[i * 4] = seeds[i * 4] * s + (rnd() - 0.5) * 6; start[i * 4 + 1] = seeds[i * 4 + 1] * s + (rnd() - 0.5) * 6; }
    S.cpu.set(start); for (let i = 0; i < N; i++) { S.cpu[i * 4 + 2] = 0; S.cpu[i * 4 + 3] = 0; }
    const posBuf = [buf(N * 16, U.STORAGE | U.COPY_DST | U.COPY_SRC, start), buf(N * 16, U.STORAGE | U.COPY_DST | U.COPY_SRC, start)];
    const metaBuf = buf(N * 16, U.STORAGE | U.COPY_DST, meta);
    const fxData = new Float32Array(N * 4), fxBuf = buf(N * 16, U.STORAGE | U.COPY_DST, fxData);
    const linkBuf = buf(LINKS * 16, U.STORAGE | U.COPY_DST, linkData), linkFxBuf = buf(LINKS * 16, U.STORAGE | U.COPY_DST, linkFx);
    const camData = new Float32Array(16), camBuf = buf(64, U.UNIFORM | U.COPY_DST);
    const simData = new Float32Array(8 + 32), simBuf = buf(simData.byteLength, U.UNIFORM | U.COPY_DST);
    E.LAYOUT.forEach((L, f) => simData.set([L.x, L.y, L.mode === 'ring' ? L.r : 0, L.k], 8 + f * 4));
    const readBuf = buf(N * 16, U.MAP_READ | U.COPY_DST);
    let reading = false;

    const mod = (code, label) => { const m = device.createShaderModule({ code, label }); m.getCompilationInfo().then((info) => { for (const x of info.messages) if (x.type === 'error') console.warn('shader ' + label + ' ' + x.lineNum + ':' + x.linePos + ' ' + x.message); }); return m; };
    const simMod = mod(SIM, 'layout'), sceneMod = mod(SCENE, 'scene');
    const postMod = mod(POST, 'bloom'), finalMod = mod(FINAL, 'final');
    const simPipe = await device.createComputePipelineAsync({ layout: 'auto', compute: { module: simMod, entryPoint: 'step' } });
    const simBind = [0, 1].map((k) => device.createBindGroup({ layout: simPipe.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: simBuf } }, { binding: 1, resource: { buffer: posBuf[k] } }, { binding: 2, resource: { buffer: posBuf[1 - k] } },
      { binding: 3, resource: { buffer: metaBuf } }, { binding: 4, resource: { buffer: linkBuf } }] }));
    const add = { color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' } };
    // one explicit layout for the scene, so every scene pipeline shares one bind group
    const sceneLayout = device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      { binding: 3, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      { binding: 4, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      { binding: 5, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }] });
    const scenePL = device.createPipelineLayout({ bindGroupLayouts: [sceneLayout] });
    const scenePipe = (vs, fs, blend) => device.createRenderPipelineAsync({ layout: scenePL, vertex: { module: sceneMod, entryPoint: vs },
      fragment: { module: sceneMod, entryPoint: fs, targets: [{ format: HDR, blend }] }, primitive: { topology: 'triangle-list' } });
    const [bgPipe, dustPipe, linkPipe, cellPipe] = await Promise.all([scenePipe('vsBg', 'fsBg'), scenePipe('vsDust', 'fsDust', add), scenePipe('vsLink', 'fsLink', add), scenePipe('vsCell', 'fsCell', add)]);
    const sceneBind = [0, 1].map((k) => device.createBindGroup({ layout: sceneLayout, entries: [
      { binding: 0, resource: { buffer: camBuf } }, { binding: 1, resource: { buffer: posBuf[k] } }, { binding: 2, resource: { buffer: metaBuf } },
      { binding: 3, resource: { buffer: fxBuf } }, { binding: 4, resource: { buffer: linkBuf } }, { binding: 5, resource: { buffer: linkFxBuf } }] }));
    const postPipe = (fs, blend) => device.createRenderPipelineAsync({ layout: 'auto', vertex: { module: postMod, entryPoint: 'vs' },
      fragment: { module: postMod, entryPoint: fs, targets: [{ format: HDR, blend }] }, primitive: { topology: 'triangle-list' } });
    const [brightPipe, downPipe, upPipe] = await Promise.all([postPipe('bright'), postPipe('down'), postPipe('up', add)]);
    const finalPipe = await device.createRenderPipelineAsync({ layout: 'auto', vertex: { module: finalMod, entryPoint: 'vs' },
      fragment: { module: finalMod, entryPoint: 'fs', targets: [{ format }] }, primitive: { topology: 'triangle-list' } });
    const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
    const err = await device.popErrorScope();
    if (err) throw new Error(err.message);

    const LEVELS = 4;
    let hdr = null, mips = [], postU = [], binds = null;
    const makeTargets = () => {
      if (hdr) { hdr.destroy(); mips.forEach((m) => m.destroy()); }
      const w = canvas.width, h = canvas.height, usage = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;
      hdr = device.createTexture({ size: [w, h], format: HDR, usage });
      mips = []; postU = [];
      for (let l = 0; l < LEVELS; l++) mips.push(device.createTexture({ size: [Math.max(1, w >> (l + 1)), Math.max(1, h >> (l + 1))], format: HDR, usage }));
      const uni = (tw, th, strength) => { const b = buf(32, U.UNIFORM | U.COPY_DST); device.queue.writeBuffer(b, 0, new Float32Array([1 / tw, 1 / th, strength, 0, 0, 0, 0, 0])); return b; };
      const bg = (pipe, u, tex) => device.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: u } }, { binding: 1, resource: sampler }, { binding: 2, resource: tex.createView() }] });
      binds = { down: [], up: [] };
      binds.bright = bg(brightPipe, uni(w, h, 1), hdr);
      for (let l = 1; l < LEVELS; l++) binds.down.push(bg(downPipe, uni(w >> l, h >> l, 1), mips[l - 1]));
      for (let l = LEVELS - 1; l > 0; l--) binds.up.push(bg(upPipe, uni(w >> (l + 1), h >> (l + 1), 1.0), mips[l]));
      binds.finalU = buf(32, U.UNIFORM | U.COPY_DST);
      binds.final = device.createBindGroup({ layout: finalPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: binds.finalU } }, { binding: 1, resource: sampler },
        { binding: 2, resource: hdr.createView() }, { binding: 3, resource: mips[0].createView() }] });
    };
    resize(); makeTargets();

    let flip = 0, last = performance.now(), frame = 0, slow = 0;
    const draw = (now) => {
      if (api._dead || lost) { if (lost && !api._dead) { api.mode = 'canvas'; freshCanvas(); startCanvas(); } return; }
      requestAnimationFrame(draw);
      if (S.paused || document.hidden) { last = now; return; }
      if (++S.tick % S.every !== 0) return;
      const real = (now - last) / 1000, dt = Math.min(0.05, real); last = now; frame++;
      S.time = (now - S.t0) / 1000;
      S.frames.push(now); if (S.frames.length > 40) S.frames.shift();
      // a tired machine gets a smaller picture, never a stalled page
      if (dt > 0.034) { if (++slow > 45 && S.scale > 0.5) { S.scale = Math.max(0.5, S.scale - 0.17); slow = 0; } } else if (slow > 0) slow--;
      if (resize()) makeTargets();
      tickCamera(Math.min(0.6, real));
      const pw = pointerWorld();
      simData.set([S.reduced ? 0.008 : 0.016, S.time, N, K, realLinks + (frame % 3) * 65536, pw.x, pw.y, S.pointer.on && !S.reduced ? 260 : 0], 0);
      device.queue.writeBuffer(simBuf, 0, simData);
      camData.set([S.cam.x, S.cam.y, S.cam.zoom * S.dpr, S.time, canvas.width, canvas.height, S.cam.ox * S.dpr, S.cam.oy * S.dpr, S.depth, S.cam.veil, PERSP, S.reduced ? 0.02 : 0.085, pw.x, pw.y, S.hover, K]);
      device.queue.writeBuffer(camBuf, 0, camData);
      for (let i = 0; i < K; i++) { fxData[i * 4] = S.excite[i]; fxData[i * 4 + 1] = S.tone[i]; }
      device.queue.writeBuffer(fxBuf, 0, fxData, 0, K * 4);
      if (api._linksDirty) { device.queue.writeBuffer(linkBuf, 0, linkData); api._linksDirty = false; }
      if (api._fxDirty) { device.queue.writeBuffer(linkFxBuf, 0, linkFx); api._fxDirty = false; }
      device.queue.writeBuffer(binds.finalU, 0, new Float32Array([0, 0, 0.85, S.time, S.cam.veil, S.depth, 0, 0]));

      const enc = device.createCommandEncoder();
      const cp = enc.beginComputePass(); cp.setPipeline(simPipe); cp.setBindGroup(0, simBind[flip]); cp.dispatchWorkgroups(Math.ceil(N / 64)); cp.end();
      flip = 1 - flip;
      const pass = (view, clear) => enc.beginRenderPass({ colorAttachments: [{ view, loadOp: clear ? 'clear' : 'load', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
      let rp = pass(hdr.createView(), true);
      rp.setBindGroup(0, sceneBind[flip]);
      rp.setPipeline(bgPipe); rp.draw(3);
      rp.setPipeline(dustPipe); rp.draw(6, DUST);
      rp.setPipeline(linkPipe); rp.draw(6, LINKS);
      rp.setPipeline(cellPipe); rp.draw(6, N);
      rp.end();
      rp = pass(mips[0].createView(), true); rp.setPipeline(brightPipe); rp.setBindGroup(0, binds.bright); rp.draw(3); rp.end();
      for (let l = 1; l < LEVELS; l++) { rp = pass(mips[l].createView(), true); rp.setPipeline(downPipe); rp.setBindGroup(0, binds.down[l - 1]); rp.draw(3); rp.end(); }
      for (let l = LEVELS - 1, k = 0; l > 0; l--, k++) { rp = pass(mips[l - 1].createView(), false); rp.setPipeline(upPipe); rp.setBindGroup(0, binds.up[k]); rp.draw(3); rp.end(); }
      rp = pass(ctx.getCurrentTexture().createView(), true); rp.setPipeline(finalPipe); rp.setBindGroup(0, binds.final); rp.draw(3); rp.end();
      if (!reading && frame % 3 === 0) enc.copyBufferToBuffer(posBuf[flip], 0, readBuf, 0, N * 16);
      device.queue.submit([enc.finish()]);
      if (!reading && frame % 3 === 0) {
        reading = true;
        readBuf.mapAsync(GPUMapMode.READ).then(() => { S.cpu.set(new Float32Array(readBuf.getMappedRange())); readBuf.unmap(); reading = false; }).catch(() => { reading = false; });
      }
      for (const fn of S.frameFns) fn(S.time, dt);
    };
    requestAnimationFrame(draw);
  }

  // ════ 2D canvas: the same shape, a lighter version of the same forces ═══════════════════════════════════════
  function startCanvas() {
    const g = canvas.getContext('2d');
    if (!g) return;
    // every organ, and one build in four of the rest (a 2D canvas cannot move them all every frame): said on the page
    const idx = [];
    for (let i = 0; i < N; i++) if (i < K || i % 4 === 0) idx.push(i);
    const M = idx.length, vel = new Float32Array(M * 2);
    S.cpu.set(seeds);
    const sprite = (rgb, organ) => {
      const c = document.createElement('canvas'), s = organ ? 96 : 32; c.width = c.height = s;
      const x = c.getContext('2d'), gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2), [r, gg, b] = rgb.map((v) => Math.round(v * 255));
      gr.addColorStop(0, `rgba(${r},${gg},${b},1)`); gr.addColorStop(organ ? 0.16 : 0.3, `rgba(${r},${gg},${b},.55)`); gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
      x.fillStyle = gr; x.fillRect(0, 0, s, s); return c;
    };
    const small = FAMILY_RGB.map((c) => sprite(c, false)), big = FAMILY_RGB.map((c) => sprite(c.map((v) => v * 0.58 + 0.42), true)), warm = sprite([1, 0.93, 0.78], true);
    let last = performance.now();
    const draw = (now) => {
      if (api._dead) return;
      requestAnimationFrame(draw);
      if (S.paused || document.hidden) { last = now; return; }
      if (++S.tick % S.every !== 0) return;
      const real = (now - last) / 1000, dt = Math.min(0.05, real); last = now; S.time = (now - S.t0) / 1000;
      S.frames.push(now); if (S.frames.length > 40) S.frames.shift();
      resize(); tickCamera(Math.min(0.6, real));
      if (!S.reduced) {
        const t = S.time;
        for (let a = 0; a < M; a++) {
          const i = idx[a], organ = i < K; let fx = 0, fy = 0; const px = S.cpu[i * 4], py = S.cpu[i * 4 + 1];
          if (organ) {
            for (let b = 0; b < M && idx[b] < K; b++) { if (b === a) continue; const j = idx[b], dx = px - S.cpu[j * 4], dy = py - S.cpu[j * 4 + 1], r = Math.hypot(dx, dy) + 0.5; if (r < 135) { const k = 420 * (1 - r / 135) / r; fx += dx * k; fy += dy * k; } }
            const hold = shape.nodes[i].char === 'heart' ? 0.6 : 0.02; fx -= px * hold; fy -= py * hold;
          } else {
            const L = E.LAYOUT[shape.nodes[i].fam];
            if (L.mode === 'ring') { const r = Math.hypot(px, py) + 0.001; fx += (px / r) * (L.r - r) * L.k * 60 - (py / r) * 1.4; fy += (py / r) * (L.r - r) * L.k * 60 + (px / r) * 1.4; }
            else { fx += (L.x - px) * L.k * 60; fy += (L.y - py) * L.k * 60; }
          }
          const ang = Math.sin(py * 0.0041 + t * 0.21) * 2.1 + Math.cos(px * 0.0037 - t * 0.17) * 2.3 + meta[i * 4] * 6.283, drift = organ ? 2 : 9;
          fx += Math.cos(ang) * drift; fy += Math.sin(ang) * drift;
          vel[a * 2] = (vel[a * 2] + fx * 0.016) * 0.9; vel[a * 2 + 1] = (vel[a * 2 + 1] + fy * 0.016) * 0.9;
        }
        for (let a = 0; a < M; a++) { const i = idx[a]; S.cpu[i * 4] += vel[a * 2] * 0.016; S.cpu[i * 4 + 1] += vel[a * 2 + 1] * 0.016; }
      }
      const W = canvas.width, H = canvas.height, d = S.dpr, v = 1 - S.cam.veil * 0.55;
      const bg = g.createLinearGradient(0, 0, 0, H);
      const mix = (a, b) => a.map((x, k) => Math.round((x + (b[k] - x) * S.depth) * 255));
      bg.addColorStop(0, `rgb(${mix([0.012, 0.085, 0.13], [0.004, 0.014, 0.03]).join(',')})`); bg.addColorStop(1, `rgb(${mix([0.004, 0.022, 0.04], [0.006, 0.004, 0.016]).join(',')})`);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'lighter';
      g.lineWidth = d; g.strokeStyle = `rgba(40,150,170,${0.16 * v})`; g.beginPath();
      for (const [a, b] of shape.links) { const pa = api.project(a), pb = api.project(b); g.moveTo(pa.x * d, pa.y * d); g.lineTo(pb.x * d, pb.y * d); }
      g.stroke();
      for (let e = 0; e < LINKS; e++) {
        const st = linkFx[e * 4], du = linkFx[e * 4 + 1]; if (!(du > 0)) continue;
        const ph = (S.time - st) / du; if (ph < 0 || ph > 1) continue;
        const a = linkData[e * 4], b = linkData[e * 4 + 1], pa = api.project(a), pb = api.project(b), q = linkFx[e * 4 + 3] === 2 ? 1 - ph : ph;
        const [r, gg, bb] = TONE_RGB[linkFx[e * 4 + 2] | 0].map((x) => Math.round(x * 255));
        g.fillStyle = `rgba(${r},${gg},${bb},.9)`; g.beginPath(); g.arc((pa.x + (pb.x - pa.x) * q) * d, (pa.y + (pb.y - pa.y) * q) * d, 4 * d, 0, 6.2832); g.fill();
      }
      for (let a = 0; a < M; a++) {
        const i = idx[a], organ = i < K, p = api.project(i), z = meta[i * 4];
        const breath = S.reduced ? 1 : 1 + 0.085 * Math.sin(S.time * 1.05 - Math.hypot(S.cpu[i * 4], S.cpu[i * 4 + 1]) * 0.0065 + z * 2);
        const core = Math.max(organ ? 2.6 : 0.9, meta[i * 4 + 1] * breath * p.k * S.cam.zoom) * d, size = core * (organ ? 9 : 6) * (i === S.hover ? 1.3 : 1);
        g.globalAlpha = Math.min(1, (organ ? 1 : 0.7) * (1 - z * 0.6) * v * (1 + (organ ? S.excite[i] : 0)));
        g.drawImage(organ ? (shape.nodes[i].char === 'heart' ? warm : big[shape.nodes[i].fam]) : small[shape.nodes[i].fam], p.x * d - size / 2, p.y * d - size / 2, size, size);
        if (organ && S.excite[i] > 0.01) {
          const [r, gg, bb] = TONE_RGB[S.tone[i]].map((x) => Math.round(x * 255));
          g.globalAlpha = S.excite[i]; g.strokeStyle = `rgb(${r},${gg},${bb})`; g.lineWidth = 2 * d; g.beginPath(); g.arc(p.x * d, p.y * d, core * (1.6 + (1 - S.excite[i]) * 4.6), 0, 6.2832); g.stroke();
        }
      }
      g.globalAlpha = 1;
      for (const fn of S.frameFns) fn(S.time, dt);
    };
    requestAnimationFrame(draw);
  }
}

export default { createOrganism, PERSP, FAMILY_RGB };
