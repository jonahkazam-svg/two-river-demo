/* Shared script for Allogene content pages — smooth scroll + reveal on scroll */
document.addEventListener('DOMContentLoaded', () => {
  const $$ = (s, c=document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;

  let lenis = null;
  if (window.Lenis && !reduce){
    lenis = new Lenis({ duration:1.1, smoothWheel:true, wheelMultiplier:1 });
    (function raf(t){ lenis.raf(t); requestAnimationFrame(raf); })();
    window.__lenis = lenis;
  }
  $$('a[href^="#"]').forEach(a => {
    const id = a.getAttribute('href'); if (id.length < 2) return;
    a.addEventListener('click', e => {
      const el = document.querySelector(id); if (!el) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(el, { offset:-80, duration:1.2 });
      else el.scrollIntoView({ behavior:'smooth' });
    });
  });

  // page transition — fade through an overlay on internal navigation
  const ov = document.createElement('div'); ov.className = 'tr-overlay'; document.body.appendChild(ov);
  $$('a[href]').forEach(a => {
    const href = a.getAttribute('href'); if (!href) return;
    if (href.startsWith('#') || /^(https?:|mailto:|tel:)/.test(href) || a.target === '_blank') return;
    a.addEventListener('click', e => { e.preventDefault(); ov.classList.add('show'); setTimeout(() => { location.href = href; }, 340); });
  });

  // reveal on scroll
  if (reduce){ $$('[data-fade]').forEach(el => el.classList.add('in')); return; }
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold:0.12, rootMargin:'0px 0px -8% 0px' });
  $$('[data-fade]').forEach(el => io.observe(el));
});
