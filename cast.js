// The crew: Agent (the player) and the three bugs. Drawn as inline SVG so they stay crisp at any size.
window.CAST = {
  agent() {
    return `<svg viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg">
      <line x1="60" y1="30" x2="60" y2="10" stroke="#5EF2C2" stroke-width="5" stroke-linecap="round"/>
      <circle class="bulb" cx="60" cy="9" r="7" fill="#FFE45E"/>
      <rect x="10" y="30" width="100" height="84" rx="24" fill="#5EF2C2"/>
      <rect x="22" y="44" width="76" height="38" rx="14" fill="#151845"/>
      <g class="eyes"><circle cx="45" cy="63" r="7" fill="#5EF2C2"/><circle cx="75" cy="63" r="7" fill="#5EF2C2"/></g>
      <rect x="44" y="92" width="32" height="6" rx="3" fill="#151845" opacity=".35"/>
      <rect x="28" y="114" width="16" height="16" rx="5" fill="#2BB58C"/><rect x="76" y="114" width="16" height="16" rx="5" fill="#2BB58C"/>
    </svg>`;
  },
  bug(c) {
    const legs = [30, 50, 70].map((x, i) =>
      `<path class="leg" style="animation-delay:${i * -0.08}s" d="M${x} 40 L${x - 6} 12 M${x} 40 L${x - 6} 68" stroke="${c}" stroke-width="4" stroke-linecap="round" fill="none"/>`).join('');
    return `<svg viewBox="0 0 110 80" xmlns="http://www.w3.org/2000/svg">
      ${legs}
      <path d="M86 34 L102 18 M86 46 L102 62" stroke="${c}" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="46" cy="40" rx="32" ry="24" fill="${c}"/>
      <line x1="16" y1="40" x2="72" y2="40" stroke="#151845" stroke-opacity=".45" stroke-width="3"/>
      <circle cx="82" cy="40" r="13" fill="${c}"/>
      <circle cx="86" cy="35" r="3" fill="#151845"/><circle cx="86" cy="45" r="3" fill="#151845"/>
    </svg>`;
  }
};

(() => {
  const agent = document.getElementById('hero-agent');
  agent.innerHTML = CAST.agent();
  document.querySelectorAll('.bug-actor').forEach(el => el.innerHTML = CAST.bug(el.dataset.bug));

  // Agent's eyes follow the cursor.
  const eyes = agent.querySelector('.eyes');
  addEventListener('pointermove', e => {
    const r = agent.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height * .45);
    const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 300);
    eyes.setAttribute('transform', `translate(${(dx / d) * 8 * k} ${(dy / d) * 5 * k})`);
  }, { passive: true });

  // Blinking antenna.
  const bulb = agent.querySelector('.bulb');
  setInterval(() => bulb.setAttribute('fill', bulb.getAttribute('fill') === '#FFE45E' ? '#5EF2C2' : '#FFE45E'), 600);
})();
