(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  window.esc = esc;

  /* ---------- permission gate ---------- */
  const boot = document.getElementById('boot'), gateEl = document.getElementById('gate');
  const why = document.getElementById('gate-why'), deny = document.getElementById('gate-deny');
  const allow = document.getElementById('gate-allow'), av = document.getElementById('gate-av');
  av.innerHTML = window.CAST ? CAST.agent() : '';
  const ss = { get: k => { try { return sessionStorage.getItem(k) || localStorage.getItem(k); } catch (e) { return null; } } };
  function enter(always) {
    try { sessionStorage.setItem('allowed', '1'); if (always) localStorage.setItem('allowed', '1'); } catch (e) {}
    document.body.classList.add('entered');
    boot.classList.add('gone');
    setTimeout(() => boot.hidden = true, 950);
  }
  if (ss.get('allowed') === '1') { boot.hidden = true; document.body.classList.add('entered'); }
  else {
    allow.focus();
    allow.onclick = () => { why.textContent = 'Running show_portfolio… ok'; setTimeout(() => enter(false), 350); };
    document.getElementById('gate-always').onclick = () => enter(true);
    let denials = 0;
    const LINES = [
      'Permission denied. Agent is processing this emotionally.',
      'Denied again. Retrying with exponential backoff…',
      'Fine. Agent has overridden your decision. This is exactly what alignment researchers warned about.'
    ];
    deny.onclick = () => {
      denials++;
      why.textContent = LINES[Math.min(denials, 3) - 1];
      gateEl.classList.add('sad');
      allow.classList.add('bigger');
      gateEl.classList.remove('shake'); void gateEl.offsetWidth; gateEl.classList.add('shake');
      if (denials >= 3) setTimeout(() => enter(false), 1600);
    };
    // after the second no, the Deny button gets shy and runs from the mouse
    deny.addEventListener('pointerenter', e => {
      if (denials < 2 || e.pointerType !== 'mouse' || reduce) return;
      const r = gateEl.getBoundingClientRect(), b = deny.getBoundingClientRect();
      const x = (Math.random() - .5) * (r.width - b.width), y = (Math.random() - .5) * 140;
      deny.style.transform = `translate(${x}px, ${y}px)`;
    });
  }

  /* ---------- cards ---------- */
  const D = window.DATA;
  const card = (s, proj) => `
    <article class="card${proj ? ' proj' : ''}" id="card-${s.id}">
      <span class="found" data-found="${s.id}" hidden>Unlocked</span>
      ${proj ? `<canvas data-art="${s.id}" aria-hidden="true"></canvas><div class="inner">` : ''}
      <span class="when">${esc(s.when)}</span>
      <h3>${esc(s.title)}</h3>
      <p class="org">${esc(s.org)}</p>
      <ul>${s.b.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <div class="tags">${s.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>
      ${proj ? '</div>' : ''}
    </article>`;
  const expStrip = document.getElementById('exp-strip');
  if (expStrip) expStrip.innerHTML = D.sections.filter(s => s.type === 'exp').map(s => card(s, false)).join('');
  document.getElementById('proj-strip').innerHTML = D.sections.filter(s => s.type === 'proj').map(s => card(s, true)).join('');
  document.getElementById('skills-grid').innerHTML = D.skills.map(([h, list]) =>
    `<div><h3>${esc(h)}</h3><div class="chips">${list.map(x => `<span>${esc(x)}</span>`).join('')}</div></div>`).join('');

  /* project covers: a little circuit-board drawing, seeded per project */
  function rng(seed) { let x = 0; for (const c of seed) x = (x * 31 + c.charCodeAt(0)) | 0; return () => ((x = (x * 1103515245 + 12345) | 0) >>> 0) / 4294967296; }
  function art(cv) {
    const w = cv.clientWidth, h = cv.clientHeight; if (!w) return;
    const d = Math.min(devicePixelRatio || 1, 2); cv.width = w * d; cv.height = h * d;
    const g = cv.getContext('2d'); g.scale(d, d);
    const R = rng(cv.dataset.art), cols = ['#5EF2C2', '#FFE45E', '#FF6B8B', '#C59BFF', '#FFB547'];
    g.fillStyle = '#11143A'; g.fillRect(0, 0, w, h);
    const S = 22; g.lineCap = 'round'; g.lineJoin = 'round';
    for (let k = 0; k < 16; k++) {
      let x = Math.floor(R() * w / S) * S, y = Math.floor(R() * h / S) * S;
      g.strokeStyle = k < 3 ? cols[Math.floor(R() * cols.length)] : '#3B44C9';
      g.lineWidth = k < 3 ? 4 : 3; g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 6; s++) { if (R() < .5) x += (R() < .5 ? -1 : 1) * S * (1 + Math.floor(R() * 4)); else y += (R() < .5 ? -1 : 1) * S * (1 + Math.floor(R() * 3)); g.lineTo(x, y); }
      g.stroke(); g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill();
    }
    const cx = w * (.3 + R() * .4), cy = h * .5;
    g.save(); g.translate(cx, cy); g.rotate(Math.PI / 4);
    g.shadowColor = '#FFE45E'; g.shadowBlur = 30; g.fillStyle = '#FFE45E'; g.fillRect(-20, -20, 40, 40);
    g.shadowBlur = 0; g.fillStyle = '#11143A'; g.fillRect(-8, -8, 16, 16); g.restore();
  }
  const drawArt = () => document.querySelectorAll('canvas[data-art]').forEach(art);
  drawArt(); addEventListener('resize', () => { clearTimeout(window.__a); window.__a = setTimeout(drawArt, 150); });

  /* ---------- drag-to-fling strips ---------- */
  document.querySelectorAll('.strip').forEach(el => {
    let down = false, sx = 0, sl = 0, v = 0, lx = 0, lt = 0, raf = 0, moved = false;
    el.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse') return; // touch uses native scrolling
      down = true; moved = false; sx = lx = e.clientX; sl = el.scrollLeft; v = 0; lt = performance.now();
      cancelAnimationFrame(raf);
    });
    addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - sx; if (Math.abs(dx) > 4) { moved = true; el.classList.add('dragging'); }
      el.scrollLeft = sl - dx;
      const now = performance.now(); v = (e.clientX - lx) / Math.max(1, now - lt); lx = e.clientX; lt = now;
    });
    addEventListener('pointerup', () => {
      if (!down) return; down = false; el.classList.remove('dragging');
      if (reduce) return;
      let vel = v * 16;
      const glide = () => { el.scrollLeft -= vel; vel *= .94; if (Math.abs(vel) > .4) raf = requestAnimationFrame(glide); };
      glide();
    });
    el.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
    el.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.shiftKey) { el.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
    el.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { el.scrollBy({ left: 320, behavior: 'smooth' }); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { el.scrollBy({ left: -320, behavior: 'smooth' }); e.preventDefault(); }
    });
  });

  /* ---------- copy email ---------- */
  document.getElementById('copy').onclick = async () => {
    const t = document.getElementById('toast');
    try { await navigator.clipboard.writeText('yuktha.gowda12@gmail.com'); t.textContent = 'Email copied'; }
    catch (e) { t.textContent = 'Copy failed. Select the address above instead.'; }
    setTimeout(() => t.textContent = '', 2500);
  };
})();
