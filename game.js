// The maze game. Collect chips to unlock resume sections; avoid the bugs.
(() => {
const S = window.DATA.sections, esc = window.esc;
const MAZE = [
"###################",
"#.....#.....#.....#",
"#.###.#.###.#.###.#",
"#.#.............#.#",
"#.#.##.#####.##.#.#",
"#......#...#......#",
"###.##.#.#.#.##.###",
"#.....#.....#.....#",
"#.###.#.###.#.###.#",
"#.#.............#.#",
"#.#.###.#.#.###.#.#",
"#.....#.#.#.#.....#",
"#.###.#.....#.###.#",
"#.................#",
"###################"];
const COLS = 19, ROWS = 15;
const wall = (x, y) => x < 0 || y < 0 || x >= COLS || y >= ROWS || MAZE[y][x] === '#';
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
const CHIP_POS = [[3, 3], [15, 3], [1, 5], [17, 9], [5, 11], [13, 11], [9, 13], [3, 9]];
const BUG_START = [[1, 1], [17, 1], [17, 13]];
const BUG_COL = ['#FF6B8B', '#FFB547', '#C59BFF'];

const cv = document.getElementById('game'), g = cv.getContext('2d');
let T = 30, dpr = 1, board = null;
function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  const w = cv.parentElement.clientWidth; if (!w) return; T = w / COLS;
  cv.width = Math.round(w * dpr); cv.height = Math.round(T * ROWS * dpr);
  cv.style.height = (T * ROWS) + 'px';
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildBoard(); draw();
}

let player, bugs, chips, lives = 3, state = 'ready', grace = 0, clock = 0, hitT = 0, runMs = 0;
const timerEl = document.getElementById('timer');
const fmt = ms => { const t = ms / 1000, m = Math.floor(t / 60), sec = (t % 60).toFixed(1).padStart(4, '0'); return `${m}:${sec}`; };
window.fmtTime = fmt;
const unlocked = new Set();
const ent = (x, y) => ({ x, y, dir: null, next: null, p: 0 });
function reset(full) {
  player = ent(9, 7);
  bugs = BUG_START.map((p, i) => Object.assign(ent(p[0], p[1]), { c: BUG_COL[i] }));
  if (full) lives = 3;
  chips = S.map((s, i) => ({ x: CHIP_POS[i][0], y: CHIP_POS[i][1], s, got: unlocked.has(s.id) }));
  grace = 1.2; hud();
}
const open = (e, d) => d && !wall(e.x + DIRS[d][0], e.y + DIRS[d][1]);
function moveEnt(e, speed, dt, choose) {
  if (!e.dir) { choose(e); if (!e.dir) return; }
  e.p += speed * dt;
  while (e.p >= 1) {
    e.x += DIRS[e.dir][0]; e.y += DIRS[e.dir][1]; e.p -= 1;
    choose(e);
    if (!e.dir) { e.p = 0; break; }
  }
}
function choosePlayer(e) {
  if (e.next && open(e, e.next)) e.dir = e.next;
  else if (!open(e, e.dir)) e.dir = null;
}
function chooseBug(e) {
  let opts = Object.keys(DIRS).filter(d => open(e, d) && d !== OPP[e.dir]);
  if (!opts.length) opts = [OPP[e.dir]];
  if (Math.random() < .72) {
    const dist = d => Math.hypot(e.x + DIRS[d][0] - player.x, e.y + DIRS[d][1] - player.y);
    opts.sort((a, b) => dist(a) - dist(b)); e.dir = opts[0];
  } else e.dir = opts[Math.floor(Math.random() * opts.length)];
}
function steer(d) {
  if (state !== 'play') return;
  if (player.dir && d === OPP[player.dir] && player.p > 0) {
    player.x += DIRS[player.dir][0]; player.y += DIRS[player.dir][1];
    player.p = 1 - player.p; player.dir = d; player.next = d; return;
  }
  player.next = d;
  if (!player.dir && open(player, d)) player.dir = d;
}
const pos = e => e.dir ? [e.x + DIRS[e.dir][0] * e.p, e.y + DIRS[e.dir][1] * e.p] : [e.x, e.y];

/* static board drawn once: circuit traces for walls */
function buildBoard() {
  board = document.createElement('canvas'); board.width = cv.width; board.height = cv.height;
  const b = board.getContext('2d'); b.setTransform(dpr, 0, 0, dpr, 0, 0);
  b.fillStyle = '#11143A'; b.fillRect(0, 0, COLS * T, ROWS * T);
  b.fillStyle = 'rgba(169,156,255,.10)';
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (!wall(x, y)) { b.beginPath(); b.arc((x + .5) * T, (y + .5) * T, Math.max(1, T * .04), 0, 7); b.fill(); }
  b.lineCap = 'round'; b.strokeStyle = '#3B44C9'; b.lineWidth = T * .26;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (!wall(x, y)) continue;
    const cx = (x + .5) * T, cy = (y + .5) * T;
    if (x + 1 < COLS && wall(x + 1, y)) { b.beginPath(); b.moveTo(cx, cy); b.lineTo(cx + T, cy); b.stroke(); }
    if (y + 1 < ROWS && wall(x, y + 1)) { b.beginPath(); b.moveTo(cx, cy); b.lineTo(cx, cy + T); b.stroke(); }
  }
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (!wall(x, y)) continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, c]) => { const X = x + a, Y = y + c; return X >= 0 && Y >= 0 && X < COLS && Y < ROWS && wall(X, Y); }).length;
    if (n === 1 || n >= 3) {
      b.fillStyle = '#11143A'; b.beginPath(); b.arc((x + .5) * T, (y + .5) * T, T * .24, 0, 7); b.fill();
      b.strokeStyle = '#7E86FF'; b.lineWidth = T * .09; b.beginPath(); b.arc((x + .5) * T, (y + .5) * T, T * .2, 0, 7); b.stroke();
      b.strokeStyle = '#3B44C9'; b.lineWidth = T * .26;
    }
  }
}

function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function drawAgent(x, y, dir) {
  const s = T * .78, cx = (x + .5) * T, cy = (y + .5) * T + T * .05;
  g.strokeStyle = '#5EF2C2'; g.lineWidth = T * .07; g.beginPath(); g.moveTo(cx, cy - s * .42); g.lineTo(cx, cy - s * .66); g.stroke();
  g.fillStyle = (Math.floor(clock * 3) % 2) ? '#FFE45E' : '#5EF2C2'; g.beginPath(); g.arc(cx, cy - s * .68, T * .07, 0, 7); g.fill();
  g.fillStyle = '#5EF2C2'; rr(g, cx - s / 2, cy - s * .42, s, s * .8, s * .22); g.fill();
  g.fillStyle = '#151845'; rr(g, cx - s * .36, cy - s * .27, s * .72, s * .36, s * .14); g.fill();
  const [dx, dy] = dir ? DIRS[dir] : [0, 0];
  g.fillStyle = '#5EF2C2';
  for (const ox of [-.16, .16]) { g.beginPath(); g.arc(cx + s * ox + dx * s * .06, cy - s * .09 + dy * s * .04, T * .06, 0, 7); g.fill(); }
}
function drawBug(x, y, c, dir, i) {
  const cx = (x + .5) * T, cy = (y + .5) * T, a = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[dir] || 0;
  g.save(); g.translate(cx, cy); g.rotate(a);
  const wig = Math.sin(clock * 18 + i) * T * .06;
  g.strokeStyle = c; g.lineWidth = T * .05;
  for (const sx of [-.15, 0, .15]) for (const sy of [-1, 1]) { g.beginPath(); g.moveTo(sx * T, 0); g.lineTo(sx * T + (sy > 0 ? wig : -wig), sy * T * .36); g.stroke(); }
  g.beginPath(); g.moveTo(T * .28, -T * .05); g.lineTo(T * .42, -T * .18); g.moveTo(T * .28, T * .05); g.lineTo(T * .42, T * .18); g.stroke();
  g.fillStyle = c; g.beginPath(); g.ellipse(-T * .04, 0, T * .25, T * .2, 0, 0, 7); g.fill();
  g.beginPath(); g.arc(T * .24, 0, T * .1, 0, 7); g.fill();
  g.strokeStyle = 'rgba(21,24,69,.6)'; g.lineWidth = T * .04; g.beginPath(); g.moveTo(-T * .28, 0); g.lineTo(T * .18, 0); g.stroke();
  g.restore();
}
function drawChip(c) {
  const cx = (c.x + .5) * T, cy = (c.y + .5) * T, s = T * (.24 + Math.sin(clock * 4 + c.x) * .03);
  g.save(); g.translate(cx, cy); g.rotate(Math.PI / 4 + clock * .6);
  g.shadowColor = '#FFE45E'; g.shadowBlur = T * .5;
  g.fillStyle = '#FFE45E'; g.fillRect(-s / 2, -s / 2, s, s);
  g.shadowBlur = 0; g.fillStyle = '#151845'; g.fillRect(-s / 5, -s / 5, s / 2.5, s / 2.5);
  g.restore();
}
function draw() {
  if (!board || !board.width || !board.height) return;
  g.drawImage(board, 0, 0, board.width, board.height, 0, 0, COLS * T, ROWS * T);
  chips.forEach(c => { if (!c.got) drawChip(c); });
  bugs.forEach((b, i) => { const [x, y] = pos(b); g.globalAlpha = grace > 0 && state === 'play' ? .45 : 1; drawBug(x, y, b.c, b.dir, i); });
  g.globalAlpha = 1;
  const [px, py] = pos(player);
  if (!(state === 'hit' && Math.floor(clock * 10) % 2)) drawAgent(px, py, player.dir || player.next);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; clock += dt;
  if (state === 'play' || state === 'hit') { runMs += dt * 1000; timerEl.textContent = fmt(runMs); }
  if (state === 'play') {
    moveEnt(player, 5.4, dt, choosePlayer);
    if (grace > 0) grace -= dt; else bugs.forEach(b => moveEnt(b, 3.3 + unlocked.size * .12, dt, chooseBug));
    const [px, py] = pos(player);
    for (const c of chips) if (!c.got && Math.hypot(c.x - px, c.y - py) < .5) { c.got = true; collect(c.s); break; }
    if (state === 'play' && grace <= 0) for (const b of bugs) { const [bx, by] = pos(b); if (Math.hypot(bx - px, by - py) < .6) { lives--; hud(); state = 'hit'; hitT = 1; break; } }
  } else if (state === 'hit') {
    hitT -= dt; if (hitT <= 0) { if (lives <= 0) end('over'); else { reset(false); state = 'play'; } }
  }
  draw(); requestAnimationFrame(loop);
}

/* ui */
const ov = document.getElementById('ov'), ovT = document.getElementById('ov-title'), ovP = document.getElementById('ov-text'), ovB = document.getElementById('ov-btn');
function hud() {
  document.getElementById('score').textContent = `Unlocked ${unlocked.size}/8`;
  const l = document.getElementById('lives'), n = Math.max(0, lives);
  l.textContent = '♥'.repeat(n) + '♡'.repeat(3 - n); l.setAttribute('aria-label', `${n} lives left`);
}
function start() {
  if (state === 'won') { unlocked.clear(); document.querySelectorAll('.found').forEach(f => f.hidden = true); }
  if (unlocked.size === 0) { runMs = 0; timerEl.textContent = fmt(0); }
  document.querySelector('.score-form[data-game="maze"]').hidden = true; document.querySelector('.score-status[data-game="maze"]').textContent = '';
  reset(true); ov.hidden = true; state = 'play';
}
function end(kind) {
  state = kind; ov.hidden = false;
  if (kind === 'over') { ovT.textContent = 'Build failed'; ovP.textContent = `The bugs got you. You keep the ${unlocked.size} chips you found, so the next run is shorter.`; ovB.textContent = 'Try again'; }
  else {
    ovT.textContent = 'All 8 unlocked in ' + fmt(runMs);
    ovP.textContent = 'You’ve seen the whole resume. Now imagine what I could build on your team.';
    ovB.textContent = 'Play again';
    dispatchEvent(new CustomEvent('arcade:result', { detail: { game: 'maze', value: Math.round(runMs) } }));
  }
}
ovB.onclick = () => { if (state === 'paused') { ov.hidden = true; state = 'play'; grace = 1; } else start(); };
addEventListener('arcade:pause', e => {
  if (e.detail !== 'maze' && (state === 'play' || state === 'hit')) {
    state = 'paused'; ov.hidden = false;
    ovT.textContent = 'Paused'; ovP.textContent = `Your run is waiting. ${unlocked.size}/8 chips so far.`; ovB.textContent = 'Resume';
    document.querySelector('.score-form[data-game="maze"]').hidden = true;
  }
});

const dlg = document.getElementById('dlg');
function collect(s) {
  unlocked.add(s.id); hud(); state = 'card';
  document.querySelectorAll(`[data-found="${s.id}"]`).forEach(f => f.hidden = false);
  document.getElementById('c-kind').textContent = s.kind;
  document.getElementById('c-count').textContent = `${unlocked.size}/8`;
  document.getElementById('c-title').textContent = s.title;
  document.getElementById('c-org').textContent = [s.org, s.when].filter(Boolean).join('. ');
  document.getElementById('c-content').innerHTML =
    (s.tags.length ? `<div class="tags">${s.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : '') +
    `<ul>${s.b.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
  document.getElementById('c-go').textContent = unlocked.size === 8 ? 'Finish' : 'Keep playing';
  dlg.showModal();
}
dlg.addEventListener('close', () => { if (unlocked.size === 8) end('won'); else { state = 'play'; grace = 1; player.next = player.dir; } });
document.getElementById('c-go').onclick = () => dlg.close();

/* input */
let inView = false;
new IntersectionObserver(es => inView = es[0].isIntersecting, { threshold: .4 }).observe(cv);
const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
addEventListener('keydown', e => {
  const d = KEYS[e.key]; if (!d || dlg.open || !inView) return;
  const a = document.activeElement;
  if (a && (/^(INPUT|TEXTAREA)$/.test(a.tagName) || a.classList.contains('strip'))) return;
  if (state === 'ready') start();
  if (state === 'play' || state === 'hit') { e.preventDefault(); steer(d); }
});
document.querySelectorAll('.pad button').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); if (state === 'ready') start(); steer(b.dataset.d); }));
let ts = null;
cv.addEventListener('pointerdown', e => ts = [e.clientX, e.clientY]);
cv.addEventListener('pointerup', e => {
  if (!ts) return; const dx = e.clientX - ts[0], dy = e.clientY - ts[1]; ts = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
  if (state === 'ready') start();
  steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});

reset(true);
addEventListener('resize', () => { clearTimeout(window.__g); window.__g = setTimeout(resize, 120); });
resize(); requestAnimationFrame(t => { last = t; loop(t); });
if (document.fonts) document.fonts.ready.then(resize);
})();
