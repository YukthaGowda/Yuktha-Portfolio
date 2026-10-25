// Career trace, retrieval playground, agent workflow, threshold toy and tool-call contact.
(() => {
const D = window.DATA, esc = window.esc;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const byId = id => D.sections.find(s => s.id === id);

/* =========================================================
   2. Retrieval playground (BM25 over the resume)
   ========================================================= */
const chunks = [];
D.sections.filter(s => s.type !== 'skills').forEach(s => s.b.forEach(t => chunks.push({ src: s.title, text: t, extra: s.tags.join(' ') })));
D.skills.forEach(([h, l]) => chunks.push({ src: 'Skills: ' + h, text: l.join(', '), extra: '' }));
chunks.push({ src: 'Education', text: 'M.S. Engineering Management at Stevens Institute of Technology, and a B.E. in Computer Science and Engineering from BNM Institute of Technology in Bangalore.', extra: 'degree university school study' });
const STOP = new Set('a an the and or of to in on for with by at from is are was were be has have had she her he it its that this what which who how does did do can could about any some into as'.split(' '));
const SYN = { doctor: 'clinical', doctors: 'clinical', medical: 'clinical disease', health: 'clinical disease', llm: 'llm openai gpt', llms: 'llm', ai: 'llm agentic ai', agent: 'agentic', agents: 'agentic', retrieval: 'rag retrieval', frontend: 'react', ui: 'react', web: 'react', imbalance: 'imbalanced smote', imbalanced: 'imbalanced smote', dashboard: 'dashboards', dashboards: 'dashboards tableau', paper: 'paper published ieee', papers: 'paper published', research: 'paper published research', images: 'image lesion', image: 'lesion cnn', hiring: 'recruiter candidate', recruiting: 'recruiter candidate' };
const stem = w => w.replace(/(ing|ed|es|s)$/, '').slice(0, 9);
const tok = t => t.toLowerCase().replace(/[^a-z0-9+ ]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w));
const docs = chunks.map(c => tok(c.text + ' ' + c.src + ' ' + c.extra).map(stem));
const avgdl = docs.reduce((a, d) => a + d.length, 0) / docs.length;
const df = {}; docs.forEach(d => new Set(d).forEach(w => df[w] = (df[w] || 0) + 1));
function bm25(q) {
  let terms = tok(q); terms = terms.concat(...terms.map(t => SYN[t] ? tok(SYN[t]) : [])); terms = [...new Set(terms.map(stem))];
  return docs.map(d => terms.reduce((s, t) => {
    const f = d.filter(w => w === t).length; if (!f) return s;
    const idf = Math.log(1 + (docs.length - df[t] + .5) / (df[t] + .5));
    return s + idf * f * 2.2 / (f + 1.2 * (.25 + .75 * d.length / avgdl));
  }, 0));
}
const chunksEl = document.getElementById('chunks'), ctx = document.getElementById('ctx');
chunksEl.innerHTML = chunks.map(c => `<div class="chunk"><b>${esc(c.src)}</b><span>${esc(c.text.slice(0, 54))}…</span><i><em></em></i></div>`).join('');
const tiles = [...chunksEl.children];
function retrieve(q) {
  q = q.trim(); if (!q) return;
  const t0 = performance.now(), sc = bm25(q), ms = performance.now() - t0;
  const max = Math.max(...sc) || 1;
  const top = sc.map((s, i) => [s, i]).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, 3);
  tiles.forEach((el, i) => {
    el.classList.remove('top'); el.style.setProperty('--w', '0%');
    setTimeout(() => { el.style.setProperty('--w', (sc[i] / max * 100).toFixed(0) + '%'); }, reduce ? 0 : i * 18);
  });
  setTimeout(() => {
    top.forEach(([, i]) => tiles[i].classList.add('top'));
    if (!top.length) {
      ctx.innerHTML = `<p class="ctx-h">0 relevant chunks in ${ms.toFixed(1)} ms</p><p>Either Yuktha hasn’t done that yet, or you asked about something gloriously off-topic. Agent refuses to make things up.</p>`;
      return;
    }
    ctx.innerHTML = `<p class="ctx-h">Top ${top.length} of ${chunks.length} chunks, retrieved in ${ms.toFixed(1)} ms</p>` +
      top.map(([s, i], k) => `<p class="ctx-c"><span class="cite">${k + 1}</span>${esc(chunks[i].text)} <em>(${esc(chunks[i].src)}, score ${s.toFixed(2)})</em></p>`).join('');
  }, reduce ? 0 : tiles.length * 18 + 250);
}
document.getElementById('rag-form').addEventListener('submit', e => { e.preventDefault(); retrieve(document.getElementById('rag-input').value); });
document.querySelectorAll('#rag-suggest button').forEach(b => b.onclick = () => { document.getElementById('rag-input').value = b.textContent; retrieve(b.textContent); });

/* =========================================================
   3. Agent workflow with validators (simplified LangGraph)
   ========================================================= */
const STAGES = ['Read the papers', 'Retrieve evidence', 'Draft question', 'Draft variables', 'Validate', 'Build causal graph', 'Identification check', 'Write report'];
const graph = document.getElementById('graph');
graph.innerHTML = STAGES.map((s, i) => `<div class="node${i === 4 || i === 6 ? ' guard' : ''}" data-i="${i}"><span>${i + 1}</span>${s}</div>`).join('');
const nodes = [...graph.children];
const stateEl = document.getElementById('g-state'), glog = document.getElementById('g-log');
const runBtn = document.getElementById('g-run'), chaos = document.getElementById('g-chaos');
let st = { stage: 'idle', revisions: 0, checks_passed: 0, blocked: null };
const showState = () => stateEl.textContent = JSON.stringify(st, null, 2);
showState();
const log = (t, cls = '') => { const li = document.createElement('li'); li.className = cls; li.textContent = t; glog.appendChild(li); glog.scrollTop = glog.scrollHeight; };
const wait = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));
const FAIL5 = ['collider detected on "age"', 'too much missing data in "dosage"', 'treatment happens after the outcome'];
const FAIL7 = ['adjustment set opens a backdoor path', 'unmeasured confounder between diet and sleep'];
async function runAgent() {
  runBtn.disabled = true; glog.innerHTML = ''; st = { stage: 'start', revisions: 0, checks_passed: 0, blocked: null };
  nodes.forEach(n => n.className = n.className.replace(/ (on|done|fail)/g, ''));
  const p = chaos.checked ? .6 : .25;
  let i = 0;
  while (i < STAGES.length) {
    nodes.forEach(n => n.classList.remove('on')); nodes[i].classList.add('on');
    st.stage = STAGES[i]; st.blocked = null; showState();
    log(`→ ${STAGES[i]}`);
    await wait(i === 4 || i === 6 ? 900 : 550);
    const guard = i === 4 || i === 6;
    if (guard && Math.random() < p && st.revisions < 3) {
      const why = (i === 4 ? FAIL5 : FAIL7)[Math.floor(Math.random() * 2)];
      st.blocked = why; st.revisions++; showState();
      nodes[i].classList.add('fail'); log(`✗ blocked: ${why}`, 'bad');
      await wait(700); nodes[i].classList.remove('fail');
      const back = i === 4 ? 3 : 5; log(`↺ sent back to "${STAGES[back]}" for revision`, 'warn');
      for (let k = back; k <= i; k++) nodes[k].classList.remove('done');
      i = back; continue;
    }
    if (guard) { st.checks_passed++; log('✓ passed', 'good'); }
    nodes[i].classList.remove('on'); nodes[i].classList.add('done'); i++;
  }
  st.stage = 'done'; showState();
  log(st.revisions >= 3 ? '✓ done, after 3 revisions. Agent would like a nap.' : `✓ experiment design ready. ${st.revisions} bad draft${st.revisions === 1 ? '' : 's'} caught, 0 reached the user.`, 'good');
  runBtn.disabled = false; runBtn.textContent = 'Run it again';
}
runBtn.onclick = runAgent;

/* =========================================================
   4. Threshold tradeoff (simulated scores, AUC about 0.93)
   ========================================================= */
const SEP = 2.09; // healthy ~ N(0,1), sick ~ N(SEP,1) gives AUC = Phi(SEP/sqrt 2) ≈ 0.93
const erf = x => { const t = 1 / (1 + .3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
const Phi = x => .5 * (1 + erf(x / Math.SQRT2));
const pdf = x => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
const dist = document.getElementById('dist'), roc = document.getElementById('roc'), thr = document.getElementById('thr');
function sizeC(c, h) { const d = Math.min(devicePixelRatio || 1, 2), w = c.clientWidth; c.width = w * d; c.height = h * d; c.style.height = h + 'px'; const g = c.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); return [g, w, h]; }
function drawThr() {
  const t = +thr.value, sens = 1 - Phi(t - SEP), fpr = 1 - Phi(t);
  let [g, w, h] = sizeC(dist, 170);
  const X = x => (x + 3) / 8 * w, Y = y => h - 18 - y / .42 * (h - 30);
  g.clearRect(0, 0, w, h);
  [[0, '#C59BFF', 'healthy'], [SEP, '#FF6B8B', 'sick']].forEach(([m, c, name]) => {
    g.beginPath(); g.moveTo(X(-3), Y(0));
    for (let x = -3; x <= 5; x += .05) g.lineTo(X(x), Y(pdf(x - m)));
    g.lineTo(X(5), Y(0)); g.closePath();
    g.save(); g.clip(); g.fillStyle = c; g.globalAlpha = .18; g.fillRect(0, 0, w, h);
    g.globalAlpha = .55; g.fillRect(X(t), 0, w, h); g.restore();
    g.strokeStyle = c; g.lineWidth = 2; g.stroke();
    g.fillStyle = c; g.font = '600 13px "IBM Plex Sans", sans-serif'; g.fillText(name, X(m) - 18, Y(pdf(0)) - 6);
  });
  g.strokeStyle = '#FFE45E'; g.lineWidth = 2; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(X(t), 6); g.lineTo(X(t), h - 18); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#A3A1D6'; g.font = '12px "IBM Plex Sans", sans-serif'; g.fillText('model score →', w - 92, h - 3); g.fillText('flagged as sick →', Math.min(X(t) + 6, w - 110), 16);

  [g, w, h] = sizeC(roc, 170); const s = Math.min(w, h) - 24, ox = 20, oy = 4;
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(94,242,194,.14)'; g.fillRect(ox, oy, s * .15, s * .1);
  g.strokeStyle = 'rgba(237,236,255,.25)'; g.strokeRect(ox, oy, s, s);
  g.beginPath(); g.moveTo(ox, oy + s); g.lineTo(ox + s, oy); g.setLineDash([3, 4]); g.stroke(); g.setLineDash([]);
  g.beginPath(); for (let x = 6; x >= -4; x -= .05) { const px = ox + (1 - Phi(x)) * s, py = oy + s - (1 - Phi(x - SEP)) * s; x === 6 ? g.moveTo(px, py) : g.lineTo(px, py); }
  g.strokeStyle = '#5EF2C2'; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#FFE45E'; g.beginPath(); g.arc(ox + fpr * s, oy + s - sens * s, 6, 0, 7); g.fill();
  g.fillStyle = '#A3A1D6'; g.font = '11px "IBM Plex Sans", sans-serif'; g.fillText('target', ox + 4, oy + 14);

  document.getElementById('t-sens').textContent = Math.round(sens * 100) + '%';
  document.getElementById('t-fpr').textContent = Math.round(fpr * 100) + '%';
  document.getElementById('t-sens').className = sens >= .9 ? 'ok' : 'no';
  document.getElementById('t-fpr').className = fpr < .15 ? 'ok' : 'no';
  const v = sens >= .9 && fpr < .15 ? 'Both targets hit. Ship it.'
    : sens < .6 ? 'Way too relaxed. Most sick patients walk out undiagnosed. The bugs approve.'
    : fpr > .4 ? 'Everyone’s sick! The referral desk is crying.'
    : sens >= .9 ? 'Catching the sick patients, but too many healthy people get scary referrals.'
    : fpr < .15 ? 'Hardly any false alarms, but too many sick patients slip through.'
    : 'Somewhere in the messy middle. This tension is the real design problem.';
  document.getElementById('t-verdict').textContent = v;
}
thr.addEventListener('input', drawThr);
drawThr(); addEventListener('resize', () => { clearTimeout(window.__t); window.__t = setTimeout(drawThr, 120); });
if (document.fonts) document.fonts.ready.then(drawThr);

/* =========================================================
   5. Contact as a tool call
   ========================================================= */
const tcLog = document.getElementById('tc-log'), tcRun = document.getElementById('tc-run');
tcRun.onclick = async () => {
  tcLog.innerHTML = ''; tcRun.disabled = true;
  const from = document.getElementById('tc-from').value.trim(), subject = document.getElementById('tc-subject').value.trim() || 'Hello';
  const say = (t, c = '') => { const li = document.createElement('li'); li.className = c; li.textContent = t; tcLog.appendChild(li); };
  say('→ validating arguments…'); await wait(400);
  if (!from) { say('✗ missing argument: from. Who should Yuktha thank?', 'bad'); tcRun.disabled = false; document.getElementById('tc-from').focus(); return; }
  if (window.setVisitorName) window.setVisitorName(from);
  say('✓ arguments look great', 'good'); await wait(350);
  say('→ opening your mail app…'); await wait(450);
  say(`✓ returned: one very happy Yuktha`, 'good');
  location.href = `mailto:yuktha.gowda12@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Hi Yuktha,\n\n\n\n${from}`)}`;
  tcRun.disabled = false;
};
})();
