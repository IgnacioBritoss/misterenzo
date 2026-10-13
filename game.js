'use strict';
/*
 * Míster, el topo — juego 2D basado en "Kentukis" de Samanta Schweblin (la historia de Enzo).
 * Sos Míster, el kentuki topo. Cumplí las tareas de cada día, escapá de las trampas de Luca
 * y no te quedes sin batería.
 */
(() => {
  // ================= Utilidades =================
  const T = 40, MW = 30, MH = 20, WORLD_W = MW * T, WORLD_H = MH * T;
  const WALL = 0, WOOD = 1, TILE = 2, GRASS = 3;
  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const C = (tx, ty) => ({ x: (tx + 0.5) * T, y: (ty + 0.5) * T });
  const hash = (x, y, i = 0) => { const s = Math.sin(x * 12.9898 + y * 78.233 + i * 37.719) * 43758.5453; return s - Math.floor(s); };
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin storage */ } },
  };

  // ================= Mapa: la casa de Enzo en Umbertide =================
  const ROOMS = {
    bano:    { name: 'Baño',           r: [1, 1, 5, 5],    floor: TILE },
    luca:    { name: 'Cuarto de Luca', r: [7, 1, 16, 5],   floor: WOOD },
    cocina:  { name: 'Cocina',         r: [18, 1, 28, 5],  floor: TILE },
    pasillo: { name: 'Pasillo',        r: [1, 7, 28, 8],   floor: WOOD },
    living:  { name: 'Living',         r: [1, 10, 14, 18], floor: WOOD },
    vivero:  { name: 'Vivero',         r: [16, 10, 28, 18], floor: GRASS },
  };
  const DOORS = {
    bano:    { x: 3,  y: 6, locked: false, name: 'el baño',    spawn: C(2, 3) },
    armario: { x: 15, y: 3, locked: false, name: 'el armario', spawn: C(15.5, 1.5) },
  };
  // [x, y, w, h] en tiles
  const FURN = [
    { k: 'inodoro', r: [1, 1, 1, 1] },
    { k: 'banera', r: [4, 1, 2, 2] },
    { k: 'lavabo', r: [1, 4, 1, 1] },
    { k: 'cama', r: [7, 1, 2, 3] },
    { k: 'escritorio', r: [11, 1, 2, 1] },
    { k: 'mesada', r: [18, 1, 7, 1] },
    { k: 'heladera', r: [27, 1, 2, 1] },
    { k: 'mesa', r: [21, 3, 3, 1] },
    { k: 'tele', r: [1, 10, 3, 1] },
    { k: 'biblio', r: [9, 10, 2, 1] },
    { k: 'mesita', r: [13, 10, 1, 1] },
    { k: 'ratona', r: [2, 12, 2, 1] },
    { k: 'sillon', r: [1, 14, 4, 1], hide: true },
    { k: 'caja', r: [11, 17, 2, 1] },
    { k: 'reposera', r: [24, 13, 1, 2] },
    { k: 'canilla', r: [28, 10, 1, 1] },
  ];
  const SILLON = FURN.find((f) => f.k === 'sillon');
  const CAJA = FURN.find((f) => f.k === 'caja');
  const PAD = C(2, 17);
  const CANILLA = C(28, 10);
  const PHONE = C(13, 10);
  const PLANT_SPOTS = [[17, 11], [19, 11], [17, 14], [19, 14], [17, 17], [20, 17], [23, 17], [26, 17]];
  const TOY_SPOTS = [[8, 4], [13, 4], [4, 8], [18, 8], [26, 8], [8, 13], [12, 15], [6, 17], [9, 17]];
  const CHARGER_SPOTS = [
    { t: [9, 2], where: 'entre la cama y el escritorio de Luca' },
    { t: [2, 2], where: 'en el baño' },
    { t: [26, 4], where: 'en la cocina' },
    { t: [1, 11], where: 'atrás de la tele' },
    { t: [27, 18], where: 'en un rincón del vivero' },
    { t: [28, 7], where: 'al fondo del pasillo' },
    { t: [16, 1], where: 'adentro del armario' },
  ];
  // interruptores: sobre la pared, se usan desde el piso de al lado
  const SWITCHES = [
    { room: 'bano', t: [0, 3] },
    { room: 'luca', t: [13, 0] },
    { room: 'cocina', t: [29, 4] },
    { room: 'living', t: [0, 12] },
    { room: 'pasillo', t: [15, 9] },
  ];
  const ENZO_SPOTS = [[25, 14], [20, 4], [6, 15], [18, 12], [13, 4], [10, 8]];
  const LUCA_SEAT = [11, 2];
  const LUCA_WANDER = [[5, 8], [25, 7], [8, 15], [26, 3], [9, 4], [13, 13], [20, 15]];

  let tiles = [];
  function buildMap() {
    tiles = Array.from({ length: MH }, () => Array(MW).fill(WALL));
    for (const k in ROOMS) {
      const [x1, y1, x2, y2] = ROOMS[k].r;
      for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) tiles[y][x] = ROOMS[k].floor;
    }
    for (const [x, y] of [[14, 1], [14, 2], [14, 3], [16, 3]]) tiles[y][x] = WALL; // armario
    const openings = [[3, 6, TILE], [15, 3, WOOD], [10, 6, WOOD], [11, 6, WOOD], [22, 6, TILE], [23, 6, TILE],
      [5, 9, WOOD], [6, 9, WOOD], [21, 9, GRASS], [22, 9, GRASS], [15, 12, WOOD], [15, 13, WOOD]];
    for (const [x, y, f] of openings) tiles[y][x] = f;
  }
  buildMap();

  const inRectPx = (p, r, pad = 0) => p.x >= r[0] * T - pad && p.x <= (r[0] + r[2]) * T + pad && p.y >= r[1] * T - pad && p.y <= (r[1] + r[3]) * T + pad;
  const roomAt = (p) => { for (const k in ROOMS) { const [x1, y1, x2, y2] = ROOMS[k].r; if (p.x >= x1 * T && p.x < (x2 + 1) * T && p.y >= y1 * T && p.y < (y2 + 1) * T) return k; } return null; };

  // ---------- Navegación (BFS en la grilla) para los personajes ----------
  function navBlocked(x, y) {
    if (x < 0 || y < 0 || x >= MW || y >= MH) return true;
    if (tiles[y][x] === WALL) return true;
    for (const k in DOORS) { const d = DOORS[k]; if (d.locked && d.x === x && d.y === y) return true; }
    for (const f of FURN) { const [fx, fy, fw, fh] = f.r; if (x >= fx && x < fx + fw && y >= fy && y < fy + fh) return true; }
    for (const [px, py] of PLANT_SPOTS) if (px === x && py === y) return true;
    return false;
  }
  const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function findPath(from, tx, ty) {
    const sx = Math.floor(from.x / T), sy = Math.floor(from.y / T);
    if (navBlocked(tx, ty)) return null;
    const start = sy * MW + sx, goal = ty * MW + tx;
    const prev = new Int16Array(MW * MH).fill(-1);
    prev[start] = start;
    const q = [start];
    for (let qi = 0; qi < q.length; qi++) {
      const c = q[qi];
      if (c === goal) break;
      const cx = c % MW, cy = (c / MW) | 0;
      for (const [dx, dy] of DIRS4) {
        const nx = cx + dx, ny = cy + dy;
        if (navBlocked(nx, ny)) continue;
        const n = ny * MW + nx;
        if (prev[n] !== -1) continue;
        prev[n] = c; q.push(n);
      }
    }
    if (prev[goal] === -1) return null;
    const path = [];
    for (let c = goal; c !== start; c = prev[c]) path.push(C(c % MW, (c / MW) | 0));
    return path.reverse();
  }

  // ---------- Colisiones de Míster ----------
  const HB = 12; // medio lado de la caja de colisión
  function solidPx(x, y, h) {
    const x0 = Math.floor((x - h) / T), x1 = Math.floor((x + h - 0.01) / T);
    const y0 = Math.floor((y - h) / T), y1 = Math.floor((y + h - 0.01) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (tx < 0 || ty < 0 || tx >= MW || ty >= MH || tiles[ty][tx] === WALL) return true;
      for (const k in DOORS) { const d = DOORS[k]; if (d.locked && d.x === tx && d.y === ty) return true; }
    }
    const box = (r) => x + h > r[0] * T + 2 && x - h < (r[0] + r[2]) * T - 2 && y + h > r[1] * T + 2 && y - h < (r[1] + r[3]) * T - 2;
    for (const f of FURN) if (!f.hide && box(f.r)) return true;
    for (const [px, py] of PLANT_SPOTS) if (box([px + 0.15, py + 0.15, 0.7, 0.7])) return true;
    return false;
  }
  function moveAxis(e, dx, dy) {
    const total = Math.abs(dx || dy);
    if (!total) return;
    const sx = Math.sign(dx), sy = Math.sign(dy);
    let left = total;
    while (left > 0) {
      const st = Math.min(2, left);
      const nx = e.x + sx * st, ny = e.y + sy * st;
      if (!solidPx(nx, ny, HB)) { e.x = nx; e.y = ny; left -= st; continue; }
      // ayuda en esquinas y puertas: probar a correrse un poco de costado
      let slid = false;
      for (let k = 1; k <= 14 && !slid; k++) {
        for (const s of [1, -1]) {
          const ox = sy ? s * k : 0, oy = sx ? s * k : 0;
          if (!solidPx(e.x + ox, e.y + oy, HB) && !solidPx(nx + ox, ny + oy, HB)) {
            e.x += Math.sign(ox) * Math.min(st, 1.5); e.y += Math.sign(oy) * Math.min(st, 1.5);
            slid = true; break;
          }
        }
      }
      break;
    }
  }

  // ================= Los días (partes de la historia de Enzo) =================
  const DAYS = [
    {
      titulo: 'El topo llega', parte: 'Parte 1 · págs. 21 a 23',
      intro: 'Nuria y la psicóloga decidieron que Luca tenga un kentuki. Llegaste vos: <b>Míster</b>, un topo de peluche con ruedas y cámaras en los ojos.<br><br>Luca te odia. Ya te encerró en el baño y escondió tu cargador para que te quedes sin batería. Si te apagás, hay otra mediación...',
      startTrapped: true, chargerHidden: true, battery: 70,
      plants: 3, toys: 0, lights: 0, reports: 0, hunts: false, kicks: false, nuria: false,
      quote: 'El pacto con Enzo: quedarse quieto es <b>"no"</b> y ronronear es <b>"sí"</b>.',
    },
    {
      titulo: 'El vínculo', parte: 'Parte 2 · págs. 50 a 53',
      intro: 'Ya pasaron casi dos meses. Cuidás a Luca, ordenás la casa y le avisás a Enzo si el chico <b>no hace la tarea o se duerme</b>.<br><br>Ojo: Luca te quiere encerrar en el armario.',
      battery: 85, plants: 3, toys: 3, lights: 0, reports: 2, hunts: true, kicks: false, nuria: false,
      quote: '"¿Qué está haciendo acá todo el día con nosotros?" — Enzo. El teléfono nunca suena.',
    },
    {
      titulo: 'La distancia', parte: 'Parte 3 · págs. 72 a 74',
      intro: 'Desde "ese nefasto domingo" te mantenés lejos de Enzo, pero seguís cuidando a Luca. Quedaron luces prendidas por toda la casa.<br><br>Hoy llega <b>Nuria</b> sin avisar, y a ella los kentukis no le gustan nada. Cuando llegue, <b>escondete bajo el sillón</b>.',
      battery: 85, plants: 0, toys: 0, lights: 3, reports: 2, hunts: true, kicks: true, nuria: true,
      quote: '"Hace tres meses que convivimos." Enzo defiende al topo, y él mismo nota que es una excusa.',
    },
    {
      titulo: 'La indiferencia', parte: 'Parte 4 · págs. 89 y 90',
      intro: 'Enzo se siente abandonado y dejó que se sequen las plantas que vos cuidabas. Luca volvió a esconder el cargador.<br><br>Salvá el vivero antes de quedarte sin batería.',
      chargerHidden: true, battery: 55, plants: 6, toys: 0, lights: 0, reports: 1, hunts: true, kicks: true, nuria: false,
      quote: 'Enzo le pega su dirección en la pata del sillón. Nada. Lo que vive como un desaire es una señal de peligro.',
    },
    {
      titulo: 'El quiebre', parte: 'Parte 5 · págs. 105 y 106',
      intro: 'Enzo planea llevarte a pescar al río Tevere con Carlo. Luca se va una semana a la playa con su madre.<br><br>Es tu último día tranquilo en la casa...',
      battery: 85, plants: 3, toys: 2, lights: 2, reports: 2, hunts: true, kicks: true, nuria: false, ending: true, lucaSpeed: 135,
      quote: '',
    },
  ];

  const ENDING = [
    { k: 'Parte 5 · El quiebre', h: 'Luca mintió', p: 'Nuria vuelve con la excusa de buscar una campera y te encuentra. Luca le había dicho que ya no estabas, para proteger a su papá.' },
    { k: 'Parte 5 · El quiebre', h: 'El teléfono', p: 'Suena tres veces, otras tres y otra vez. Nuria atiende: <i>"Hable. Diga algo."</i> Nadie contesta. Luca queda blanco como un papel.', ring: true },
    { k: 'Parte 6 · El final', h: 'El contrato', p: 'Enzo firma que va a desconectar el kentuki y mudarse para recuperar a Luca. En el vivero seco, Míster sigue en su cargador. Enzo cierra la puerta del vivero.' },
    { k: 'Fin', h: '¿Quién era Míster?', p: 'Nunca sabemos quién manejaba a Míster. El problema no es el aparato, son las personas de los dos lados de la pantalla.<blockquote>¿Ustedes sabrían quién los está mirando?</blockquote>', last: true },
  ];

  const ENZO_CHAT = [
    '¿Usted es un señor mayor, no? Ronronee si es así.',
    'Mi papá le hablaba así a su perro, ¿sabe?',
    'Tiene cara de haber viajado mucho. ¿Es de Alsacia?',
    'Un día de estos lo llevo a pescar con Carlo.',
    '¿Qué está haciendo acá todo el día con nosotros?',
    'Le anoté mi número. Cuando quiera, llame.',
    'Una cervecita en la reposera y listo.',
  ];

  // ================= Audio (sintetizado) =================
  let actx = null, muted = store.get('mister.muted', false);
  function audio() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }
    if (actx && actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(freq, dur, type = 'sine', vol = 0.12, slide = 0, delay = 0) {
    const a = audio(); if (!a || muted) return;
    const t0 = a.currentTime + delay;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.linearRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  const sfx = {
    purr() { for (let i = 0; i < 7; i++) tone(60 + (i % 2) * 18, 0.09, 'sawtooth', 0.07, 0, i * 0.075); },
    knock() { tone(170, 0.08, 'square', 0.14, -80); },
    water() { tone(900, 0.25, 'triangle', 0.05, -500); tone(500, 0.2, 'sine', 0.05, 300, 0.06); },
    pick() { tone(520, 0.08, 'square', 0.07, 220); },
    ok() { [523, 659, 784].forEach((f, i) => tone(f, 0.15, 'triangle', 0.12, 0, i * 0.09)); },
    win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.12, 0, i * 0.12)); },
    bad() { tone(300, 0.35, 'sawtooth', 0.09, -180); },
    alarm() { tone(880, 0.12, 'square', 0.07); tone(660, 0.12, 'square', 0.07, 0, 0.15); },
    ring() { for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) tone(i % 2 ? 1450 : 1150, 0.05, 'square', 0.05, 0, r * 0.7 + i * 0.06); },
    kick() { tone(130, 0.18, 'sine', 0.22, -70); },
    click() { tone(1200, 0.03, 'square', 0.05); },
  };

  // ================= Estado =================
  let mode = 'menu'; // menu | intro | play | paused | over
  let G = null;
  const mister = { x: 0, y: 0, dir: 0, kx: 0, ky: 0, spin: 0, battery: 100, carry: null, water: 0, hidden: false, trapped: null, moving: false, bubble: null };
  const luca = { name: 'Luca', x: 0, y: 0, dir: Math.PI / 2, speed: 95, path: [], state: 'tarea', t: 0, alert: false, seen: false, bubble: null, repath: 0, pause: 0 };
  const enzo = { name: 'Enzo', x: 0, y: 0, dir: 0, speed: 75, path: [], t: 0, spot: 0, bubble: null };
  let nuria = null;

  const say = (e, text, dur = 3) => { e.bubble = { text, t: dur }; };
  function goTo(n, tx, ty) { const p = findPath(n, tx, ty); n.path = p || []; return !!p; }
  function stepPath(n, dt) {
    if (!n.path.length) return true;
    let step = n.speed * dt;
    while (step > 0 && n.path.length) {
      const p = n.path[0];
      const dx = p.x - n.x, dy = p.y - n.y, d = Math.hypot(dx, dy);
      if (d > 0.01) n.dir = Math.atan2(dy, dx);
      if (d <= step) { n.x = p.x; n.y = p.y; n.path.shift(); step -= d; }
      else { n.x += dx / d * step; n.y += dy / d * step; step = 0; }
    }
    return !n.path.length;
  }

  // ---------- Toast y banner ----------
  let toastTimer = 0;
  function toast(text, dur = 3) { const el = $('toast'); el.innerHTML = text; el.classList.add('show'); toastTimer = dur; }
  function banner(text) { const el = $('banner'); if (text) { el.innerHTML = text; el.hidden = false; } else el.hidden = true; }

  // ================= Inicio de cada día =================
  function startDay(n) {
    const d = DAYS[n - 1];
    buildMap();
    for (const k in DOORS) DOORS[k].locked = false;
    G = {
      n, d, time: 0, knocks: 0, chargerActive: !d.chargerHidden, cargador: null,
      plants: [], toys: [], switches: [], event: null, nuriaDone: false, allDone: false,
      kickCd: 0, followT: 0, followCd: 0, chatIdx: Math.floor(Math.random() * ENZO_CHAT.length), chatCd: 15,
      lowWarned: false, hint: null, taskHtml: '', huntCount: 0,
      stats: { watered: 0, toys: 0, lights: 0, reports: 0, escaped: 0, traps: 0, kicks: 0 },
    };
    const thirsty = new Set(shuffle(PLANT_SPOTS.map((_, i) => i)).slice(0, d.plants));
    G.plants = PLANT_SPOTS.map(([x, y], i) => ({ ...C(x, y), thirsty: thirsty.has(i), wet: 0 }));
    G.toys = shuffle(TOY_SPOTS).slice(0, d.toys).map(([x, y], i) => ({ ...C(x, y), kind: ['pelota', 'autito', 'dino'][i % 3], state: 'floor' }));
    G.switches = SWITCHES.map((s) => ({ ...s, ...C(s.t[0], s.t[1]), on: false }));
    shuffle(G.switches).slice(0, d.lights).forEach((s) => { s.on = true; });
    if (d.chargerHidden) { const s = pick(CHARGER_SPOTS); G.cargador = { ...C(s.t[0], s.t[1]), state: 'floor', where: s.where }; }
    G.tasks = makeTasks(d);

    Object.assign(mister, { ...PAD, dir: -Math.PI / 2, kx: 0, ky: 0, spin: 0, battery: d.battery, carry: null, water: 0, hidden: false, trapped: null, bubble: null });
    if (d.startTrapped) { lockIn('bano'); }
    Object.assign(luca, { ...C(...LUCA_SEAT), path: [], state: 'tarea', t: rand(8, 12), alert: false, seen: false, bubble: null, speed: 95, pause: 0, dir: -Math.PI / 2 });
    Object.assign(enzo, { ...C(25, 14), path: [], t: rand(8, 12), spot: 0, bubble: null });
    nuria = null;
    banner(null);

    mode = 'intro';
    showCard(`<p class="kicker">Día ${n} de 5 · ${d.parte}</p><h2>${d.titulo}</h2><p>${d.intro}</p>
      <p><b>Tareas de hoy:</b></p><ul>${G.tasks.map((t) => `<li>${t.text()}</li>`).join('')}</ul>`,
    [{ label: '¡A jugar!', fn: () => { hideCard(); mode = 'play'; firstTip(); } }]);
  }

  function firstTip() {
    if (G.n === 1) toast(`Luca te encerró en el baño. Acercate a la puerta y golpeala con ${isTouch ? 'el botón <b>A</b>' : '<span class="key">Espacio</span>'}.`, 5);
    else if (G.d.nuria) toast('Hoy viene Nuria. Cuando aparezca el aviso, corré a esconderte bajo el sillón del living.', 4.5);
    else if (G.d.chargerHidden) toast('Luca escondió el cargador. Cuando estés cerca lo vas a ver brillar.', 4);
    else toast('Mirá tus tareas arriba a la izquierda.', 3);
  }

  function makeTasks(d) {
    const s = () => G.stats;
    const L = [];
    if (d.startTrapped) L.push({ text: () => 'Salí del baño: golpeá la puerta para que Enzo te escuche', check: () => s().escaped > 0 });
    if (d.chargerHidden) L.push({ text: () => 'Encontrá el cargador que escondió Luca y llevalo al enchufe del living', check: () => G.chargerActive });
    if (d.plants) L.push({ text: () => `Regá las plantas del vivero (${Math.min(s().watered, d.plants)}/${d.plants}) — llená la regadera en la canilla`, check: () => s().watered >= d.plants });
    if (d.toys) L.push({ text: () => `Ordená: guardá los juguetes en la caja (${Math.min(s().toys, d.toys)}/${d.toys})`, check: () => s().toys >= d.toys });
    if (d.lights) L.push({ text: () => `Apagá las luces que quedaron prendidas (${Math.min(s().lights, d.lights)}/${d.lights})`, check: () => s().lights >= d.lights });
    if (d.reports) L.push({ text: () => `Avisale a Enzo si Luca se duerme o no hace la tarea (${Math.min(s().reports, d.reports)}/${d.reports})`, check: () => s().reports >= d.reports });
    if (d.nuria) L.push({ text: () => 'Cuando llegue Nuria, escondete bajo el sillón', check: () => G.nuriaDone });
    L.push({ final: true, text: () => 'Volvé al cargador para pasar la noche', check: () => false });
    return L;
  }

  // ================= Acciones de Míster =================
  function lockIn(which) {
    const d = DOORS[which];
    if (mister.carry) dropCarry();
    Object.assign(mister, { x: d.spawn.x, y: d.spawn.y, kx: 0, ky: 0, trapped: which });
    d.locked = true;
    G.knocks = 0;
  }
  function knock() {
    G.knocks++;
    sfx.knock();
    mister.battery -= 0.8;
    say(mister, pick(['¡toc toc!', '¡TOC!', 'toc toc toc']), 0.8);
    if (G.knocks >= 6) {
      const d = DOORS[mister.trapped];
      d.locked = false;
      mister.trapped = null;
      G.stats.escaped++;
      sfx.ok();
      toast(`Enzo te abrió la puerta: <i>"¿Otra vez encerrado, Míster? ¡Luca!"</i>`, 3.5);
      if (G.n === 1 && G.stats.escaped === 1) setTimeout(() => { if (G && mode === 'play') toast('Ahora buscá el cargador: Luca lo escondió. Cuando estés cerca lo vas a ver brillar.', 4.5); }, 3600);
    }
  }
  function talkEnzo() {
    sfx.purr();
    say(mister, 'rrrrrr ♥', 1.4);
    if (luca.alert && luca.seen) {
      const what = luca.state === 'dormido' ? 'se durmió' : 'no está haciendo la tarea';
      luca.alert = false; luca.seen = false;
      G.stats.reports++;
      say(enzo, `¿Luca ${what}? ¡Gracias, Míster! ¡LUCA, A LA TAREA!`, 3.5);
      setTimeout(() => { if (G) { say(luca, 'Uf... bueno, ya voy.', 2.5); luca.state = 'volver'; luca.path = []; } }, 900);
    } else {
      G.chatIdx = (G.chatIdx + 1) % ENZO_CHAT.length;
      say(enzo, ENZO_CHAT[G.chatIdx], 3.5);
    }
  }
  function fillWater() { mister.water = 3; sfx.water(); say(mister, 'regadera llena 💧', 1.4); }
  function waterPlant(p) {
    p.thirsty = false; p.wet = 1.2; mister.water--; G.stats.watered++;
    sfx.water();
  }
  function pickToy(t) { t.state = 'carried'; mister.carry = { type: 'toy', ref: t }; sfx.pick(); }
  function storeToy() { mister.carry.ref.state = 'stored'; mister.carry = null; G.stats.toys++; sfx.pick(); }
  function pickCargador() { G.cargador.state = 'carried'; mister.carry = { type: 'cargador' }; sfx.pick(); toast('¡Lo encontraste! Llevalo al enchufe del living.', 3); }
  function plugCargador() { G.cargador.state = 'plugged'; mister.carry = null; G.chargerActive = true; sfx.ok(); }
  function dropCarry() {
    const c = mister.carry; if (!c) return;
    if (c.type === 'toy') Object.assign(c.ref, { x: mister.x, y: mister.y, state: 'floor' });
    else Object.assign(G.cargador, { x: mister.x, y: mister.y, state: 'floor' });
    mister.carry = null;
  }
  function switchOff(s) { s.on = false; G.stats.lights++; sfx.click(); }

  function interactions() {
    const m = mister, L = [];
    const add = (x, y, label, act, opt = {}) => L.push({ x, y, label, act, reach: 58, ...opt });
    if (m.trapped) {
      const d = DOORS[m.trapped];
      add((d.x + 0.5) * T, (d.y + 0.5) * T, `Golpear la puerta (${G.knocks}/6)`, knock, { reach: 62 });
    }
    add(enzo.x, enzo.y, luca.alert && luca.seen ? 'Ronronear: avisarle de Luca' : 'Ronronear a Enzo', talkEnzo, { reach: 60 });
    if (m.water < 3) add(CANILLA.x, CANILLA.y, 'Llenar la regadera', fillWater);
    for (const p of G.plants) {
      if (!p.thirsty) continue;
      if (m.water > 0) add(p.x, p.y, 'Regar la planta', () => waterPlant(p));
      else add(p.x, p.y, 'Sin agua: llená la regadera en la canilla', null, { disabled: true });
    }
    if (!m.carry) {
      for (const t of G.toys) if (t.state === 'floor') add(t.x, t.y, 'Agarrar el juguete', () => pickToy(t), { reach: 40 });
      if (G.cargador && G.cargador.state === 'floor') add(G.cargador.x, G.cargador.y, 'Agarrar el cargador', pickCargador, { reach: 44 });
    } else if (m.carry.type === 'toy') {
      add((CAJA.r[0] + 1) * T, (CAJA.r[1] + 0.5) * T, 'Guardar el juguete en la caja', storeToy, { reach: 62 });
    } else if (m.carry.type === 'cargador') {
      add(PAD.x, PAD.y, 'Enchufar el cargador', plugCargador, { reach: 50 });
    }
    for (const s of G.switches) if (s.on) add(s.x, s.y, 'Apagar la luz', () => switchOff(s), { reach: 50 });
    add(PHONE.x, PHONE.y, 'Mirar el teléfono', () => { say(mister, '...', 1); toast('El teléfono de Enzo. Nunca suena.', 2.5); });

    let best = null, bd = Infinity;
    for (const it of L) {
      const d = Math.hypot(it.x - m.x, it.y - m.y) + (it.disabled ? 20 : 0);
      if (d <= it.reach + (it.disabled ? 20 : 0) && d < bd) { bd = d; best = it; }
    }
    return best;
  }

  function action() {
    if (mode !== 'play') return;
    const it = G.hint;
    if (it && !it.disabled && it.act) it.act();
    else if (it && it.disabled) { toast(it.label, 2); sfx.bad(); }
    else if (mister.carry) { dropCarry(); sfx.pick(); }
    else { sfx.purr(); say(mister, 'rrrrr…', 1.2); }
  }

  // ================= Luca =================
  function lucaUpdate(dt) {
    const d = G.d, m = mister;
    const seat = C(...LUCA_SEAT);
    const busy = !!G.event;
    switch (luca.state) {
      case 'tarea': {
        if (dist(luca, seat) > 2) { luca.state = 'volver'; break; }
        luca.dir = -Math.PI / 2;
        luca.t -= dt;
        if (luca.t <= 0 && !busy) {
          const opts = [];
          if (d.reports - G.stats.reports > 0) opts.push('issue', 'issue');
          if (d.hunts && G.time > 15 && !m.trapped && !m.hidden) opts.push('hunt');
          const o = opts.length ? pick(opts) : null;
          if (o === 'hunt') {
            luca.state = 'cazando'; luca.t = d.ending ? 10 : 8; luca.repath = 0;
            luca.speed = d.lucaSpeed || 122;
            say(luca, '¡Vení acá, topo!', 2.5);
            toast('¡Luca te quiere encerrar! Escapá o escondete bajo el sillón.', 3);
            sfx.alarm(); G.huntCount++;
          } else if (o === 'issue') {
            luca.alert = true; luca.seen = false;
            if (Math.random() < 0.5) { luca.state = 'dormido'; }
            else { luca.state = 'jugando'; luca.speed = 85; luca.pause = 0; }
          } else luca.t = rand(8, 12);
        }
        break;
      }
      case 'dormido':
        luca.dir = -Math.PI / 2;
        break;
      case 'jugando': {
        if (!luca.path.length) {
          luca.pause -= dt;
          if (luca.pause <= 0) { const w = pick(LUCA_WANDER); goTo(luca, w[0], w[1]); luca.pause = rand(0.6, 1.8); }
        }
        stepPath(luca, dt);
        if (d.kicks && G.kickCd <= 0 && !m.hidden && !m.trapped && dist(luca, m) < 36) {
          const a = Math.atan2(m.y - luca.y, m.x - luca.x);
          m.kx = Math.cos(a) * 520; m.ky = Math.sin(a) * 520; m.spin = 0.7;
          G.kickCd = 6; G.stats.kicks++;
          say(luca, pick(['¡Fuera de acá!', '¡Dejá de seguirme!', '¡Andate!']), 2);
          toast('Luca te dio una patadita y saliste rodando.', 2.5);
          sfx.kick();
        }
        break;
      }
      case 'cazando': {
        luca.t -= dt; luca.repath -= dt;
        if (m.hidden || m.trapped || busy) {
          if (m.hidden) say(luca, '¿Dónde se metió ese topo?', 2.5);
          luca.state = 'volver'; luca.path = []; break;
        }
        if (luca.repath <= 0) { goTo(luca, Math.floor(m.x / T), Math.floor(m.y / T)); luca.repath = 0.35; }
        stepPath(luca, dt);
        if (dist(luca, m) < 28) {
          const which = Math.random() < 0.5 ? 'bano' : 'armario';
          lockIn(which);
          G.stats.traps++;
          say(luca, '¡Jaja! ¡Quedate ahí!', 2.5);
          toast(`Luca te encerró en ${DOORS[which].name}. Golpeá la puerta para que Enzo te escuche.`, 4);
          sfx.bad();
          luca.state = 'volver'; luca.path = [];
        } else if (luca.t <= 0) {
          say(luca, 'Bah... me aburrí.', 2);
          luca.state = 'volver'; luca.path = [];
        }
        break;
      }
      case 'volver':
        luca.speed = 95;
        if (!luca.path.length && dist(luca, seat) > 2) {
          if (!goTo(luca, ...LUCA_SEAT)) Object.assign(luca, seat);
        }
        if (stepPath(luca, dt) && dist(luca, seat) <= 2) {
          luca.state = luca.alert ? 'dormido' : 'tarea'; luca.t = rand(12, 20);
        }
        break;
    }
    if (luca.alert && !luca.seen && dist(luca, m) < 3.6 * T && !m.trapped) {
      luca.seen = true;
      say(m, luca.state === 'dormido' ? '¡Luca se durmió! Hay que avisarle a Enzo.' : '¡Luca no hace la tarea! Hay que avisarle a Enzo.', 3);
      sfx.alarm();
    }
  }

  // ================= Enzo =================
  function enzoUpdate(dt) {
    if (!G.event) {
      if (!enzo.path.length) {
        enzo.t -= dt;
        if (enzo.t <= 0) {
          let i; do { i = Math.floor(Math.random() * ENZO_SPOTS.length); } while (i === enzo.spot);
          enzo.spot = i; goTo(enzo, ...ENZO_SPOTS[i]); enzo.t = rand(12, 20);
        }
      }
    }
    stepPath(enzo, dt);
    // "¡Deje de perseguirme por toda la casa como un perro!"
    const m = mister;
    G.followCd -= dt; G.chatCd -= dt;
    if (dist(m, enzo) < 1.8 * T && m.moving && enzo.path.length) G.followT += dt; else G.followT = Math.max(0, G.followT - dt);
    if (G.followT > 3 && G.followCd <= 0) { say(enzo, '¡Deje de perseguirme por toda la casa como un perro!', 3.5); G.followCd = 30; G.followT = 0; }
    if (G.chatCd <= 0 && dist(m, enzo) < 4 * T && !enzo.bubble) {
      G.chatCd = rand(25, 40);
      say(enzo, pick(['Míster, ¿todo bien por ahí?', 'Qué silencio hay en esta casa...', '¿Me escucha, Míster?', 'Mañana lo llevo al súper en la luneta del auto.']), 3);
    }
  }

  // ================= Visita de Nuria (día 3) =================
  const NURIA_LINES = [
    [0.8, 'nuria', '¿Y el topo? Ese aparato no me gusta nada.'],
    [4.2, 'enzo', 'Está cuidando la siesta de Luca.'],
    [7.6, 'nuria', 'Apagalo, Enzo. No sabés quién está del otro lado.'],
    [11, 'enzo', 'Hace tres meses que convivimos...'],
  ];
  function eventUpdate(dt) {
    const d = G.d, m = mister;
    if (d.nuria && !G.nuriaDone && !G.event && G.time > 35 && !m.trapped && luca.state !== 'cazando') {
      G.event = { phase: 'warn', t: 12 };
      sfx.alarm();
      goTo(enzo, 9, 16);
    }
    const ev = G.event;
    if (!ev) return;
    if (ev.phase === 'warn') {
      ev.t -= dt;
      banner(`¡Llega Nuria! Escondete bajo el sillón del living<br>${Math.ceil(ev.t)}`);
      if (ev.t <= 0) {
        if (!m.hidden) return fail('Nuria entró y te vio. <i>"Apagá ese aparato, Enzo."</i>');
        ev.phase = 'visit'; ev.t = 0; ev.line = 0;
        nuria = { name: 'Nuria', ...C(8, 18), dir: -Math.PI / 2, speed: 70, path: [], bubble: null };
        goTo(nuria, 8, 15);
        banner('Quedate quieto bajo el sillón...');
        setTimeout(() => banner(null), 2000);
      }
    } else if (ev.phase === 'visit' || ev.phase === 'leave') {
      ev.t += dt;
      stepPath(nuria, dt);
      if (!m.hidden && dist(m, nuria) < 7 * T) return fail('Saliste del sillón y Nuria te vio. <i>"Apagá ese aparato, Enzo."</i>');
      if (ev.phase === 'visit') {
        if (!nuria.path.length) nuria.dir = Math.atan2(enzo.y - nuria.y, enzo.x - nuria.x);
        while (ev.line < NURIA_LINES.length && ev.t >= NURIA_LINES[ev.line][0]) {
          const [, who, text] = NURIA_LINES[ev.line++];
          say(who === 'nuria' ? nuria : enzo, text, 3.3);
        }
        if (ev.t > 14.5) { ev.phase = 'leave'; goTo(nuria, 8, 18); say(nuria, 'Pensalo. Por Luca.', 2.5); }
      } else if (!nuria.path.length) {
        nuria = null; G.event = null; G.nuriaDone = true; banner(null);
        toast('Nuria se fue. Ya podés salir.', 3);
        enzo.t = 4;
      }
    }
  }

  // ================= Bucle principal =================
  const keys = new Set();
  const stick = { x: 0, y: 0 };

  function update(dt) {
    G.time += dt;
    const m = mister;
    // --- movimiento ---
    let ix = 0, iy = 0;
    if (keys.has('left')) ix -= 1; if (keys.has('right')) ix += 1;
    if (keys.has('up')) iy -= 1; if (keys.has('down')) iy += 1;
    ix += stick.x; iy += stick.y;
    const mag = Math.hypot(ix, iy);
    if (mag > 1) { ix /= mag; iy /= mag; }
    m.moving = mag > 0.15;
    const sp = 150;
    const vx = (m.moving ? ix * sp : 0) + m.kx, vy = (m.moving ? iy * sp : 0) + m.ky;
    moveAxis(m, vx * dt, 0); moveAxis(m, 0, vy * dt);
    const decay = Math.pow(0.015, dt); m.kx *= decay; m.ky *= decay;
    if (Math.abs(m.kx) < 5) m.kx = 0; if (Math.abs(m.ky) < 5) m.ky = 0;
    if (m.spin > 0) { m.spin -= dt; m.dir += 18 * dt; }
    else if (m.moving) {
      const target = Math.atan2(iy, ix);
      let da = target - m.dir; da = Math.atan2(Math.sin(da), Math.cos(da));
      m.dir += da * Math.min(1, 14 * dt);
    }
    m.hidden = inRectPx(m, SILLON.r);

    // --- batería ---
    const onPad = G.chargerActive && dist(m, PAD) < 22;
    m.charging = onPad && m.battery < 100;
    if (onPad) m.battery = Math.min(100, m.battery + 22 * dt);
    else m.battery -= (0.45 + (m.moving ? 0.6 : 0)) * dt;
    if (m.battery < 22 && !G.lowWarned && !onPad) { G.lowWarned = true; toast(G.chargerActive ? '¡Batería baja! Volvé al cargador del living.' : '¡Batería baja! Encontrá el cargador.', 3); sfx.alarm(); }
    if (m.battery > 40) G.lowWarned = false;
    if (m.battery <= 0) return fail('Te quedaste sin batería y te apagaste. Si el kentuki se apaga, hay otra mediación...');

    // --- personajes y eventos ---
    G.kickCd -= dt;
    lucaUpdate(dt);
    enzoUpdate(dt);
    eventUpdate(dt);
    if (mode !== 'play') return;
    for (const e of [m, luca, enzo, nuria]) if (e && e.bubble) { e.bubble.t -= dt; if (e.bubble.t <= 0) e.bubble = null; }
    for (const p of G.plants) if (p.wet > 0) p.wet -= dt;

    // --- tareas ---
    for (const t of G.tasks) {
      if (!t.final && !t.done && t.check()) { t.done = true; sfx.ok(); toast(`✔ ${t.text()}`, 2.5); }
    }
    const allDone = G.tasks.every((t) => t.final || t.done);
    if (allDone && !G.allDone) { G.allDone = true; setTimeout(() => { if (G && mode === 'play') toast('¡Terminaste las tareas! Volvé al cargador para pasar la noche.', 4); }, 1200); }
    if (allDone && onPad && !G.event) return finishDay();

    G.hint = interactions();
    if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('toast').classList.remove('show'); }
    updateHud();
  }

  function fail(msg) {
    mode = 'over';
    sfx.bad();
    banner(null);
    showCard(`<p class="kicker">Día ${G.n} · ${G.d.titulo}</p><h2>¡Uy!</h2><p>${msg}</p>`, [
      { label: 'Reintentar el día', fn: () => startDay(G.n) },
      { label: 'Menú', cls: 'ghost', fn: showMenu },
    ]);
  }

  function finishDay() {
    mode = 'over';
    const unlocked = store.get('mister.unlocked', 1);
    if (G.n + 1 > unlocked) store.set('mister.unlocked', Math.min(5, G.n + 1));
    if (G.d.ending) { sfx.ring(); return showEnding(0); }
    sfx.win();
    const s = G.stats, d = G.d;
    const stat = (v, l) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;
    showCard(`<p class="kicker">Día ${G.n} completado</p><h2>${d.titulo}</h2>
      <div class="stats">${[
        d.plants ? stat(s.watered, 'plantas regadas') : '',
        d.toys ? stat(s.toys, 'juguetes guardados') : '',
        d.lights ? stat(s.lights, 'luces apagadas') : '',
        d.reports ? stat(s.reports, 'avisos a Enzo') : '',
        stat(s.traps + (d.startTrapped ? 1 : 0), 'veces encerrado'),
        d.kicks ? stat(s.kicks, 'pataditas') : '',
      ].join('')}</div>
      <p><b>Para destacar</b></p><blockquote>${d.quote}</blockquote>`, [
      { label: `Día ${G.n + 1} →`, fn: () => startDay(G.n + 1) },
      { label: 'Menú', cls: 'ghost', fn: showMenu },
    ]);
  }

  function showEnding(i) {
    const e = ENDING[i];
    if (e.ring) sfx.ring();
    showCard(`<p class="kicker">${e.k}</p><h2>${e.h}</h2><p>${e.p}</p>`, e.last
      ? [{ label: 'Jugar de nuevo', fn: () => startDay(1) }, { label: 'Menú', cls: 'ghost', fn: showMenu }]
      : [{ label: 'Seguir →', fn: () => showEnding(i + 1) }]);
  }

  // ================= HUD =================
  function updateHud() {
    const m = mister;
    $('dayLabel').textContent = `Día ${G.n} · ${G.d.titulo}`;
    const b = Math.max(0, Math.round(m.battery));
    const fill = $('batFill');
    fill.style.width = b + '%';
    fill.className = m.charging ? 'charging' : (b < 22 ? 'low' : '');
    $('batText').textContent = (m.charging ? '⚡ ' : '') + b + '%';
    const w = $('water');
    w.hidden = !(G.d.plants);
    w.textContent = '💧 ' + m.water;
    const allDone = G.tasks.every((t) => t.final || t.done);
    const li = (t) => `<li class="${t.done ? 'done' : ''} ${t.final ? 'final' : ''}">${t.text()}</li>`;
    const visible = G.tasks.filter((t) => !t.final || allDone);
    const pending = visible.filter((t) => !t.done);
    const n = G.tasks.filter((t) => !t.final).length, k = G.tasks.filter((t) => !t.final && t.done).length;
    let html;
    if ($('tasks').classList.contains('compact')) {
      html = (pending[0] ? li(pending[0]) : '') + (pending.length > 1 ? `<li class="more">+${pending.length - 1} más (tocá "Tareas")</li>` : '');
    } else html = visible.map(li).join('');
    const label = `Tareas ${k}/${n} ${$('tasks').classList.contains('compact') || $('tasks').classList.contains('collapsed') ? '▸' : '▾'}`;
    if ($('tasksToggle').textContent !== label) $('tasksToggle').textContent = label;
    if (html !== G.taskHtml) { $('taskList').innerHTML = html; G.taskHtml = html; }
  }

  // ================= Dibujo =================
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = WORLD_W; mapCanvas.height = WORLD_H;

  function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }
  function ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); }

  function renderStatic() {
    const c = mapCanvas.getContext('2d');
    c.clearRect(0, 0, WORLD_W, WORLD_H);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const t = tiles[y][x], px = x * T, py = y * T;
      if (t === WOOD) {
        c.fillStyle = (y % 2) ? '#c99868' : '#c08b5b'; c.fillRect(px, py, T, T);
        c.strokeStyle = 'rgba(100,60,25,.22)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(px, py + T / 2 + 0.5); c.lineTo(px + T, py + T / 2 + 0.5);
        const j = px + Math.floor(hash(x, y) * 3) * 13 + 6;
        c.moveTo(j + 0.5, py); c.lineTo(j + 0.5, py + T / 2);
        c.moveTo(px + ((j - px + 20) % T) + 0.5, py + T / 2); c.lineTo(px + ((j - px + 20) % T) + 0.5, py + T);
        c.stroke();
      } else if (t === TILE) {
        c.fillStyle = ((x + y) % 2) ? '#e4ecef' : '#d0dbe0'; c.fillRect(px, py, T, T);
        c.strokeStyle = 'rgba(120,140,150,.3)'; c.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
      } else if (t === GRASS) {
        c.fillStyle = '#8cbf63'; c.fillRect(px, py, T, T);
        for (let i = 0; i < 6; i++) {
          c.fillStyle = hash(x, y, i + 9) > 0.5 ? '#7aae52' : '#9ccc72';
          c.fillRect(px + hash(x, y, i) * 36, py + hash(x, y, i + 3) * 36, 3, 4);
        }
      }
    }
    // paredes
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (tiles[y][x] !== WALL) {
        if (y > 0 && tiles[y - 1][x] === WALL) { c.fillStyle = 'rgba(0,0,0,.16)'; c.fillRect(x * T, y * T, T, 7); }
        continue;
      }
      const px = x * T, py = y * T;
      c.fillStyle = '#5a463a'; c.fillRect(px, py, T, T);
      c.fillStyle = '#6e584a'; c.fillRect(px, py, T, 5);
      if (y < MH - 1 && tiles[y + 1][x] !== WALL) { c.fillStyle = '#8a7060'; c.fillRect(px, py + T - 12, T, 12); }
    }
    // puerta de entrada
    c.fillStyle = '#7a4a26'; c.fillRect(8 * T + 4, 19 * T, T - 8, 14);
    c.fillStyle = '#d9b26a'; c.fillRect(8 * T + 4, 19 * T, T - 8, 3);
    // nombres de los ambientes
    c.font = '800 13px system-ui, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'top';
    const labelAt = { bano: [1, 3], luca: [9, 4], cocina: [25, 3], pasillo: [12, 7], living: [7, 11], vivero: [21, 12] };
    for (const k in ROOMS) {
      const [lx, ly] = labelAt[k];
      c.fillStyle = k === 'vivero' ? 'rgba(40,80,20,.35)' : 'rgba(60,40,25,.28)';
      c.fillText(ROOMS[k].name.toUpperCase(), lx * T + 4, ly * T + 4);
    }
    // canteros del vivero
    c.fillStyle = 'rgba(110,70,40,.35)';
    for (const [px, py] of PLANT_SPOTS) { rr(c, px * T + 2, py * T + 2, T - 4, T - 4, 8); c.fill(); }
    for (const f of FURN) if (f.k !== 'sillon') drawFurniture(c, f);
  }

  function drawFurniture(c, f) {
    const [x, y, w, h] = f.r, px = x * T, py = y * T, W = w * T, H = h * T;
    c.save();
    c.fillStyle = 'rgba(0,0,0,.18)'; rr(c, px + 4, py + 6, W - 4, H - 4, 8); c.fill();
    switch (f.k) {
      case 'inodoro':
        c.fillStyle = '#fff'; rr(c, px + 8, py + 3, 24, 10, 3); c.fill();
        ell(c, px + 20, py + 24, 10, 12); c.fill(); c.fillStyle = '#bcd6e0'; ell(c, px + 20, py + 25, 6, 8); c.fill(); break;
      case 'banera':
        c.fillStyle = '#fff'; rr(c, px + 3, py + 3, W - 6, H - 6, 14); c.fill();
        c.fillStyle = '#9fd3ea'; rr(c, px + 9, py + 9, W - 18, H - 18, 10); c.fill(); break;
      case 'lavabo':
        c.fillStyle = '#fff'; rr(c, px + 4, py + 6, 30, 28, 6); c.fill(); c.fillStyle = '#bcd6e0'; ell(c, px + 19, py + 20, 9, 7); c.fill(); break;
      case 'cama':
        c.fillStyle = '#6d4a32'; rr(c, px + 2, py + 2, W - 4, H - 4, 6); c.fill();
        c.fillStyle = '#3d6fb6'; rr(c, px + 5, py + 26, W - 10, H - 32, 6); c.fill();
        c.fillStyle = '#f4f1ea'; rr(c, px + 12, py + 7, W - 24, 16, 6); c.fill();
        c.fillStyle = '#2f5a98'; for (let i = 0; i < 4; i++) c.fillRect(px + 5, py + 40 + i * 18, W - 10, 3); break;
      case 'escritorio':
        c.fillStyle = '#a0683c'; rr(c, px + 2, py + 2, W - 4, H - 6, 4); c.fill();
        c.fillStyle = '#fff'; c.save(); c.translate(px + 34, py + 18); c.rotate(-0.15); c.fillRect(-10, -8, 20, 15); c.restore();
        c.fillStyle = '#e74c3c'; c.fillRect(px + 52, py + 10, 4, 18); c.fillStyle = '#f1c40f'; c.fillRect(px + 60, py + 12, 10, 14); break;
      case 'mesada':
        c.fillStyle = '#9aa5ab'; rr(c, px, py + 2, W, H - 6, 3); c.fill();
        c.fillStyle = '#2c3e50'; for (const ox of [30, 62]) { ell(c, px + ox, py + 18, 9, 9); c.fill(); }
        c.fillStyle = '#c9d6dc'; rr(c, px + 150, py + 8, 50, 22, 6); c.fill(); break;
      case 'heladera':
        c.fillStyle = '#f2f5f7'; rr(c, px + 4, py + 2, W - 8, H - 6, 6); c.fill();
        c.strokeStyle = '#b8c4ca'; c.lineWidth = 2; c.beginPath(); c.moveTo(px + W / 2, py + 4); c.lineTo(px + W / 2, py + H - 6); c.stroke(); break;
      case 'mesa':
        c.fillStyle = '#b07a48'; rr(c, px + 3, py + 3, W - 6, H - 6, 8); c.fill();
        c.fillStyle = '#fff'; for (const ox of [22, 60, 98]) { ell(c, px + ox, py + 20, 9, 9); c.fill(); } break;
      case 'tele':
        c.fillStyle = '#6a4428'; rr(c, px + 2, py + 6, W - 4, H - 10, 4); c.fill();
        c.fillStyle = '#1a1a1a'; rr(c, px + 14, py + 2, W - 28, 12, 3); c.fill(); break;
      case 'biblio':
        c.fillStyle = '#6a4428'; rr(c, px + 2, py + 2, W - 4, H - 6, 3); c.fill();
        ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#16a085', '#d35400'].forEach((col, i) => { c.fillStyle = col; c.fillRect(px + 6 + i * 10, py + 6, 7, 22); }); break;
      case 'mesita':
        c.fillStyle = '#7a4f2e'; rr(c, px + 4, py + 4, W - 8, H - 10, 4); c.fill();
        c.fillStyle = '#b22222'; rr(c, px + 10, py + 10, 20, 14, 4); c.fill();
        c.fillStyle = '#7d1515'; rr(c, px + 8, py + 8, 24, 6, 3); c.fill(); break;
      case 'ratona':
        c.fillStyle = '#9b6a40'; rr(c, px + 4, py + 6, W - 8, H - 12, 6); c.fill();
        c.fillStyle = '#d4a017'; ell(c, px + 26, py + 20, 6, 6); c.fill(); break;
      case 'caja':
        c.fillStyle = '#e67e22'; rr(c, px + 3, py + 3, W - 6, H - 8, 5); c.fill();
        c.fillStyle = '#fff'; c.font = '800 11px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('JUGUETES', px + W / 2, py + H / 2 - 2); break;
      case 'reposera':
        c.fillStyle = '#d6d6d6'; rr(c, px + 4, py + 2, W - 8, H - 4, 6); c.fill();
        c.fillStyle = '#2e86c1'; for (let i = 0; i < 6; i++) c.fillRect(px + 6, py + 6 + i * 12, W - 12, 6);
        c.fillStyle = '#d4a017'; rr(c, px + W + 2, py + 6, 8, 14, 3); c.fill(); break; // la cerveza
      case 'canilla':
        c.fillStyle = '#7f8c8d'; rr(c, px + 12, py + 2, 16, 26, 4); c.fill();
        c.fillStyle = '#3498db'; ell(c, px + 20, py + 32, 8, 5); c.fill(); break;
    }
    c.restore();
  }

  function drawSillon(c, alpha) {
    const [x, y, w, h] = SILLON.r, px = x * T, py = y * T, W = w * T, H = h * T;
    c.save(); c.globalAlpha = alpha;
    c.fillStyle = '#8e3b2f'; rr(c, px, py - 6, W, H + 10, 10); c.fill();
    c.fillStyle = '#a84a3b'; for (let i = 0; i < 3; i++) { rr(c, px + 8 + i * ((W - 16) / 3), py + 4, (W - 16) / 3 - 4, H - 8, 6); c.fill(); }
    c.fillStyle = '#7a3026'; rr(c, px, py - 6, W, 10, 6); c.fill();
    c.restore();
  }

  function drawMister(c, x, y, dir, t, o = {}) {
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(0,0,0,.2)'; ell(c, 0, 5, 18, 13); c.fill();
    c.rotate(dir);
    c.fillStyle = '#2b2b2b'; rr(c, -11, -18, 15, 6, 3); c.fill(); rr(c, -11, 12, 15, 6, 3); c.fill(); // ruedas
    c.fillStyle = o.dim ? '#5e4a3a' : '#7a5636'; ell(c, 0, 0, 18, 14); c.fill();
    c.strokeStyle = '#4d341f'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#8f6844'; ell(c, -4, 0, 10, 8); c.fill();
    c.fillStyle = '#e9a7b6'; ell(c, 10, -12, 4, 3, 0.4); c.fill(); ell(c, 10, 12, 4, 3, -0.4); c.fill(); // patitas
    c.fillStyle = '#f0a3b5'; ell(c, 17, 0, 6, 5); c.fill(); // hocico
    c.fillStyle = '#c96f86'; ell(c, 21, 0, 2, 2); c.fill();
    for (const s of [-1, 1]) { // ojos-cámara
      c.fillStyle = '#111'; ell(c, 8, 6 * s, 3.8, 3.8); c.fill();
      c.fillStyle = '#4a6fa5'; ell(c, 8.6, 6 * s, 1.8, 1.8); c.fill();
      c.fillStyle = '#fff'; ell(c, 9.4, 6 * s - 1.2, 0.8, 0.8); c.fill();
    }
    if (Math.floor(t * 2) % 2 === 0) { c.fillStyle = '#ff3b30'; ell(c, -8, 0, 2.2, 2.2); c.fill(); } // REC
    c.restore();
  }

  function drawPerson(c, p, o) {
    const s = o.scale || 1;
    c.save(); c.translate(p.x, p.y);
    c.fillStyle = 'rgba(0,0,0,.2)'; ell(c, 0, 6 * s, 17 * s, 11 * s); c.fill();
    c.rotate(p.dir || 0);
    c.fillStyle = o.shirt; ell(c, 0, 0, 9 * s, 16 * s); c.fill();
    c.fillStyle = o.skin; ell(c, 5 * s, -14 * s, 3.6 * s, 3.6 * s); c.fill(); ell(c, 5 * s, 14 * s, 3.6 * s, 3.6 * s); c.fill();
    c.fillStyle = o.hair; ell(c, -1.5 * s, 0, (o.longHair ? 11 : 9.5) * s, (o.longHair ? 11 : 9.5) * s); c.fill();
    c.fillStyle = o.skin; ell(c, 2.5 * s, 0, 7 * s, 7.5 * s); c.fill();
    if (o.beard) { c.fillStyle = o.hair; ell(c, 6 * s, 0, 3 * s, 6 * s); c.fill(); }
    c.fillStyle = '#d99a7a'; ell(c, 9 * s, 0, 1.8 * s, 1.8 * s); c.fill();
    c.restore();
  }

  function drawToy(c, t, held) {
    c.save(); c.translate(t.x, t.y);
    if (held) c.scale(0.8, 0.8);
    if (t.kind === 'pelota') {
      c.fillStyle = '#e74c3c'; ell(c, 0, 0, 9, 9); c.fill(); c.fillStyle = '#fff'; c.fillRect(-9, -2, 18, 4);
    } else if (t.kind === 'autito') {
      c.fillStyle = '#222'; c.fillRect(-10, -9, 6, 18); c.fillRect(5, -9, 6, 18);
      c.fillStyle = '#2980b9'; rr(c, -12, -7, 24, 14, 4); c.fill(); c.fillStyle = '#aee1f9'; c.fillRect(2, -5, 5, 10);
    } else {
      c.fillStyle = '#27ae60'; ell(c, 0, 0, 11, 7); c.fill(); ell(c, 10, -4, 5, 4); c.fill();
      c.fillStyle = '#1e8449'; for (let i = -6; i <= 4; i += 5) { c.beginPath(); c.moveTo(i, -6); c.lineTo(i + 2.5, -11); c.lineTo(i + 5, -6); c.fill(); }
    }
    c.restore();
  }

  function drawCargador(c, x, y, t, alpha) {
    c.save(); c.globalAlpha = alpha; c.translate(x, y);
    c.strokeStyle = '#222'; c.lineWidth = 3; c.beginPath(); c.moveTo(-4, 4); c.bezierCurveTo(-16, 10, -10, -14, -16, -8); c.stroke();
    c.fillStyle = '#333'; rr(c, -6, -8, 14, 16, 3); c.fill();
    c.fillStyle = '#ccc'; c.fillRect(8, -5, 5, 3); c.fillRect(8, 2, 5, 3);
    const s = 1 + Math.sin(t * 6) * 0.3; c.fillStyle = '#fff6a0';
    c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 4 * s : 11 * s; c.lineTo(14 + Math.cos(a) * r, -14 + Math.sin(a) * r); } c.fill();
    c.restore();
  }

  function drawPad(c, t) {
    const active = G.chargerActive;
    c.save(); c.translate(PAD.x, PAD.y);
    c.fillStyle = active ? '#3d4a52' : '#6b6b6b'; rr(c, -18, -18, 36, 36, 8); c.fill();
    c.strokeStyle = active ? '#4fb3d9' : '#999'; c.lineWidth = 2; c.stroke();
    c.fillStyle = active ? (mister.charging ? `rgba(79,179,217,${0.6 + Math.sin(t * 8) * 0.4})` : '#f1c40f') : '#999';
    c.beginPath(); c.moveTo(3, -12); c.lineTo(-7, 2); c.lineTo(0, 2); c.lineTo(-3, 12); c.lineTo(7, -2); c.lineTo(0, -2); c.closePath(); c.fill();
    c.fillStyle = '#5a463a'; c.fillRect(-26, -6, 8, 12); // enchufe en la pared
    if (active) { c.strokeStyle = '#222'; c.lineWidth = 3; c.beginPath(); c.moveTo(-20, 0); c.quadraticCurveTo(-24, 14, -14, 14); c.stroke(); }
    else { c.fillStyle = '#fff'; c.font = '900 12px system-ui'; c.textAlign = 'center'; c.fillText('?', 12, -22); }
    c.restore();
  }

  function drawPlant(c, p, t) {
    c.save(); c.translate(p.x, p.y);
    const sway = Math.sin(t * 1.5 + p.x) * 0.06;
    c.fillStyle = '#b5552c'; ell(c, 0, 4, 13, 12); c.fill();
    c.fillStyle = '#5b3a24'; ell(c, 0, 3, 10, 9); c.fill();
    const leaf = p.thirsty ? '#b9a24a' : '#3f9a45', leaf2 = p.thirsty ? '#9c8435' : '#2f7d36';
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + sway + (p.thirsty ? 0.3 : 0);
      c.fillStyle = i % 2 ? leaf : leaf2;
      ell(c, Math.cos(a) * 9, Math.sin(a) * 9 - 2, p.thirsty ? 8 : 10, 4.5, a); c.fill();
    }
    if (!p.thirsty) { c.fillStyle = '#e84393'; ell(c, 0, -2, 4, 4); c.fill(); }
    if (p.thirsty) {
      const by = -26 + Math.sin(t * 4 + p.x) * 3;
      c.fillStyle = '#3498db'; c.beginPath(); c.moveTo(0, by - 8); c.quadraticCurveTo(7, by + 2, 0, by + 5); c.quadraticCurveTo(-7, by + 2, 0, by - 8); c.fill();
    }
    if (p.wet > 0) {
      c.fillStyle = `rgba(80,170,255,${Math.min(1, p.wet)})`;
      for (let i = 0; i < 5; i++) { ell(c, Math.cos(i * 1.3 + t * 5) * 14, -16 + ((t * 40 + i * 9) % 22), 1.8, 3); c.fill(); }
    }
    c.restore();
  }

  function drawSwitch(c, s, t) {
    c.save(); c.translate(s.x, s.y);
    if (s.on) { const g = c.createRadialGradient(0, 0, 2, 0, 0, 26); g.addColorStop(0, 'rgba(255,230,120,.9)'); g.addColorStop(1, 'rgba(255,230,120,0)'); c.fillStyle = g; ell(c, 0, 0, 26, 26); c.fill(); }
    c.fillStyle = '#f5f0e6'; rr(c, -7, -9, 14, 18, 3); c.fill();
    c.fillStyle = s.on ? '#f1c40f' : '#999'; rr(c, -3, s.on ? -6 : 0, 6, 6, 2); c.fill();
    c.restore();
  }

  function drawLockedDoor(c, d, t) {
    const px = d.x * T, py = d.y * T;
    c.fillStyle = '#7a4a26'; c.fillRect(px + 2, py + 10, T - 4, 20);
    c.fillStyle = '#5c3519'; c.fillRect(px + 2, py + 18, T - 4, 3);
    c.fillStyle = '#f1c40f'; ell(c, px + T - 10, py + 20, 3, 3); c.fill();
    c.font = '14px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🔒', px + T / 2, py + 20 + Math.sin(t * 3) * 1.5);
  }

  function wrapText(c, text, maxW) {
    const words = text.split(' '), lines = []; let line = '';
    for (const w of words) { const test = line ? line + ' ' + w : w; if (c.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test; }
    if (line) lines.push(line);
    return lines;
  }
  function drawBubble(c, x, y, text, o = {}) {
    c.save();
    c.font = '600 13px system-ui, sans-serif';
    const lines = wrapText(c, text, 170);
    const w = Math.max(...lines.map((l) => c.measureText(l).width)) + 18, h = lines.length * 16 + 12;
    let bx = clamp(x - w / 2, 4, WORLD_W - w - 4); const by = Math.max(4, y - h - 14);
    c.fillStyle = o.dark ? 'rgba(42,26,18,.92)' : '#fff'; c.strokeStyle = o.dark ? 'transparent' : 'rgba(0,0,0,.25)'; c.lineWidth = 1.5;
    rr(c, bx, by, w, h, 10); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(clamp(x, bx + 10, bx + w - 10) - 6, by + h - 1); c.lineTo(x, by + h + 8); c.lineTo(clamp(x, bx + 10, bx + w - 10) + 6, by + h - 1); c.fill();
    c.fillStyle = o.dark ? '#fff' : '#2a1a12'; c.textAlign = 'center'; c.textBaseline = 'top';
    lines.forEach((l, i) => c.fillText(l, bx + w / 2, by + 7 + i * 16));
    c.restore();
  }
  function drawLabel(c, x, y, text, disabled) {
    c.save(); c.font = '700 12px system-ui, sans-serif';
    const w = c.measureText(text).width + 16;
    c.fillStyle = disabled ? 'rgba(110,110,110,.88)' : 'rgba(181,101,46,.95)';
    rr(c, x - w / 2, y, w, 20, 10); c.fill();
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x, y + 10.5);
    c.restore();
  }
  function drawNameTag(c, e, text) {
    c.save(); c.font = '800 10px system-ui'; c.textAlign = 'center'; c.fillStyle = 'rgba(255,255,255,.9)';
    c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 3; c.strokeText(text, e.x, e.y + 30); c.fillText(text, e.x, e.y + 30); c.restore();
  }

  let camX = 0, camY = 0, zoom = 1, dpr = 1, staticDirty = true;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr);
  }
  window.addEventListener('resize', resize); resize();

  function render(t) {
    const vw = innerWidth, vh = innerHeight;
    // espacio reservado para el HUD: barra de arriba, panel de tareas (PC) y controles táctiles
    const topPad = 56, bottomPad = isTouch ? 190 : 0;
    const leftPad = !isTouch && vw >= 1000 && !$('tasks').classList.contains('collapsed') ? 330 : 0;
    const aw = vw - leftPad, ah = vh - topPad - bottomPad;
    const fit = Math.min(aw / WORLD_W, ah / WORLD_H);
    zoom = Math.min(1.6, Math.max(fit, 0.85));
    const viewW = vw / zoom, viewH = vh / zoom;
    const tx = WORLD_W * zoom <= aw ? -(leftPad / zoom) - (aw / zoom - WORLD_W) / 2
      : clamp(mister.x - (leftPad + aw / 2) / zoom, -leftPad / zoom, WORLD_W - viewW);
    const ty = WORLD_H * zoom <= ah ? -(topPad / zoom) - (ah / zoom - WORLD_H) / 2
      : clamp(mister.y - (topPad + ah / 2) / zoom, -topPad / zoom, WORLD_H - (vh - bottomPad) / zoom);
    camX += (tx - camX) * 0.15; camY += (ty - camY) * 0.15;
    if (Math.abs(tx - camX) > 400 || Math.abs(ty - camY) > 400) { camX = tx; camY = ty; }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#2a1a12'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!G) return;
    const s = dpr * zoom;
    ctx.setTransform(s, 0, 0, s, -camX * s, -camY * s);
    if (staticDirty) { renderStatic(); staticDirty = false; }
    ctx.drawImage(mapCanvas, 0, 0);

    // luces prendidas
    for (const sw of G.switches) if (sw.on) {
      const [x1, y1, x2, y2] = ROOMS[sw.room].r;
      ctx.fillStyle = 'rgba(255,214,90,.2)'; ctx.fillRect(x1 * T, y1 * T, (x2 - x1 + 1) * T, (y2 - y1 + 1) * T);
      const cx = (x1 + x2 + 1) / 2 * T, cy = (y1 + y2 + 1) / 2 * T;
      const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 90); g.addColorStop(0, 'rgba(255,240,160,.55)'); g.addColorStop(1, 'rgba(255,240,160,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - 90, cy - 90, 180, 180);
      ctx.font = '20px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('💡', cx, cy);
    }
    for (const sw of G.switches) drawSwitch(ctx, sw, t);
    for (const k in DOORS) if (DOORS[k].locked) drawLockedDoor(ctx, DOORS[k], t);
    drawPad(ctx, t);
    for (const p of G.plants) drawPlant(ctx, p, t);
    for (const toy of G.toys) if (toy.state === 'floor') drawToy(ctx, toy);
    if (G.cargador && G.cargador.state === 'floor') {
      const d = dist(mister, G.cargador);
      const a = clamp(1.6 - d / (2.6 * T), 0, 1);
      if (a > 0) drawCargador(ctx, G.cargador.x, G.cargador.y, t, a);
    }

    // personajes ordenados por altura
    const ents = [
      { y: luca.y, draw: () => { drawPerson(ctx, luca, { shirt: '#2e86de', hair: '#4a2f1d', skin: '#f2c9a5', scale: 0.82 }); drawNameTag(ctx, luca, 'Luca'); } },
      { y: enzo.y, draw: () => { drawPerson(ctx, enzo, { shirt: '#4b7f52', hair: '#3b2a20', skin: '#e8b98f', scale: 1.05, beard: true }); drawNameTag(ctx, enzo, 'Enzo'); } },
      { y: mister.y, draw: () => drawMister(ctx, mister.x, mister.y, mister.dir, t, { dim: mister.battery < 10 }) },
    ];
    if (nuria) ents.push({ y: nuria.y, draw: () => { drawPerson(ctx, nuria, { shirt: '#c0392b', hair: '#1f1410', skin: '#efc3a0', scale: 1, longHair: true }); drawNameTag(ctx, nuria, 'Nuria'); } });
    ents.sort((a, b) => a.y - b.y).forEach((e) => e.draw());

    if (mister.carry) {
      if (mister.carry.type === 'toy') drawToy(ctx, { ...mister.carry.ref, x: mister.x, y: mister.y - 22 }, true);
      else drawCargador(ctx, mister.x, mister.y - 22, t, 1);
    }
    drawSillon(ctx, mister.hidden ? 0.7 : 1);

    // indicadores
    if (luca.alert) {
      ctx.save(); ctx.font = '900 22px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = luca.seen ? '#f39c12' : '#e74c3c';
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
      const label = luca.state === 'dormido' ? 'Zzz' : '!';
      const yy = luca.y - 26 + Math.sin(t * 5) * 3;
      ctx.strokeText(label, luca.x, yy); ctx.fillText(label, luca.x, yy); ctx.restore();
    }
    if (luca.state === 'cazando') { ctx.save(); ctx.strokeStyle = 'rgba(231,76,60,.7)'; ctx.lineWidth = 3; ell(ctx, luca.x, luca.y, 22 + Math.sin(t * 10) * 3, 22 + Math.sin(t * 10) * 3); ctx.stroke(); ctx.restore(); }

    for (const e of [luca, enzo, nuria, mister]) if (e && e.bubble) drawBubble(ctx, e.x, e.y - 22, e.bubble.text, { dark: e === mister });
    if (mode === 'play' && G.hint && !mister.bubble) {
      const k = isTouch ? 'A' : 'Espacio';
      drawLabel(ctx, mister.x, mister.y + 24, G.hint.disabled ? G.hint.label : `${k}: ${G.hint.label}`, G.hint.disabled);
    }
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (mode === 'play' && G) update(dt);
    render(now / 1000);
    requestAnimationFrame(loop);
  }

  // ================= Pantallas =================
  function showCard(html, buttons) {
    const card = $('card');
    card.innerHTML = html + '<div class="btns">' + buttons.map((b, i) => `<button data-i="${i}" class="${b.cls || ''}">${b.label}</button>`).join('') + '</div>';
    card.querySelectorAll('button[data-i]').forEach((btn) => { btn.onclick = () => { audio(); buttons[+btn.dataset.i].fn(); }; });
    $('overlay').hidden = false; $('overlay').scrollTop = 0; card.scrollTop = 0;
    $('hud').hidden = true; $('touch').hidden = true;
  }
  function hideCard() {
    $('overlay').hidden = true; $('hud').hidden = false; $('touch').hidden = !isTouch;
    G.taskHtml = ''; updateHud();
  }

  function showMenu() {
    mode = 'menu'; banner(null);
    const unlocked = store.get('mister.unlocked', 1);
    showCard(`<div class="hero"><canvas id="heroMole" width="220" height="130"></canvas></div>
      <h1>Míster</h1>
      <p class="sub">Un juego sobre <i>Kentukis</i> de Samanta Schweblin · La historia de Enzo</p>
      <p>Sos <b>Míster</b>, el kentuki topo de la casa de Enzo en Umbertide. Cumplí las tareas de cada día, cuidá a Luca, escapá de sus trampas y llegá al cargador antes de quedarte sin batería.</p>
      <p class="kicker" style="margin-top:14px">Elegir día</p>
      <div class="days">${DAYS.map((d, i) => `<button class="${i + 1 <= unlocked ? '' : 'ghost'}" data-day="${i + 1}" title="${d.titulo}">${i + 1}</button>`).join('')}</div>
      <p class="credits">Guido Jacofsky · Zahir Fara · Lucas Park · Ignacio Britos</p>`,
    [
      { label: unlocked > 1 ? `Seguir (día ${unlocked})` : 'Jugar', fn: () => startDay(unlocked) },
      { label: 'Cómo jugar', cls: 'ghost', fn: showHelp },
    ]);
    $('card').querySelectorAll('button[data-day]').forEach((b) => { b.onclick = () => { audio(); startDay(+b.dataset.day); }; });
    const hc = $('heroMole').getContext('2d');
    const animHero = (now) => {
      if (!document.body.contains(hc.canvas)) return;
      hc.setTransform(1, 0, 0, 1, 0, 0); hc.clearRect(0, 0, 220, 130);
      hc.setTransform(2.6, 0, 0, 2.6, 110, 68);
      drawMister(hc, 0, 0, -Math.PI / 2 + Math.sin(now / 600) * 0.25, now / 1000);
      requestAnimationFrame(animHero);
    };
    requestAnimationFrame(animHero);
  }

  function showHelp() {
    const k = (s) => `<span class="key">${s}</span>`;
    showCard(`<h2>Cómo jugar</h2>
      <ul>
        <li><b>Mover:</b> ${isTouch ? 'joystick (abajo a la izquierda)' : `${k('←↑↓→')} o ${k('WASD')}`}</li>
        <li><b>Acción:</b> ${isTouch ? 'botón <b>A</b>' : `${k('Espacio')} o ${k('E')}`}. Cuando estés cerca de algo, abajo de Míster aparece qué podés hacer.</li>
        <li>Cada día tiene <b>tareas</b>: regar las plantas, ordenar los juguetes, apagar luces, cuidar a Luca... Cuando termines, <b>volvé al cargador</b> del living.</li>
        <li>Cuidá la <b>batería</b>: si llega a 0 te apagás. En el cargador se recarga.</li>
        <li><b>El pacto con Enzo:</b> quedarse quieto es "no" y ronronear es "sí". Si Luca se duerme o no hace la tarea, andá a verlo y después ronroneale a Enzo para avisarle.</li>
        <li><b>Luca te odia:</b> si te atrapa te encierra en el baño o en el armario. Golpeá la puerta hasta que Enzo te escuche. Debajo del <b>sillón</b> no te encuentra.</li>
      </ul>`, [{ label: 'Volver', fn: showMenu }]);
  }

  function pause() {
    if (mode !== 'play') return;
    mode = 'paused';
    showCard(`<p class="kicker">Día ${G.n} · ${G.d.titulo}</p><h2>Pausa</h2><ul>${G.tasks.filter((t) => !t.final).map((t) => `<li>${t.done ? '✔ ' : ''}${t.text()}</li>`).join('')}</ul>`, [
      { label: 'Seguir', fn: () => { hideCard(); mode = 'play'; } },
      { label: 'Reiniciar día', cls: 'ghost', fn: () => startDay(G.n) },
      { label: 'Cómo jugar', cls: 'ghost', fn: () => { showHelp(); const card = $('card'); const b = card.querySelector('button[data-i="0"]'); b.textContent = 'Seguir'; b.onclick = () => { hideCard(); mode = 'play'; }; } },
      { label: 'Menú', cls: 'ghost', fn: showMenu },
    ]);
  }

  // ================= Entrada =================
  const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' };
  window.addEventListener('keydown', (e) => {
    if (KEYMAP[e.code]) { keys.add(KEYMAP[e.code]); if (mode === 'play') e.preventDefault(); }
    if ((e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') && mode === 'play') { e.preventDefault(); if (!e.repeat) { audio(); action(); } }
    if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) { if (mode === 'play') pause(); }
  });
  window.addEventListener('keyup', (e) => { if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]); });
  window.addEventListener('blur', () => { keys.clear(); stick.x = stick.y = 0; if (mode === 'play') pause(); });

  // joystick táctil
  const zone = $('stickZone'), base = $('stickBase'), knob = $('stickKnob');
  let stickId = null, sc = { x: 0, y: 0 };
  zone.addEventListener('pointerdown', (e) => {
    audio(); stickId = e.pointerId; zone.setPointerCapture(e.pointerId);
    const r = zone.getBoundingClientRect();
    base.style.left = (e.clientX - r.left - 60) + 'px'; base.style.top = (e.clientY - r.top - 60) + 'px'; base.style.bottom = 'auto';
    sc = { x: e.clientX, y: e.clientY };
    knob.style.transform = '';
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== stickId) return;
    let dx = e.clientX - sc.x, dy = e.clientY - sc.y; const d = Math.hypot(dx, dy), R = 50;
    if (d > R) { dx = dx / d * R; dy = dy / d * R; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    stick.x = dx / R; stick.y = dy / R;
  });
  const endStick = (e) => {
    if (e.pointerId !== stickId) return;
    stickId = null; stick.x = stick.y = 0; knob.style.transform = '';
    base.style.left = ''; base.style.top = ''; base.style.bottom = '';
  };
  zone.addEventListener('pointerup', endStick); zone.addEventListener('pointercancel', endStick);
  $('btnAction').addEventListener('pointerdown', (e) => { e.preventDefault(); audio(); action(); });

  $('btnPause').addEventListener('click', pause);
  const muteBtn = $('btnMute');
  const syncMute = () => { muteBtn.textContent = muted ? '🔇' : '🔊'; };
  muteBtn.addEventListener('click', () => { muted = !muted; store.set('mister.muted', muted); syncMute(); });
  syncMute();
  // en pantallas chicas las tareas arrancan en modo compacto (solo la próxima)
  const tasksEl = $('tasks');
  const smallScreen = () => innerWidth < 700;
  if (smallScreen()) tasksEl.classList.add('compact');
  $('tasksToggle').addEventListener('click', () => {
    if (smallScreen()) tasksEl.classList.toggle('compact');
    else tasksEl.classList.toggle('collapsed');
    if (G) { G.taskHtml = ''; updateHud(); }
  });
  if (isTouch) document.body.classList.add('touch');

  // para pruebas automáticas
  window.__mister = { get G() { return G; }, mister, luca, enzo, get mode() { return mode; }, startDay, action, DOORS };

  showMenu();
  requestAnimationFrame(loop);
})();
