/* ============================================================
   PORSCHE 911 — scroll-driven film (scrubbed video)
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  const $  = (s, c=document) => c.querySelector(s);
  const $$ = (s, c=document) => [...c.querySelectorAll(s)];
  const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  const fine   = window.matchMedia('(pointer:fine)').matches;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  // begin at the overture (restoration already disabled via the inline head script)
  let userMoved = false;
  ['wheel','touchstart','keydown','pointerdown'].forEach(ev =>
    window.addEventListener(ev, () => { userMoved = true; }, { passive:true, once:true }));
  function forceTop(){ if (userMoved) return; window.scrollTo(0,0); if (lenis) lenis.scrollTo(0,{ immediate:true }); }

  const hasGSAP  = window.gsap && window.ScrollTrigger;
  const hasLenis = window.Lenis;
  if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

  /* ---------------- SCROLL-DRIVEN FRAME SEQUENCES ---------------- */
  // Each chapter is a pre-rendered image sequence. Scroll picks the frame and we
  // draw it to a canvas — no video seeking, so scrubbing is perfectly smooth.
  const acts = $$('[data-act]');
  acts.forEach(act => {
    act._dir = act.dataset.seq;
    act._count = +act.dataset.count;
    act._frames = new Array(act._count);
    act._requested = false;
    act._loaded = 0;
    act._p = 0;
    act._drawn = -1;
    act._canvas = $('.act__canvas', act);
    act._ctx = act._canvas.getContext('2d', { alpha:false });
    act._caps = $$('.cap', act);
  });
  const framePath = (dir, i) => `assets/frames/${dir}/${String(i+1).padStart(4,'0')}.jpg`;
  function loadSequence(act){
    if (act._requested) return; act._requested = true;
    for (let i = 0; i < act._count; i++){
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { act._loaded++; };
      img.src = framePath(act._dir, i);
      act._frames[i] = img;
    }
  }
  const firstAct = acts[0];
  loadSequence(firstAct);            // overture loads immediately

  /* ---------------- PRELOADER (waits for first clip) ---------------- */
  const pre = $('#preloader'), loadBar = $('#loadBar'), loadPct = $('#loadPct');
  let started = Date.now();
  document.documentElement.style.overflow = 'hidden';
  const tick = setInterval(() => {
    const frac = firstAct._count ? firstAct._loaded / firstAct._count : 1;
    const elapsed = Date.now() - started;
    let p = Math.round(frac * 100);
    if (elapsed > 6000) p = 100;                 // failsafe
    loadPct.textContent = p;
    loadBar.style.width = p + '%';
    if (p >= 100){ clearInterval(tick); setTimeout(endLoad, 250); }
  }, 100);

  let lenis = null;
  function endLoad(){
    pre.classList.add('done');
    pre.style.pointerEvents = 'none';
    setTimeout(() => { pre.style.display = 'none'; }, 850);  // hard-remove after the fade
    document.documentElement.style.overflow = '';
    forceTop();
    if (hasGSAP) ScrollTrigger.refresh();
    startHeroIntro();
  }

  /* ---------------- LENIS SMOOTH SCROLL ---------------- */
  const noLenis = location.search.includes('nolenis');
  if (hasLenis && !reduce && !noLenis){
    lenis = new Lenis({ duration:1.15, smoothWheel:true, wheelMultiplier:1, touchMultiplier:1.6 });
    if (hasGSAP){
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t*1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
    window.__lenis = lenis;
  }
  $$('a[href^="#"]').forEach(a => {
    const id = a.getAttribute('href'); if (id.length < 2) return;
    a.addEventListener('click', e => {
      const el = $(id); if (!el) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(el, { duration:1.5 });
      else el.scrollIntoView({ behavior:'smooth' });
    });
  });

  // page transition — fade through an overlay when leaving for another page
  const trOv = document.createElement('div'); trOv.className = 'tr-overlay'; document.body.appendChild(trOv);
  $$('a[href]').forEach(a => {
    const href = a.getAttribute('href'); if (!href) return;
    if (href.startsWith('#') || /^(https?:|mailto:|tel:)/.test(href) || a.target === '_blank') return;
    a.addEventListener('click', e => { e.preventDefault(); trOv.classList.add('show'); setTimeout(() => { location.href = href; }, 340); });
  });

  /* ---------------- CURSOR GLOW ---------------- */
  const glow = $('#cursorGlow');
  if (fine) window.addEventListener('mousemove', e => {
    glow.style.opacity = '1'; glow.style.left = e.clientX+'px'; glow.style.top = e.clientY+'px';
  });

  /* ---------------- HERO INTRO ---------------- */
  function startHeroIntro(){
    const cap = acts[0] && $('.cap', acts[0]);
    if (cap) cap.style.opacity = '1';
  }

  /* ============================================================
     SCROLL-SCRUBBED VIDEO  (the core)
     ============================================================ */
  function capOpacity(prog, from, to){
    const m = 0.06;
    if (prog < from - m || prog > to + m) return 0;
    if (prog < from) return (prog - (from - m)) / m;
    if (prog > to)   return ((to + m) - prog) / m;
    return 1;
  }

  // wire scroll → frame index + captions
  acts.forEach(act => {
    const caps = act._caps;
    if (hasGSAP){
      ScrollTrigger.create({
        trigger: act, start: 'top top', end: 'bottom bottom', scrub: 0.45,
        onUpdate(self){
          act._p = self.progress;
          caps.forEach(c => { c.style.opacity = capOpacity(self.progress, +c.dataset.from, +c.dataset.to); });
          if (act.id === 'act-delta' && self.progress > 0.52) runCounters($('#deltaStats'));
        }
      });
      // pull this chapter's frames in just before it scrolls into view
      ScrollTrigger.create({ trigger: act, start: 'top bottom+=90%', onEnter: () => loadSequence(act) });
    } else { caps.forEach(c => c.style.opacity = '1'); loadSequence(act); }
  });

  // draw the on-screen chapter's current frame to its canvas
  function drawFrame(){
    for (const a of acts){
      const r = a._canvas.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= window.innerHeight) continue;   // off screen
      let idx = Math.round(a._p * (a._count - 1));
      idx = idx < 0 ? 0 : (idx >= a._count ? a._count - 1 : idx);
      let img = a._frames[idx];
      if (!(img && img.complete && img.naturalWidth)){
        // never show blank: fall back to the nearest already-decoded frame
        let f;
        for (let j = idx; j >= 0; j--){ f = a._frames[j]; if (f && f.complete && f.naturalWidth){ img = f; idx = j; break; } }
        if (!(img && img.complete && img.naturalWidth))
          for (let j = idx; j < a._count; j++){ f = a._frames[j]; if (f && f.complete && f.naturalWidth){ img = f; idx = j; break; } }
      }
      if (img && img.complete && img.naturalWidth && a._drawn !== idx){
        try { a._ctx.drawImage(img, 0, 0, a._canvas.width, a._canvas.height); a._drawn = idx; } catch(e){}
      }
    }
  }
  if (hasGSAP) gsap.ticker.add(drawFrame);
  else (function loop(){ drawFrame(); requestAnimationFrame(loop); })();

  /* ---------------- ANIMATED COUNTERS (per scope) ---------------- */
  function runCounters(scope){
    if (!scope || scope.dataset.counted) return; scope.dataset.counted = '1';
    scope.querySelectorAll('.count').forEach(el => {
      const to = parseFloat(el.dataset.to), dec = parseInt(el.dataset.dec||'0');
      const dur = 1600, t0 = performance.now();
      const fmt = v => dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US');
      const step = now => {
        const k = Math.min((now-t0)/dur, 1), e = 1-Math.pow(1-k,3);
        el.textContent = fmt(to*e);
        if (k<1) requestAnimationFrame(step); else el.textContent = fmt(to);
      };
      requestAnimationFrame(step);
    });
  }
  // info-section counters fire when scrolled into view
  $$('[data-counts]').forEach(s => {
    if (hasGSAP) ScrollTrigger.create({ trigger:s, start:'top 80%', onEnter:()=>runCounters(s) });
    else runCounters(s);
  });
  // pipeline phase bars fill on reveal
  $$('.phasebar').forEach(b => {
    const fill = () => { const sp=b.querySelector('span'); if(sp) sp.style.width=(b.dataset.p||0)+'%'; };
    if (hasGSAP) ScrollTrigger.create({ trigger:b, start:'top 82%', onEnter:fill });
    else fill();
  });

  /* ---------------- GENERIC FADE-UP (config / reserve) ---------------- */
  if (hasGSAP && !reduce){
    $$('[data-fade]').forEach(el => ScrollTrigger.create({ trigger:el, start:'top 85%', onEnter:()=>el.classList.add('in') }));
  } else $$('[data-fade]').forEach(el => el.classList.add('in'));

  /* ---------------- PROGRESS BAR + TOPBAR ---------------- */
  const bar = $('#scrollbar'), topbar = $('#topbar');
  function onScrollUI(){
    const max = document.body.scrollHeight - window.innerHeight;
    const r = max>0 ? (window.scrollY/max) : 0;
    bar.style.width = (r*100)+'%';
    topbar.classList.toggle('solid', window.scrollY > window.innerHeight*0.85);
    updateChapter();
  }
  if (lenis) lenis.on('scroll', onScrollUI);
  window.addEventListener('scroll', onScrollUI, { passive:true });

  /* ---------------- CHAPTER INDEX ---------------- */
  const dots = $$('.chapters__dot');
  const secIds = ['act-confluence','act-source','act-rapids','act-valley','act-delta','approach','portfolio','act-ocean'];
  let ranges = [];
  function measure(){
    ranges = secIds.map(id => { const el = $('#'+id); if(!el) return null;
      const top = el.offsetTop; return { id, top, bottom: top + el.offsetHeight }; }).filter(Boolean);
  }
  function updateChapter(){
    const mid = window.scrollY + window.innerHeight*0.5;
    let active = ranges[0]?.id;
    ranges.forEach(r => { if (mid >= r.top && mid < r.bottom) active = r.id; });
    dots.forEach(d => d.classList.toggle('active', d.getAttribute('href') === '#'+active));
  }
  measure(); updateChapter();
  window.addEventListener('resize', () => { measure(); if(hasGSAP) ScrollTrigger.refresh(); });
  window.addEventListener('load', () => { measure(); if(hasGSAP) ScrollTrigger.refresh(); });

  if (hasGSAP) window.addEventListener('load', () => ScrollTrigger.refresh());
});
