// crystal.js — the house hero: a living crystal, drawn by one fragment shader. No library is fetched.
//
// It is a real solid, not a picture of one: a 32-faced gem (an icosahedron cut by a dodecahedron) that every pixel's
// ray is intersected with exactly. Light is bent into the body, carried through it, turned back where it cannot leave
// and bent out again, once for each of three colours, so the facets split light the way glass does. The body absorbs
// as it carries; its edges burn; a slow lattice of light moves inside it.
//
// And it is bound to data. Each of the 32 faces holds a state the page gives it: dark, proven (cyan), sealing (gold,
// breathing) or failed (red, kept). A page lights a face only for a receipt it has re-derived, so the crystal is the
// record, not decoration. A face can be pointed at and pressed: the page is told which one.
//
//   mount(canvas, options) → { setFaces, setEnergy, setCentre, onHover, onPick, redraw, destroy, FACES }   or null
// It decides nothing. With no WebGL the canvas is left as it is (the page's own background shows) and null is returned.

export const FACES = 32;
export const STATE = { dark: 0, proven: 1, sealing: 2, failed: 3 };
const PHI = (1 + Math.sqrt(5)) / 2;
const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
// ten icosahedron normals, then six dodecahedron normals; each stands for a pair of opposite faces (i and i + 16)
export const NORMALS = [[1, 1, 1], [-1, 1, 1], [1, -1, 1], [1, 1, -1], [0, 1, PHI + 1], [0, -1, PHI + 1], [PHI + 1, 0, 1], [-PHI - 1, 0, 1], [1, PHI + 1, 0], [-1, PHI + 1, 0], [0, PHI, 1], [0, -PHI, 1], [1, 0, PHI], [-1, 0, PHI], [PHI, 1, 0], [-PHI, 1, 0]].map(unit);
const R_ICOSA = 1.2, R_CUT = 1.37, CAMERA = 5.2, FOV = 0.8284;

const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform mat3 uRot; uniform mat3 uInv; uniform vec3 uCen;
uniform vec3 uN[16]; uniform float uR[16]; uniform float uState[32]; uniform float uEnergy; uniform float uHot;
const vec3 CYAN = vec3(0.286, 0.910, 0.784); const vec3 GOLD = vec3(1.0, 0.812, 0.416); const vec3 RED = vec3(1.0, 0.42, 0.42);
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float hash3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z); }
vec3 tint(float s){ return s < 0.5 ? vec3(0.0) : s < 1.5 ? CYAN : s < 2.5 ? GOLD : RED; }
// the solid: sixteen pairs of planes. Where a ray enters and leaves, through which faces, and how near an edge.
bool solid(vec3 ro, vec3 rd, out float tN, out float tF, out vec3 nN, out vec3 nF, out float sN, out float sF, out float eN, out float eF, out float iN){
  tN = -1e9; tF = 1e9; float tN2 = -1e9; float tF2 = 1e9; nN = vec3(0.0); nF = vec3(0.0); sN = 0.0; sF = 0.0; iN = -1.0;
  for (int i = 0; i < 16; i++){
    vec3 n = uN[i]; float dn = dot(rd, n); dn = abs(dn) < 1e-5 ? 1e-5 : dn; float po = dot(ro, n);
    float tp = (uR[i] - po) / dn; float tm = (-uR[i] - po) / dn;
    float ta; float tb; vec3 na; vec3 nb; float sa; float sb; float ia;
    if (dn < 0.0) { ta = tp; na = n; sa = uState[i]; ia = float(i); tb = tm; nb = -n; sb = uState[i + 16]; }
    else { ta = tm; na = -n; sa = uState[i + 16]; ia = float(i) + 16.0; tb = tp; nb = n; sb = uState[i]; }
    if (ta > tN) { tN2 = tN; tN = ta; nN = na; sN = sa; iN = ia; } else if (ta > tN2) { tN2 = ta; }
    if (tb < tF) { tF2 = tF; tF = tb; nF = nb; sF = sb; } else if (tb < tF2) { tF2 = tb; }
  }
  eN = tN - tN2; eF = tF2 - tF;
  return tN < tF && tF > 0.0;
}
// what the crystal reflects and bends: a dark sea, three lamps, a horizon, slow bars of light
vec3 world(vec3 d){
  vec3 c = mix(vec3(0.0006, 0.003, 0.006), vec3(0.006, 0.028, 0.042), pow(clamp(d.y * 0.5 + 0.5, 0.0, 1.0), 1.5));
  c += CYAN * 2.2 * pow(max(dot(d, normalize(vec3(0.6, 0.7, 0.4))), 0.0), 26.0);
  c += vec3(0.6, 0.8, 1.0) * 1.3 * pow(max(dot(d, normalize(vec3(-0.7, 0.3, 0.5))), 0.0), 60.0);
  c += GOLD * 0.55 * pow(max(dot(d, normalize(vec3(0.1, -0.8, 0.5))), 0.0), 28.0);
  c += vec3(0.15, 0.5, 0.45) * exp(-abs(d.y) * 14.0) * 0.12;
  float bars = smoothstep(0.9, 1.0, sin(d.x * 9.0 + d.z * 5.0 + uTime * 0.07) * 0.5 + 0.5);
  return c + vec3(0.5, 0.9, 0.85) * bars * 0.22 * smoothstep(-0.2, 0.6, d.y);
}
// one colour of light through the body: bent in, carried, turned back once if it cannot leave, bent out
vec3 through(vec3 p, vec3 rd, vec3 n, float ior, out float path, out float sX, out float eX){
  vec3 d = refract(rd, n, 1.0 / ior); vec3 o = p - n * 0.003; vec3 leave = d; path = 0.0; sX = 0.0; eX = 1.0;
  for (int b = 0; b < 2; b++){
    float tN; float tF; vec3 nN; vec3 nF; float sN; float sF; float eN; float eF; float iN;
    solid(o, d, tN, tF, nN, nF, sN, sF, eN, eF, iN);
    path += max(tF, 0.0);
    if (b == 0) { sX = sF; eX = eF; }
    vec3 r = refract(d, -nF, ior);
    if (dot(r, r) > 0.0) { leave = r; break; }
    vec3 q = o + d * tF; d = reflect(d, -nF); o = q - nF * 0.003; leave = d;
  }
  return leave;
}
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 ro = vec3(0.0, 0.0, ${CAMERA.toFixed(1)}); vec3 rd = normalize(vec3(uv * ${FOV.toFixed(4)}, -1.0));
  // the room: depth, a breath of light round the crystal, three drifts of dust
  vec3 col = mix(vec3(0.0002, 0.0008, 0.0016), vec3(0.0016, 0.0042, 0.0085), exp(-length(uv - vec2(0.36, 0.3)) * 1.9));
  float near = length(cross(rd, uCen - ro));
  col += CYAN * 0.010 * uEnergy * exp(-near * near * 0.42);
  for (int k = 0; k < 3; k++){
    float sc = 14.0 + float(k) * 11.0; vec2 g = uv * sc + vec2(uTime * 0.010 * float(k + 1), uTime * 0.006);
    vec2 id = floor(g); vec2 f = fract(g) - 0.5; float h = hash(id + float(k) * 17.0);
    vec2 o = vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5; float tw = 0.5 + 0.5 * sin(uTime * (0.6 + h * 2.0) + h * 40.0);
    col += vec3(0.56, 0.91, 0.85) * smoothstep(0.045, 0.0, length(f - o * 0.7)) * step(0.9, h) * tw * (0.22 - 0.05 * float(k));
  }
  vec3 lo = uInv * (ro - uCen); vec3 ld = uInv * rd;
  float tN; float tF; vec3 nN; vec3 nF; float sN; float sF; float eN; float eF; float iN;
  if (solid(lo, ld, tN, tF, nN, nF, sN, sF, eN, eF, iN) && tN > 0.0){
    vec3 p = lo + ld * tN; float facing = max(dot(-ld, nN), 0.0); float fres = pow(1.0 - facing, 3.0);
    float pa; float sa; float ea; float pathG; float sX; float eX;
    vec3 dr = through(p, ld, nN, 1.41, pa, sa, ea);
    vec3 dg = through(p, ld, nN, 1.45, pathG, sX, eX);
    vec3 db = through(p, ld, nN, 1.50, pa, sa, ea);
    vec3 bent = vec3(world(uRot * dr).r, world(uRot * dg).g, world(uRot * db).b);
    vec3 body = exp(-pathG * vec3(1.5, 0.38, 0.52) * 0.8);
    vec3 c = mix(bent * body, world(uRot * reflect(ld, nN)), 0.06 + 0.9 * fres);
    vec3 cN = tint(sN); vec3 cX = tint(sX);
    float breath = (sN > 1.5 && sN < 2.5) ? 0.6 + 0.4 * sin(uTime * 1.8 + iN) : 1.0;
    c += cN * (0.012 + 0.10 * fres) * breath * uEnergy;                 // a lit face glows from within
    c += cX * 0.03 * body.g * uEnergy;                                  // the far side, seen through the body
    float edge = exp(-eN * 90.0) + 0.35 * exp(-eX * 60.0) * body.g;      // edges burn
    c += mix(vec3(0.16, 0.55, 0.48), cN, step(0.5, sN)) * edge * (0.35 + 0.45 * uEnergy);
    vec3 mid = p + refract(ld, nN, 1.0 / 1.45) * pathG * 0.5;           // the lattice of light inside
    c += CYAN * pow(noise(mid * 3.2 + vec3(0.0, uTime * 0.12, uTime * 0.05)), 3.0) * 0.05 * uEnergy;
    c += vec3(0.5, 0.9, 0.85) * (1.0 - step(0.5, abs(iN - uHot))) * 0.07;         // the face under the pointer
    col = c;
  }
  col *= 1.0 - 0.5 * pow(length(uv * vec2(0.75, 1.0)), 2.2);
  col = 1.0 - exp(-col * 2.4);
  col = pow(col, vec3(0.4545)); col = mix(col, col * col * (3.0 - 2.0 * col), 0.65) + (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.014;
  gl_FragColor = vec4(col, 1.0);
}`;

const mul = (m, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
// rot(yaw, pitch) → the turn of the crystal as a column-major 3×3, and its inverse (its transpose)
export function rot(yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch);
  const m = [cy, sx * sy, -cx * sy, 0, cx, sx, sy, -sx * cy, cx * cy];
  return { m, inv: [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]] };
}
// faceAt(u, v, aspect, turn, centre, cut) → the face (0…31) a ray through that point of the screen enters by, or -1.
// u, v run 0…1 from the top left. The same sum the shader does, so the page and the picture agree on which face it is.
export function faceAt(u, v, aspect, turn, centre, cut) {
  const x = (u - 0.5) * aspect * FOV, y = (0.5 - v) * FOV, l = Math.hypot(x, y, 1);
  const rd = mul(turn.inv, [x / l, y / l, -1 / l]), ro = mul(turn.inv, [-centre[0], -centre[1], CAMERA - centre[2]]);
  let tN = -1e9, tF = 1e9, face = -1;
  for (let i = 0; i < 16; i++) {
    const n = NORMALS[i], r = i < 10 ? R_ICOSA : cut;
    let dn = rd[0] * n[0] + rd[1] * n[1] + rd[2] * n[2]; if (Math.abs(dn) < 1e-5) dn = 1e-5;
    const po = ro[0] * n[0] + ro[1] * n[1] + ro[2] * n[2], tp = (r - po) / dn, tm = (-r - po) / dn;
    const ta = dn < 0 ? tp : tm, tb = dn < 0 ? tm : tp;
    if (ta > tN) { tN = ta; face = dn < 0 ? i : i + 16; }
    if (tb < tF) tF = tb;
  }
  return tN < tF && tN > 0 ? face : -1;
}

export function mount(canvas, options) {
  const opt = options || {};
  let gl = null;
  try { gl = canvas && canvas.getContext ? canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' }) : null; } catch { gl = null; }
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(prog, n);
  const u = { res: U('uRes'), time: U('uTime'), rot: U('uRot'), inv: U('uInv'), cen: U('uCen'), n: U('uN[0]'), r: U('uR[0]'), state: U('uState[0]'), energy: U('uEnergy'), hot: U('uHot') };
  gl.uniform3fv(u.n, new Float32Array(NORMALS.flat()));
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const S = { faces: new Float32Array(FACES), energy: opt.energy ?? 0.8, target: opt.energy ?? 0.8, centre: [0, 0, 0], yaw: 0.5, pitch: 0.18, vy: 0, vp: 0, drag: null, hot: -1, scale: 1, ms: 16, t: 0, last: 0, seen: true, raf: 0, dead: false, hover: null, pick: null, turn: rot(0.5, 0.18), cut: R_CUT };
  const size = () => {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1, d = Math.min(1.5, globalThis.devicePixelRatio || 1) * S.scale;
    const W = Math.max(2, Math.round(w * d)), H = Math.max(2, Math.round(h * d));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    S.centre = typeof opt.centre === 'function' ? opt.centre(w, h) : [w > 820 ? 1.25 : 0, w > 820 ? 0 : 0.55, 0];
  };
  const draw = () => {
    size();
    S.turn = rot(S.yaw, S.pitch);
    S.cut = R_CUT + 0.07 * Math.sin(S.t * 0.35);                        // the cut faces open and close: it breathes
    const r = new Float32Array(16); for (let i = 0; i < 16; i++) r[i] = i < 10 ? R_ICOSA : S.cut;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(u.res, canvas.width, canvas.height); gl.uniform1f(u.time, S.t); gl.uniformMatrix3fv(u.rot, false, new Float32Array(S.turn.m)); gl.uniformMatrix3fv(u.inv, false, new Float32Array(S.turn.inv));
    gl.uniform3f(u.cen, S.centre[0], S.centre[1], S.centre[2]); gl.uniform1fv(u.r, r); gl.uniform1fv(u.state, S.faces); gl.uniform1f(u.energy, S.energy); gl.uniform1f(u.hot, S.hot);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const frame = (now) => {
    if (S.dead) return;
    S.raf = requestAnimationFrame(frame);
    if (!S.seen || (typeof document !== 'undefined' && document.hidden)) { S.last = now; return; }
    const dt = Math.min(0.05, (now - (S.last || now)) / 1000); S.last = now;
    S.ms += ((dt * 1000) - S.ms) * 0.08;
    if (S.ms > 30 && S.scale > 0.45) S.scale *= 0.92; else if (S.ms < 14 && S.scale < 1) S.scale = Math.min(1, S.scale * 1.03);
    if (!still) { S.t += dt; if (!S.drag) { S.yaw += dt * 0.16 + S.vy; S.pitch += (0.18 + 0.12 * Math.sin(S.t * 0.22) - S.pitch) * 0.02 + S.vp; S.vy *= 0.94; S.vp *= 0.94; } }
    S.energy += (S.target - S.energy) * 0.04;
    draw();
  };
  const where = (e) => { const b = canvas.getBoundingClientRect(); return [(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height, b.width / b.height]; };
  const face = (e) => { const [x, y, asp] = where(e); return faceAt(x, y, asp, S.turn, S.centre, S.cut); };
  const down = (e) => { S.drag = { x: e.clientX, y: e.clientY, moved: 0 }; };
  const move = (e) => {
    if (S.drag) { const dx = e.clientX - S.drag.x, dy = e.clientY - S.drag.y; S.drag.x = e.clientX; S.drag.y = e.clientY; S.drag.moved += Math.abs(dx) + Math.abs(dy); S.yaw += dx * 0.006; S.pitch = Math.max(-1.2, Math.min(1.2, S.pitch + dy * 0.006)); S.vy = dx * 0.0006; S.vp = 0; if (still) draw(); return; }
    const f = face(e); if (f !== S.hot) { S.hot = f; canvas.style.cursor = f >= 0 ? 'pointer' : 'grab'; if (S.hover) S.hover(f, e); if (still) draw(); }
  };
  const up = (e) => { const d = S.drag; S.drag = null; if (d && d.moved < 6 && S.pick) { const f = face(e); if (f >= 0) S.pick(f, e); } };
  const leave = () => { S.drag = null; if (S.hot !== -1) { S.hot = -1; if (S.hover) S.hover(-1, null); if (still) draw(); } };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointerleave', leave);
  canvas.style.cursor = 'grab'; canvas.style.touchAction = 'pan-y';
  let io = null;
  if (typeof IntersectionObserver === 'function') { io = new IntersectionObserver((es) => { for (const e of es) S.seen = e.isIntersecting; }); io.observe(canvas); }
  const onSize = () => { if (still) draw(); };
  if (typeof addEventListener === 'function') addEventListener('resize', onSize);
  draw();
  S.raf = requestAnimationFrame(frame);
  return {
    FACES,
    setFaces(states) { for (let i = 0; i < FACES; i++) S.faces[i] = Number(states && states[i]) || 0; if (still) draw(); },
    setEnergy(x) { S.target = Math.max(0, Math.min(1.4, Number(x) || 0)); },
    setCentre(fn) { opt.centre = fn; if (still) draw(); },
    onHover(fn) { S.hover = fn; }, onPick(fn) { S.pick = fn; },
    redraw: draw,
    destroy() { S.dead = true; cancelAnimationFrame(S.raf); if (io) io.disconnect(); canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointerleave', leave); if (typeof removeEventListener === 'function') removeEventListener('resize', onSize); },
  };
}

export default { FACES, STATE, NORMALS, rot, faceAt, mount };
