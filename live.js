// Multiplayer bits: live visitor counter + shared guestbook wall.
// Both stay hidden until config.js has your Supabase keys.
(() => {
  const URL_ = window.SUPABASE_URL, KEY = window.SUPABASE_ANON_KEY;
  if (!URL_ || !KEY || !window.supabase) return;
  const sb = window.supabase.createClient(URL_, KEY);

  /* ---------- presence: how many people are here right now ---------- */
  const me = Math.random().toString(36).slice(2);
  const room = sb.channel('portfolio-online', { config: { presence: { key: me } } });
  room.on('presence', { event: 'sync' }, () => {
    const n = Object.keys(room.presenceState()).length || 1;
    document.getElementById('presence-n').textContent = n;
    document.getElementById('presence-l').textContent = n === 1 ? 'here now (that’s you)' : 'here now';
    document.getElementById('presence').hidden = false;
  }).subscribe(status => { if (status === 'SUBSCRIBED') room.track({ at: Date.now() }); });

  /* ---------- guestbook ---------- */
  document.getElementById('wall').hidden = false;
  document.getElementById('nav-wall').hidden = false;

  const cv = document.getElementById('draw'), g = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const PAPER = '#F7F6FF';
  const COLORS = ['#151845', '#5EF2C2', '#FFE45E', '#FF6B8B', '#FFB547', '#C59BFF'];
  let tool = 'pen', color = COLORS[0], drawing = false, last = null, dirty = false;
  const clear = () => { g.fillStyle = PAPER; g.fillRect(0, 0, W, H); dirty = false; };
  clear();

  const sw = document.getElementById('swatches');
  COLORS.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'sw' + (i === 0 ? ' on' : ''); b.style.background = c; b.setAttribute('aria-label', 'Color ' + c);
    b.onclick = () => { color = c; sw.querySelectorAll('.sw').forEach(x => x.classList.toggle('on', x === b)); if (tool === 'eraser') setTool('pen'); };
    sw.appendChild(b);
  });
  function setTool(t) {
    tool = t;
    document.querySelectorAll('[data-tool]').forEach(b => { const on = b.dataset.tool === t; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  }
  document.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));
  document.getElementById('clear').onclick = clear;

  const at = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
  function paint(p) {
    dirty = true;
    if (tool === 'spray') {
      g.fillStyle = color;
      for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28, r = Math.random() * 16; g.fillRect(p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r, 1.6, 1.6); }
      return;
    }
    g.strokeStyle = tool === 'eraser' ? PAPER : color; g.lineWidth = tool === 'eraser' ? 22 : 4;
    g.lineCap = g.lineJoin = 'round';
    g.beginPath(); g.moveTo(...(last || p)); g.lineTo(...p); g.stroke();
  }
  cv.addEventListener('pointerdown', e => { drawing = true; cv.setPointerCapture(e.pointerId); last = at(e); paint(last); });
  cv.addEventListener('pointermove', e => { if (!drawing) return; const p = at(e); paint(p); last = p; });
  const stop = () => { drawing = false; last = null; };
  cv.addEventListener('pointerup', stop); cv.addEventListener('pointercancel', stop);

  /* wall */
  const list = document.getElementById('wall-list');
  const seen = new Set();
  function note(row, fresh) {
    if (seen.has(row.id) || !String(row.drawing).startsWith('data:image/')) return;
    seen.add(row.id);
    const el = document.createElement('figure'); el.className = 'note' + (fresh ? ' new' : ''); el.style.margin = 0;
    const img = new Image(); img.alt = `Drawing by ${row.name}`; img.src = row.drawing; img.loading = 'lazy';
    const b = document.createElement('b'); b.textContent = row.name;
    el.append(img, b);
    if (row.message) { const s = document.createElement('span'); s.textContent = row.message; el.append(s); }
    list.querySelector('.wall-empty')?.remove();
    fresh ? list.prepend(el) : list.append(el);
    while (list.children.length > 30) list.lastChild.remove();
  }
  (async () => {
    const { data, error } = await sb.from('guestbook').select('id,name,message,drawing,created_at').order('created_at', { ascending: false }).limit(24);
    if (error) { list.innerHTML = '<p class="wall-empty">The wall couldn’t load. Check the Supabase setup in README.md.</p>'; return; }
    if (!data.length) list.innerHTML = '<p class="wall-empty">The wall is empty. Be the first to draw something.</p>';
    data.forEach(r => note(r, false));
  })();
  sb.channel('guestbook-live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'guestbook' }, p => note(p.new, true))
    .subscribe();

  /* post */
  const status = document.getElementById('gb-status'), btn = document.getElementById('gb-post');
  btn.onclick = async () => {
    const name = document.getElementById('gb-name').value.trim();
    const message = document.getElementById('gb-msg').value.trim();
    if (!name) { status.textContent = 'Add your name so Yuktha knows who drew it.'; return; }
    if (!dirty) { status.textContent = 'Draw something first.'; return; }
    let lastPost = 0; try { lastPost = +localStorage.getItem('gb-last') || 0; } catch (e) {}
    if (Date.now() - lastPost < 60000) { status.textContent = 'You can post again in a minute.'; return; }
    // shrink before upload to keep rows small
    const small = document.createElement('canvas'); small.width = 360; small.height = 240;
    small.getContext('2d').drawImage(cv, 0, 0, 360, 240);
    let img = small.toDataURL('image/webp', .75);
    if (!img.startsWith('data:image/webp')) img = small.toDataURL('image/png');
    btn.disabled = true; status.textContent = 'Posting…';
    const { data, error } = await sb.from('guestbook').insert({ name, message: message || null, drawing: img }).select().single();
    btn.disabled = false;
    if (error) { status.textContent = 'Couldn’t post. Try again in a moment.'; return; }
    try { localStorage.setItem('gb-last', Date.now()); } catch (e) {}
    note(data, true); clear(); document.getElementById('gb-msg').value = '';
    status.textContent = 'Posted. Everyone can see it now.';
  };
})();
