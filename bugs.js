// Bug hunt: bugs escape the maze and crawl across the page. Click to squash.
(() => {
  const layer = document.getElementById('bugs-layer');
  const mineEl = document.getElementById('bugs-mine');
  const toggle = document.getElementById('bugs-toggle');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLORS = ['#FF6B8B', '#FFB547', '#C59BFF'];
  const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

  document.querySelector('.bug-ico').innerHTML = CAST.bug('#FF6B8B');
  let mine = +store.get('bugs-mine') || 0; mineEl.textContent = mine;
  let paused = reduce || store.get('bugs-paused') === '1';
  const setToggle = () => { toggle.textContent = paused ? 'Release bugs' : 'Pause bugs'; toggle.setAttribute('aria-pressed', paused); };
  setToggle();
  toggle.onclick = () => { paused = !paused; store.set('bugs-paused', paused ? '1' : '0'); setToggle(); if (paused) bugs.slice().forEach(b => leave(b)); };

  const bugs = [];
  function spawn() {
    const c = COLORS[Math.floor(Math.random() * COLORS.length)];
    const el = document.createElement('button');
    el.className = 'crawler'; el.setAttribute('aria-label', 'Squash this bug');
    el.innerHTML = CAST.bug(c);
    layer.appendChild(el);
    const W = innerWidth, H = innerHeight, side = Math.floor(Math.random() * 4);
    const b = { el, x: 0, y: 0, a: 0, v: 70 + Math.random() * 60, life: 18 + Math.random() * 12, dead: false, c };
    if (side === 0) { b.x = -50; b.y = Math.random() * H; b.a = 0; }
    if (side === 1) { b.x = W + 50; b.y = Math.random() * H; b.a = Math.PI; }
    if (side === 2) { b.x = Math.random() * W; b.y = -50; b.a = Math.PI / 2; }
    if (side === 3) { b.x = Math.random() * W; b.y = H + 50; b.a = -Math.PI / 2; }
    el.addEventListener('click', e => { e.stopPropagation(); squash(b); });
    bugs.push(b);
  }
  function remove(b) { const i = bugs.indexOf(b); if (i > -1) bugs.splice(i, 1); setTimeout(() => b.el.remove(), 700); }
  function leave(b) { if (b.dead) return; b.dead = true; b.el.classList.add('fade'); remove(b); }
  function squash(b) {
    if (b.dead) return; b.dead = true;
    b.el.classList.add('splat'); b.el.disabled = true;
    const plus = document.createElement('span'); plus.className = 'plus'; plus.textContent = '+1';
    plus.style.left = b.x + 'px'; plus.style.top = b.y + 'px'; layer.appendChild(plus);
    setTimeout(() => plus.remove(), 900);
    mine++; mineEl.textContent = mine; store.set('bugs-mine', mine);
    dispatchEvent(new CustomEvent('bug:squashed'));
    remove(b);
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const W = innerWidth, H = innerHeight, m = 60;
    for (const b of bugs) {
      if (b.dead) continue;
      b.life -= dt;
      b.a += (Math.random() - .5) * 3 * dt;            // wander
      if (b.life > 0) {                                 // stay on screen while alive
        const tx = W / 2 - b.x, ty = H / 2 - b.y;
        if (b.x < m || b.x > W - m || b.y < m || b.y > H - m) {
          const want = Math.atan2(ty, tx); let d = want - b.a;
          d = Math.atan2(Math.sin(d), Math.cos(d)); b.a += d * 2.5 * dt;
        }
      } else if (b.x < -80 || b.x > W + 80 || b.y < -80 || b.y > H + 80) { leave(b); continue; }
      const step = (Math.sin(now / 180 + b.v) > .85 ? .2 : 1) * b.v * dt; // little pauses
      b.x += Math.cos(b.a) * step; b.y += Math.sin(b.a) * step;
      b.el.style.transform = `translate(${b.x - 27}px, ${b.y - 20}px) rotate(${b.a}rad)`;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function ready() {
    return !paused && document.visibilityState === 'visible' && document.body.classList.contains('entered')
      && !document.querySelector('dialog[open]') && document.getElementById('boot').hidden;
  }
  (function schedule() {
    setTimeout(() => { if (ready() && bugs.length < 3) spawn(); schedule(); }, 9000 + Math.random() * 9000);
  })();
  setTimeout(() => { if (ready()) spawn(); }, 5000);
})();
