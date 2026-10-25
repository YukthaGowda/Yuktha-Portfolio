// Multiplayer bits: visitor counter, live cursors, guestbook, leaderboard, global bug counter.
// Everything here stays hidden until config.js has your Supabase keys.
(() => {
  const URL_ = window.SUPABASE_URL, KEY = window.SUPABASE_ANON_KEY;
  if (!URL_ || !KEY || !window.supabase) return;
  const sb = window.supabase.createClient(URL_, KEY);
  window.SB = sb;

  /* ---------- who am I ---------- */
  const ADJ = ['curious', 'sleepy', 'brave', 'speedy', 'quiet', 'clever', 'cosmic', 'fuzzy', 'lucky', 'sunny'];
  const ANI = ['otter', 'panda', 'fox', 'koala', 'owl', 'tiger', 'yak', 'gecko', 'heron', 'lemur'];
  const COLS = ['#5EF2C2', '#FFE45E', '#FF6B8B', '#FFB547', '#C59BFF', '#7FD1FF'];
  const me = Math.random().toString(36).slice(2);
  const myColor = COLS[Math.floor(Math.random() * COLS.length)];
  const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  let myName = store.get('visitor-name') || '';
  const handle = ADJ[Math.floor(Math.random() * ADJ.length)] + ' ' + ANI[Math.floor(Math.random() * ANI.length)];
  const label = () => myName || handle;
  window.setVisitorName = n => { myName = n; store.set('visitor-name', n); };

  /* ---------- presence + live cursors ---------- */
  const room = sb.channel('portfolio-online', { config: { presence: { key: me }, broadcast: { self: false } } });
  const layer = document.getElementById('cursors');
  const others = new Map();

  function cursorEl(id, c) {
    const el = document.createElement('div');
    el.className = 'cursor';
    el.innerHTML = `<svg viewBox="0 0 20 22" width="20" height="22"><path d="M2 2 L18 11 L10 12.5 L6 20 Z" fill="${c}" stroke="#151845" stroke-width="1.5" stroke-linejoin="round"/></svg><span style="background:${c}"></span>`;
    layer.appendChild(el); others.set(id, { el, t: 0 });
    return others.get(id);
  }
  room.on('broadcast', { event: 'cur' }, ({ payload: p }) => {
    if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') return;
    const o = others.get(p.id) || cursorEl(p.id, COLS.includes(p.c) ? p.c : COLS[0]);
    o.t = Date.now();
    o.el.style.transform = `translate(${p.x * innerWidth}px, ${p.y * document.documentElement.scrollHeight}px)`;
    o.el.querySelector('span').textContent = String(p.n || 'visitor').slice(0, 24);
    o.el.classList.remove('gone');
  });
  setInterval(() => {
    const now = Date.now();
    for (const [id, o] of others) {
      if (now - o.t > 4000) o.el.classList.add('gone');
      if (now - o.t > 20000) { o.el.remove(); others.delete(id); }
    }
  }, 1000);

  room.on('presence', { event: 'sync' }, () => {
    const n = Object.keys(room.presenceState()).length || 1;
    document.getElementById('presence-n').textContent = n;
    document.getElementById('presence-l').textContent = n === 1 ? 'here now (that’s you)' : 'here now';
    document.getElementById('presence').hidden = false;
  });
  room.on('presence', { event: 'leave' }, ({ key }) => { const o = others.get(key); if (o) { o.el.remove(); others.delete(key); } });
  room.subscribe(status => { if (status === 'SUBSCRIBED') room.track({ at: Date.now() }); });

  let lastSend = 0;
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const now = performance.now(); if (now - lastSend < 60) return; lastSend = now;
    room.send({ type: 'broadcast', event: 'cur', payload: { id: me, x: e.clientX / innerWidth, y: e.pageY / document.documentElement.scrollHeight, c: myColor, n: label() } });
  }, { passive: true });

  /* ---------- leaderboard (one per arcade game) ---------- */
  const board = document.getElementById('board'), list = document.getElementById('board-list');
  const META = {
    maze:   { title: 'Fastest agents', sub: 'Time to unlock all 8 chips', col: 'ms', asc: true, fmt: v => window.fmtTime ? window.fmtTime(v) : (v / 1000).toFixed(1) + 's' },
    facts:  { title: 'Best lie detectors', sub: 'Hallucination or Fact? points', col: 'points', asc: false, fmt: v => v + ' pts' },
    inject: { title: 'Top defenders', sub: 'Injection Defense points', col: 'points', asc: false, fmt: v => v + ' pts' }
  };
  let current = 'maze';
  board.hidden = false;
  async function loadBoard(game = current, highlightId) {
    const m = META[game];
    document.getElementById('board-title').textContent = m.title;
    document.getElementById('board-sub').textContent = m.sub;
    const { data, error } = await sb.from('scores').select(`id,name,${m.col}`).eq('game', game).not(m.col, 'is', null)
      .order(m.col, { ascending: m.asc }).limit(10);
    if (game !== current) return;
    if (error) { list.innerHTML = '<li class="board-empty">Leaderboard couldn’t load. Run supabase-v3.sql in Supabase.</li>'; return; }
    if (!data.length) { list.innerHTML = '<li class="board-empty">No scores yet. Be the first.</li>'; return; }
    list.innerHTML = '';
    data.forEach(r => {
      const li = document.createElement('li'); if (r.id === highlightId) li.className = 'you';
      const n = document.createElement('span'); n.textContent = r.name;
      const t = document.createElement('b'); t.textContent = m.fmt(r[m.col]);
      li.append(n, t); list.appendChild(li);
    });
  }
  loadBoard();
  addEventListener('arcade:switch', e => { current = e.detail; loadBoard(); });
  sb.channel('scores-live').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scores' },
    p => { if ((p.new.game || 'maze') === current) loadBoard(); }).subscribe();

  const pending = {};
  addEventListener('arcade:result', e => {
    const { game, value } = e.detail; pending[game] = value;
    const f = document.querySelector(`.score-form[data-game="${game}"]`);
    document.querySelector(`.score-status[data-game="${game}"]`).textContent = '';
    f.hidden = false; const inp = f.querySelector('input'); inp.value = myName; setTimeout(() => inp.focus(), 50);
  });
  document.querySelectorAll('.score-form').forEach(f => {
    const game = f.dataset.game, inp = f.querySelector('input'), btn = f.querySelector('button');
    const status = document.querySelector(`.score-status[data-game="${game}"]`);
    async function save() {
      const name = inp.value.trim();
      if (!name) { status.textContent = 'Add a name for the leaderboard.'; return; }
      if (pending[game] == null) return;
      btn.disabled = true; status.textContent = 'Saving…';
      const row = { name, game }; row[META[game].col] = pending[game];
      const { data, error } = await sb.from('scores').insert(row).select('id').single();
      btn.disabled = false;
      if (error) { status.textContent = 'Couldn’t save that. Try again.'; return; }
      window.setVisitorName(name); pending[game] = null; f.hidden = true;
      status.textContent = 'Saved. Check the leaderboard.';
      if (game === current) loadBoard(game, data.id);
    }
    btn.onclick = save;
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') save(); });
  });

  /* ---------- global bug counter ---------- */
  const allWrap = document.getElementById('bugs-all-wrap'), allEl = document.getElementById('bugs-all');
  const showAll = v => { allEl.textContent = Number(v).toLocaleString(); allWrap.hidden = false; };
  sb.from('stats').select('value').eq('id', 'bugs_squashed').single().then(({ data }) => { if (data) showAll(data.value); });
  sb.channel('stats-live').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stats' }, p => { if (p.new.id === 'bugs_squashed') showAll(p.new.value); }).subscribe();
  addEventListener('bug:squashed', async () => {
    const { data } = await sb.rpc('squash_bug');
    if (typeof data === 'number') showAll(data);
  });

  /* ---------- guestbook ---------- */
  document.getElementById('wall').hidden = false;
  document.getElementById('nav-wall').hidden = false;

  const cv = document.getElementById('draw'), g = cv.getContext('2d');
  const W = cv.width, H = cv.height, PAPER = '#F7F6FF';
  const PEN = ['#151845', '#5EF2C2', '#FFE45E', '#FF6B8B', '#FFB547', '#C59BFF'];
  let tool = 'pen', color = PEN[0], drawing = false, last = null, dirty = false;
  const clear = () => { g.fillStyle = PAPER; g.fillRect(0, 0, W, H); dirty = false; };
  clear();
  const sw = document.getElementById('swatches');
  PEN.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'sw' + (i === 0 ? ' on' : ''); b.style.background = c; b.setAttribute('aria-label', 'Color ' + c);
    b.onclick = () => { color = c; sw.querySelectorAll('.sw').forEach(x => x.classList.toggle('on', x === b)); if (tool === 'eraser') setTool('pen'); };
    sw.appendChild(b);
  });
  function setTool(t) { tool = t; document.querySelectorAll('[data-tool]').forEach(b => { const on = b.dataset.tool === t; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); }
  document.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));
  document.getElementById('clear').onclick = clear;
  const at = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
  function paint(p) {
    dirty = true;
    if (tool === 'spray') { g.fillStyle = color; for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28, r = Math.random() * 16; g.fillRect(p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r, 1.6, 1.6); } return; }
    g.strokeStyle = tool === 'eraser' ? PAPER : color; g.lineWidth = tool === 'eraser' ? 22 : 4; g.lineCap = g.lineJoin = 'round';
    g.beginPath(); g.moveTo(...(last || p)); g.lineTo(...p); g.stroke();
  }
  cv.addEventListener('pointerdown', e => { drawing = true; cv.setPointerCapture(e.pointerId); last = at(e); paint(last); });
  cv.addEventListener('pointermove', e => { if (!drawing) return; const p = at(e); paint(p); last = p; });
  const stop = () => { drawing = false; last = null; };
  cv.addEventListener('pointerup', stop); cv.addEventListener('pointercancel', stop);

  const wall = document.getElementById('wall-list'), seen = new Set();
  function note(row, fresh) {
    if (seen.has(row.id) || !String(row.drawing).startsWith('data:image/')) return;
    seen.add(row.id);
    const el = document.createElement('figure'); el.className = 'note' + (fresh ? ' new' : ''); el.style.margin = 0;
    const img = new Image(); img.alt = `Drawing by ${row.name}`; img.src = row.drawing; img.loading = 'lazy';
    const b = document.createElement('b'); b.textContent = row.name;
    el.append(img, b);
    if (row.message) { const s = document.createElement('span'); s.textContent = row.message; el.append(s); }
    wall.querySelector('.wall-empty')?.remove();
    fresh ? wall.prepend(el) : wall.append(el);
    while (wall.children.length > 30) wall.lastChild.remove();
  }
  (async () => {
    const { data, error } = await sb.from('guestbook').select('id,name,message,drawing,created_at').order('created_at', { ascending: false }).limit(24);
    if (error) { wall.innerHTML = '<p class="wall-empty">The wall couldn’t load. Check the Supabase setup in README.md.</p>'; return; }
    if (!data.length) wall.innerHTML = '<p class="wall-empty">The wall is empty. Be the first to draw something.</p>';
    data.forEach(r => note(r, false));
  })();
  sb.channel('guestbook-live').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'guestbook' }, p => note(p.new, true)).subscribe();

  const gStatus = document.getElementById('gb-status'), postBtn = document.getElementById('gb-post');
  document.getElementById('gb-name').value = myName;
  postBtn.onclick = async () => {
    const name = document.getElementById('gb-name').value.trim();
    const message = document.getElementById('gb-msg').value.trim();
    if (!name) { gStatus.textContent = 'Add your name so Yuktha knows who drew it.'; return; }
    if (!dirty) { gStatus.textContent = 'Draw something first.'; return; }
    if (Date.now() - (+store.get('gb-last') || 0) < 60000) { gStatus.textContent = 'You can post again in a minute.'; return; }
    const small = document.createElement('canvas'); small.width = 360; small.height = 240;
    small.getContext('2d').drawImage(cv, 0, 0, 360, 240);
    let img = small.toDataURL('image/webp', .75); if (!img.startsWith('data:image/webp')) img = small.toDataURL('image/png');
    postBtn.disabled = true; gStatus.textContent = 'Posting…';
    const { data, error } = await sb.from('guestbook').insert({ name, message: message || null, drawing: img }).select().single();
    postBtn.disabled = false;
    if (error) { gStatus.textContent = 'Couldn’t post. Try again in a moment.'; return; }
    store.set('gb-last', Date.now()); window.setVisitorName(name);
    note(data, true); clear(); document.getElementById('gb-msg').value = '';
    gStatus.textContent = 'Posted. Everyone can see it now.';
  };
})();
