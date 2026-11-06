// The Yuktha-o-matic: insert a coin, pick a slot, open a capsule.
// To add your own capsules, edit the CAPSULES list below. Keep every line true!
(() => {
const CAPSULES = {
  A1: { color: '#5EF2C2', title: 'Three cities, one laptop', text: 'Started in Bangalore, shipped code in Hyderabad, now building agents in New Jersey. Her laptop has more stamps than her passport.' },
  A2: { color: '#FFB547', title: 'Keeper of the snack budget', text: 'She’s the treasurer of the International Students Club at Stevens. Yes, she knows exactly where the snack money went.' },
  A3: { color: '#C59BFF', title: 'Born organizer', text: 'She was NSS Head in high school, wrangling volunteers and fundraisers long before she was wrangling AI agents.' },
  B1: { color: '#FF6B8B', title: 'Published, early', text: 'Her first research paper was published before she even finished her bachelor’s. A second one got into an IEEE conference.' },
  B2: { soldOut: true, title: 'Free time', text: 'SOLD OUT since grad school started.' },
  B3: { color: '#7FD1FF', title: 'Professional lie detector', text: 'Her favorite part of working with LLMs is catching them making things up, then building the checks that stop them.' },
  C1: { color: '#5EF2C2', title: 'Tested on real humans', text: 'She tested her recruiting AI against real recruiter questions until it stopped picking the wrong candidates.' },
  C2: { color: '#FF6B8B', title: 'Secret product nerd', text: 'Engineer by training, product nerd for fun. She’s in the Stevens Product Management Club, critiquing apps for sport.' },
  C3: { golden: true, color: '#FFE45E', title: 'You found the rare one!', text: 'Yuktha is open to AI engineering roles right now. If you’re hiring, this capsule is your sign.' }
};
const CODES = Object.keys(CAPSULES);
const TOTAL = CODES.filter(c => !CAPSULES[c].soldOut).length;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);
const glass = $('m-glass'), keys = $('m-keys'), coin = $('m-coin'), tray = $('tray-cap');
const line1 = $('m-line1'), line2 = $('m-line2'), dlg = $('cap-dlg');
let state = 'idle', current = null;
const taken = new Set();

const capStyle = c => c.golden ? '' : `--c:${c.color}`;
glass.innerHTML = CODES.map(code => {
  const c = CAPSULES[code];
  return `<div class="g-slot" data-code="${code}">
    ${c.soldOut ? '<span class="sold">SOLD<br>OUT</span>' : `<span class="cap${c.golden ? ' gold' : ''}" style="${capStyle(c)}"></span>`}
    <span class="coil"></span><b>${code}</b></div>`;
}).join('');
keys.innerHTML = CODES.map(code => `<button data-code="${code}">${code}</button>`).join('');

function screen(a, b = '', flash) {
  line1.textContent = a; line2.textContent = b;
  if (flash) { const s = $('m-screen'); s.classList.remove('flash'); void s.offsetWidth; s.classList.add('flash'); }
}
const wait = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));

coin.onclick = async () => {
  if (state !== 'idle') { screen(state === 'ready' ? 'TAKE YOUR' : 'ONE AT A', state === 'ready' ? 'capsule first' : 'time, please', true); return; }
  if (taken.size >= TOTAL) { screen('ALL GONE', 'hit restock', true); return; }
  state = 'busy'; coin.classList.add('in');
  await wait(550);
  coin.classList.add('spent');
  state = 'paid'; screen('PICK A SLOT', 'A1 to C3');
};

keys.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  const code = b.dataset.code, c = CAPSULES[code];
  if (c.soldOut) { screen(`${code}: ${c.title.toUpperCase()}`, 'sold out, sorry', true); return; }
  if (taken.has(code)) { screen(`${code} IS EMPTY`, 'try another', true); return; }
  if (state === 'idle') { screen('INSERT COIN', 'tap the coin', true); return; }
  if (state !== 'paid') return;
  state = 'busy'; current = code;
  screen('VENDING…', code);
  const slot = glass.querySelector(`[data-code="${code}"]`);
  slot.classList.add('spin');
  await wait(900);
  slot.classList.add('dropped'); taken.add(code);
  await wait(450);
  tray.hidden = false; tray.className = 'tray-cap' + (c.golden ? ' gold' : '');
  tray.style.cssText = capStyle(c);
  state = 'ready'; screen(c.golden ? '★ RARE ★' : 'ENJOY!', 'tap your capsule');
  tray.focus({ preventScroll: true });
});

tray.onclick = () => {
  const c = CAPSULES[current];
  dlg.className = 'cap-dlg' + (c.golden ? ' gold' : '');
  dlg.style.cssText = capStyle(c);
  $('cap-code').textContent = `Capsule ${current}`;
  $('cap-title').textContent = c.title;
  $('cap-text').textContent = c.text;
  $('cap-cta').hidden = !c.golden;
  tray.hidden = true;
  dlg.showModal();
  addSticker(current);
};
$('cap-keep').onclick = () => dlg.close();
$('cap-cta').onclick = () => dlg.close();
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
dlg.addEventListener('close', () => {
  coin.classList.remove('in', 'spent');
  state = 'idle'; current = null;
  if (taken.size >= TOTAL) { screen('ALL GONE!', 'you emptied me'); $('restock').hidden = false; }
  else screen('INSERT COIN', 'tap the coin');
});

function addSticker(code) {
  const c = CAPSULES[code], list = $('stickers');
  list.querySelector('.empty')?.remove();
  const li = document.createElement('li');
  li.className = c.golden ? 'gold' : ''; li.style.cssText = capStyle(c);
  const b = document.createElement('b'); b.textContent = code;
  const s = document.createElement('span'); s.textContent = c.title;
  li.append(b, s); li.title = c.text; list.appendChild(li);
  $('col-count').textContent = taken.size === TOTAL ? `All ${TOTAL} opened. You know Yuktha now.` : `${taken.size} of ${TOTAL} capsules opened`;
}

$('restock').onclick = () => {
  taken.clear();
  glass.querySelectorAll('.g-slot').forEach(s => s.classList.remove('spin', 'dropped'));
  $('stickers').innerHTML = '<li class="empty">Nothing yet. Feed the machine.</li>';
  $('col-count').textContent = `0 of ${TOTAL} capsules opened`;
  $('restock').hidden = true; screen('RESTOCKED!', 'insert coin');
};
})();
