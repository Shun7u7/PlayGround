(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const scene = document.getElementById('sceneWrap');
  const scoreEl = document.getElementById('score');
  const timerEl = document.getElementById('timer');
  const ammoEl = document.getElementById('ammo');
  const statusEl = document.getElementById('statusText');
  const toast = document.getElementById('toast');
  const startOverlay = document.getElementById('startOverlay');
  const endOverlay = document.getElementById('endOverlay');
  const soundButton = document.getElementById('soundButton');
  const reloadButton = document.getElementById('reloadButton');

  const state = {
    mode: 'intro', score: 0, ammo: 6, seconds: 45, lastFrame: 0,
    roundStart: 0, targetOffset: 0, hiddenUntil: 0, aim: { x: -1, y: -1 },
    snow: [], particles: [], sound: false, lastShot: 0, toastTimeout: 0,
    best: Number(localStorage.getItem('frosty-best') || 0),
  };
  document.getElementById('bestScore').textContent = String(state.best).padStart(2, '0');

  function resize() {
    const rect = scene.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.width = rect.width;
    state.height = rect.height;
    state.snow = Array.from({ length: Math.max(38, Math.floor(rect.width * rect.height / 7000)) }, () => ({
      x: Math.random() * rect.width, y: Math.random() * rect.height,
      r: .5 + Math.random() * 1.8, speed: 9 + Math.random() * 20, sway: Math.random() * 2,
      alpha: .2 + Math.random() * .52,
    }));
  }
  new ResizeObserver(resize).observe(scene);
  window.addEventListener('resize', resize);
  resize();

  const rand = (a, b) => a + Math.random() * (b - a);
  function roundedRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  }
  function drawMountain(x, base, width, peak, color) {
    ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x + width * .5, peak); ctx.lineTo(x + width, base); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + width * .5, peak); ctx.lineTo(x + width * .67, peak + width * .15); ctx.lineTo(x + width * .55, peak + width * .12); ctx.lineTo(x + width * .45, peak + width * .17); ctx.closePath(); ctx.fillStyle = 'rgba(225,239,255,.62)'; ctx.fill();
  }
  function drawPine(x, ground, scale, color, snowColor) {
    ctx.fillStyle = '#182b3d'; ctx.fillRect(x - scale * .035, ground - scale * .18, scale * .07, scale * .2);
    for (let i = 0; i < 3; i++) {
      const top = ground - scale * (1.13 - i * .29), half = scale * (.3 - i * .055);
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x - half, top + scale * .43); ctx.lineTo(x + half, top + scale * .43); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x - half * .64, top + scale * .25); ctx.lineTo(x - half * .1, top + scale * .21); ctx.lineTo(x + half * .08, top + scale * .31); ctx.closePath(); ctx.fillStyle = snowColor; ctx.globalAlpha = .85; ctx.fill(); ctx.globalAlpha = 1;
    }
  }
  function drawHouse(x, y, w, h, tone, style) {
    const roofH = h * .37;
    ctx.fillStyle = tone;
    ctx.fillRect(x, y + roofH, w, h - roofH);
    ctx.beginPath(); ctx.moveTo(x - w * .08, y + roofH); ctx.lineTo(x + w * .5, y); ctx.lineTo(x + w * 1.08, y + roofH); ctx.closePath(); ctx.fillStyle = style === 'red' ? '#774b52' : '#40566d'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - w * .08, y + roofH); ctx.lineTo(x + w * .5, y); ctx.lineTo(x + w * 1.08, y + roofH); ctx.lineTo(x + w, y + roofH * .84); ctx.lineTo(x + w * .5, y + roofH * .13); ctx.lineTo(x, y + roofH * .86); ctx.closePath(); ctx.fillStyle = '#d7e8f4'; ctx.fill();
    ctx.fillStyle = '#f9d79c';
    const win = w * .15, wy = y + roofH + h * .18;
    ctx.fillRect(x + w * .17, wy, win, h * .17); ctx.fillRect(x + w * .68, wy, win, h * .17);
    ctx.fillStyle = 'rgba(255,235,184,.16)'; ctx.fillRect(x + w * .17 - 3, wy - 3, win + 6, h * .17 + 6); ctx.fillRect(x + w * .68 - 3, wy - 3, win + 6, h * .17 + 6);
    ctx.fillStyle = '#293c51'; ctx.fillRect(x + w * .44, y + roofH + h * .48, w * .18, h * .52);
    ctx.fillStyle = '#eef5fc'; ctx.fillRect(x + w * .05, y + roofH + h * .78, w * .9, h * .08);
    if (style === 'red') { ctx.strokeStyle = '#f2cc89'; ctx.lineWidth = Math.max(1, w * .012); ctx.beginPath(); ctx.moveTo(x + w * .11, y + roofH + 3); ctx.quadraticCurveTo(x + w * .5, y + roofH + h * .1, x + w * .9, y + roofH + 3); ctx.stroke(); }
  }
  function characterScale() {
    return Math.max(58, Math.min(108, Math.min(state.width, state.height) * .19));
  }
  function santaPosition(t) {
    const w = state.width, h = state.height;
    const direction = Math.sin(t * .22) > 0 ? 1 : -1;
    const x = w * (.08 + .84 * (0.5 + 0.5 * Math.sin(t * .22)));
    const y = h * .83 - characterScale() * .37 + Math.sin(t * 1.9) * 2;
    const hidden = (x > w * .14 && x < w * .255) || (x > w * .50 && x < w * .62) || (x > w * .785 && x < w * .865);
    return { x, y, direction, hidden: hidden || (state.mode === 'playing' && performance.now() < state.hiddenUntil) };
  }
  function drawSanta(x, ground, direction, scale, t) {
    ctx.save(); ctx.translate(x, ground); ctx.scale(direction * scale, scale);
    const step = Math.sin(t * 8) * .045;
    // shadow
    ctx.fillStyle = 'rgba(17,34,48,.22)'; ctx.beginPath(); ctx.ellipse(0, .015, .18, .035, 0, 0, Math.PI * 2); ctx.fill();
    // legs and boots
    ctx.strokeStyle = '#26374b'; ctx.lineWidth = .075; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-.035, -.22); ctx.lineTo(-.065 + step, -.04); ctx.moveTo(.04, -.22); ctx.lineTo(.085 - step, -.045); ctx.stroke();
    ctx.strokeStyle = '#262e3b'; ctx.lineWidth = .09; ctx.beginPath(); ctx.moveTo(-.065 + step, -.04); ctx.lineTo(-.015 + step, -.025); ctx.moveTo(.085 - step, -.045); ctx.lineTo(.13 - step, -.03); ctx.stroke();
    // coat body
    ctx.fillStyle = '#bc3f4a'; roundedRect(-.105, -.49, .21, .29, .065); ctx.fill();
    ctx.fillStyle = '#f4eee0'; roundedRect(-.11, -.255, .22, .05, .025); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-.1, -.49); ctx.lineTo(-.14, -.34); ctx.lineTo(-.08, -.32); ctx.lineTo(-.04, -.43); ctx.closePath(); ctx.fillStyle = '#a93645'; ctx.fill();
    // belt
    ctx.fillStyle = '#333a46'; ctx.fillRect(-.103, -.34, .206, .035); ctx.fillStyle = '#f1c976'; ctx.fillRect(-.012, -.345, .035, .045);
    // arms
    ctx.strokeStyle = '#bd3f4a'; ctx.lineWidth = .075; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-.08, -.445); ctx.lineTo(-.16, -.32 + step * .3); ctx.moveTo(.08, -.445); ctx.lineTo(.14, -.34 - step * .3); ctx.stroke();
    ctx.fillStyle = '#f0d7c3'; ctx.beginPath(); ctx.arc(-.16, -.32 + step * .3, .035, 0, Math.PI * 2); ctx.arc(.14, -.34 - step * .3, .035, 0, Math.PI * 2); ctx.fill();
    // head and beard
    ctx.fillStyle = '#efc6a9'; ctx.beginPath(); ctx.arc(0, -.54, .095, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff8e9'; ctx.beginPath(); ctx.moveTo(-.086, -.54); ctx.quadraticCurveTo(-.105, -.49, -.04, -.455); ctx.quadraticCurveTo(.065, -.45, .09, -.54); ctx.quadraticCurveTo(.04, -.505, 0, -.53); ctx.quadraticCurveTo(-.04, -.49, -.086, -.54); ctx.fill();
    ctx.fillStyle = '#5b3b38'; ctx.beginPath(); ctx.arc(.035, -.57, .009, 0, Math.PI * 2); ctx.fill();
    // hat
    ctx.fillStyle = '#c7424d'; ctx.beginPath(); ctx.moveTo(-.085, -.59); ctx.lineTo(-.055, -.72); ctx.quadraticCurveTo(.025, -.73, .09, -.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff5e8'; roundedRect(-.1, -.615, .205, .045, .02); ctx.fill();
    ctx.fillStyle = '#fff8ed'; ctx.beginPath(); ctx.arc(.03, -.73, .032, 0, Math.PI * 2); ctx.fill();
    // sack
    ctx.fillStyle = '#bd945d'; ctx.beginPath(); ctx.ellipse(-.18, -.43, .085, .12, -.18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#dfbd81'; ctx.beginPath(); ctx.ellipse(-.2, -.47, .046, .022, -.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function drawScene(now) {
    const w = state.width, h = state.height;
    if (!w || !h) return;
    const time = now / 1000;
    const scale = characterScale();
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#14243d'); sky.addColorStop(.58, '#314967'); sky.addColorStop(1, '#a4bfd0');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    // moon and stars
    ctx.fillStyle = '#f2e7c7'; ctx.globalAlpha = .88; ctx.beginPath(); ctx.arc(w * .82, h * .19, Math.min(w, h) * .045, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = .16; ctx.beginPath(); ctx.arc(w * .82, h * .19, Math.min(w, h) * .075, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    for (let i = 0; i < 35; i++) { const x = ((i * 139 + 37) % 997) / 997 * w; const y = ((i * 83 + 17) % 457) / 457 * h * .56; const twinkle = .35 + .5 * Math.abs(Math.sin(time * .8 + i)); ctx.fillStyle = `rgba(235,244,255,${twinkle})`; ctx.beginPath(); ctx.arc(x, y, i % 5 === 0 ? 1.4 : .8, 0, Math.PI * 2); ctx.fill(); }
    drawMountain(-w * .08, h * .65, w * .53, h * .29, '#425d78'); drawMountain(w * .27, h * .64, w * .53, h * .25, '#526b83'); drawMountain(w * .66, h * .64, w * .46, h * .32, '#3c5670');
    // far forest
    for (let i = 0; i < 14; i++) drawPine(w * (i / 13) + Math.sin(i * 11) * w * .017, h * (.72 + (i % 3) * .017), h * (.2 + (i % 4) * .025), i % 2 ? '#29445b' : '#213d53', '#b6d0dc');
    // distant village silhouette
    const farHouses = [[.02,.58,.13,.2],[.24,.61,.12,.17],[.4,.57,.14,.21],[.66,.59,.12,.18],[.88,.56,.14,.22]];
    farHouses.forEach(([x,y,ww,hh],i) => drawHouse(w*x,h*y,w*ww,h*hh,i%2?'#52657a':'#5c7086',i%2?'blue':'red'));
    // ground
    const groundY = h * .81;
    const snow = ctx.createLinearGradient(0, groundY, 0, h); snow.addColorStop(0, '#dce9ec'); snow.addColorStop(1, '#9fb9c9'); ctx.fillStyle = snow; ctx.fillRect(0, groundY, w, h - groundY);
    ctx.fillStyle = 'rgba(255,255,255,.48)'; ctx.beginPath(); ctx.moveTo(0, groundY + h * .04); ctx.quadraticCurveTo(w * .22, groundY - h * .02, w * .45, groundY + h * .035); ctx.quadraticCurveTo(w * .72, groundY + h * .09, w, groundY + h * .01); ctx.lineTo(w,h); ctx.lineTo(0,h); ctx.fill();
    // warming lamps
    for (let i = 0; i < 4; i++) { const lx = w * (.09 + i * .26); ctx.strokeStyle = '#354b61'; ctx.lineWidth = Math.max(2, w * .003); ctx.beginPath(); ctx.moveTo(lx, h * .49); ctx.lineTo(lx, h * .82); ctx.stroke(); ctx.fillStyle = '#efd494'; ctx.beginPath(); ctx.arc(lx, h * .49, Math.max(3, h * .012), 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,218,148,.15)'; ctx.beginPath(); ctx.arc(lx, h * .49, h * .05, 0, Math.PI * 2); ctx.fill(); }
    // Santa crosses the lane, behind the foreground rooftops and trees.
    const santa = santaPosition(time);
    if (!santa.hidden) drawSanta(santa.x, h * .83, santa.direction, scale, time);
    // foreground houses (natural cover)
    drawHouse(w * .135, h * .55, w * .125, h * .35, '#334b61', 'red');
    drawHouse(w * .50, h * .57, w * .13, h * .34, '#344c63', 'blue');
    drawHouse(w * .785, h * .53, w * .09, h * .39, '#344a60', 'red');
    // tree silhouettes to frame the scene
    drawPine(w * .035, h * .84, h * .38, '#234259', '#d2e3e7');
    drawPine(w * .94, h * .85, h * .44, '#203e54', '#d2e3e7');
    // foreground snowbanks
    ctx.fillStyle = '#f2f7f5'; ctx.beginPath(); ctx.moveTo(0,h*.88); ctx.quadraticCurveTo(w*.18,h*.81,w*.34,h*.89); ctx.quadraticCurveTo(w*.53,h*.95,w*.72,h*.87); ctx.quadraticCurveTo(w*.88,h*.82,w,h*.89); ctx.lineTo(w,h); ctx.lineTo(0,h); ctx.fill();
    // drifting snow
    for (const flake of state.snow) { flake.y += flake.speed * .016; flake.x += Math.sin(time + flake.sway) * .25; if (flake.y > h) { flake.y = -4; flake.x = Math.random() * w; } if (flake.x < 0) flake.x = w; if (flake.x > w) flake.x = 0; ctx.globalAlpha = flake.alpha; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    // brief snowball sparkle particles
    state.particles = state.particles.filter(p => now - p.time < 550);
    for (const p of state.particles) { const progress = (now - p.time) / 550; ctx.globalAlpha = 1 - progress; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x + Math.sin(progress * 8 + p.seed) * progress * 25, p.y - progress * 45, 2 + 3 * (1-progress), 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    drawReticle();
  }
  function drawReticle() {
    if (state.aim.x < 0 || state.mode !== 'playing') return;
    const { x, y } = state.aim;
    ctx.save(); ctx.translate(x,y); ctx.strokeStyle = 'rgba(234,248,255,.94)'; ctx.lineWidth = 1.25; ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 4;
    ctx.beginPath(); ctx.arc(0,0,13,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-23,0); ctx.lineTo(-7,0); ctx.moveTo(7,0); ctx.lineTo(23,0); ctx.moveTo(0,-23); ctx.lineTo(0,-7); ctx.moveTo(0,7); ctx.lineTo(0,23); ctx.stroke();
    ctx.fillStyle = '#8debd0'; ctx.beginPath(); ctx.arc(0,0,1.8,0,Math.PI*2); ctx.fill(); ctx.restore();
  }

  function updateHud() {
    scoreEl.innerHTML = `${String(state.score).padStart(2,'0')} <i>/ 05</i>`;
    timerEl.innerHTML = `${Math.max(0, Math.ceil(state.seconds))}<span>s</span>`;
    ammoEl.textContent = '●'.repeat(state.ammo) + '○'.repeat(6-state.ammo);
  }
  function showToast(message, good = true) {
    toast.textContent = message; toast.style.color = good ? 'var(--mint)' : 'var(--gold)'; toast.classList.add('show');
    clearTimeout(state.toastTimeout); state.toastTimeout = setTimeout(() => toast.classList.remove('show'), 950);
  }
  function startGame() {
    state.mode = 'playing'; state.score = 0; state.ammo = 6; state.seconds = 45; state.roundStart = performance.now(); state.hiddenUntil = 0; state.aim = {x:-1,y:-1};
    startOverlay.classList.add('hidden'); endOverlay.classList.add('hidden'); statusEl.textContent = 'RASTREANDO SEÑAL...'; updateHud();
  }
  function finishGame(won) {
    if (state.mode !== 'playing') return;
    state.mode = won ? 'won' : 'lost';
    if (state.score > state.best) { state.best = state.score; localStorage.setItem('frosty-best', state.best); document.getElementById('bestScore').textContent = String(state.best).padStart(2,'0'); }
    document.getElementById('resultKicker').textContent = won ? 'MISIÓN COMPLETADA' : 'MISIÓN TERMINADA';
    document.getElementById('resultIcon').textContent = won ? '🎄' : '🎅';
    document.getElementById('resultTitle').innerHTML = won ? '¡Lo encontraste!' : '¡Casi lo tienes!';
    document.getElementById('resultCopy').textContent = won ? 'Santa recibió su marca de nieve y ya puede seguir con el reparto.' : 'Santa se perdió entre los tejados. ¿Una última vuelta?';
    document.getElementById('resultHint').textContent = `ACIERTOS: ${String(state.score).padStart(2,'0')} · MEJOR: ${String(state.best).padStart(2,'0')}`;
    endOverlay.classList.remove('hidden'); statusEl.textContent = won ? 'SEÑAL CONFIRMADA · BUEN TRABAJO' : 'SEÑAL PERDIDA · FIN DE MISIÓN'; updateHud();
  }
  function playTone(freq, duration, type = 'sine') {
    if (!state.sound) return;
    try { const audio = new (window.AudioContext || window.webkitAudioContext)(); const osc = audio.createOscillator(); const gain = audio.createGain(); osc.type=type; osc.frequency.value=freq; gain.gain.setValueAtTime(.035,audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration); osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime+duration); osc.onended=()=>audio.close(); } catch (_) {}
  }
  function fire() {
    if (state.mode !== 'playing' || performance.now() - state.lastShot < 260) return;
    if (state.ammo <= 0) { showToast('SIN NIEVE · RECARGA', false); playTone(180,.1,'triangle'); return; }
    state.lastShot = performance.now(); state.ammo--; updateHud();
    const now = performance.now(), target = santaPosition(now / 1000);
    const hitRadius = characterScale() * .28;
    const distance = Math.hypot(state.aim.x - target.x, state.aim.y - target.y);
    state.particles.push({x:state.aim.x,y:state.aim.y,time:now,color:'#dff8ff',seed:Math.random()*10});
    if (!target.hidden && distance < hitRadius) {
      state.score++; state.hiddenUntil = now + 850; statusEl.textContent = '¡OBJETIVO MARCADO!'; showToast('¡PLAF! SANTA MARCADO ✦'); playTone(670,.18,'sine');
      if (state.score >= 5) { updateHud(); setTimeout(() => finishGame(true), 500); }
      else setTimeout(() => { if (state.mode === 'playing') statusEl.textContent = 'RASTREANDO SEÑAL...'; }, 1000);
    } else {
      showToast(target.hidden ? '¡ESTÁ CUBIERTO!' : '¡POR POQUITO!', false); playTone(250,.12,'triangle');
    }
    if (state.ammo === 0) setTimeout(() => { if (state.mode === 'playing' && state.ammo === 0) showToast('RECARGA PARA SEGUIR', false); }, 200);
  }
  function reload() {
    if (state.mode !== 'playing' || state.ammo === 6) return;
    state.ammo = 6; updateHud(); showToast('¡RECARGADA!'); playTone(440,.08,'sine');
  }
  function frame(now) {
    const delta = Math.min(.04, (now - (state.lastFrame || now)) / 1000); state.lastFrame = now;
    if (state.mode === 'playing') {
      state.seconds -= delta;
      if (state.seconds <= 0) { state.seconds = 0; updateHud(); finishGame(false); }
      else updateHud();
    }
    drawScene(now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  scene.addEventListener('pointermove', e => {
    const rect = canvas.getBoundingClientRect(); state.aim = {x:e.clientX-rect.left,y:e.clientY-rect.top};
  });
  scene.addEventListener('pointerdown', e => {
    if (e.target.closest('.overlay')) return;
    if (state.mode !== 'playing') return;
    const rect = canvas.getBoundingClientRect(); state.aim = {x:e.clientX-rect.left,y:e.clientY-rect.top}; fire();
  });
  document.getElementById('playButton').addEventListener('click', startGame);
  document.getElementById('againButton').addEventListener('click', startGame);
  reloadButton.addEventListener('click', reload);
  soundButton.addEventListener('click', () => { state.sound = !state.sound; soundButton.textContent = state.sound ? '♫' : '♪'; soundButton.classList.toggle('is-on', state.sound); soundButton.setAttribute('aria-label', state.sound ? 'Desactivar sonido' : 'Activar sonido'); if(state.sound) playTone(560,.12); });
  window.addEventListener('keydown', e => { if (e.key.toLowerCase() === 'r') reload(); if (e.key === ' ' && state.mode === 'playing') { e.preventDefault(); fire(); } });
  updateHud();
})();
