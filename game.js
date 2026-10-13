'use strict';
/*
 * Míster, el topo — juego 2D basado en "Kentukis" de Samanta Schweblin (la historia de Enzo).
 * Sos Míster, el kentuki topo. Cumplí las tareas de cada día, escapá de las trampas de Luca
 * y no te quedes sin batería.
 */
(() => {
  // ================= Utilidades =================
  const T = 40, MW = 30, MH = 20, WORLD_W = MW * T, WORLD_H = MH * T;
  const M = 3; // margen exterior (jardín y calle) en tiles
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
    { k: 'mesaluz', r: [9, 1, 1, 1] },
    { k: 'escritorio', r: [11, 1, 2, 1] },
    { k: 'mesada', r: [18, 1, 7, 1] },
    { k: 'heladera', r: [27, 1, 2, 1] },
    { k: 'mesa', r: [21, 3, 3, 1] },
    { k: 'cesto', r: [28, 3, 1, 1] },
    { k: 'tele', r: [1, 10, 3, 1] },
    { k: 'biblio', r: [9, 10, 2, 1] },
    { k: 'mesita', r: [13, 10, 1, 1] },
    { k: 'ratona', r: [2, 12, 2, 1] },
    { k: 'butaca', r: [7, 12, 1, 1] },
    { k: 'sillon', r: [1, 14, 4, 1], hide: true },
    { k: 'caja', r: [11, 17, 2, 1] },
    { k: 'planta', r: [14, 18, 1, 1] },
    { k: 'planta', r: [1, 18, 1, 1] },
    { k: 'estante', r: [24, 10, 3, 1] },
    { k: 'reposera', r: [24, 13, 1, 2] },
    { k: 'canilla', r: [28, 10, 1, 1] },
  ];
  const SILLON = FURN.find((f) => f.k === 'sillon');
  const CAJA = FURN.find((f) => f.k === 'caja');
  const CESTO = C(28, 3);
  const PAD = C(2, 17);
  const CANILLA = C(28, 10);
  const PHONE = C(13, 10);
  const PLANT_SPOTS = [[17, 11], [19, 11], [17, 14], [19, 14], [17, 17], [20, 17], [23, 17], [26, 17]];
  const BASIL_SPOTS = [[24, 11], [26, 11], [27, 15]];
  const TOY_SPOTS = [[8, 4], [13, 4], [4, 8], [18, 8], [26, 8], [8, 13], [12, 15], [6, 17], [9, 17]];
  const CHARGER_SPOTS = [
    { t: [9, 2], where: 'entre la cama y el escritorio de Luca' },
    { t: [2, 2], where: 'en el baño' },
    { t: [19, 4], where: 'en la cocina' },
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
  const WINDOWS = [[2, 0], [3, 0], [8, 0], [9, 0], [19, 0], [20, 0], [25, 0], [26, 0], [0, 15], [0, 16], [3, 19], [4, 19], [11, 19], [12, 19], [29, 2]];
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
  const OPENINGS = [[3, 6], [15, 3], [10, 6], [11, 6], [22, 6], [23, 6], [5, 9], [6, 9], [21, 9], [22, 9], [15, 12], [15, 13]];

  const inRectPx = (p, r, pad = 0) => p.x >= r[0] * T - pad && p.x <= (r[0] + r[2]) * T + pad && p.y >= r[1] * T - pad && p.y <= (r[1] + r[3]) * T + pad;
  const roomAt = (p) => { for (const k in ROOMS) { const [x1, y1, x2, y2] = ROOMS[k].r; if (p.x >= x1 * T && p.x < (x2 + 1) * T && p.y >= y1 * T && p.y < (y2 + 1) * T) return k; } return null; };
  const blockedSpots = [...PLANT_SPOTS, ...BASIL_SPOTS];

  // ---------- Navegación (BFS en la grilla) para los personajes ----------
  function navBlocked(x, y) {
    if (x < 0 || y < 0 || x >= MW || y >= MH) return true;
    if (tiles[y][x] === WALL) return true;
    for (const k in DOORS) { const d = DOORS[k]; if (d.locked && d.x === x && d.y === y) return true; }
    for (const f of FURN) { const [fx, fy, fw, fh] = f.r; if (x >= fx && x < fx + fw && y >= fy && y < fy + fh) return true; }
    for (const [px, py] of blockedSpots) if (px === x && py === y) return true;
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
    for (const [px, py] of blockedSpots) if (box([px + 0.15, py + 0.15, 0.7, 0.7])) return true;
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
      intro: 'Nuria y la psicóloga decidieron que Luca tenga un kentuki. Llegaste vos: <b>Míster</b>, un topo de peluche con ruedas y cámaras en los ojos.<br><br>Luca te odia. Ya te encerró en el baño y escondió tu cargador para que te quedes sin batería. Si te apagás, hay otra mediación...<br><br><b>Ojo:</b> si te acercás a Luca, te agarra y te vuelve a encerrar.',
      startTrapped: true, chargerHidden: true, battery: 75,
      plants: 3, basil: 0, toys: 0, lights: 0, reports: 0, hunts: false, nuria: false,
      quote: 'El pacto con Enzo: quedarse quieto es <b>"no"</b> y ronronear es <b>"sí"</b>.',
    },
    {
      titulo: 'El vínculo', parte: 'Parte 2 · págs. 50 a 53',
      intro: 'Ya pasaron casi dos meses. Cuidás a Luca, ordenás la casa, cosechás albahaca para la cocina y le avisás a Enzo si el chico <b>no hace la tarea o se duerme</b>.<br><br>Luca se volvió a meter con tu cargador: puede que lo haya escondido o que solo te haya desconectado los cables.',
      battery: 80, plants: 2, basil: 2, toys: 3, lights: 0, reports: 2, hunts: true, nuria: false,
      quote: '"¿Qué está haciendo acá todo el día con nosotros?" — Enzo. El teléfono nunca suena.',
    },
    {
      titulo: 'La distancia', parte: 'Parte 3 · págs. 72 a 74',
      intro: 'Desde "ese nefasto domingo" te mantenés lejos de Enzo, pero seguís cuidando a Luca. Quedaron luces prendidas por toda la casa.<br><br>Hoy llega <b>Nuria</b> sin avisar, y a ella los kentukis no le gustan nada. Cuando llegue, <b>escondete bajo el sillón</b>.',
      battery: 80, plants: 0, basil: 2, toys: 0, lights: 3, reports: 2, hunts: true, nuria: true,
      quote: '"Hace tres meses que convivimos." Enzo defiende al topo, y él mismo nota que es una excusa.',
    },
    {
      titulo: 'La indiferencia', parte: 'Parte 4 · págs. 89 y 90',
      intro: 'Enzo se siente abandonado y dejó que se sequen las plantas que vos cuidabas. Luca volvió a esconder el cargador.<br><br>Salvá el vivero antes de quedarte sin batería.',
      chargerHidden: true, battery: 65, plants: 5, basil: 2, toys: 0, lights: 0, reports: 1, hunts: true, nuria: false,
      quote: 'Enzo le pega su dirección en la pata del sillón. Nada. Lo que vive como un desaire es una señal de peligro.',
    },
    {
      titulo: 'El quiebre', parte: 'Parte 5 · págs. 105 y 106',
      intro: 'Enzo planea llevarte a pescar al río Tevere con Carlo. Luca se va una semana a la playa con su madre.<br><br>Es tu último día tranquilo en la casa...',
      battery: 80, plants: 3, basil: 2, toys: 2, lights: 2, reports: 2, hunts: true, nuria: false, ending: true, lucaSpeed: 135,
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
    if (actx && !music.started) startBgm();
    return actx;
  }

  // ---------- Música de fondo: barcarola napolitana con mandolina (original, sintetizada) ----------
  const MUSIC_VOL = 0.05, BEAT = 60 / 96, BAR = 3 * BEAT;
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  // 16 compases en 3/4: [acorde (notas MIDI), melodía [[nota, tiempos], ...]]
  const SONG = [
    [[57, 60, 64], [[76, 1.5], [74, 0.5], [72, 1]]],
    [[50, 53, 57], [[74, 1], [77, 1], [81, 1]]],
    [[52, 56, 59], [[80, 1.5], [77, 0.5], [76, 1]]],
    [[57, 60, 64], [[76, 3]]],
    [[48, 52, 55], [[76, 1], [79, 1], [76, 1]]],
    [[43, 47, 50], [[74, 1.5], [71, 0.5], [74, 1]]],
    [[41, 45, 48], [[72, 1], [69, 1], [72, 1]]],
    [[52, 56, 59], [[71, 2], [68, 1]]],
    [[57, 60, 64], [[69, 1], [72, 1], [76, 1]]],
    [[50, 53, 57], [[77, 1.5], [76, 0.5], [74, 1]]],
    [[43, 47, 50], [[71, 1], [74, 1], [79, 1]]],
    [[48, 52, 55], [[76, 3]]],
    [[41, 45, 48], [[81, 1.5], [79, 0.5], [77, 1]]],
    [[50, 53, 57], [[77, 1], [76, 1], [74, 1]]],
    [[52, 56, 59], [[76, 1], [74, 1], [71, 1]]],
    [[57, 60, 64], [[69, 3]]],
  ];
  const music = { started: false, on: false, out: null, next: 0, bar: 0, timer: null, file: false };
  // Si en la carpeta del juego hay un archivo "musica.mp3", suena ese (bajito y en loop).
  const bgm = new Audio();
  bgm.src = 'musica.mp3'; bgm.loop = true; bgm.volume = 0.22; bgm.preload = 'auto';
  function startBgm() {
    music.started = true;
    bgm.muted = muted;
    bgm.play().then(() => { music.file = true; }).catch(() => startMusic());
  }
  function startMusic() {
    music.on = true;
    music.out = actx.createGain();
    music.out.gain.value = muted ? 0 : MUSIC_VOL;
    const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    music.out.connect(lp).connect(actx.destination);
    music.next = actx.currentTime + 0.2;
    music.timer = setInterval(scheduleMusic, 150);
  }
  function setMusicVolume() { bgm.muted = muted; if (music.out) music.out.gain.setTargetAtTime(muted ? 0 : MUSIC_VOL, actx.currentTime, 0.1); }
  function pluck(freq, t, dur, type, vol) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(music.out); o.start(t); o.stop(t + dur + 0.02);
  }
  function scheduleMusic() {
    if (!actx || actx.state !== 'running') return;
    if (music.next < actx.currentTime) music.next = actx.currentTime + 0.05;
    while (music.next < actx.currentTime + 0.8) {
      const [chord, mel] = SONG[music.bar], t0 = music.next;
      // bajo en el 1 y acorde de guitarra en el 2 y el 3
      pluck(midi(chord[0] - 12), t0, BEAT * 0.9, 'triangle', 0.9);
      for (const b of [1, 2]) chord.forEach((n, i) => pluck(midi(n), t0 + b * BEAT + i * 0.012, 0.35, 'triangle', 0.28));
      // melodía con trémolo de mandolina
      let t = t0;
      for (const [n, beats] of mel) {
        const dur = beats * BEAT;
        if (beats <= 0.5) pluck(midi(n), t, dur * 0.9, 'sawtooth', 0.22);
        else for (let k = 0; k < dur - 0.05; k += 1 / 13) pluck(midi(n), t + k, 0.11, 'sawtooth', k === 0 ? 0.26 : 0.16);
        t += dur;
      }
      music.next += BAR;
      music.bar = (music.bar + 1) % SONG.length;
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (!actx) return;
    if (document.hidden) { actx.suspend(); bgm.pause(); }
    else { actx.resume(); if (music.file) bgm.play().catch(() => {}); }
  });
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
    water() { tone(900, 0.25, 'triangle', 0.05, -500); tone(500, 0.2, 'sine', 0.05, 300, 0.06); },
    pick() { tone(520, 0.08, 'square', 0.07, 220); },
    ok() { [523, 659, 784].forEach((f, i) => tone(f, 0.15, 'triangle', 0.12, 0, i * 0.09)); },
    win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.12, 0, i * 0.12)); },
    bad() { tone(300, 0.35, 'sawtooth', 0.09, -180); },
    alarm() { tone(880, 0.12, 'square', 0.07); tone(660, 0.12, 'square', 0.07, 0, 0.15); },
    ring() { for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) tone(i % 2 ? 1450 : 1150, 0.05, 'square', 0.05, 0, r * 0.7 + i * 0.06); },
    click() { tone(1200, 0.03, 'square', 0.05); },
    pin() { tone(1500, 0.05, 'square', 0.08); tone(900, 0.08, 'triangle', 0.08, 0, 0.04); },
    spark() { tone(2000, 0.06, 'sawtooth', 0.04, -1200); },
  };

  // ================= Estado =================
  let mode = 'menu'; // menu | intro | play | mini | paused | over
  let G = null;
  const mister = { x: 0, y: 0, dir: 0, kx: 0, ky: 0, battery: 100, carry: null, water: 0, hidden: false, trapped: null, moving: false, bubble: null };
  const luca = { name: 'Luca', x: 0, y: 0, dir: Math.PI / 2, speed: 95, path: [], state: 'tarea', t: 0, alert: false, seen: false, bubble: null, repath: 0, pause: 0 };
  const enzo = { name: 'Enzo', x: 0, y: 0, dir: 0, speed: 75, path: [], t: 0, spot: 0, bubble: null };
  let nuria = null;
  const keys = new Set();
  const stick = { x: 0, y: 0 };

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
    if (mini) closeMini(true);
    G = {
      n, d, time: 0, chargerActive: false, cargador: null,
      plants: [], basil: [], toys: [], switches: [], event: null, nuriaDone: false, allDone: false,
      grabCd: 0, followT: 0, followCd: 0, chatIdx: Math.floor(Math.random() * ENZO_CHAT.length), chatCd: 15,
      lowWarned: false, leakT: 0, leakWarned: false, hint: null, taskHtml: '',
      stats: { watered: 0, basil: 0, toys: 0, lights: 0, reports: 0, escaped: 0, traps: 0 },
    };
    const thirsty = new Set(shuffle(PLANT_SPOTS.map((_, i) => i)).slice(0, d.plants));
    G.plants = PLANT_SPOTS.map(([x, y], i) => ({ ...C(x, y), thirsty: thirsty.has(i), wet: 0 }));
    G.basil = BASIL_SPOTS.map(([x, y]) => ({ ...C(x, y), ready: d.basil > 0, regrow: 0 }));
    G.toys = shuffle(TOY_SPOTS).slice(0, d.toys).map(([x, y], i) => ({ ...C(x, y), kind: ['pelota', 'autito', 'dino'][i % 3], state: 'floor' }));
    G.switches = SWITCHES.map((s) => ({ ...s, ...C(s.t[0], s.t[1]), on: false }));
    shuffle(G.switches).slice(0, d.lights).forEach((s) => { s.on = true; });
    // el día 1 y el 4 siempre lo esconde; los demás días a veces sí y a veces solo desconecta los cables
    G.chargerHidden = d.chargerHidden || Math.random() < 0.5;
    if (G.chargerHidden) { const s = pick(CHARGER_SPOTS); G.cargador = { ...C(s.t[0], s.t[1]), state: 'floor', where: s.where }; }
    else G.cargador = { ...PAD, state: 'atPad' }; // está en su lugar, pero con los cables desconectados
    G.tasks = makeTasks(d, G.chargerHidden);

    Object.assign(mister, { ...PAD, dir: -Math.PI / 2, kx: 0, ky: 0, battery: d.battery, carry: null, water: 0, hidden: false, trapped: null, bubble: null });
    if (d.startTrapped) lockIn('bano');
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
    if (G.n === 1) toast(`Luca te encerró en el baño. Acercate a la puerta y forzá la cerradura con ${isTouch ? 'el botón <b>A</b>' : '<span class="key">Espacio</span>'}.`, 5);
    else if (G.d.nuria) toast('Hoy viene Nuria. Cuando aparezca el aviso, corré a esconderte bajo el sillón del living.', 4.5);
    else if (G.chargerHidden) toast(`Luca escondió el cargador ${G.cargador.where}. Buscalo y llevalo al living.`, 4.5);
    else toast('Luca desconectó el cargador. Andá al living y uní los cables.', 3.5);
  }

  function makeTasks(d, hidden) {
    const s = () => G.stats;
    const L = [];
    if (d.startTrapped) L.push({ text: () => 'Escapá del baño: forzá la cerradura', check: () => s().escaped > 0 });
    L.push(hidden
      ? { text: () => 'Encontrá el cargador que escondió Luca, llevalo al living y uní los cables', check: () => G.chargerActive }
      : { text: () => 'Luca desconectó el cargador: uní los cables en el living', check: () => G.chargerActive });
    if (d.plants) L.push({ text: () => `Regá las plantas del vivero (${Math.min(s().watered, d.plants)}/${d.plants}) — la regadera pierde agua`, check: () => s().watered >= d.plants });
    if (d.basil) L.push({ text: () => `Cortá albahaca del vivero y dejala en el cesto de la cocina (${Math.min(s().basil, d.basil)}/${d.basil})`, check: () => s().basil >= d.basil });
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
    if (mister.carry) dropCarry(true);
    Object.assign(mister, { x: d.spawn.x, y: d.spawn.y, kx: 0, ky: 0, trapped: which });
    d.locked = true;
  }
  function unlockDoor() {
    const d = DOORS[mister.trapped];
    d.locked = false;
    mister.trapped = null;
    G.stats.escaped++;
    G.grabCd = 3;
    toast('¡Abriste la cerradura! Ahora alejate de Luca.', 3);
    if (G.n === 1 && G.stats.escaped === 1) setTimeout(() => { if (G && mode === 'play') toast(`Ahora buscá el cargador: Luca lo dejó ${G.cargador.where}.`, 4.5); }, 3200);
  }
  function grabMister() {
    lockIn('bano');
    G.stats.traps++;
    say(luca, pick(['¡Te agarré, topo!', '¡Al baño!', '¡Jaja! ¡Quedate ahí!']), 2.5);
    toast('¡Luca te agarró y te encerró en el baño! Forzá la cerradura para salir.', 4);
    sfx.bad();
    if (!luca.alert || luca.state === 'cazando') { luca.state = 'volver'; luca.path = []; }
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
  function fillWater() {
    mister.water = 3; G.leakT = 0; sfx.water(); say(mister, 'regadera llena 💧', 1.4);
    if (!G.leakWarned) { G.leakWarned = true; toast('La regadera pierde agua mientras te movés. ¡Apurate!', 3.5); }
  }
  function waterPlant(p) { p.thirsty = false; p.wet = 1.2; mister.water--; G.stats.watered++; sfx.water(); }
  function pickToy(t) { t.state = 'carried'; mister.carry = { type: 'toy', ref: t }; sfx.pick(); }
  function storeToy() { mister.carry.ref.state = 'stored'; mister.carry = null; G.stats.toys++; sfx.pick(); }
  function cutBasil(b) { b.ready = false; b.regrow = 14; mister.carry = { type: 'basil', fresh: 30 }; sfx.pick(); toast('¡Llevala rápido al cesto de la cocina antes de que se marchite!', 3); }
  function storeBasil() { mister.carry = null; G.stats.basil++; sfx.ok(); }
  function pickCargador() { G.cargador.state = 'carried'; mister.carry = { type: 'cargador' }; sfx.pick(); toast('¡Lo encontraste! Llevalo al enchufe del living.', 3); }
  function placeCargador() { Object.assign(G.cargador, { ...PAD, state: 'atPad' }); mister.carry = null; openMini('wires'); }
  function dropCarry(byLuca) {
    const c = mister.carry; if (!c) return;
    if (c.type === 'toy') Object.assign(c.ref, { x: mister.x, y: mister.y, state: 'floor' });
    else if (c.type === 'cargador') Object.assign(G.cargador, { x: mister.x, y: mister.y, state: 'floor' });
    else if (c.type === 'basil') toast(byLuca ? 'Se te cayó la albahaca.' : 'Tiraste la albahaca.', 2);
    mister.carry = null;
  }
  function switchOff(s) { s.on = false; G.stats.lights++; sfx.click(); }

  function interactions() {
    const m = mister, L = [];
    const add = (x, y, label, act, opt = {}) => L.push({ x, y, label, act, reach: 58, ...opt });
    if (m.trapped) {
      const d = DOORS[m.trapped];
      add((d.x + 0.5) * T, (d.y + 0.5) * T, 'Forzar la cerradura', () => openMini('lock'), { reach: 62 });
    }
    add(enzo.x, enzo.y, luca.alert && luca.seen ? 'Ronronear: avisarle de Luca' : 'Ronronear a Enzo', talkEnzo, { reach: 60 });
    if (m.water < 3) add(CANILLA.x, CANILLA.y, 'Llenar la regadera', fillWater);
    for (const p of G.plants) {
      if (!p.thirsty) continue;
      if (m.water > 0) add(p.x, p.y, 'Regar la planta', () => openMini('water', { plant: p }));
      else add(p.x, p.y, 'Sin agua: llená la regadera en la canilla', null, { disabled: true });
    }
    if (!m.carry) {
      for (const t of G.toys) if (t.state === 'floor') add(t.x, t.y, 'Agarrar el juguete', () => pickToy(t), { reach: 40 });
      if (G.cargador.state === 'floor') add(G.cargador.x, G.cargador.y, 'Agarrar el cargador', pickCargador, { reach: 44 });
      if (G.stats.basil < G.d.basil) for (const b of G.basil) if (b.ready) add(b.x, b.y, 'Cortar albahaca', () => cutBasil(b));
      if (G.cargador.state === 'atPad') add(PAD.x, PAD.y, 'Unir los cables del cargador', () => openMini('wires'), { reach: 50 });
    } else if (m.carry.type === 'toy') {
      add((CAJA.r[0] + 1) * T, (CAJA.r[1] + 0.5) * T, 'Guardar el juguete en la caja', storeToy, { reach: 62 });
    } else if (m.carry.type === 'cargador') {
      add(PAD.x, PAD.y, 'Poner el cargador y unir los cables', placeCargador, { reach: 50 });
    } else if (m.carry.type === 'basil') {
      add(CESTO.x, CESTO.y, 'Dejar la albahaca en el cesto', storeBasil, { reach: 60 });
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
    else if (mister.carry) { dropCarry(false); sfx.pick(); }
    else { sfx.purr(); say(mister, 'rrrrr…', 1.2); }
  }

  // ================= Minijuegos =================
  // lock: ganzúa estilo GTA · water: mantener apretado y soltar en la zona verde · wires: unir cables estilo Among Us
  const MS = 320;
  const miniEl = $('mini'), mc = $('miniCanvas'), mx = mc.getContext('2d');
  const WIRE_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#e84393'];
  const WIRE_Y = [80, 140, 200, 260];
  let mini = null;

  function openMini(type, opts = {}) {
    mini = { type, t: 0, result: null, ...opts };
    let title = '', help = '';
    if (type === 'lock') {
      const pins = G.n <= 2 ? 3 : 4;
      Object.assign(mini, { pins, set: 0, a: -Math.PI / 2, w: 2.3 + G.n * 0.18, dir: 1, hw: 0.42, c: rand(0, Math.PI * 2), shake: 0 });
      title = 'Forzá la cerradura';
      help = isTouch ? 'Tocá cuando la ganzúa pase por la zona verde.' : 'Apretá <span class="key">Espacio</span> cuando la ganzúa pase por la zona verde.';
    } else if (type === 'water') {
      const lo = rand(48, 66), hw = G.n >= 4 ? 13 : 16;
      Object.assign(mini, { level: 0, holding: false, lo, hi: lo + hw });
      title = 'Regá la planta';
      help = isTouch ? 'Mantené apretado para echar agua y soltá en la zona verde.' : 'Mantené <span class="key">Espacio</span> para echar agua y soltá en la zona verde.';
    } else if (type === 'wires') {
      Object.assign(mini, { right: shuffle([0, 1, 2, 3]), done: [false, false, false, false], drag: null });
      title = 'Uní los cables del cargador';
      help = 'Arrastrá cada cable de la izquierda hasta el de su mismo color.';
    }
    $('miniTitle').textContent = title;
    $('miniHelp').innerHTML = help;
    const s = Math.min(window.devicePixelRatio || 1, 2);
    mc.width = MS * s; mc.height = MS * s;
    mx.setTransform(s, 0, 0, s, 0, 0);
    mode = 'mini';
    miniEl.hidden = false; $('touch').hidden = true;
    keys.clear(); stick.x = stick.y = 0;
  }
  function closeMini(silent) {
    mini = null;
    miniEl.hidden = true;
    if (silent) return;
    mode = 'play';
    $('touch').hidden = !isTouch;
    keys.clear();
  }
  function miniResult(text, ok, after, t = 0.9) { mini.result = { text, ok, after, t }; }

  function miniPress() {
    if (!mini || mini.result) return;
    if (mini.type === 'lock') {
      let d = mini.a - mini.c; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) <= mini.hw) {
        mini.set++;
        sfx.pin();
        if (mini.set >= mini.pins) { sfx.ok(); miniResult('¡Click! Abierta', true, () => { closeMini(); unlockDoor(); }); return; }
        mini.c = rand(0, Math.PI * 2); mini.w *= 1.15; mini.hw *= 0.85; mini.dir *= -1;
      } else {
        mini.set = Math.max(0, mini.set - 1);
        mini.shake = 0.35;
        mister.battery -= 2;
        sfx.bad();
      }
    } else if (mini.type === 'water') {
      mini.holding = true;
    }
  }
  function miniRelease() {
    if (!mini || mini.result || mini.type !== 'water' || !mini.holding) return;
    mini.holding = false;
    const L = mini.level;
    if (L < 4) return;
    if (L >= mini.lo && L <= mini.hi) { waterPlant(mini.plant); miniResult('¡Justo lo que necesitaba!', true, () => closeMini()); sfx.ok(); }
    else if (L < mini.lo) { miniResult('Poca agua. Probá de nuevo.', false, () => { mini.level = 0; mini.result = null; }, 0.8); sfx.bad(); }
    else { mister.water--; miniResult('¡Demasiada agua! Se perdió.', false, () => closeMini()); sfx.bad(); }
  }
  function miniUpdate(dt) {
    mister.battery -= 0.3 * dt;
    if (mister.battery <= 0) { closeMini(true); return fail('Te quedaste sin batería y te apagaste. Si el kentuki se apaga, hay otra mediación...'); }
    mini.t += dt;
    if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('toast').classList.remove('show'); }
    updateHud();
    if (mini.result) { mini.result.t -= dt; if (mini.result.t <= 0) { const f = mini.result.after; mini.result = null; f(); } return; }
    if (mini.type === 'lock') { mini.a += mini.w * mini.dir * dt; mini.shake = Math.max(0, mini.shake - dt); }
    if (mini.type === 'water' && mini.holding) {
      mini.level += (28 + 46 * Math.abs(Math.sin(mini.t * 3.1))) * dt;
      if (mini.level >= 100) { mini.holding = false; mister.water--; sfx.bad(); miniResult('¡Se rebalsó! Perdiste agua.', false, () => closeMini()); }
    }
  }

  function miniPoint(e) { const r = mc.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * MS, y: (e.clientY - r.top) / r.height * MS }; }
  mc.addEventListener('pointerdown', (e) => {
    e.preventDefault(); audio();
    if (!mini || mini.result) return;
    if (mini.type === 'wires') {
      const p = miniPoint(e);
      for (let i = 0; i < 4; i++) {
        if (!mini.done[i] && Math.hypot(p.x - 44, p.y - WIRE_Y[i]) < 30) { mini.drag = { i, ...p }; mc.setPointerCapture(e.pointerId); sfx.click(); break; }
      }
    } else miniPress();
  });
  mc.addEventListener('pointermove', (e) => { if (mini && mini.drag) Object.assign(mini.drag, miniPoint(e)); });
  const miniUp = (e) => {
    if (!mini) return;
    if (mini.type === 'wires' && mini.drag) {
      const p = miniPoint(e), i = mini.drag.i;
      mini.drag = null;
      for (let j = 0; j < 4; j++) {
        if (Math.hypot(p.x - 276, p.y - WIRE_Y[j]) < 32) {
          if (mini.right[j] === i) {
            mini.done[i] = true; sfx.spark();
            if (mini.done.every(Boolean)) {
              sfx.ok();
              miniResult('¡Cargador conectado!', true, () => { closeMini(); G.cargador.state = 'plugged'; G.chargerActive = true; });
            }
          } else sfx.bad();
          break;
        }
      }
    } else miniRelease();
  };
  mc.addEventListener('pointerup', miniUp);
  mc.addEventListener('pointercancel', miniUp);
  $('miniClose').addEventListener('click', () => { if (mini) closeMini(); });

  function renderMini(t) {
    if (!mini) return;
    const c = mx;
    c.clearRect(0, 0, MS, MS);
    c.save();
    if (mini.type === 'lock') {
      const sx = mini.shake > 0 ? Math.sin(t * 90) * 6 * mini.shake / 0.35 : 0;
      c.translate(sx, 0);
      const cx = 160, cy = 180;
      // pernos
      for (let i = 0; i < mini.pins; i++) {
        const px = 160 + (i - (mini.pins - 1) / 2) * 38;
        c.fillStyle = i < mini.set ? '#3f9a45' : '#4a4f57'; rr(c, px - 13, 14, 26, 34, 6); c.fill();
        c.fillStyle = i < mini.set ? '#b9f6bd' : '#22262b'; rr(c, px - 6, i < mini.set ? 18 : 30, 12, 14, 3); c.fill();
      }
      // cuerpo de la cerradura
      const g = c.createRadialGradient(cx - 30, cy - 30, 10, cx, cy, 120);
      g.addColorStop(0, '#f3d27a'); g.addColorStop(1, '#a87b1c');
      c.fillStyle = g; ell(c, cx, cy, 112, 112); c.fill();
      c.strokeStyle = '#6e4f0f'; c.lineWidth = 4; c.stroke();
      c.strokeStyle = '#2a2208'; c.lineWidth = 20; ell(c, cx, cy, 86, 86); c.stroke();
      c.strokeStyle = '#4cd964'; c.lineWidth = 20; c.beginPath(); c.arc(cx, cy, 86, mini.c - mini.hw, mini.c + mini.hw); c.stroke();
      // ojo de la cerradura
      c.fillStyle = '#1b1b1b'; ell(c, cx, cy - 10, 16, 16); c.fill();
      c.beginPath(); c.moveTo(cx - 9, cy - 4); c.lineTo(cx + 9, cy - 4); c.lineTo(cx + 13, cy + 30); c.lineTo(cx - 13, cy + 30); c.fill();
      // ganzúa
      c.save(); c.translate(cx, cy); c.rotate(mini.a);
      c.strokeStyle = '#d7dde3'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(96, 0); c.stroke();
      c.fillStyle = '#ff3b30'; ell(c, 96, 0, 8, 8); c.fill();
      c.restore();
    } else if (mini.type === 'water') {
      c.save(); c.translate(110, 220); c.scale(3, 3);
      drawPlant(c, { x: 0, y: 0, thirsty: mini.level < mini.lo, wet: mini.holding ? 1 : 0 }, t);
      c.restore();
      // regadera
      c.save(); c.translate(150, 70); c.rotate(mini.holding ? 0.55 : 0.1);
      c.fillStyle = '#2e86c1'; rr(c, -40, -22, 60, 44, 10); c.fill();
      c.strokeStyle = '#2e86c1'; c.lineWidth = 7; c.beginPath(); c.moveTo(18, 0); c.lineTo(52, 20); c.stroke();
      c.strokeStyle = '#1b5e8a'; c.lineWidth = 5; c.beginPath(); c.arc(-12, -22, 16, Math.PI, 0); c.stroke();
      c.restore();
      if (mini.holding) {
        c.fillStyle = '#5dade2';
        for (let i = 0; i < 10; i++) { const k = (t * 3 + i / 10) % 1; ell(c, 185 - 60 * k + Math.sin(i) * 6, 105 + 85 * k, 2.5, 5); c.fill(); }
      }
      // medidor
      const gx = 254, gy = 30, gw = 40, gh = 250;
      c.fillStyle = '#22262b'; rr(c, gx, gy, gw, gh, 10); c.fill();
      const zy = gy + gh * (1 - mini.hi / 100), zh = gh * (mini.hi - mini.lo) / 100;
      c.fillStyle = 'rgba(76,217,100,.45)'; c.fillRect(gx + 4, zy, gw - 8, zh);
      c.strokeStyle = '#4cd964'; c.lineWidth = 2; c.strokeRect(gx + 4, zy, gw - 8, zh);
      const lv = Math.min(100, mini.level);
      c.fillStyle = '#3498db'; c.fillRect(gx + 9, gy + gh * (1 - lv / 100), gw - 18, gh * lv / 100);
      c.fillStyle = '#fff'; c.font = '800 13px system-ui'; c.textAlign = 'center'; c.fillText('💧 ' + mister.water, gx + gw / 2, gy + gh + 24);
    } else if (mini.type === 'wires') {
      c.fillStyle = '#2b2f36'; rr(c, 6, 30, 308, 276, 14); c.fill();
      c.fillStyle = '#4a4f57'; c.fillRect(14, 50, 22, 236); c.fillRect(284, 50, 22, 236);
      c.fillStyle = '#ffd400'; c.font = '900 22px system-ui'; c.textAlign = 'center'; c.fillText('⚡', 160, 60);
      const L = 44, R = 276;
      for (let j = 0; j < 4; j++) {
        c.fillStyle = WIRE_COLORS[mini.right[j]]; c.fillRect(R, WIRE_Y[j] - 7, 30, 14);
        c.fillStyle = '#ddd'; ell(c, R, WIRE_Y[j], 9, 9); c.fill();
      }
      for (let i = 0; i < 4; i++) {
        c.fillStyle = WIRE_COLORS[i]; c.fillRect(14, WIRE_Y[i] - 7, 30, 14);
        c.fillStyle = '#ddd'; ell(c, L, WIRE_Y[i], 9, 9); c.fill();
        let end = null;
        if (mini.done[i]) end = { x: R, y: WIRE_Y[mini.right.indexOf(i)] };
        else if (mini.drag && mini.drag.i === i) end = mini.drag;
        if (end) {
          c.strokeStyle = WIRE_COLORS[i]; c.lineWidth = 12; c.lineCap = 'round';
          c.beginPath(); c.moveTo(L, WIRE_Y[i]); c.lineTo(end.x, end.y); c.stroke();
        }
      }
      const k = mini.done.filter(Boolean).length;
      c.fillStyle = '#fff'; c.font = '700 13px system-ui'; c.fillText(`${k}/4 cables`, 160, 298);
    }
    if (mini.result) {
      c.fillStyle = mini.result.ok ? 'rgba(46,160,67,.94)' : 'rgba(192,57,43,.94)';
      rr(c, 20, 130, 280, 60, 14); c.fill();
      c.fillStyle = '#fff'; c.font = '900 19px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(mini.result.text, 160, 160);
    }
    c.restore();
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
            sfx.alarm();
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
        if (luca.t <= 0) {
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
    // si te acercás a Luca (despierto), te agarra y te encierra en el baño
    G.grabCd -= dt;
    if (!busy && luca.state !== 'dormido' && !m.hidden && !m.trapped && G.grabCd <= 0 && dist(luca, m) < 40) grabMister();
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
        setTimeout(() => { if (G && G.event) banner(null); }, 2000);
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
  function update(dt) {
    G.time += dt;
    const m = mister;
    // --- movimiento ---
    let ix = 0, iy = 0;
    if (keys.has('left')) ix -= 1;
    if (keys.has('right')) ix += 1;
    if (keys.has('up')) iy -= 1;
    if (keys.has('down')) iy += 1;
    ix += stick.x; iy += stick.y;
    const mag = Math.hypot(ix, iy);
    if (mag > 1) { ix /= mag; iy /= mag; }
    m.moving = mag > 0.15;
    const sp = 150;
    moveAxis(m, (m.moving ? ix * sp : 0) * dt, 0); moveAxis(m, 0, (m.moving ? iy * sp : 0) * dt);
    if (m.moving) {
      const target = Math.atan2(iy, ix);
      let da = target - m.dir; da = Math.atan2(Math.sin(da), Math.cos(da));
      m.dir += da * Math.min(1, 14 * dt);
    }
    m.hidden = inRectPx(m, SILLON.r);

    // --- regadera que pierde agua ---
    if (m.water > 0 && m.moving) {
      G.leakT += dt;
      if (G.leakT >= 8) { G.leakT = 0; m.water--; say(m, m.water ? 'se escapa el agua...' : '¡se vació la regadera!', 1.4); }
    }
    // --- la albahaca se marchita ---
    if (m.carry && m.carry.type === 'basil') {
      m.carry.fresh -= dt;
      if (m.carry.fresh <= 0) { m.carry = null; sfx.bad(); toast('La albahaca se marchitó. Cortá otra (vuelve a crecer).', 3); }
    }
    for (const b of G.basil) if (!b.ready && G.d.basil) { b.regrow -= dt; if (b.regrow <= 0) b.ready = true; }

    // --- batería ---
    const onPad = G.chargerActive && dist(m, PAD) < 22;
    m.charging = onPad && m.battery < 100;
    if (onPad) m.battery = Math.min(100, m.battery + 22 * dt);
    else m.battery -= (0.45 + (m.moving ? 0.6 : 0)) * dt;
    if (m.battery < 22 && !G.lowWarned && !onPad) { G.lowWarned = true; toast(G.chargerActive ? '¡Batería baja! Volvé al cargador del living.' : '¡Batería baja! Conectá el cargador.', 3); sfx.alarm(); }
    if (m.battery > 40) G.lowWarned = false;
    if (m.battery <= 0) return fail('Te quedaste sin batería y te apagaste. Si el kentuki se apaga, hay otra mediación...');

    // --- personajes y eventos ---
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
        d.basil ? stat(s.basil, 'albahacas cosechadas') : '',
        d.toys ? stat(s.toys, 'juguetes guardados') : '',
        d.lights ? stat(s.lights, 'luces apagadas') : '',
        d.reports ? stat(s.reports, 'avisos a Enzo') : '',
        stat(s.traps + (d.startTrapped ? 1 : 0), 'veces encerrado'),
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
  mapCanvas.width = WORLD_W + 2 * M * T; mapCanvas.height = WORLD_H + 2 * M * T;

  function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
  function ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, Math.PI * 2); }
  const shade = (rgb, v) => `rgb(${clamp(rgb[0] + v, 0, 255) | 0},${clamp(rgb[1] + v * 0.85, 0, 255) | 0},${clamp(rgb[2] + v * 0.7, 0, 255) | 0})`;
  const WOOD_TONES = { luca: [214, 172, 124], pasillo: [176, 128, 84], living: [196, 146, 98] };

  function drawTree(c, x, y, r, seed) {
    c.fillStyle = 'rgba(0,0,0,.18)'; ell(c, x + 8, y + 10, r, r * 0.85); c.fill();
    const greens = ['#4f8a3a', '#5e9c45', '#6fb052'];
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + seed, d = r * 0.45;
      c.fillStyle = greens[i % 3]; ell(c, x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.62, r * 0.62); c.fill();
    }
    c.fillStyle = '#7cc05c'; ell(c, x - r * 0.2, y - r * 0.25, r * 0.4, r * 0.4); c.fill();
  }

  function drawExterior(c) {
    // pasto exterior (coordenadas del mundo: la casa va de 0 a WORLD_W)
    const x0 = -M * T, y0 = -M * T, W = WORLD_W + 2 * M * T, H = WORLD_H + 2 * M * T;
    c.fillStyle = '#7fb257'; c.fillRect(x0, y0, W, H);
    for (let i = 0; i < 900; i++) {
      const x = x0 + hash(i, 1) * W, y = y0 + hash(i, 2) * H;
      c.fillStyle = hash(i, 3) > 0.5 ? '#72a64c' : '#8cc063'; c.fillRect(x, y, 3, 5);
    }
    // vereda y calle
    const sy = WORLD_H + 0.55 * T;
    c.fillStyle = '#c9c4ba'; c.fillRect(x0, sy, W, 0.8 * T);
    c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 1;
    for (let x = x0; x < x0 + W; x += 40) { c.beginPath(); c.moveTo(x + 0.5, sy); c.lineTo(x + 0.5, sy + 0.8 * T); c.stroke(); }
    c.fillStyle = '#4b4f55'; c.fillRect(x0, sy + 0.8 * T, W, H);
    c.fillStyle = '#f1e9c8'; for (let x = x0; x < x0 + W; x += 80) c.fillRect(x + 10, sy + 1.95 * T, 44, 5);
    // camino a la puerta
    c.fillStyle = '#d8cdb7'; c.fillRect(8 * T + 4, WORLD_H, T - 8, 0.55 * T);
    // el auto de Enzo (con la luneta donde lleva a Míster)
    c.save(); c.translate(21 * T, sy + 1.45 * T);
    c.fillStyle = 'rgba(0,0,0,.25)'; rr(c, -58, -20, 124, 46, 14); c.fill();
    c.fillStyle = '#2f6db5'; rr(c, -62, -24, 124, 46, 14); c.fill();
    c.fillStyle = '#9fd0f0'; rr(c, 24, -18, 20, 34, 5); c.fill(); // parabrisas
    c.fillStyle = '#8cc0e0'; rr(c, -44, -17, 14, 32, 5); c.fill(); // luneta
    c.fillStyle = '#285d9a'; rr(c, -26, -20, 46, 38, 8); c.fill();
    c.fillStyle = '#fff6b0'; c.fillRect(58, -18, 4, 8); c.fillRect(58, 8, 4, 8);
    c.fillStyle = '#e74c3c'; c.fillRect(-62, -18, 4, 8); c.fillRect(-62, 8, 4, 8);
    c.restore();
    // buzón
    c.fillStyle = '#6d4a32'; c.fillRect(10 * T + 18, WORLD_H + 6, 4, 14);
    c.fillStyle = '#c0392b'; rr(c, 10 * T + 10, WORLD_H + 2, 20, 10, 4); c.fill();
    // árboles y arbustos alrededor
    const trees = [[-1.6, -1.4, 34], [6, -1.8, 30], [14, -1.6, 36], [23, -1.8, 30], [31.4, -1.2, 36], [31.6, 7, 32], [-1.7, 6, 30], [-1.6, 14, 34], [31.5, 15, 30], [-1.8, 20.2, 26], [3, 20.15, 16], [14, 20.15, 16], [28, 20.15, 18]];
    trees.forEach(([tx, ty, r], i) => drawTree(c, tx * T, ty * T, r, i));
  }

  function drawFloorTile(c, x, y, t) {
    const px = x * T, py = y * T;
    if (t === WOOD) {
      const room = roomAt(C(x, y)) || 'pasillo';
      const base = WOOD_TONES[room] || WOOD_TONES.pasillo;
      for (let r = 0; r < 4; r++) {
        const row = y * 4 + r, yy = py + r * 10, off = Math.floor(hash(row, 7) * 80);
        const seg = Math.floor((px + off) / 80), bx = 80 - ((px + off) % 80);
        c.fillStyle = shade(base, (hash(seg, row) - 0.5) * 22); c.fillRect(px, yy, T, 10);
        if (bx < T) {
          c.fillStyle = shade(base, (hash(seg + 1, row) - 0.5) * 22); c.fillRect(px + bx, yy, T - bx, 10);
          c.fillStyle = 'rgba(70,40,15,.35)'; c.fillRect(px + bx, yy, 1, 10);
        }
        c.fillStyle = 'rgba(70,40,15,.22)'; c.fillRect(px, yy + 9, T, 1);
      }
    } else if (t === TILE) {
      const room = roomAt(C(x, y));
      if (room === 'cocina' || (x >= 18 && y === 6)) {
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
          c.fillStyle = (x * 2 + i + y * 2 + j) % 2 ? '#efe4d0' : '#c9b393';
          c.fillRect(px + i * 20, py + j * 20, 20, 20);
        }
      } else {
        c.fillStyle = '#d7ebf1'; c.fillRect(px, py, T, T);
        c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.5;
        for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(px + i * 10, py); c.lineTo(px + i * 10, py + T); c.moveTo(px, py + i * 10); c.lineTo(px + T, py + i * 10); c.stroke(); }
        if (hash(x, y) > 0.8) { c.fillStyle = '#b6dbe6'; c.fillRect(px + 11, py + 11, 9, 9); }
      }
    } else if (t === GRASS) {
      c.fillStyle = (Math.floor(x / 2) % 2) ? '#8cc363' : '#95ca6b'; c.fillRect(px, py, T, T);
      for (let i = 0; i < 7; i++) {
        c.fillStyle = hash(x, y, i + 9) > 0.5 ? '#7cb455' : '#a5d47b';
        c.fillRect(px + hash(x, y, i) * 36, py + hash(x, y, i + 3) * 36, 2, 5);
      }
    }
  }

  function drawDecor(c) {
    // alfombra del pasillo
    c.fillStyle = '#8e3b2f'; rr(c, 1.7 * T, 7.25 * T, 26.6 * T, 1.5 * T, 6); c.fill();
    c.strokeStyle = '#d9a75b'; c.lineWidth = 3; rr(c, 1.85 * T, 7.4 * T, 26.3 * T, 1.2 * T, 4); c.stroke();
    c.fillStyle = 'rgba(217,167,91,.35)';
    for (let x = 3; x < 28; x += 2) { c.save(); c.translate(x * T, 8 * T); c.rotate(Math.PI / 4); c.fillRect(-6, -6, 12, 12); c.restore(); }
    // alfombra del living
    c.fillStyle = '#3e6f8c'; rr(c, 1.3 * T, 11.5 * T, 4.6 * T, 3.3 * T, 8); c.fill();
    c.strokeStyle = '#f2e6cf'; c.lineWidth = 3; rr(c, 1.5 * T, 11.7 * T, 4.2 * T, 2.9 * T, 6); c.stroke();
    c.strokeStyle = 'rgba(242,230,207,.5)'; c.lineWidth = 2; rr(c, 1.75 * T, 11.95 * T, 3.7 * T, 2.4 * T, 4); c.stroke();
    // alfombra redonda del living
    c.fillStyle = '#d9a75b'; ell(c, 9.5 * T, 15 * T, 1.5 * T, 1.2 * T); c.fill();
    c.strokeStyle = '#b5652e'; c.lineWidth = 4; ell(c, 9.5 * T, 15 * T, 1.15 * T, 0.88 * T); c.stroke();
    // cuarto de Luca: alfombra y silla
    c.fillStyle = '#5d9cec'; ell(c, 11 * T, 4 * T, 1.7 * T, 0.95 * T); c.fill();
    c.fillStyle = '#ffd166'; c.font = '28px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('★', 11 * T, 4 * T);
    c.fillStyle = '#4a5560'; rr(c, 11.5 * T - 13, 2.5 * T - 12, 26, 24, 6); c.fill();
    // armario: barral con ropa
    c.fillStyle = '#5c4033'; c.fillRect(15 * T + 4, 1 * T + 6, 2 * T - 8, 4);
    ['#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#34495e'].forEach((col, i) => { c.fillStyle = col; rr(c, 15 * T + 8 + i * 14, 1 * T + 8, 10, 26, 3); c.fill(); });
    // baño: alfombrita
    c.fillStyle = '#f7b6c2'; rr(c, 2.4 * T, 4.3 * T, 1.3 * T, 0.6 * T, 8); c.fill();
    // cocina: alfombra bajo la mesa
    c.fillStyle = 'rgba(181,101,46,.35)'; rr(c, 20.6 * T, 2.6 * T, 3.8 * T, 1.8 * T, 8); c.fill();
    // vivero: caminos de piedra
    const stones = [];
    for (let x = 16; x <= 22; x++) stones.push([x + 0.5, 12.5 + (x % 2 ? 0.15 : -0.1)]);
    for (let y = 10; y <= 16; y++) stones.push([21.7 + (y % 2 ? 0.15 : -0.1), y + 0.5]);
    stones.forEach(([sx, sy], i) => {
      c.fillStyle = 'rgba(0,0,0,.12)'; ell(c, sx * T + 2, sy * T + 3, 15, 12, hash(i, 4)); c.fill();
      c.fillStyle = '#d6d0c4'; ell(c, sx * T, sy * T, 15, 12, hash(i, 4)); c.fill();
    });
    // vivero: flores sueltas
    for (let i = 0; i < 40; i++) {
      const fx = 16 + hash(i, 11) * 13, fy = 10 + hash(i, 12) * 9;
      const tx = Math.floor(fx), ty = Math.floor(fy);
      if (navBlocked(tx, ty) || ty === 12 || ty === 13 || tx === 21 || tx === 22) continue;
      c.fillStyle = ['#ff6b81', '#ffd166', '#ffffff', '#c39bd3'][i % 4];
      for (let k = 0; k < 5; k++) { ell(c, fx * T + Math.cos(k * 1.26) * 3, fy * T + Math.sin(k * 1.26) * 3, 2.2, 2.2); c.fill(); }
      c.fillStyle = '#f39c12'; ell(c, fx * T, fy * T, 1.5, 1.5); c.fill();
    }
  }

  function renderStatic() {
    const c = mapCanvas.getContext('2d');
    c.setTransform(1, 0, 0, 1, M * T, M * T);
    c.clearRect(-M * T, -M * T, mapCanvas.width, mapCanvas.height);
    drawExterior(c);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (tiles[y][x] !== WALL) drawFloorTile(c, x, y, tiles[y][x]);
    drawDecor(c);
    // umbrales de puertas
    for (const [x, y] of OPENINGS) { c.fillStyle = 'rgba(90,60,35,.22)'; c.fillRect(x * T, y * T, T, T); }
    // sombras de las paredes sobre el piso
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (tiles[y][x] === WALL) continue;
      if (y > 0 && tiles[y - 1][x] === WALL) { const g = c.createLinearGradient(0, y * T, 0, y * T + 12); g.addColorStop(0, 'rgba(0,0,0,.22)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x * T, y * T, T, 12); }
      if (x > 0 && tiles[y][x - 1] === WALL) { const g = c.createLinearGradient(x * T, 0, x * T + 8, 0); g.addColorStop(0, 'rgba(0,0,0,.14)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x * T, y * T, 8, T); }
    }
    // paredes (o cerco de ligustro alrededor del vivero)
    const isWall = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH && tiles[y][x] === WALL;
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (!isWall(x, y)) continue;
      const px = x * T, py = y * T;
      const near = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < MW && ny < MH && tiles[ny][nx] !== WALL) near.push(tiles[ny][nx]);
      }
      if (near.length && near.every((t) => t === GRASS)) {
        c.fillStyle = '#3f7a32'; c.fillRect(px, py, T, T);
        for (let i = 0; i < 5; i++) { c.fillStyle = i % 2 ? '#4f9140' : '#5fa64d'; ell(c, px + hash(x, y, i) * T, py + hash(x, y, i + 5) * T, 10, 10); c.fill(); }
        continue;
      }
      c.fillStyle = '#efe3d0'; c.fillRect(px, py, T, T);
      c.fillStyle = 'rgba(160,130,100,.18)'; c.fillRect(px, py + T / 2, T, 1);
      c.fillStyle = '#4e3b2f';
      if (!isWall(x, y - 1)) c.fillRect(px, py, T, 3);
      if (!isWall(x, y + 1)) c.fillRect(px, py + T - 3, T, 3);
      if (!isWall(x - 1, y)) c.fillRect(px, py, 3, T);
      if (!isWall(x + 1, y)) c.fillRect(px + T - 3, py, 3, T);
    }
    // ventanas
    for (const [x, y] of WINDOWS) {
      const px = x * T, py = y * T, horiz = y === 0 || y === MH - 1;
      c.fillStyle = '#9fd3ea';
      if (horiz) { c.fillRect(px, py + 13, T, 14); c.fillStyle = '#fff'; c.fillRect(px, py + 19, T, 2); c.fillRect(px + T / 2 - 1, py + 13, 2, 14); }
      else { c.fillRect(px + 13, py, 14, T); c.fillStyle = '#fff'; c.fillRect(px + 19, py, 2, T); c.fillRect(px + 13, py + T / 2 - 1, 14, 2); }
    }
    // puerta de entrada
    c.fillStyle = '#7a4a26'; c.fillRect(8 * T + 4, 19 * T + 6, T - 8, T - 12);
    c.fillStyle = '#d9b26a'; ell(c, 8 * T + T - 12, 19 * T + T / 2, 2.5, 2.5); c.fill();
    // nombres de los ambientes
    c.font = '800 12px system-ui, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'top';
    const labelAt = { bano: [2, 2.6], luca: [8.9, 4.6], cocina: [25, 3.3], pasillo: [12, 7.55], living: [6.4, 10.3], vivero: [23, 12] };
    for (const k in ROOMS) {
      const [lx, ly] = labelAt[k];
      c.fillStyle = k === 'vivero' ? 'rgba(30,70,15,.45)' : 'rgba(60,40,25,.4)';
      c.fillText(ROOMS[k].name.toUpperCase(), lx * T, ly * T);
    }
    // canteros del vivero
    for (const [px, py] of PLANT_SPOTS) { c.fillStyle = '#6b4a2e'; rr(c, px * T + 3, py * T + 3, T - 6, T - 6, 8); c.fill(); c.fillStyle = '#4a3220'; rr(c, px * T + 6, py * T + 6, T - 12, T - 12, 6); c.fill(); }
    for (const [px, py] of BASIL_SPOTS) { c.fillStyle = '#8b5a2b'; rr(c, px * T + 3, py * T + 3, T - 6, T - 6, 4); c.fill(); c.fillStyle = '#4a3220'; rr(c, px * T + 6, py * T + 6, T - 12, T - 12, 3); c.fill(); }
    for (const f of FURN) if (f.k !== 'sillon') drawFurniture(c, f);
  }

  function drawFurniture(c, f) {
    const [x, y, w, h] = f.r, px = x * T, py = y * T, W = w * T, H = h * T;
    c.save();
    c.fillStyle = 'rgba(0,0,0,.2)'; rr(c, px + 5, py + 7, W - 6, H - 6, 8); c.fill();
    switch (f.k) {
      case 'inodoro':
        c.fillStyle = '#fff'; rr(c, px + 8, py + 3, 24, 11, 3); c.fill();
        c.fillStyle = '#f4f7f8'; ell(c, px + 20, py + 25, 11, 13); c.fill();
        c.strokeStyle = '#c9d6dc'; c.lineWidth = 1.5; c.stroke();
        c.fillStyle = '#bcd6e0'; ell(c, px + 20, py + 26, 6, 8); c.fill(); break;
      case 'banera':
        c.fillStyle = '#fff'; rr(c, px + 3, py + 3, W - 6, H - 6, 16); c.fill();
        c.strokeStyle = '#c9d6dc'; c.lineWidth = 2; c.stroke();
        c.fillStyle = '#9fd3ea'; rr(c, px + 10, py + 10, W - 20, H - 20, 12); c.fill();
        c.fillStyle = 'rgba(255,255,255,.6)'; ell(c, px + 30, py + 30, 8, 4, -0.5); c.fill();
        c.fillStyle = '#aab7bd'; ell(c, px + W / 2, py + 8, 4, 4); c.fill(); break;
      case 'lavabo':
        c.fillStyle = '#e8dccb'; rr(c, px + 2, py + 6, 34, 30, 5); c.fill();
        c.fillStyle = '#fff'; ell(c, px + 19, py + 21, 11, 9); c.fill(); c.fillStyle = '#bcd6e0'; ell(c, px + 19, py + 22, 7, 5); c.fill();
        c.fillStyle = '#aab7bd'; c.fillRect(px + 2, py + 12, 6, 4); break;
      case 'cama':
        c.fillStyle = '#6d4a32'; rr(c, px + 2, py + 2, W - 4, H - 4, 6); c.fill();
        c.fillStyle = '#f4f1ea'; rr(c, px + 5, py + 5, W - 10, H - 10, 5); c.fill();
        c.fillStyle = '#3d6fb6'; rr(c, px + 5, py + 30, W - 10, H - 35, 5); c.fill();
        c.fillStyle = '#ffd166'; for (let i = 0; i < 6; i++) { ell(c, px + 22 + (i % 2) * 36, py + 46 + Math.floor(i / 2) * 22, 4, 4); c.fill(); }
        c.fillStyle = '#fff'; rr(c, px + 14, py + 9, W - 28, 16, 7); c.fill();
        c.fillStyle = '#2f5a98'; c.fillRect(px + 5, py + 30, W - 10, 4); break;
      case 'mesaluz':
        c.fillStyle = '#8a5a36'; rr(c, px + 5, py + 5, W - 10, H - 12, 4); c.fill();
        c.fillStyle = '#ffe08a'; ell(c, px + 20, py + 17, 8, 8); c.fill(); c.fillStyle = '#f1c40f'; ell(c, px + 20, py + 17, 3, 3); c.fill(); break;
      case 'escritorio':
        c.fillStyle = '#a0683c'; rr(c, px + 2, py + 2, W - 4, H - 6, 4); c.fill();
        c.fillStyle = '#b97a49'; c.fillRect(px + 2, py + 2, W - 4, 4);
        c.save(); c.translate(px + 34, py + 18); c.rotate(-0.15); c.fillStyle = '#fff'; c.fillRect(-11, -8, 22, 15); c.fillStyle = '#9ab'; for (let i = 0; i < 4; i++) c.fillRect(-8, -5 + i * 3, 16, 1); c.restore();
        c.fillStyle = '#e74c3c'; c.fillRect(px + 54, py + 10, 4, 18); c.fillStyle = '#f1c40f'; c.fillRect(px + 61, py + 12, 10, 14); break;
      case 'mesada':
        c.fillStyle = '#7d8a90'; rr(c, px, py + 2, W, H - 6, 3); c.fill();
        c.fillStyle = '#aab7bd'; c.fillRect(px, py + 2, W, 4);
        for (const ox of [24, 54]) { c.fillStyle = '#2c3e50'; ell(c, px + ox, py + 19, 10, 10); c.fill(); c.strokeStyle = '#566'; c.lineWidth = 2; ell(c, px + ox, py + 19, 6, 6); c.stroke(); }
        c.fillStyle = '#d5dde1'; rr(c, px + 150, py + 7, 56, 24, 7); c.fill(); c.fillStyle = '#9fc6d4'; rr(c, px + 155, py + 11, 46, 16, 5); c.fill();
        c.fillStyle = '#aab7bd'; ell(c, px + 178, py + 6, 3, 3); c.fill();
        c.fillStyle = '#c0392b'; ell(c, px + 110, py + 18, 9, 9); c.fill(); c.fillStyle = '#e67e22'; ell(c, px + 124, py + 16, 6, 6); c.fill(); break;
      case 'heladera':
        c.fillStyle = '#f2f5f7'; rr(c, px + 4, py + 2, W - 8, H - 6, 6); c.fill();
        c.strokeStyle = '#b8c4ca'; c.lineWidth = 2; c.beginPath(); c.moveTo(px + W / 2, py + 4); c.lineTo(px + W / 2, py + H - 6); c.stroke();
        c.fillStyle = '#e74c3c'; c.fillRect(px + 14, py + 10, 8, 8); c.fillStyle = '#3498db'; c.fillRect(px + 52, py + 12, 10, 6); break;
      case 'mesa':
        c.fillStyle = '#7a4f2e'; for (const ox of [20, 60, 100]) { rr(c, px + ox - 8, py - 6, 16, 10, 3); c.fill(); rr(c, px + ox - 8, py + H - 4, 16, 10, 3); c.fill(); }
        c.fillStyle = '#b07a48'; rr(c, px + 3, py + 3, W - 6, H - 6, 8); c.fill();
        c.fillStyle = '#fff'; for (const ox of [20, 60, 100]) { ell(c, px + ox, py + 20, 9, 9); c.fill(); }
        c.fillStyle = '#e74c3c'; ell(c, px + 60, py + 20, 4, 4); c.fill(); break;
      case 'cesto':
        c.fillStyle = '#c8a165'; ell(c, px + 20, py + 21, 17, 14); c.fill();
        c.strokeStyle = '#8b6a3a'; c.lineWidth = 1.5; for (let i = -12; i <= 12; i += 6) { c.beginPath(); c.moveTo(px + 20 + i, py + 10); c.lineTo(px + 20 + i, py + 32); c.stroke(); }
        c.lineWidth = 3; ell(c, px + 20, py + 21, 17, 14); c.stroke();
        c.beginPath(); c.arc(px + 20, py + 18, 13, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); break;
      case 'tele':
        c.fillStyle = '#6a4428'; rr(c, px + 2, py + 6, W - 4, H - 10, 4); c.fill();
        c.fillStyle = '#1a1a1a'; rr(c, px + 12, py + 1, W - 24, 12, 3); c.fill();
        c.fillStyle = '#3d5a80'; c.fillRect(px + 14, py + 3, W - 28, 7); break;
      case 'biblio':
        c.fillStyle = '#6a4428'; rr(c, px + 2, py + 2, W - 4, H - 6, 3); c.fill();
        ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#16a085', '#d35400'].forEach((col, i) => { c.fillStyle = col; c.fillRect(px + 6 + i * 10, py + 6, 7, 22); }); break;
      case 'mesita':
        c.fillStyle = '#7a4f2e'; rr(c, px + 4, py + 4, W - 8, H - 10, 4); c.fill();
        c.fillStyle = '#b22222'; rr(c, px + 10, py + 10, 20, 14, 4); c.fill();
        c.fillStyle = '#7d1515'; rr(c, px + 8, py + 8, 24, 6, 3); c.fill(); break;
      case 'ratona':
        c.fillStyle = '#9b6a40'; rr(c, px + 4, py + 6, W - 8, H - 12, 6); c.fill();
        c.fillStyle = '#d4a017'; ell(c, px + 26, py + 20, 6, 6); c.fill();
        c.fillStyle = '#fff'; rr(c, px + 44, py + 13, 18, 13, 2); c.fill(); break;
      case 'butaca':
        c.fillStyle = '#5d6d7e'; rr(c, px + 2, py + 2, W - 4, H - 4, 10); c.fill();
        c.fillStyle = '#85929e'; rr(c, px + 9, py + 10, W - 18, H - 14, 6); c.fill(); break;
      case 'planta':
        c.fillStyle = '#b5552c'; ell(c, px + 20, py + 22, 11, 11); c.fill();
        ['#2f7d36', '#3f9a45', '#4caf50'].forEach((col, i) => { for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + i * 0.5; c.fillStyle = col; ell(c, px + 20 + Math.cos(a) * 9, py + 18 + Math.sin(a) * 9, 9, 4, a); c.fill(); } }); break;
      case 'caja':
        c.fillStyle = '#e67e22'; rr(c, px + 3, py + 3, W - 6, H - 8, 5); c.fill();
        c.fillStyle = '#d35400'; c.fillRect(px + 3, py + 3, W - 6, 5);
        c.fillStyle = '#fff'; c.font = '800 11px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('JUGUETES', px + W / 2, py + H / 2); break;
      case 'estante':
        c.fillStyle = '#8b5a2b'; rr(c, px + 2, py + 4, W - 4, H - 10, 3); c.fill();
        for (let i = 0; i < 5; i++) { const ox = px + 14 + i * 23; c.fillStyle = '#c0663a'; ell(c, ox, py + 20, 8, 7); c.fill(); c.fillStyle = ['#3f9a45', '#e84393', '#2f7d36', '#f39c12', '#3f9a45'][i]; ell(c, ox, py + 16, 7, 6); c.fill(); } break;
      case 'reposera':
        c.fillStyle = '#d6d6d6'; rr(c, px + 4, py + 2, W - 8, H - 4, 6); c.fill();
        c.fillStyle = '#2e86c1'; for (let i = 0; i < 6; i++) c.fillRect(px + 6, py + 6 + i * 12, W - 12, 6);
        c.fillStyle = '#d4a017'; rr(c, px + W + 2, py + 6, 8, 14, 3); c.fill(); break; // la cerveza
      case 'canilla':
        c.fillStyle = '#7f8c8d'; rr(c, px + 12, py + 2, 16, 26, 4); c.fill();
        c.fillStyle = '#c0392b'; ell(c, px + 20, py + 8, 6, 6); c.fill();
        c.fillStyle = '#3498db'; ell(c, px + 20, py + 33, 9, 5); c.fill(); break;
    }
    c.restore();
  }

  function drawSillon(c, alpha) {
    const [x, y, w, h] = SILLON.r, px = x * T, py = y * T, W = w * T, H = h * T;
    c.save(); c.globalAlpha = alpha;
    c.fillStyle = 'rgba(0,0,0,.2)'; rr(c, px + 4, py, W, H + 10, 10); c.fill();
    c.fillStyle = '#8e3b2f'; rr(c, px, py - 6, W, H + 10, 10); c.fill();
    c.fillStyle = '#a84a3b'; for (let i = 0; i < 3; i++) { rr(c, px + 8 + i * ((W - 16) / 3), py + 4, (W - 16) / 3 - 4, H - 8, 6); c.fill(); }
    c.fillStyle = '#7a3026'; rr(c, px, py - 6, W, 10, 6); c.fill();
    c.fillStyle = '#f1c40f'; rr(c, px + 12, py + 6, 16, 14, 4); c.fill();
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
    c.fillStyle = 'rgba(0,0,0,.22)'; ell(c, 2, 6 * s, 17 * s, 11 * s); c.fill();
    c.rotate(p.dir || 0);
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.5;
    c.fillStyle = o.shirt; ell(c, 0, 0, 9 * s, 16 * s); c.fill(); c.stroke();
    c.fillStyle = o.skin; ell(c, 5 * s, -14 * s, 3.6 * s, 3.6 * s); c.fill(); ell(c, 5 * s, 14 * s, 3.6 * s, 3.6 * s); c.fill();
    c.fillStyle = o.hair; ell(c, -1.5 * s, 0, (o.longHair ? 11 : 9.5) * s, (o.longHair ? 11 : 9.5) * s); c.fill(); c.stroke();
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

  function drawBasil(c, b, t, held, fresh) {
    c.save(); c.translate(b.x, b.y);
    if (held) {
      c.fillStyle = '#7a5636'; c.fillRect(-1, 2, 2, 8);
      for (let i = 0; i < 6; i++) { const a = i * 1.05; c.fillStyle = i % 2 ? '#3fae49' : '#2e8b37'; ell(c, Math.cos(a) * 5, Math.sin(a) * 4 - 2, 6, 3.5, a); c.fill(); }
      if (fresh !== undefined) { c.strokeStyle = fresh < 10 ? '#e74c3c' : '#4cd964'; c.lineWidth = 3; c.beginPath(); c.arc(0, -1, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fresh / 30); c.stroke(); }
    } else if (b.ready) {
      const sway = Math.sin(t * 2 + b.x) * 0.08;
      for (let i = 0; i < 9; i++) { const a = i * 0.7 + sway; const r = 4 + (i % 3) * 4; c.fillStyle = ['#2e8b37', '#3fae49', '#57c05f'][i % 3]; ell(c, Math.cos(a) * r, Math.sin(a) * r - 1, 7, 4, a); c.fill(); }
    } else {
      c.fillStyle = '#57c05f'; ell(c, -3, 0, 4, 2.5, -0.5); c.fill(); ell(c, 3, 0, 4, 2.5, 0.5); c.fill();
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
    const active = G.chargerActive, atPad = G.cargador.state === 'atPad';
    c.save(); c.translate(PAD.x, PAD.y);
    c.fillStyle = active ? '#3d4a52' : '#6b6b6b'; rr(c, -18, -18, 36, 36, 8); c.fill();
    c.strokeStyle = active ? '#4fb3d9' : '#999'; c.lineWidth = 2; c.stroke();
    c.fillStyle = active ? (mister.charging ? `rgba(79,179,217,${0.6 + Math.sin(t * 8) * 0.4})` : '#f1c40f') : '#999';
    c.beginPath(); c.moveTo(3, -12); c.lineTo(-7, 2); c.lineTo(0, 2); c.lineTo(-3, 12); c.lineTo(7, -2); c.lineTo(0, -2); c.closePath(); c.fill();
    c.fillStyle = '#efe3d0'; c.fillRect(-30, -8, 10, 16); c.fillStyle = '#555'; c.fillRect(-27, -4, 2, 3); c.fillRect(-27, 2, 2, 3); // enchufe
    if (active) { c.strokeStyle = '#222'; c.lineWidth = 3; c.beginPath(); c.moveTo(-20, 0); c.quadraticCurveTo(-24, 14, -14, 14); c.stroke(); }
    else if (atPad) {
      // cables sueltos de colores
      WIRE_COLORS.forEach((col, i) => { c.strokeStyle = col; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-20, -3 + i * 2); c.quadraticCurveTo(-30 + Math.sin(t * 3 + i) * 3, 18 + i * 3, -12 + i * 6, 24 + Math.cos(t * 2 + i) * 2); c.stroke(); });
      if (Math.floor(t * 3) % 2) { c.fillStyle = '#fff6a0'; ell(c, -14, 22, 3, 3); c.fill(); }
    } else { c.fillStyle = '#fff'; c.font = '900 12px system-ui'; c.textAlign = 'center'; c.fillText('?', 12, -22); }
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

  function drawSwitch(c, s) {
    c.save(); c.translate(s.x, s.y);
    if (s.on) { const g = c.createRadialGradient(0, 0, 2, 0, 0, 26); g.addColorStop(0, 'rgba(255,230,120,.9)'); g.addColorStop(1, 'rgba(255,230,120,0)'); c.fillStyle = g; ell(c, 0, 0, 26, 26); c.fill(); }
    c.fillStyle = '#fffaf0'; rr(c, -7, -9, 14, 18, 3); c.fill(); c.strokeStyle = '#9b8a76'; c.lineWidth = 1; c.stroke();
    c.fillStyle = s.on ? '#f1c40f' : '#999'; rr(c, -3, s.on ? -6 : 0, 6, 6, 2); c.fill();
    c.restore();
  }

  function drawLockedDoor(c, d, t) {
    const px = d.x * T, py = d.y * T;
    c.fillStyle = '#7a4a26'; c.fillRect(px + 2, py + 8, T - 4, 24);
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
    const bx = clamp(x - w / 2, 4, WORLD_W - w - 4); const by = Math.max(4, y - h - 14);
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
    const viewW = vw / zoom, viewH = vh / zoom, ext = M * T * 0.8;
    const tx = WORLD_W * zoom <= aw ? -(leftPad / zoom) - (aw / zoom - WORLD_W) / 2
      : clamp(mister.x - (leftPad + aw / 2) / zoom, -leftPad / zoom - ext, WORLD_W - viewW + ext);
    const ty = WORLD_H * zoom <= ah ? -(topPad / zoom) - (ah / zoom - WORLD_H) / 2
      : clamp(mister.y - (topPad + ah / 2) / zoom, -topPad / zoom - ext, WORLD_H - (vh - bottomPad) / zoom + ext);
    camX += (tx - camX) * 0.15; camY += (ty - camY) * 0.15;
    if (Math.abs(tx - camX) > 400 || Math.abs(ty - camY) > 400) { camX = tx; camY = ty; }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#7fb257'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!G) return;
    const s = dpr * zoom;
    ctx.setTransform(s, 0, 0, s, -camX * s, -camY * s);
    if (staticDirty) { renderStatic(); staticDirty = false; }
    ctx.drawImage(mapCanvas, -M * T, -M * T);

    // luces prendidas
    for (const sw of G.switches) if (sw.on) {
      const [x1, y1, x2, y2] = ROOMS[sw.room].r;
      ctx.fillStyle = 'rgba(255,214,90,.2)'; ctx.fillRect(x1 * T, y1 * T, (x2 - x1 + 1) * T, (y2 - y1 + 1) * T);
      const cx = (x1 + x2 + 1) / 2 * T, cy = (y1 + y2 + 1) / 2 * T;
      const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 90); g.addColorStop(0, 'rgba(255,240,160,.55)'); g.addColorStop(1, 'rgba(255,240,160,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - 90, cy - 90, 180, 180);
      ctx.font = '20px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('💡', cx, cy);
    }
    for (const sw of G.switches) drawSwitch(ctx, sw);
    for (const k in DOORS) if (DOORS[k].locked) drawLockedDoor(ctx, DOORS[k], t);
    drawPad(ctx, t);
    for (const p of G.plants) drawPlant(ctx, p, t);
    for (const b of G.basil) drawBasil(ctx, b, t);
    for (const toy of G.toys) if (toy.state === 'floor') drawToy(ctx, toy);
    if (G.cargador.state === 'floor') {
      drawCargador(ctx, G.cargador.x, G.cargador.y, t, 1);
    }
    if (G.d.basil) {
      ctx.save(); ctx.font = '800 11px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#5c3d1e';
      ctx.fillText(`🌿 ${Math.min(G.stats.basil, G.d.basil)}/${G.d.basil}`, CESTO.x - 4, CESTO.y + 32); ctx.restore();
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
      const c = mister.carry;
      if (c.type === 'toy') drawToy(ctx, { ...c.ref, x: mister.x, y: mister.y - 22 }, true);
      else if (c.type === 'basil') drawBasil(ctx, { x: mister.x, y: mister.y - 24 }, t, true, c.fresh);
      else drawCargador(ctx, mister.x, mister.y - 22, t, 1);
    }
    if (mister.water > 0 && mister.moving) {
      ctx.fillStyle = 'rgba(80,170,255,.8)';
      ell(ctx, mister.x - Math.cos(mister.dir) * 18, mister.y - Math.sin(mister.dir) * 18 + ((t * 60) % 10), 2, 3); ctx.fill();
    }
    drawSillon(ctx, mister.hidden ? 0.7 : 1);

    // zona de peligro alrededor de Luca
    if (luca.state !== 'dormido' && !G.event) {
      const hunting = luca.state === 'cazando';
      ctx.save(); ctx.strokeStyle = hunting ? 'rgba(231,76,60,.8)' : 'rgba(231,76,60,.35)'; ctx.lineWidth = hunting ? 3 : 2;
      ctx.setLineDash([6, 6]); ctx.lineDashOffset = -t * 20;
      const r = 40 + (hunting ? Math.sin(t * 10) * 3 : 0);
      ell(ctx, luca.x, luca.y, r, r); ctx.stroke(); ctx.restore();
    }
    if (luca.alert) {
      ctx.save(); ctx.font = '900 22px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = luca.seen ? '#f39c12' : '#e74c3c';
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
      const label = luca.state === 'dormido' ? 'Zzz' : '!';
      const yy = luca.y - 26 + Math.sin(t * 5) * 3;
      ctx.strokeText(label, luca.x, yy); ctx.fillText(label, luca.x, yy); ctx.restore();
    }

    for (const e of [luca, enzo, nuria, mister]) if (e && e.bubble) drawBubble(ctx, e.x, e.y - 22, e.bubble.text, { dark: e === mister });
    if (mode === 'play' && G.hint && !mister.bubble) {
      const k = isTouch ? 'A' : 'Espacio';
      drawLabel(ctx, mister.x, mister.y + 24, G.hint.disabled ? G.hint.label : `${k}: ${G.hint.label}`, G.hint.disabled);
    }
    if (mode === 'mini') renderMini(t);
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (mode === 'play' && G) update(dt);
    else if (mode === 'mini' && mini) miniUpdate(dt);
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
    if (mini) closeMini(true);
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
        <li>Cada día tiene <b>tareas</b>: regar, cosechar albahaca para la cocina, ordenar juguetes, apagar luces, cuidar a Luca... Cuando termines, <b>volvé al cargador</b> del living.</li>
        <li>Cuidá la <b>batería</b>. Para cargar tenés que <b>unir los cables</b> del cargador por color.</li>
        <li><b>Regar:</b> mantené apretado y soltá cuando el agua esté en la zona verde. La regadera pierde agua si te movés mucho.</li>
        <li><b>Albahaca:</b> cortala y llevala al cesto de la cocina antes de que se marchite.</li>
        <li><b>El pacto con Enzo:</b> quedarse quieto es "no" y ronronear es "sí". Si Luca se duerme o no hace la tarea, andá a verlo y después ronroneale a Enzo.</li>
        <li><b>Luca te odia:</b> si entrás en su círculo rojo te agarra y te encierra en el baño. Para salir, forzá la cerradura frenando la ganzúa en la zona verde. Debajo del <b>sillón</b> no te encuentra.</li>
      </ul>`, [{ label: 'Volver', fn: showMenu }]);
  }

  function pause() {
    if (mode !== 'play') return;
    mode = 'paused';
    showCard(`<p class="kicker">Día ${G.n} · ${G.d.titulo}</p><h2>Pausa</h2><ul>${G.tasks.filter((t) => !t.final).map((t) => `<li>${t.done ? '✔ ' : ''}${t.text()}</li>`).join('')}</ul>`, [
      { label: 'Seguir', fn: () => { hideCard(); mode = 'play'; } },
      { label: 'Reiniciar día', cls: 'ghost', fn: () => startDay(G.n) },
      { label: 'Menú', cls: 'ghost', fn: showMenu },
    ]);
  }

  // ================= Entrada =================
  const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' };
  const ACTION_KEYS = ['Space', 'KeyE', 'Enter'];
  window.addEventListener('keydown', (e) => {
    if (mode === 'mini') {
      if (ACTION_KEYS.includes(e.code)) { e.preventDefault(); if (!e.repeat) { audio(); miniPress(); } }
      if (e.code === 'Escape') closeMini();
      return;
    }
    if (KEYMAP[e.code]) { keys.add(KEYMAP[e.code]); if (mode === 'play') e.preventDefault(); }
    if (ACTION_KEYS.includes(e.code) && mode === 'play') { e.preventDefault(); if (!e.repeat) { audio(); action(); } }
    if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) { if (mode === 'play') pause(); }
  });
  window.addEventListener('keyup', (e) => {
    if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]);
    if (mode === 'mini' && ACTION_KEYS.includes(e.code)) miniRelease();
  });
  window.addEventListener('blur', () => { keys.clear(); stick.x = stick.y = 0; if (mode === 'mini') miniRelease(); if (mode === 'play') pause(); });

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
  muteBtn.addEventListener('click', () => { muted = !muted; store.set('mister.muted', muted); syncMute(); setMusicVolume(); });
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
  window.__mister = { get G() { return G; }, mister, luca, enzo, get mode() { return mode; }, get mini() { return mini; }, startDay, action, DOORS, miniPress, miniRelease, navBlocked, findPath };

  showMenu();
  requestAnimationFrame(loop);
})();
