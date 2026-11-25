// house.js — the kit's motion: what makes a house page feel alive without saying anything untrue.
//   reveal(root)          sections rise into place as they are reached
//   light(root)           a soft light follows the pointer across cards
//   count(el, text)       a receipt's number runs up to its value when first seen; the value written is exactly `text`
//   bindScroll(crystal)   the crystal's light answers the scroll: brightest at the top, quieter as the page is read
// Each is safe to call with nothing to act on, and does nothing where motion is not wanted.
const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function reveal(root) {
  const els = root && root.querySelectorAll ? [...root.querySelectorAll('.reveal')] : [];
  if (typeof IntersectionObserver !== 'function' || still()) return;                 // nothing is hidden, so nothing needs showing
  if (root.documentElement && root.documentElement.classList) root.documentElement.classList.add('js');   // only now may .reveal start hidden
  const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }, { threshold: 0.14 });
  for (const el of els) io.observe(el);
}

export function light(root) {
  if (!root || !root.addEventListener || still()) return;
  root.addEventListener('pointermove', (e) => {
    const card = e.target && e.target.closest ? e.target.closest('.act') : null;
    if (!card) return;
    const b = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - b.left}px`); card.style.setProperty('--my', `${e.clientY - b.top}px`);
  });
}

// count(el, text): text is the final, true text of the number (for example "31.6%"). Only its digits move, and only
// on the way in: when it stops, the element holds exactly `text`.
export function count(el, text) {
  const final = String(text), m = final.match(/^(\D*)(\d+(?:\.\d+)?)(.*)$/);
  if (!el || !m || still() || typeof requestAnimationFrame !== 'function' || typeof IntersectionObserver !== 'function') { if (el) el.textContent = final; return; }
  const to = Number(m[2]), places = (m[2].split('.')[1] || '').length;
  el.textContent = final;
  const io = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return;
    io.disconnect();
    const t0 = performance.now(), run = (now) => { const k = Math.min(1, (now - t0) / 900), ease = 1 - (1 - k) ** 3; el.textContent = k < 1 ? `${m[1]}${(to * ease).toFixed(places)}${m[3]}` : final; if (k < 1) requestAnimationFrame(run); };
    requestAnimationFrame(run);
  }, { threshold: 0.4 });
  io.observe(el);
}

export function bindScroll(crystal, base) {
  if (!crystal || typeof addEventListener !== 'function') return;
  const top = base ?? 1, set = () => crystal.setEnergy(top * Math.max(0.35, 1 - (globalThis.scrollY || 0) / ((globalThis.innerHeight || 800) * 1.2)));
  addEventListener('scroll', set, { passive: true }); set();
}

export default { reveal, light, count, bindScroll };
