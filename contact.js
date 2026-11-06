// Contact section: send_email(...) as a runnable tool call.
(() => {
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));

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
