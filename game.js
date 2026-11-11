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
    level: 1, mapIndex: 0, maps: [], props: [], touchAimArmed: false,
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
  const maps = [
    { name: 'Fábrica de juguetes', sky: ['#26364b','#79899a'], floor: '#697b82', accent: '#e5a84b', props: [
      ['machine',.18,.53,.18,.28],['crate',.38,.69,.12,.13],['car',.68,.64,.22,.18],['machine',.83,.48,.16,.32],['belt',.49,.45,.28,.12],['crate',.12,.76,.10,.10],['car',.37,.51,.17,.14],['crate',.89,.74,.09,.11],
    ] },
    { name: 'Bosque de los pinos', sky: ['#18334a','#8ca9b0'], floor: '#758e82', accent: '#87b98f', props: [
      ['pine',.16,.52,.18,.34],['pine',.39,.68,.22,.38],['rock',.62,.72,.18,.12],['pine',.82,.50,.2,.39],['crate',.31,.48,.12,.12],['rock',.88,.75,.14,.12],['pine',.58,.46,.12,.25],
    ] },
    { name: 'Puerto nevado', sky: ['#20364c','#89a6ba'], floor: '#637e8b', accent: '#e9c16f', props: [
      ['crate',.17,.54,.2,.24],['crate',.35,.69,.16,.20],['machine',.71,.5,.18,.31],['car',.50,.72,.23,.17],['crate',.83,.72,.12,.16],['belt',.43,.47,.23,.12],['rock',.11,.76,.12,.12],
    ] },
    { name: 'Taller del Polo Norte', sky: ['#332d4b','#b17d79'], floor: '#827a7b', accent: '#d97458', props: [
      ['machine',.16,.65,.18,.31],['car',.42,.51,.18,.15],['crate',.62,.71,.13,.15],['pine',.83,.51,.18,.33],['belt',.49,.43,.27,.12],['crate',.87,.74,.1,.12],['machine',.72,.47,.15,.25],
    ] },
  ];
  function characterScale() {
    return Math.max(44, Math.min(94, Math.min(state.width, state.height) * .17));
  }
  function currentMap() { return maps[state.mapIndex]; }
  function santaPosition(t) {
    const w = state.width, h = state.height;
    const xNorm = .5 + .36 * Math.sin(t * (.43 + state.level * .035) + state.level * 1.7);
    const depth = .48 + .31 * (.5 + .5 * Math.sin(t * .72 + 1.4));
    const direction = Math.cos(t * (.43 + state.level * .035) + state.level * 1.7) > 0 ? 1 : -1;
    const x = w * xNorm;
    const ground = h * depth;
    const map = currentMap();
    const hiddenByProp = map.props.some(([type, px, py, pw, ph]) => {
      const radius = pw * .42;
      return Math.abs(xNorm - px) < radius && Math.abs(depth - py) < ph * .48 + .035 && ['machine','crate','car','pine','belt'].includes(type);
    });
    return { x, y: ground - characterScale() * (.35 + depth * .14), ground, depth, direction,
      hidden: hiddenByProp || (state.mode === 'playing' && performance.now() < state.hiddenUntil) };
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
  function drawProp(prop, time) {
    const [type, px, py, pw, ph] = prop;
    const w = state.width, h = state.height;
    const depth = Math.max(0, Math.min(1, (py - .34) / .62));
    const x = px * w, base = h * (.34 + depth * .62);
    const scale = .42 + depth * .78;
    const ww = pw * w * scale, hh = ph * h * scale;
    ctx.save();
    ctx.fillStyle = 'rgba(9,20,29,.28)'; ctx.beginPath(); ctx.ellipse(x, base + 2, ww * .58, Math.max(3, hh * .1), 0, 0, Math.PI * 2); ctx.fill();
    if (type === 'crate') {
      ctx.fillStyle = '#87583c'; ctx.fillRect(x-ww/2,base-hh,ww,hh);
      ctx.fillStyle = '#b98252'; ctx.beginPath(); ctx.moveTo(x-ww/2,base-hh); ctx.lineTo(x-ww*.32,base-hh-hh*.2); ctx.lineTo(x+ww*.62,base-hh-hh*.2); ctx.lineTo(x+ww/2,base-hh); ctx.fill();
      ctx.strokeStyle='#d5a26b';ctx.lineWidth=Math.max(2,ww*.035);ctx.strokeRect(x-ww/2+2,base-hh+2,ww-4,hh-4);ctx.beginPath();ctx.moveTo(x-ww*.4,base-hh+hh*.12);ctx.lineTo(x+ww*.4,base-hh+hh*.88);ctx.moveTo(x+ww*.4,base-hh+hh*.12);ctx.lineTo(x-ww*.4,base-hh+hh*.88);ctx.stroke();
    } else if (type === 'machine') {
      ctx.fillStyle='#455b67';ctx.fillRect(x-ww/2,base-hh,ww,hh);ctx.fillStyle='#667d83';ctx.fillRect(x-ww*.42,base-hh+hh*.08,ww*.84,hh*.2);ctx.fillStyle=currentMap().accent;ctx.fillRect(x-ww*.34,base-hh+hh*.37,ww*.68,hh*.08);
      ctx.fillStyle='#253b49';ctx.fillRect(x-ww*.36,base-hh+hh*.55,ww*.72,hh*.34);ctx.fillStyle='#a9d8d1';ctx.fillRect(x-ww*.29,base-hh+hh*.62,ww*.58,hh*.06);
      for(let i=0;i<3;i++){ctx.fillStyle='#293d48';ctx.beginPath();ctx.arc(x-ww*.3+i*ww*.3,base-hh*.03,Math.max(3,ww*.07),0,Math.PI*2);ctx.fill();}
    } else if (type === 'car') {
      ctx.fillStyle='#a73542';ctx.beginPath();ctx.moveTo(x-ww*.5,base-hh*.25);ctx.lineTo(x-ww*.4,base-hh*.65);ctx.lineTo(x-ww*.18,base-hh*.92);ctx.lineTo(x+ww*.2,base-hh*.92);ctx.lineTo(x+ww*.42,base-hh*.62);ctx.lineTo(x+ww*.5,base-hh*.25);ctx.closePath();ctx.fill();
      ctx.fillStyle='#a8d0d5';ctx.beginPath();ctx.moveTo(x-ww*.28,base-hh*.66);ctx.lineTo(x-ww*.14,base-hh*.84);ctx.lineTo(x+ww*.14,base-hh*.84);ctx.lineTo(x+ww*.3,base-hh*.62);ctx.closePath();ctx.fill();
      ctx.fillStyle='#263741';for(const wx of [-.3,.3]){ctx.beginPath();ctx.arc(x+ww*wx,base-hh*.2,Math.max(3,hh*.16),0,Math.PI*2);ctx.fill();ctx.fillStyle='#d7e3dc';ctx.beginPath();ctx.arc(x+ww*wx,base-hh*.2,Math.max(1.5,hh*.07),0,Math.PI*2);ctx.fill();ctx.fillStyle='#263741';}
      ctx.fillStyle='#f8d99a';ctx.fillRect(x-ww*.45,base-hh*.42,ww*.08,hh*.08);ctx.fillRect(x+ww*.37,base-hh*.42,ww*.08,hh*.08);
    } else if (type === 'belt') {
      ctx.fillStyle='#4b5a5a';ctx.fillRect(x-ww/2,base-hh*.52,ww,hh*.32);ctx.fillStyle='#d19b54';ctx.fillRect(x-ww/2,base-hh*.62,ww,hh*.12);
      for(let i=0;i<5;i++){ctx.fillStyle='#263b44';ctx.beginPath();ctx.arc(x-ww*.4+i*ww*.2,base-hh*.16,Math.max(2,hh*.13),0,Math.PI*2);ctx.fill();}
    } else if (type === 'pine') {
      ctx.fillStyle='#244b47';ctx.fillRect(x-ww*.06,base-hh*.27,ww*.12,hh*.27);
      for(let i=0;i<3;i++){const top=base-hh*(1-i*.25);ctx.fillStyle=i%2?'#286456':'#1c5148';ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x-ww*(.3-i*.045),top+hh*.42);ctx.lineTo(x+ww*(.3-i*.045),top+hh*.42);ctx.closePath();ctx.fill();ctx.fillStyle='#e2f0e7';ctx.fillRect(x-ww*.11,top+hh*.24,ww*.22,Math.max(2,hh*.035));}
    } else {
      ctx.fillStyle='#64747b';ctx.beginPath();ctx.ellipse(x,base-hh*.45,ww*.5,hh*.48,0,Math.PI,0);ctx.fill();ctx.fillStyle='#dce7e3';ctx.beginPath();ctx.ellipse(x,base-hh*.86,ww*.38,hh*.12,0,Math.PI,0);ctx.fill();
    }
    ctx.restore();
  }
  function drawScene(now) {
    const w = state.width, h = state.height;
    if (!w || !h) return;
    const time = now / 1000, map = currentMap();
    const sky = ctx.createLinearGradient(0, 0, 0, h*.55); sky.addColorStop(0,map.sky[0]);sky.addColorStop(1,map.sky[1]);ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
    for(let i=0;i<24;i++){const x=((i*139+37)%997)/997*w,y=((i*83+17)%457)/457*h*.38;ctx.fillStyle=`rgba(240,248,255,${.3+.45*Math.abs(Math.sin(time+i))})`;ctx.fillRect(x,y,1.5,1.5);}
    // Perspectiva: horizonte, nave industrial y suelo que converge al fondo.
    const horizon=h*.34;
    ctx.fillStyle='rgba(16,28,39,.32)';ctx.fillRect(0,horizon*.7,w,horizon*.3);
    ctx.fillStyle='#4b5b63';ctx.fillRect(0,horizon*.73,w,horizon*.27);
    ctx.fillStyle='#344650';ctx.fillRect(w*.08,h*.08,w*.84,h*.25);
    ctx.fillStyle='#53656a';ctx.beginPath();ctx.moveTo(w*.08,h*.08);ctx.lineTo(w*.5,h*.015);ctx.lineTo(w*.92,h*.08);ctx.lineTo(w*.92,h*.13);ctx.lineTo(w*.5,h*.065);ctx.lineTo(w*.08,h*.13);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(231,190,115,.14)';for(let i=0;i<5;i++){const lx=w*(.16+i*.17);ctx.beginPath();ctx.moveTo(lx,h*.11);ctx.lineTo(lx-w*.045,horizon);ctx.lineTo(lx+w*.045,horizon);ctx.closePath();ctx.fill();ctx.fillStyle='#f5d894';ctx.beginPath();ctx.arc(lx,h*.12,Math.max(2,w*.004),0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(231,190,115,.14)';}
    // Floor plane and perspective markings.
    const floor=ctx.createLinearGradient(0,horizon,0,h);floor.addColorStop(0,map.floor);floor.addColorStop(1,'#d7e1dc');ctx.fillStyle=floor;ctx.beginPath();ctx.moveTo(0,horizon);ctx.lineTo(w,horizon);ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(238,247,239,.22)';ctx.lineWidth=1;
    for(let i=0;i<7;i++){const y=horizon+(h-horizon)*(i/7)**2;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
    for(let i=-3;i<=3;i++){ctx.beginPath();ctx.moveTo(w*.5+i*w*.035,horizon);ctx.lineTo(w*.5+i*w*.2,h);ctx.stroke();}
    // Scatter props in depth order. Santa is composited at the matching depth.
    const santa=santaPosition(time), ordered=[...map.props].sort((a,b)=>a[2]-b[2]);let drawn=false;
    for(const prop of ordered){if(!drawn&&prop[2]>santa.depth){if(!santa.hidden)drawSanta(santa.x,santa.ground,santa.direction,characterScale()*(.52+santa.depth*.6),time);drawn=true;}drawProp(prop,time);}
    if(!drawn&&!santa.hidden)drawSanta(santa.x,santa.ground,santa.direction,characterScale()*(.52+santa.depth*.6),time);
    // Snowy glints and drifting flakes add depth to the industrial scene.
    for(let i=0;i<4;i++){const x=w*(.11+i*.26);ctx.fillStyle='rgba(255,255,255,.13)';ctx.beginPath();ctx.ellipse(x,h*(.42+i*.08),w*.075,h*.012,0,0,Math.PI*2);ctx.fill();}
    for(const flake of state.snow){flake.y+=flake.speed*.016;flake.x+=Math.sin(time+flake.sway)*.25;if(flake.y>h){flake.y=-4;flake.x=Math.random()*w;}if(flake.x<0)flake.x=w;if(flake.x>w)flake.x=0;ctx.globalAlpha=flake.alpha;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(flake.x,flake.y,flake.r,0,Math.PI*2);ctx.fill();}
    ctx.globalAlpha=1;
    state.particles=state.particles.filter(p=>now-p.time<550);
    for(const p of state.particles){const progress=(now-p.time)/550;ctx.globalAlpha=1-progress;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x+Math.sin(progress*8+p.seed)*progress*25,p.y-progress*45,2+3*(1-progress),0,Math.PI*2);ctx.fill();}
    ctx.globalAlpha=1;drawReticle();
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
    state.mode = 'playing'; state.score = 0; state.ammo = 6; state.seconds = 45; state.level = 1; state.mapIndex = 0; state.roundStart = performance.now(); state.hiddenUntil = 0; state.aim = {x:-1,y:-1}; state.touchAimArmed = false;
    document.getElementById('levelName').textContent = 'NIVEL 1'; document.getElementById('mapName').textContent = currentMap().name;
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
    state.touchAimArmed = false; state.lastShot = performance.now(); state.ammo--; updateHud();
    const now = performance.now(), target = santaPosition(now / 1000);
    const hitRadius = characterScale() * (.25 + target.depth * .15);
    const distance = Math.hypot(state.aim.x - target.x, state.aim.y - target.y);
    state.particles.push({x:state.aim.x,y:state.aim.y,time:now,color:'#dff8ff',seed:Math.random()*10});
    if (!target.hidden && distance < hitRadius) {
      state.score++; state.level = state.score + 1; state.mapIndex = (state.mapIndex + 1 + Math.floor(Math.random() * (maps.length - 1))) % maps.length; document.getElementById('levelName').textContent = `NIVEL ${state.level}`; document.getElementById('mapName').textContent = currentMap().name; statusEl.textContent = '¡OBJETIVO MARCADO!'; showToast(`¡PLAF! NIVEL ${state.level} · ${currentMap().name.toUpperCase()}`); playTone(670,.18,'sine');
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
    const rect = canvas.getBoundingClientRect(); state.aim = {x:e.clientX-rect.left,y:e.clientY-rect.top};
    if (e.pointerType === 'touch' && !state.touchAimArmed) {
      state.touchAimArmed = true;
      showToast('PUNTO DE MIRA FIJADO · TOCA PARA LANZAR');
      return;
    }
    fire();
  });
  document.getElementById('playButton').addEventListener('click', startGame);
  document.getElementById('againButton').addEventListener('click', startGame);
  reloadButton.addEventListener('click', reload);
  soundButton.addEventListener('click', () => { state.sound = !state.sound; soundButton.textContent = state.sound ? '♫' : '♪'; soundButton.classList.toggle('is-on', state.sound); soundButton.setAttribute('aria-label', state.sound ? 'Desactivar sonido' : 'Activar sonido'); if(state.sound) playTone(560,.12); });
  window.addEventListener('keydown', e => { if (e.key.toLowerCase() === 'r') reload(); if (e.key === ' ' && state.mode === 'playing') { e.preventDefault(); fire(); } });
  updateHud();
})();
