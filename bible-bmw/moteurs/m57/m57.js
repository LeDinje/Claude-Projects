// Fiche M57 : 6 cylindres en ligne diesel, simulation 3D, coupe du cylindre et pièces
(() => {
'use strict';
const $ = s => document.querySelector(s);
const DEG = Math.PI / 180;
const css = getComputedStyle(document.documentElement);
const C = k => css.getPropertyValue(k).trim();
const COL = { amber:C('--amber'), air:C('--air'), comp:C('--comp'), exh:C('--exh'), red:C('--red'), ok:C('--ok'), fuel:C('--fuel'),
  fg:C('--fg'), muted:C('--muted'), dim:C('--dim'), line:C('--line'), line2:C('--line-2'), bg2:C('--bg-2') };
const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const clamp = THREE.MathUtils.clamp;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rv = a => (Math.random() * 2 - 1) * a;

// ------------------------------------------------------------------
// Données moteur (1 unité 3D = 100 mm)
// ------------------------------------------------------------------
const SPEC = { bore: 84, stroke: 90, rod: 135, ptc: 42, pitch: 91, redline: 4800, cr: 17 };
const MM = 0.01;
const R = SPEC.stroke / 2 * MM, L = SPEC.rod * MM, PTC = SPEC.ptc * MM;
const DECK = R + L + PTC + 0.012;          // 1,2 mm entre le piston au PMH et la culasse
const BORE_R = SPEC.bore / 2 * MM;
const PITCH = SPEC.pitch * MM;
const FIRE_ORDER = [1, 5, 3, 6, 2, 4];
const FIRE = {}; FIRE_ORDER.forEach((c, i) => FIRE[c] = i * 120);
// cylindres verticaux : le maneton du cylindre c est en haut quand θ = FIRE[c] (mod 360)
const THROW = [1, 2, 3, 4, 5, 6].map(c => -(FIRE[c] % 360) * DEG);
// Distribution (degrés du cycle, 0 = PMH combustion)
const IN_OPEN = 350, IN_CLOSE = 570, EX_OPEN = 140, EX_CLOSE = 370;

// Versions : courbes de couple à pleine charge (valeurs maximales publiées, forme estimée)
const VERS = {
  d30: { code: 'M57D30', short: '1re génération', txt: '330d E46, 530d E39', cc: 2926, bs: '84 × 88', boost: 1.1, rail: 1350,
    tq: [[750,160],[1000,220],[1250,300],[1500,360],[1750,390],[3000,390],[3500,360],[4000,323],[4400,280],[4800,220]],
    hint: "Première génération (1998) : 184 ch et 390 N·m sur la 330d E46. Rampe commune Bosch de première génération, environ 1 350 bar, injecteurs à électrovanne." },
  tu: { code: 'M57D30TÜ', short: 'TÜ', txt: '530d E60', cc: 2993, bs: '84 × 90', boost: 1.35, rail: 1600,
    tq: [[750,180],[1000,250],[1250,340],[1500,430],[2000,500],[2750,500],[3250,455],[4000,383],[4400,330],[4800,260]],
    hint: "Seconde génération (2002) : course portée à 90 mm, 2 993 cm³. Jusqu'à 218 ch et 500 N·m sur la 530d E60, rampe d'environ 1 600 bar." },
  tu2: { code: 'M57D30TÜ2', short: 'TÜ2', txt: '330d E90', cc: 2993, bs: '84 × 90', boost: 1.5, rail: 1600,
    tq: [[750,200],[1000,280],[1250,380],[1500,460],[1750,500],[3000,500],[3500,455],[4000,405],[4400,360],[4800,280]],
    hint: "Troisième génération (2005) : injecteurs piézo Bosch, turbo Garrett GTB2260VK à géométrie variable. 231 ch et 500 N·m sur la 330d E90." },
  top: { code: 'M57D30 biturbo', short: 'Biturbo', txt: '335d, 535d', cc: 2993, bs: '84 × 90', boost: 1.9, rail: 1600,
    tq: [[750,230],[1000,330],[1250,450],[1500,540],[1750,580],[2250,580],[3000,545],[3500,510],[4000,475],[4400,457],[4800,380]],
    hint: "Version biturbo : un petit turbo pour les bas régimes et un gros turbo en série, qui prend le relais. 286 ch et 580 N·m. La simulation montre un seul turbo." },
};
const st = {
  rpm: 800, pedal: 0, load: 0, cold: false, ver: VERS.tu2,
  playback: 1/50, paused: false, theta: 0, torque: 0, power: 0, pmax: 0,
  boost: 0, boostTgt: 0, fuelOn: true, cut: false, turboRpm: 0,
};
function fullTorque(rpm){
  const T = st.ver.tq;
  if (rpm <= T[0][0]) return T[0][1];
  for (let i = 1; i < T.length; i++) if (rpm <= T[i][0]){
    const [x0, y0] = T[i - 1], [x1, y1] = T[i]; return y0 + (y1 - y0) * (rpm - x0) / (x1 - x0);
  }
  return T[T.length - 1][1];
}
const spool = rpm => Math.pow(clamp((rpm - 850) / 1050, 0, 1), 0.8) * (rpm > 3800 ? 1 - 0.15 * (rpm - 3800) / 1000 : 1);
const friction = rpm => 22 + 0.008 * rpm;     // N·m perdus en frottements et pompage
const pistonS = g => { const s = Math.sin(g); return R * Math.cos(g) + Math.sqrt(L * L - R * R * s * s); };
const cycleOf = (theta, c) => (((theta - FIRE[c]) % 720) + 720) % 720;
const inWin = (a, s, e) => { const dur = ((e - s) % 720 + 720) % 720; return ((((a - s) % 720) + 720) % 720) < dur; };
function lift(a, open, close){
  const dur = ((close - open) % 720 + 720) % 720;
  const x = ((a - open) % 720 + 720) % 720;
  return x > dur ? 0 : Math.pow(Math.sin(Math.PI * x / dur), 1.4);
}

// ------------------------------------------------------------------
// Rendu
// ------------------------------------------------------------------
const viewport = $('#viewport');
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
const VIEWS = { iso: [8.4, 5.6, 9.6], front: [0, 1.6, 13], side: [14, 1.6, 0.01], top: [0.01, 15, 0.6] };
camera.position.set(...VIEWS.iso);
const controls = new THREE.OrbitControls(camera, canvas);
controls.target.set(0, 1.2, 0);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 3; controls.maxDistance = 32;

function makeEnvTexture(rend){
  const pmrem = new THREE.PMREMGenerator(rend);
  const env = new THREE.Scene();
  const g = new THREE.SphereGeometry(20, 32, 16);
  const cols = [], p = g.attributes.position;
  for (let i = 0; i < p.count; i++){
    const t = (p.getY(i) / 20 + 1) / 2;
    const c = new THREE.Color(0.03, 0.035, 0.045).lerp(new THREE.Color(0.42, 0.46, 0.52), Math.pow(t, 1.6));
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  env.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const soft = (w, h, pos, col) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m);
  };
  soft(14, 5, [0, 15, 4], new THREE.Color(3.2, 3.2, 3.3));
  soft(6, 10, [-15, 4, 6], new THREE.Color(1.4, 1.5, 1.8));
  soft(6, 10, [15, 3, -4], new THREE.Color(2.0, 1.7, 1.3));
  return pmrem.fromScene(env, 0.04).texture;
}
scene.environment = makeEnvTexture(renderer);
scene.add(new THREE.HemisphereLight(0xbfd4ee, 0x1a1410, 0.35));
const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(5, 9, 6); scene.add(key);
const rim = new THREE.DirectionalLight(0x9cc4ff, 0.6); rim.position.set(-6, 3, -7); scene.add(rim);
const fireLight = new THREE.PointLight(0xff8a2a, 0, 3.2, 2); scene.add(fireLight);

const M = {
  steel:  new THREE.MeshStandardMaterial({ color: 0xb9c1ca, metalness: 0.95, roughness: 0.26 }),
  forged: new THREE.MeshStandardMaterial({ color: 0x8f99a5, metalness: 0.92, roughness: 0.36 }),
  bolt:   new THREE.MeshStandardMaterial({ color: 0x3c4148, metalness: 0.9, roughness: 0.4 }),
  alu:    new THREE.MeshStandardMaterial({ color: 0xdadee3, metalness: 0.78, roughness: 0.3 }),
  crown:  new THREE.MeshStandardMaterial({ color: 0x5b524a, metalness: 0.5, roughness: 0.55 }),
  ringM:  new THREE.MeshStandardMaterial({ color: 0x2a2d31, metalness: 0.8, roughness: 0.4 }),
  cam:    new THREE.MeshStandardMaterial({ color: 0xa8b0ba, metalness: 0.95, roughness: 0.22 }),
  valve:  new THREE.MeshStandardMaterial({ color: 0xc9ced5, metalness: 0.9, roughness: 0.3 }),
  block:  new THREE.MeshStandardMaterial({ color: 0x9aa7b5, metalness: 0.35, roughness: 0.45, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }),
  head:   new THREE.MeshStandardMaterial({ color: 0x8e99a6, metalness: 0.5, roughness: 0.4, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
  cover:  new THREE.MeshStandardMaterial({ color: 0x2b2f35, metalness: 0.3, roughness: 0.55, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }),
  edge:   new THREE.LineBasicMaterial({ color: 0x8aa0b8, transparent: true, opacity: 0.45 }),
  liner:  new THREE.MeshStandardMaterial({ color: 0xa6c8ea, metalness: 0.2, roughness: 0.1, transparent: true, opacity: 0.09, depthWrite: false, side: THREE.DoubleSide }),
  header: new THREE.MeshStandardMaterial({ color: 0x9b8774, metalness: 0.85, roughness: 0.33, emissive: 0xff4d12, emissiveIntensity: 0 }),
  turbo:  new THREE.MeshStandardMaterial({ color: 0x8e8378, metalness: 0.8, roughness: 0.4 }),
  comp:   new THREE.MeshStandardMaterial({ color: 0xc8ccd1, metalness: 0.8, roughness: 0.3 }),
  runner: new THREE.MeshStandardMaterial({ color: 0x2c3137, metalness: 0.3, roughness: 0.45 }),
  plenum: new THREE.MeshStandardMaterial({ color: 0x2f343a, metalness: 0.2, roughness: 0.6, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
  pipe:   new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 0.4, roughness: 0.5 }),
  ic:     new THREE.MeshStandardMaterial({ color: 0x6b737c, metalness: 0.7, roughness: 0.45, transparent: true, opacity: 0.55, depthWrite: false }),
  egr:    new THREE.MeshStandardMaterial({ color: 0x7c8590, metalness: 0.8, roughness: 0.35 }),
  flap:   new THREE.MeshStandardMaterial({ color: 0xb8bec6, metalness: 0.8, roughness: 0.35 }),
  injector: new THREE.MeshStandardMaterial({ color: 0x1f2328, metalness: 0.4, roughness: 0.5 }),
  rail:   new THREE.MeshStandardMaterial({ color: 0x9aa1aa, metalness: 0.9, roughness: 0.28 }),
  pump:   new THREE.MeshStandardMaterial({ color: 0x6d747d, metalness: 0.8, roughness: 0.4 }),
  glow:   new THREE.MeshStandardMaterial({ color: 0xb0b6bd, metalness: 0.9, roughness: 0.3 }),
  glowTip: new THREE.MeshStandardMaterial({ color: 0x2a2420, metalness: 0.3, roughness: 0.6, emissive: 0xff4a0a, emissiveIntensity: 0 }),
};

const engine = new THREE.Group(); scene.add(engine);
const layers = {};
const layer = name => { if (!layers[name]) { layers[name] = new THREE.Group(); engine.add(layers[name]); } return layers[name]; };
['block','heads','valvetrain','manifolds','turbo','rail','liners','gas','flow','pistons','rods','crank'].forEach(layer);
const zAxis = g => { g.rotateX(Math.PI / 2); return g; };
function withEdges(mesh, mat = M.edge){ mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 25), mat)); return mesh; }
function tubeBetween(a, b, r, mat, open = true){
  const d = new THREE.Vector3().subVectors(b, a); const len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 20, 1, open), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}
const curveTube = (pts, r, mat, seg = 60) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 16), mat);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------- Cylindres ----------------
const cyls = [1, 2, 3, 4, 5, 6].map(n => ({ n, j: n - 1, z: (2.5 - (n - 1)) * PITCH }));
const ENG_LEN = 6 * PITCH + 0.4;

// ---------------- Vilebrequin : 7 paliers, 6 manetons à 120° ----------------
const crank = new THREE.Group(); layer('crank').add(crank);
const PIN_R = 0.24, CW_R = 0.66;
const webShape = (() => {
  const s = new THREE.Shape();
  s.moveTo(0.32, R);
  s.absarc(0, R, 0.32, 0, Math.PI, false);
  s.lineTo(-CW_R * 0.9 * Math.cos(30 * DEG), -CW_R * 0.9 * Math.sin(30 * DEG));
  s.absarc(0, 0, CW_R, Math.PI + 30 * DEG, 2 * Math.PI - 30 * DEG, false);
  s.lineTo(0.32, R);
  return s;
})();
const webGeo = new THREE.ExtrudeGeometry(webShape, { depth: 0.11, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 24 });
webGeo.translate(0, 0, -0.055);
for (let k = 0; k < 7; k++){
  const m = new THREE.Mesh(zAxis(new THREE.CylinderGeometry(0.29, 0.29, 0.36, 32)), M.steel);
  m.position.z = (3 - k) * PITCH; crank.add(m);
}
cyls.forEach(cy => {
  const a = THROW[cy.j];
  const pin = new THREE.Mesh(zAxis(new THREE.CylinderGeometry(PIN_R, PIN_R, 0.3, 32)), M.steel);
  pin.position.set(R * Math.sin(a), R * Math.cos(a), cy.z); crank.add(pin);
  [-0.21, 0.21].forEach(dz => { const w = new THREE.Mesh(webGeo, M.forged); w.rotation.z = -a; w.position.z = cy.z + dz; crank.add(w); });
});
const nose = new THREE.Mesh(zAxis(new THREE.CylinderGeometry(0.2, 0.2, 0.6, 24)), M.steel); nose.position.z = 3 * PITCH + 0.45; crank.add(nose);
const damper = new THREE.Mesh(zAxis(new THREE.CylinderGeometry(0.7, 0.7, 0.22, 48)), M.bolt); damper.position.z = 3 * PITCH + 0.62; crank.add(damper);
const flywheel = new THREE.Mesh(zAxis(new THREE.CylinderGeometry(1.25, 1.25, 0.14, 64)), M.forged); flywheel.position.z = -3 * PITCH - 0.42; crank.add(flywheel);
const ringGear = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.05, 8, 96), M.steel); ringGear.position.z = flywheel.position.z; crank.add(ringGear);
for (let i = 0; i < 6; i++){
  const a = i * Math.PI / 3;
  const h = new THREE.Mesh(zAxis(new THREE.CylinderGeometry(0.15, 0.15, 0.16, 20)), M.bolt);
  h.position.set(Math.sin(a) * 0.8, Math.cos(a) * 0.8, flywheel.position.z); crank.add(h);
}
const mark = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.05), new THREE.MeshBasicMaterial({ color: 0xf5a524 }));
mark.position.set(0, 0.52, damper.position.z + 0.12); crank.add(mark);

// ---------------- Bielles ----------------
const rodShape = (() => {
  const s = new THREE.Shape();
  s.moveTo(-0.15, 0.28); s.lineTo(0.15, 0.28); s.lineTo(0.09, L - 0.15); s.lineTo(-0.09, L - 0.15); s.lineTo(-0.15, 0.28);
  return s;
})();
const shankGeo = new THREE.ExtrudeGeometry(rodShape, { depth: 0.11, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1 });
shankGeo.translate(0, 0, -0.055);
const bigUpGeo = zAxis(new THREE.CylinderGeometry(0.36, 0.36, 0.2, 32, 1, false, Math.PI / 2, Math.PI));
const capGeo = zAxis(new THREE.CylinderGeometry(0.36, 0.36, 0.2, 32, 1, false, -Math.PI / 2, Math.PI));
const smallGeo = zAxis(new THREE.CylinderGeometry(0.18, 0.18, 0.16, 24));
const boltGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.46, 10);
cyls.forEach(cy => {
  const rod = new THREE.Group();
  rod.add(new THREE.Mesh(bigUpGeo, M.forged)); rod.add(new THREE.Mesh(shankGeo, M.forged));
  const sm = new THREE.Mesh(smallGeo, M.forged); sm.position.y = L; rod.add(sm);
  rod.add(new THREE.Mesh(capGeo, M.forged));
  [-0.27, 0.27].forEach(x => { const b = new THREE.Mesh(boltGeo, M.bolt); b.position.set(x, 0.02, 0); rod.add(b); });
  rod.position.z = cy.z; layer('rods').add(rod); cy.rod = rod;
});

// ---------------- Pistons, chemises, gaz, soupapes ----------------
const pistonBody = new THREE.CylinderGeometry(BORE_R - 0.01, BORE_R - 0.01, 0.6, 40); pistonBody.translate(0, PTC - 0.33, 0);
const crownGeo = new THREE.CylinderGeometry(BORE_R - 0.016, BORE_R - 0.01, 0.03, 40); crownGeo.translate(0, PTC - 0.015, 0);
const bowlRim = new THREE.TorusGeometry(0.25, 0.012, 6, 40); bowlRim.rotateX(Math.PI / 2); bowlRim.translate(0, PTC + 0.002, 0);
const ringGeo = new THREE.TorusGeometry(BORE_R - 0.006, 0.009, 6, 48); ringGeo.rotateX(Math.PI / 2);
const wristGeo = zAxis(new THREE.CylinderGeometry(0.13, 0.13, 0.7, 20));
const LINER_BOT = 0.92;
const linerGeo = new THREE.CylinderGeometry(BORE_R + 0.012, BORE_R + 0.012, DECK - LINER_BOT, 40, 1, true); linerGeo.translate(0, (DECK + LINER_BOT) / 2, 0);
const gasGeo = new THREE.CylinderGeometry(BORE_R - 0.02, BORE_R - 0.02, 1, 32); gasGeo.translate(0, 0.5, 0);
const valveStem = new THREE.CylinderGeometry(0.026, 0.026, 0.5, 8); valveStem.translate(0, 0.27, 0);
const valveHead = new THREE.CylinderGeometry(0.11, 0.05, 0.035, 20); valveHead.translate(0, 0.017, 0);
const radial = (stops) => { const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); stops.forEach(([o, col]) => r.addColorStop(o, col));
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); };
const glowTex = radial([[0, 'rgba(255,245,210,1)'], [0.25, 'rgba(255,170,60,.85)'], [0.6, 'rgba(255,90,20,.25)'], [1, 'rgba(255,60,0,0)']]);
const dotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();

const VX = 0.19, VZ = 0.19;    // position des soupapes autour de l'axe du cylindre
cyls.forEach(cy => {
  const p = new THREE.Group();
  p.add(new THREE.Mesh(pistonBody, M.alu)); p.add(new THREE.Mesh(crownGeo, M.crown)); p.add(new THREE.Mesh(bowlRim, M.ringM));
  [PTC - 0.08, PTC - 0.125, PTC - 0.17].forEach(y => { const r = new THREE.Mesh(ringGeo, M.ringM); r.position.y = y; p.add(r); });
  p.add(new THREE.Mesh(wristGeo, M.steel));
  p.position.z = cy.z; layers.pistons.add(p); cy.piston = p;
  const ln = new THREE.Mesh(linerGeo, M.liner); ln.position.z = cy.z; layers.liners.add(ln);
  const gm = new THREE.MeshBasicMaterial({ color: 0x5cb4e8, transparent: true, opacity: 0.4, depthWrite: false });
  const gas = new THREE.Mesh(gasGeo, gm); gas.position.z = cy.z; layers.gas.add(gas); cy.gas = gas;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.position.set(0, DECK - 0.08, cy.z); glow.scale.setScalar(0.001); layers.gas.add(glow); cy.glow = glow;
  cy.valves = [];
  [[-VX, 'in'], [VX, 'ex']].forEach(([x, kind]) => [-VZ, VZ].forEach(dz => {
    const v = new THREE.Group(); v.add(new THREE.Mesh(valveStem, M.valve)); v.add(new THREE.Mesh(valveHead, M.valve));
    v.position.set(x, DECK, cy.z + dz); layers.valvetrain.add(v); cy.valves.push({ v, kind });
  }));
  // injecteur central vertical, bougie de préchauffage inclinée côté admission
  const inj = new THREE.Group(); inj.position.set(0, DECK, cy.z);
  inj.add(tubeBetween(V(0, -0.02, 0), V(0, 0.5, 0), 0.04, M.injector, false));
  inj.add(tubeBetween(V(0, 0.5, 0), V(0, 1.12, 0), 0.06, M.injector, false));
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.12), M.injector); cap.position.y = 1.16; inj.add(cap);
  layers.rail.add(inj);
  cy.injTip = V(0, DECK - 0.02, cy.z);
  const gA = V(-0.1, DECK + 0.01, cy.z), gB = V(-0.34, DECK + 0.58, cy.z);
  layers.heads.add(tubeBetween(gA.clone().lerp(gB, 0.2), gB, 0.03, M.glow, false));
  layers.heads.add(tubeBetween(gA, gA.clone().lerp(gB, 0.2), 0.016, M.glowTip, false));
});
const BLOCK_TOP = DECK, BLOCK_BOT = 0.25;
{ // bloc, carter, culasse, couvre-culasse
  const g = new THREE.BoxGeometry(1.25, BLOCK_TOP - BLOCK_BOT, ENG_LEN); g.translate(0, (BLOCK_TOP + BLOCK_BOT) / 2, 0);
  layers.block.add(withEdges(new THREE.Mesh(g, M.block)));
  const cg = new THREE.BoxGeometry(2.05, 1.55, ENG_LEN); cg.translate(0, -0.45 + 0.775 - 0.4, 0);
  layers.block.add(withEdges(new THREE.Mesh(cg, M.block)));
  const pg = new THREE.BoxGeometry(1.7, 0.6, ENG_LEN - 0.3); pg.translate(0, -1.5, 0);
  layers.block.add(withEdges(new THREE.Mesh(pg, M.block)));
  const hg = new THREE.BoxGeometry(1.5, 0.62, ENG_LEN + 0.06); hg.translate(0, DECK + 0.31, 0);
  layers.heads.add(withEdges(new THREE.Mesh(hg, M.head)));
  const cov = new THREE.BoxGeometry(1.3, 0.3, ENG_LEN - 0.1); cov.translate(0, DECK + 0.77, 0);
  layers.heads.add(withEdges(new THREE.Mesh(cov, M.cover)));
}

// Arbres à cames : admission côté gauche (−x), échappement côté droit (+x)
const camShafts = [];
[['in', -VX, IN_OPEN, IN_CLOSE], ['ex', VX, EX_OPEN, EX_CLOSE]].forEach(([kind, x, o, c]) => {
  const shaft = new THREE.Group(); shaft.position.set(x, DECK + 0.62, 0);
  shaft.add(new THREE.Mesh(zAxis(new THREE.CylinderGeometry(0.06, 0.06, ENG_LEN + 0.2, 16)), M.cam));
  const gear = new THREE.Mesh(zAxis(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 32)), M.bolt); gear.position.z = ENG_LEN / 2 + 0.06; shaft.add(gear);
  const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.06), new THREE.MeshBasicMaterial({ color: 0xf5a524 }));
  tooth.position.set(0, 0.18, gear.position.z + 0.01); shaft.add(tooth);
  const peak = (o + (((c - o) % 720 + 720) % 720) / 2) % 720;
  cyls.forEach(cy => [-VZ, VZ].forEach(dz => {
    const piv = new THREE.Group(); piv.position.z = cy.z + dz; piv.rotation.z = (FIRE[cy.n] + peak) / 2 * DEG;
    const lobe = new THREE.Mesh(zAxis(new THREE.CylinderGeometry(0.085, 0.085, 0.07, 20)), M.cam); lobe.position.y = -0.04; piv.add(lobe);
    shaft.add(piv);
  }));
  layers.valvetrain.add(shaft); camShafts.push(shaft);
});

// Admission : répartiteur côté gauche, conduits, volets de turbulence, vanne EGR
const PLEN = V(-1.55, DECK + 0.62, 0);
{ const g = new THREE.BoxGeometry(0.62, 0.55, ENG_LEN - 0.2); g.translate(PLEN.x, PLEN.y, 0); layers.manifolds.add(withEdges(new THREE.Mesh(g, M.plenum))); }
cyls.forEach(cy => {
  const port = V(-0.75, DECK + 0.3, cy.z), mid = V(-1.12, DECK + 0.42, cy.z), pl = V(PLEN.x + 0.05, PLEN.y, cy.z);
  layers.manifolds.add(curveTube([pl, mid, port], 0.12, M.runner, 24));
  const fly = new THREE.Group(); fly.position.copy(mid);
  fly.quaternion.setFromUnitVectors(V(0, 1, 0), port.clone().sub(pl).normalize());
  const flap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 24), M.flap); fly.add(flap);
  layers.manifolds.add(fly); cy.flap = flap;
  cy.inTab = new THREE.CatmullRomCurve3([V(PLEN.x - 0.1, PLEN.y + 0.05, cy.z), pl, mid, port, V(-VX, DECK - 0.05, cy.z)]).getSpacedPoints(80);
});
const egrValve = new THREE.Mesh(zAxis(new THREE.CylinderGeometry(0.14, 0.14, 0.26, 24)), M.egr);
egrValve.position.set(PLEN.x, PLEN.y + 0.4, ENG_LEN / 2 - 0.25); layers.manifolds.add(egrValve);
layers.manifolds.add(curveTube([V(1.3, DECK - 0.05, ENG_LEN / 2 - 0.2), V(1.0, DECK + 0.35, ENG_LEN / 2 + 0.25), V(-0.6, DECK + 1.1, ENG_LEN / 2 + 0.2),
  V(PLEN.x, PLEN.y + 0.45, ENG_LEN / 2 - 0.05)], 0.05, M.egr, 40));

// Échappement côté droit : conduits courts, collecteur, turbo, descente
const TURBO = V(2.05, DECK - 1.0, -0.7);
const TURB_Z = TURBO.z - 0.35, COMP_Z = TURBO.z + 0.35;
const LOG = { x: 1.3, y: DECK - 0.05 };
cyls.forEach(cy => {
  const port = V(0.75, DECK + 0.3, cy.z);
  layers.turbo.add(curveTube([port, V(1.05, DECK + 0.25, cy.z), V(LOG.x, LOG.y, cy.z)], 0.1, M.header, 20));
  const pts = [V(VX, DECK - 0.05, cy.z), port, V(1.05, DECK + 0.25, cy.z), V(LOG.x, LOG.y, cy.z)];
  const dir = Math.sign(TURB_Z - cy.z);
  for (let z = cy.z + dir * 0.4; dir * (TURB_Z - z) > 0.2; z += dir * 0.4) pts.push(V(LOG.x, LOG.y, z));
  pts.push(V(LOG.x, LOG.y, TURB_Z), V(1.65, TURBO.y + 0.55, TURB_Z), V(TURBO.x, TURBO.y, TURB_Z), V(TURBO.x, TURBO.y, TURB_Z - 0.5),
    V(TURBO.x - 0.1, -1.0, TURB_Z - 1.4), V(TURBO.x - 0.2, -1.7, -3.6));
  cy.exTab = new THREE.CatmullRomCurve3(pts).getSpacedPoints(160);
});
layers.turbo.add(tubeBetween(V(LOG.x, LOG.y, ENG_LEN / 2 - 0.15), V(LOG.x, LOG.y, -ENG_LEN / 2 + 0.15), 0.14, M.header, false));
layers.turbo.add(curveTube([V(LOG.x, LOG.y, TURB_Z), V(1.65, TURBO.y + 0.55, TURB_Z), V(TURBO.x - 0.05, TURBO.y + 0.36, TURB_Z)], 0.13, M.header, 24));
const turbine = new THREE.Group(), compWheel = new THREE.Group();
{
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); layers.turbo.add(m); return m; };
  add(new THREE.TorusGeometry(0.3, 0.15, 16, 40), M.turbo, TURBO.x, TURBO.y, TURB_Z);
  add(new THREE.TorusGeometry(0.32, 0.15, 16, 40), M.comp, TURBO.x, TURBO.y, COMP_Z);
  add(zAxis(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 24)), M.pump, TURBO.x, TURBO.y, TURBO.z);
  // ailettes de géométrie variable : petit anneau autour de la turbine
  add(new THREE.TorusGeometry(0.21, 0.025, 8, 40), M.egr, TURBO.x, TURBO.y, TURB_Z - 0.05);
  layers.turbo.add(curveTube([V(TURBO.x, TURBO.y, TURB_Z - 0.15), V(TURBO.x, TURBO.y, TURB_Z - 0.55), V(TURBO.x - 0.1, -1.0, TURB_Z - 1.4), V(TURBO.x - 0.2, -1.7, -3.6)], 0.15, M.header, 40));
  [[turbine, TURB_Z, M.turbo], [compWheel, COMP_Z, M.comp]].forEach(([w, z, mat]) => {
    w.position.set(TURBO.x, TURBO.y, z); layers.turbo.add(w);
    w.add(new THREE.Mesh(zAxis(new THREE.CylinderGeometry(0.04, 0.12, 0.12, 20)), M.steel));
    for (let i = 0; i < 9; i++){ const b = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.14, 0.11), M.steel); const a = i / 9 * Math.PI * 2;
      b.position.set(Math.sin(a) * 0.09, Math.cos(a) * 0.09, 0); b.rotation.z = -a + 0.45; w.add(b); }
  });
  // entrée d'air du compresseur, sortie vers l'échangeur, échangeur en façade, retour au répartiteur
  layers.turbo.add(curveTube([V(TURBO.x, TURBO.y, COMP_Z + 0.15), V(TURBO.x, TURBO.y + 0.1, COMP_Z + 0.8), V(TURBO.x - 0.3, TURBO.y + 0.8, 2.4), V(1.6, DECK + 0.8, 3.6)], 0.15, M.pipe, 40));
}
const IC = V(0, -1.05, ENG_LEN / 2 + 1.05);
const icBox = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 0.16), M.ic); icBox.position.copy(IC); layers.turbo.add(withEdges(icBox));
const CHG = [V(TURBO.x + 0.3, TURBO.y, COMP_Z), V(TURBO.x + 0.45, TURBO.y - 0.5, COMP_Z + 0.8), V(1.7, -1.3, 2.6), V(1.2, IC.y, IC.z - 0.05),
  V(-1.2, IC.y, IC.z - 0.05), V(-1.8, -0.6, 2.6), V(-1.85, DECK - 0.2, 2.6), V(PLEN.x, PLEN.y - 0.1, ENG_LEN / 2 - 0.1)];
layers.turbo.add(curveTube(CHG, 0.13, M.pipe, 120));
const CHG_TAB = new THREE.CatmullRomCurve3(CHG).getSpacedPoints(160);

// Injection : rampe commune côté admission, conduites, pompe haute pression
const RAIL = { x: -0.5, y: DECK + 1.08 };
layers.rail.add(tubeBetween(V(RAIL.x, RAIL.y, cyls[0].z + 0.45), V(RAIL.x, RAIL.y, cyls[5].z - 0.45), 0.075, M.rail, false));
cyls.forEach(cy => layers.rail.add(curveTube([V(RAIL.x, RAIL.y, cy.z), V(-0.25, RAIL.y + 0.05, cy.z), V(-0.06, DECK + 1.0, cy.z)], 0.02, M.rail, 12)));
const PUMP = V(-0.95, 0.75, ENG_LEN / 2 + 0.1);
{ const p = new THREE.Mesh(zAxis(new THREE.CylinderGeometry(0.2, 0.2, 0.38, 24)), M.pump); p.position.copy(PUMP); layers.rail.add(p);
  layers.rail.add(curveTube([V(PUMP.x, PUMP.y + 0.2, PUMP.z), V(-0.9, DECK + 0.4, PUMP.z + 0.05), V(RAIL.x, RAIL.y, cyls[0].z + 0.45)], 0.025, M.rail, 30)); }

// Sol et ombre
const floorY = -2.15;
const grid = new THREE.GridHelper(26, 52, 0x2a3440, 0x1a2029); grid.position.y = floorY; scene.add(grid);
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(7, 10), new THREE.MeshBasicMaterial({ map: radial([[0, 'rgba(0,0,0,.55)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2; shadow.position.y = floorY + 0.005; scene.add(shadow);

// ------------------------------------------------------------------
// Modèle de cycle diesel : suralimentation, injection, auto-inflammation, pression
// ------------------------------------------------------------------
const A_CM2 = Math.PI * 4.2 * 4.2, VD = A_CM2 * 9.0, VC = VD / (SPEC.cr - 1);
const VOL = new Float32Array(720);
for (let a = 0; a < 720; a++) VOL[a] = VC + A_CM2 * (R + L - pistonS(a * DEG)) * 10;
const IVC = IN_CLOSE, EVO = EX_OPEN;
const cyc = { p: new Float32Array(720), T: new Float32Array(720), xb: new Float32Array(720), fuelMg: 0, airMg: 0, lambda: 9, pman: 1,
  soi: 712, eoi: 714, pSoi: 700, pEoi: 701, d0: 718, delayDeg: 5, delayMs: 0.5, injDeg: 2, injMs: 0.3, prail: 300, pilotMg: 0 };
const _pm = new Float32Array(720), _g = new Float32Array(720);
const wiebe = (d, d0, dur, m) => d <= d0 ? 0 : 1 - Math.exp(-6.9 * Math.pow((d - d0) / dur, m + 1));
const nozzleFlow = (prail, pcyl) => 0.75 * 9.3e-8 * Math.sqrt(2 * Math.max(50, prail - pcyl) * 1e5 / 830) * 830 * 1000; // mg/ms
function computeCycle(){
  const rpm = Math.max(st.rpm, 300), rpmN = rpm / 4000;
  const pman = 1.0 + st.boost;
  const Tman = 305 + 22 * st.boost;
  const airMg = pman * 1e5 / (287 * Tman) * VD * 1e-6 * 0.92 * 1e6;
  const fuelOn = st.fuelOn && st.rpm > 1;
  const Tb = Math.max(0, st.torque) + friction(rpm);
  const fuelMg = fuelOn ? Tb * rpm * Math.PI / 30 / 1000 * (st.cold ? 250 : 225) / 3600 / (rpm / 120 * 6) * 1000 : 0;
  const lambda = fuelMg > 0 ? airMg / (14.5 * fuelMg) : 99;
  const load = clamp(fuelMg / 66, 0, 1.2);
  const prail = 250 + (st.ver.rail - 250) * Math.pow(clamp(0.12 + 0.42 * rpm / 4000 + 0.5 * load, 0, 1), 1.2);
  const pilotMg = fuelMg > 0 && rpm < 4200 ? Math.min(1.6, fuelMg * 0.5) : 0;
  const mainMg = fuelMg - pilotMg;
  const degPerMs = rpm * 6 / 1000;
  const q = nozzleFlow(prail, 40 + 40 * load);
  const injMs = mainMg > 0 ? mainMg / q + 0.12 : 0;
  const injDeg = injMs * degPerMs;
  const soiDeg = -(1.5 + 9 * rpmN + 3 * load + (st.cold ? 3 : 0));
  const soi = (720 + soiDeg) % 720, eoi = (soi + injDeg) % 720;
  const pInjDeg = pilotMg > 0 ? (pilotMg / q + 0.1) * degPerMs : 0;
  const pSoi = (soi - 14 - 4 * rpmN - pInjDeg + 720) % 720, pEoi = (pSoi + pInjDeg) % 720;
  const delayMs = (st.cold ? 1.1 : 0.42) + 0.25 * (1 - Math.min(1, st.boost / 1.2)) - (pilotMg > 0 ? 0.08 : 0);
  const delayDeg = delayMs * degPerMs;
  const d0 = soiDeg + delayDeg;                         // début de combustion de l'injection principale
  const pd0 = pilotMg > 0 ? (pSoi - 720) + delayDeg * 1.2 : 0;
  const fp = pilotMg > 0 ? pilotMg / fuelMg : 0;
  const prem = clamp(0.32 - 0.24 * load + (st.cold ? 0.15 : 0) - (pilotMg > 0 ? 0.08 : 0), 0.06, 0.5);
  const diffDur = injDeg + 38 + 10 * rpmN;
  const Vivc = VOL[IVC];
  let motMax = 0;
  for (let a = 0; a < 720; a++){
    const closed = a >= IVC || a <= EVO, d = a < 360 ? a : a - 720;
    let x = 0;
    if (closed && fuelMg > 0){
      const main = prem * wiebe(d, d0, 7, 1.5) + (1 - prem) * wiebe(d, d0 + 1.5, diffDur, 0.9);
      x = fp * (pilotMg > 0 ? wiebe(d, pd0, 9, 1.5) : 0) + (1 - fp) * main;
    }
    cyc.xb[a] = x;
    _pm[a] = closed ? pman * Math.pow(Vivc / VOL[a], 1.36) : 0;
    _g[a] = closed ? x * Math.pow(VC / VOL[a], 1.42) : 0;
    if (_pm[a] > motMax) motMax = _pm[a];
  }
  const target = Math.min(178, motMax + 62 * (fuelMg / 66) * (1 - 0.18 * rpmN) * (st.cold ? 1.12 : 1));
  let K = 0;
  if (fuelMg > 0 && target > motMax + 0.3){
    let lo = 0, hi = 800;
    for (let it = 0; it < 26; it++){
      const mid = (lo + hi) / 2; let m = 0;
      for (let a = IVC; a < 720; a++) m = Math.max(m, _pm[a] + mid * _g[a]);
      for (let a = 0; a <= EVO; a++) m = Math.max(m, _pm[a] + mid * _g[a]);
      if (m > target) hi = mid; else lo = mid;
    }
    K = lo;
  }
  const pexh = 1.03 + 1.05 * st.boost;
  const Tivc = Tman + 30, Tex = 430 + 600 * load;
  for (let a = 0; a < 720; a++){
    let p, T;
    if (a >= IVC || a <= EVO){ p = _pm[a] + K * _g[a]; T = Math.min(2500, Tivc * p * VOL[a] / (pman * Vivc)); }
    else if (a <= 185){ const p0 = cyc.p[EVO], T0 = cyc.T[EVO]; const k = Math.exp(-(a - EVO) / 12); p = pexh + (p0 - pexh) * k; T = Tex + (T0 - Tex) * Math.pow(k, 0.4); }
    else if (a < IN_OPEN){ p = pexh + 0.08 * rpmN * Math.sin(Math.PI * (a - 185) / 165); T = fuelMg > 0 ? Tex - (a - 185) * 0.4 : Tman + 20; }
    else if (a < 385){ const t = (a - IN_OPEN) / 35; p = pexh + (pman - pexh) * t; T = (fuelMg > 0 ? Tex - 60 : Tman + 20) * (1 - t) + Tman * t; }
    else { p = pman - 0.05 * rpmN * rpmN * Math.sin(Math.PI * (a - 385) / 185); T = Tman + 10; }
    cyc.p[a] = p; cyc.T[a] = T;
  }
  let pm = 0; for (let a = 0; a < 720; a++) pm = Math.max(pm, cyc.p[a]);
  st.pmax = pm;
  Object.assign(cyc, { pman, pexh, Tman, airMg, fuelMg, mainMg, pilotMg, lambda, load, prail, injMs, injDeg, soi, eoi, soiDeg, pSoi, pEoi,
    delayMs, delayDeg, d0, d0A: (720 + d0) % 720, diffDur, rpm });
}
const IN_CUM = new Float32Array(720), EX_CUM = new Float32Array(720);
(() => { let si = 0, se = 0, ti = 0, te = 0;
  for (let a = 0; a < 720; a++){ ti += lift(a, IN_OPEN, IN_CLOSE); te += lift(a, EX_OPEN, EX_CLOSE); }
  for (let a = 0; a < 720; a++){ si += lift(a, IN_OPEN, IN_CLOSE); se += lift(a, EX_OPEN, EX_CLOSE); IN_CUM[a] = si / ti; EX_CUM[a] = se / te; }
})();
const fuelNow = () => cyc.fuelMg > 0 && st.rpm > 1;
const mainOn = a => fuelNow() && inWin(a, cyc.soi, cyc.eoi + 0.6);
const pilotOn = a => fuelNow() && cyc.pilotMg > 0 && inWin(a, cyc.pSoi, cyc.pEoi + 0.6);
function phaseOf(a){
  const xb = cyc.xb[Math.floor(a) % 720];
  if (fuelNow() && (a >= IVC || a < EVO) && xb > 0.012 && xb < 0.985 && inWin(a, cyc.d0A, (cyc.d0A + 180) % 720)) return 'burn';
  if (mainOn(a)) return 'main';
  if (pilotOn(a)) return 'pilot';
  if (a < EVO) return 'exp';
  if (a < 185) return 'blow';
  if (a < IN_OPEN) return 'exh';
  if (a < EX_CLOSE) return 'overlap';
  if (a < IVC) return 'intake';
  return 'comp';
}

// ------------------------------------------------------------------
// Pose (cinématique)
// ------------------------------------------------------------------
const gasCol = new THREE.Color();
const cAir = new THREE.Color(COL.air), cComp = new THREE.Color(COL.comp), cFire = new THREE.Color(COL.amber), cExh = new THREE.Color(COL.exh),
  cHot = new THREE.Color(0xfff1c9), cBurnt = new THREE.Color(C('--burnt')), cFuel = new THREE.Color(COL.fuel);
const flapOpen = () => st.rpm > 2200 || st.pedal > 0.7;
function pose(theta){
  crank.rotation.z = -theta * DEG;
  camShafts.forEach(s => s.rotation.z = -theta / 2 * DEG);
  let lit = null;
  const fuel = fuelNow();
  const fa = flapOpen() ? 90 * DEG : 0;   // volet fermé : disque en travers du conduit
  cyls.forEach(cy => {
    const a = cycleOf(theta, cy.n);
    const psi = theta * DEG + THROW[cy.j];
    const s = pistonS(psi);
    cy.piston.position.y = s;
    const cx = R * Math.sin(psi), cyy = R * Math.cos(psi);
    cy.rod.position.set(cx, cyy, cy.z);
    cy.rod.rotation.set(0, 0, -Math.atan2(-cx, s - cyy));
    cy.flap.rotation.x = fa;
    const ai = Math.floor(a) % 720, xb = cyc.xb[ai], T = cyc.T[ai];
    const crown = s + PTC;
    cy.gas.position.y = crown; cy.gas.scale.y = Math.max(0.01, DECK - crown);
    let op = 0.36;
    if (fuel && xb > 0.004 && (a < EVO || a >= IVC)){
      const heat = clamp((T - 700) / 1500, 0, 1);
      gasCol.copy(cBurnt).lerp(cFire, Math.min(1, heat * 1.3)).lerp(cHot, Math.max(0, heat - 0.7) * 2.5); op = 0.3 + 0.3 * heat;
    }
    else if (fuel && (mainOn(a) || pilotOn(a))) gasCol.copy(cComp).lerp(cFuel, 0.6);
    else if (a < EVO) gasCol.copy(fuel ? cBurnt : cAir);
    else if (a < IN_OPEN) gasCol.copy(fuel ? cExh : cAir);
    else if (a < IVC) gasCol.copy(cAir);
    else gasCol.copy(cAir).lerp(cComp, Math.min(1, (a - IVC) / 150));
    cy.gas.material.color.copy(gasCol); cy.gas.material.opacity = op;
    const gI = !fuel ? 0 : clamp((T - 1150) / 1100, 0, 1);
    cy.glow.scale.setScalar(0.001 + gI * 1.2); cy.glow.material.opacity = Math.min(1, gI * 1.2);
    if (gI > 0.05 && (!lit || gI > lit.i)) lit = { i: gI, cy };
    const li = lift(a, IN_OPEN, IN_CLOSE), le = lift(a, EX_OPEN, EX_CLOSE);
    cy.valves.forEach(({ v, kind }) => { v.position.y = DECK - 0.085 * (kind === 'in' ? li : le); });
    cy.a = a;
  });
  if (lit){ fireLight.position.set(0, DECK - 0.1, lit.cy.z); fireLight.intensity = lit.i * 3; } else fireLight.intensity = 0;
  M.header.emissiveIntensity = clamp((cyc.Tman ? (cyc.load || 0) : 0) * 0.5 - 0.1, 0, 0.4);
  M.glowTip.emissiveIntensity = st.cold ? 0.9 + 0.15 * Math.sin(performance.now() / 300) : 0;
}

// ------------------------------------------------------------------
// Voiture, boîte automatique 6 rapports à convertisseur, turbo
// ------------------------------------------------------------------
// 330d E90 : rapports de la ZF 6HP, pont et masse estimés
const CAR = { m: 1660, r: 0.316, fd: 2.47, eta: 0.9, cdA: 0.29 * 2.2, crr: 0.012,
  ratios: [0, 4.171, 2.340, 1.521, 1.143, 0.867, 0.691], rev: 3.403, Ie: 0.25, vmax: 250 / 3.6, grip: 12000, idle: 800, stall: 2300 };
const NG = CAR.ratios.length - 1;
const SEL_NAMES = { P: 'Parking', R: 'Marche arrière', N: 'Point mort', D: 'Drive', S: 'Sport', M: 'Manuel' };
Object.assign(st, { sel: 'P', gear: 1, v: 0, pedal: 0, brake: false, conv: 'open', lock: false, shiftT: 0, shiftUp: false, lastShift: 0,
  accel: 0, simT: 0, t0: null, t0100: null, spin: false, limCut: false, vCut: false, dfco: false, smoke: 1, teNet: 0 });
const ratioOf = g => (st.sel === 'R' ? CAR.rev : CAR.ratios[g]) * CAR.fd;
const rpmAt = (g, v) => Math.abs(v) / CAR.r * 60 / (2 * Math.PI) * ratioOf(g);
const RPM_PER_RAD = 60 / (2 * Math.PI);
const KC = 500 / (CAR.stall * CAR.stall);     // convertisseur : couple absorbé ∝ régime², ≈ 500 N·m au calage
function stepVehicle(h){
  const sel = st.sel;
  const coupled = sel === 'D' || sel === 'S' || sel === 'M' || sel === 'R';
  const sport = sel === 'S' || sel === 'M';
  const map = Math.pow(st.pedal, sport ? 0.85 : 1.1);
  // gestion moteur : régulateur de ralenti, régime maxi, vitesse maxi, coupure en décélération
  const idleGov = clamp(0.12 + (CAR.idle - st.rpm) * 0.004, 0, 0.45);
  if (st.rpm > SPEC.redline) st.limCut = true; else if (st.rpm < SPEC.redline - 150) st.limCut = false;
  st.vCut = st.v > CAR.vmax;
  st.dfco = map < 0.01 && st.rpm > 1100;
  st.fuelOn = !st.limCut && !st.vCut && !st.dfco;
  st.load = st.fuelOn ? Math.min(Math.max(map, idleGov), st.smoke) * (st.shiftT > 0 ? 0.6 : 1) : 0;
  const Te = st.load * (fullTorque(st.rpm) + friction(st.rpm)) - friction(st.rpm);
  st.teNet = Te;
  const dir = sel === 'R' ? -1 : 1;
  const ratio = coupled ? ratioOf(st.gear) : 0;
  const rpmW = coupled ? Math.max(0, st.v * dir) / CAR.r * RPM_PER_RAD * ratio : 0;
  let Fdrive = 0;
  st.spin = false;
  if (coupled){
    const sr = rpmW / Math.max(st.rpm, 1);
    // embrayage de pontage : se ferme quand la turbine rattrape le moteur, s'ouvre près du ralenti
    if (!st.lock && sr > 0.86 && rpmW > 1050 && st.shiftT <= 0) st.lock = true;
    else if (st.lock && rpmW < 900) st.lock = false;
    if (st.lock){
      st.conv = 'lock';
      Fdrive = Te * ratio * CAR.eta / CAR.r;
    } else {
      st.conv = 'slip';
      const Tp = KC * st.rpm * st.rpm * Math.max(0, 1 - sr * sr);
      const mult = 1 + 0.8 * clamp(1 - sr, 0, 1);       // multiplication de couple du convertisseur
      st.rpm += (Te - Tp) / CAR.Ie * h * RPM_PER_RAD;
      Fdrive = Tp * mult * ratio * CAR.eta / CAR.r;
    }
    if (Fdrive > CAR.grip){ Fdrive = CAR.grip; st.spin = true; }
    Fdrive *= dir;
  } else {
    st.conv = 'open'; st.lock = false;
    st.rpm += Te / CAR.Ie * h * RPM_PER_RAD;
  }
  const v = st.v, sg = Math.sign(v);
  const Fres = Math.abs(v) > 0.02 ? sg * (0.5 * 1.2 * CAR.cdA * v * v + CAR.crr * CAR.m * 9.81) : 0;
  const Fb = (st.brake ? CAR.m * 9.81 : 0) + (sel === 'P' ? 3 * CAR.m * 9.81 : 0);
  const mEff = CAR.m + (st.lock ? CAR.Ie * Math.pow(ratio / CAR.r, 2) : 0);
  let nv = v + (Fdrive - Fres) / mEff * h;
  if (Fb > 0){ const dv = Fb / CAR.m * h; nv = Math.abs(nv) <= dv ? 0 : nv - Math.sign(nv) * dv; }
  if (Math.abs(nv) < 0.01 && Math.abs(Fdrive) < CAR.crr * CAR.m * 9.81) nv = 0;
  st.v = nv;
  if (st.lock){
    const target = Math.max(0, st.v * dir) / CAR.r * RPM_PER_RAD * ratio;
    st.rpm += (target - st.rpm) * Math.min(1, h * 30);
  }
  st.rpm = clamp(st.rpm, 450, 5200);
  if (st.shiftT > 0) st.shiftT -= h;
}
function shiftTo(g){
  if (g === st.gear) return;
  st.shiftUp = g > st.gear; st.gear = g; st.shiftT = 0.3; st.lastShift = st.simT; st.lock = false;
}
let msgTimer = 0;
function msg(t){ $('#gearMsg').textContent = t; clearTimeout(msgTimer); if (t) msgTimer = setTimeout(() => $('#gearMsg').textContent = '', 4000); }
function autoShift(){
  if (!['D', 'S', 'M'].includes(st.sel)) return;
  const since = (st.simT - st.lastShift) * 1000, p = st.pedal;
  if (st.v < 2 && st.gear > 1 && st.rpm < 1300){ shiftTo(1); return; }
  if (st.sel === 'M'){ if (st.gear > 1 && rpmAt(st.gear, st.v) < 900 && since > 600) shiftTo(st.gear - 1); return; }
  // un diesel passe tôt : il a son couple dès 1 750 tr/min
  const up = st.sel === 'D' ? 1700 + Math.pow(p, 1.3) * (4400 - 1700) : 2600 + p * (4550 - 2600);
  const down = st.sel === 'D' ? 1150 + p * 1700 : 1700 + p * 2000;
  const wheelRpm = rpmAt(st.gear, st.v);
  if (st.gear < NG && wheelRpm > up && since > 700) shiftTo(st.gear + 1);
  else if (st.gear > 1 && since > 700){
    const lower = rpmAt(st.gear - 1, st.v);
    if ((wheelRpm < down || (p > 0.93 && lower < 4000)) && lower < up - 200) shiftTo(st.gear - 1);
  }
}
function selectGear(sel){
  const kmh = st.v * 3.6;
  if (sel === 'P' && Math.abs(kmh) > 2){ msg('Arrêtez la voiture avant de passer en P.'); return; }
  if (sel === 'R' && kmh > 2){ msg('Arrêtez la voiture avant de passer la marche arrière.'); return; }
  if ((sel === 'D' || sel === 'S' || sel === 'M') && kmh < -2){ msg('Arrêtez la voiture avant de repartir en avant.'); return; }
  const prev = st.sel; st.sel = sel;
  if ((sel === 'D' || sel === 'S') || (sel === 'M' && !['D', 'S'].includes(prev))){
    let g = 1; while (g < NG && rpmAt(g, st.v) > (sel === 'D' ? 2200 : 3200)) g++;
    if (sel !== 'M' || !['D', 'S'].includes(prev)) st.gear = g;
  }
  if (sel === 'R') st.gear = 1;
  st.lock = false;
  msg('');
}
function paddle(d){
  if (st.sel === 'D' || st.sel === 'S') selectGear('M');
  if (st.sel !== 'M'){ msg('Les palettes fonctionnent en D, S ou M.'); return; }
  const g = st.gear + d; if (g < 1 || g > NG) return;
  if (d < 0){
    const r = rpmAt(g, st.v);
    if (r > SPEC.redline - 200){ msg(`Rétrogradage refusé : le moteur monterait à ${nf.format(r)} tr/min.`); return; }
  }
  shiftTo(g); msg('');
}
let vPrev = 0;
function updateEngine(dt){
  // turbo : la pression suit la demande avec un temps de réponse ; elle limite le gazole (limite de fumée)
  const full = st.ver.boost * spool(st.rpm);
  st.boostTgt = st.fuelOn ? full * (0.06 + 0.94 * Math.pow(Math.min(1, Math.max(st.pedal, st.load)), 0.9)) : 0.02 * full;
  const tau = st.boostTgt > st.boost ? 0.45 + 0.6 * (1 - spool(st.rpm)) : 0.35;
  st.boost += (st.boostTgt - st.boost) * (1 - Math.exp(-dt / tau));
  st.smoke = full > 0.05 ? clamp(0.42 + 0.58 * (1 + st.boost) / (1 + full), 0, 1) : 1;
  const n = 4;
  for (let i = 0; i < n; i++) stepVehicle(dt / n);
  autoShift();
  st.accel += ((st.v - vPrev) / Math.max(dt, 1e-3) / 9.81 - st.accel) * Math.min(1, dt * 6); vPrev = st.v;
  st.simT += dt;
  const now = st.simT * 1000;
  if (Math.abs(st.v) < 0.3){ st.t0 = null; }
  else if (st.t0 === null && st.v > 0.3 && st.v < 2) st.t0 = now;
  if (st.t0 > 0 && st.v >= 100 / 3.6){ st.t0100 = (now - st.t0) / 1000; st.t0 = -1; }
  if (st.t0 === -1 && st.v < 0.3) st.t0 = null;
  st.cut = !st.fuelOn;
  st.torque = st.fuelOn ? Math.max(0, st.teNet) : st.teNet;
  st.power = st.torque * st.rpm / 9549 / 0.7355;
  st.turboRpm = 25000 + 175000 * Math.pow(clamp(st.boost / 1.9, 0, 1), 0.7) + 10000 * st.rpm / 4800;
}

// ------------------------------------------------------------------
// Étiquettes
// ------------------------------------------------------------------
const labelsEl = $('#labels');
const labels = [];
function addLabel(text, cls, layerName, getPos){
  const el = document.createElement('div'); el.className = 'lbl ' + (cls || ''); el.textContent = text; labelsEl.appendChild(el);
  labels.push({ el, layerName, getPos, v: new THREE.Vector3() }); return el;
}
cyls.forEach(cy => { cy.label = addLabel(String(cy.n), 'cyl', null, v => v.set(0, DECK + 1.45, cy.z)); });
addLabel('Vilebrequin', '', 'crank', v => v.set(0, -0.85, 3 * PITCH + 0.62));
addLabel('Volant moteur', '', 'crank', v => v.set(0, -1.4, -3 * PITCH - 0.42));
addLabel('Bielle', '', 'rods', v => cyls[3].rod.localToWorld(v.set(0, L * 0.5, 0)));
addLabel('Piston', '', 'pistons', v => cyls[5].piston.localToWorld(v.set(0, PTC, 0)));
addLabel('Arbres à cames', '', 'valvetrain', v => v.set(VX, DECK + 0.65, -ENG_LEN / 2 - 0.2));
addLabel('Rampe commune', '', 'rail', v => v.set(RAIL.x, RAIL.y + 0.12, cyls[4].z));
addLabel('Injecteurs', '', 'rail', v => v.set(0.12, DECK + 1.2, cyls[1].z));
addLabel('Pompe haute pression', '', 'rail', v => v.copy(PUMP).add(V(-0.1, -0.25, 0.1)));
addLabel("Répartiteur d'admission", '', 'manifolds', v => v.set(PLEN.x - 0.1, PLEN.y + 0.32, cyls[3].z));
addLabel('Vanne EGR', '', 'manifolds', v => v.copy(egrValve.position).add(V(-0.15, 0.2, 0)));
addLabel("Collecteur d'échappement", '', 'turbo', v => v.set(LOG.x + 0.1, LOG.y + 0.3, cyls[1].z));
addLabel('Turbo', '', 'turbo', v => v.set(TURBO.x + 0.2, TURBO.y + 0.45, TURBO.z));
addLabel('Échangeur air/air', '', 'turbo', v => v.copy(IC).add(V(0, 0.5, 0)));
addLabel('Bougies de préchauffage', '', 'heads', v => v.set(-0.45, DECK + 0.5, cyls[5].z - 0.2));
function updateLabels(){
  const W = viewport.clientWidth, H = viewport.clientHeight;
  const show = $('input[data-layer=labels]').checked;
  labels.forEach(l => {
    const vis = show && (!l.layerName || layers[l.layerName].visible);
    if (!vis){ l.el.style.display = 'none'; return; }
    l.getPos(l.v); engine.localToWorld(l.v); l.v.project(camera);
    if (l.v.z > 1){ l.el.style.display = 'none'; return; }
    l.el.style.display = '';
    l.el.style.transform = `translate(${(l.v.x * 0.5 + 0.5) * W}px, ${(-l.v.y * 0.5 + 0.5) * H}px) translate(-50%,-50%)`;
  });
  let firing = null;
  cyls.forEach(cy => {
    const f = fuelNow() && (cy.a < 70 || cy.a > 712);
    if (f && (!firing || (cy.a < 70 ? cy.a : cy.a - 720) < (firing.a < 70 ? firing.a : firing.a - 720))) firing = cy;
    cy.label.classList.toggle('fire', f);
  });
  return firing;
}

// ------------------------------------------------------------------
// Instruments 2D
// ------------------------------------------------------------------
function fitCanvas(c){
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
  if (c.width !== w || c.height !== h){ c.width = w; c.height = h; }
  const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: c.clientWidth, h: c.clientHeight };
}
function drawTach(){
  const { ctx, w, h } = fitCanvas($('#tach'));
  if (w < 30 || h < 30) return;
  const cx = w / 2, cy = h / 2, r = w / 2 - 8, max = 6000;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(14,17,21,.78)'; ctx.beginPath(); ctx.arc(cx, cy, r + 6, 0, Math.PI * 2); ctx.fill();
  const a0 = Math.PI * 0.75, span = Math.PI * 1.5;
  const ang = rpm => a0 + span * Math.min(rpm, max) / max;
  ctx.lineWidth = 5; ctx.strokeStyle = COL.line2; ctx.beginPath(); ctx.arc(cx, cy, r - 4, a0, a0 + span); ctx.stroke();
  ctx.strokeStyle = COL.red; ctx.beginPath(); ctx.arc(cx, cy, r - 4, ang(SPEC.redline), a0 + span); ctx.stroke();
  ctx.strokeStyle = COL.amber; ctx.beginPath(); ctx.arc(cx, cy, r - 4, a0, ang(st.rpm)); ctx.stroke();
  ctx.fillStyle = COL.muted; ctx.font = `500 ${Math.max(9, w / 15)}px "IBM Plex Mono", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let k = 0; k <= 6; k++){
    const a = ang(k * 1000);
    ctx.strokeStyle = k * 1000 >= SPEC.redline ? COL.red : COL.muted; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (r - 12), cy + Math.sin(a) * (r - 12)); ctx.lineTo(cx + Math.cos(a) * (r - 18), cy + Math.sin(a) * (r - 18)); ctx.stroke();
    ctx.fillText(k, cx + Math.cos(a) * (r - 30), cy + Math.sin(a) * (r - 30));
  }
  const a = ang(st.rpm);
  ctx.strokeStyle = COL.fg; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * 10, cy - Math.sin(a) * 10); ctx.lineTo(cx + Math.cos(a) * (r - 14), cy + Math.sin(a) * (r - 14)); ctx.stroke();
  ctx.fillStyle = COL.fg; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = COL.muted; ctx.font = `500 ${Math.max(8, w / 22)}px "IBM Plex Mono", monospace`; ctx.fillText('×1000 tr/min', cx, cy + r * 0.45);
}
function drawCurve(){
  const { ctx, w, h } = fitCanvas($('#curve'));
  if (w < 30 || h < 30) return;
  const pad = { l: 34, r: 36, t: 12, b: 20 }, rmax = 5000, maxHp = 350, maxNm = 700;
  const X = rpm => pad.l + (w - pad.l - pad.r) * rpm / rmax;
  const YP = hp => h - pad.b - (h - pad.t - pad.b) * hp / maxHp;
  const YT = nm => h - pad.b - (h - pad.t - pad.b) * nm / maxNm;
  ctx.clearRect(0, 0, w, h);
  ctx.font = '10px "IBM Plex Mono", monospace'; ctx.textBaseline = 'middle';
  ctx.strokeStyle = COL.line; ctx.lineWidth = 1;
  for (let k = 0; k <= 3; k++){ const y = YP(k * 100); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
    ctx.fillStyle = COL.amber; ctx.textAlign = 'right'; ctx.fillText(k * 100, pad.l - 5, y);
    ctx.fillStyle = COL.air; ctx.textAlign = 'left'; ctx.fillText(k * 200, w - pad.r + 5, y); }
  ctx.fillStyle = COL.muted; ctx.textAlign = 'center';
  for (let k = 1; k <= 5; k++) ctx.fillText(k + 'k', X(k * 1000), h - 8);
  ctx.fillStyle = 'rgba(239,68,68,.12)'; ctx.fillRect(X(SPEC.redline), pad.t, X(rmax) - X(SPEC.redline), h - pad.t - pad.b);
  const plot = (fn, Y, color, width) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
    for (let r = 750; r <= 4800; r += 50){ const x = X(r), y = Y(fn(r)); r === 750 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
  };
  plot(r => fullTorque(r) * r / 9549 / 0.7355, YP, COL.amber, 2);
  plot(fullTorque, YT, COL.air, 2);
  const x = X(st.rpm);
  ctx.strokeStyle = COL.muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, h - pad.b); ctx.stroke();
  ctx.fillStyle = COL.amber; ctx.beginPath(); ctx.arc(x, YP(Math.max(0, st.power)), 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = COL.air; ctx.beginPath(); ctx.arc(x, YT(Math.max(0, st.torque)), 4, 0, Math.PI * 2); ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = COL.amber; ctx.fillText('ch', pad.l + 4, pad.t);
  ctx.fillStyle = COL.air; ctx.fillText('N·m', pad.l + 26, pad.t);
  ctx.fillStyle = COL.dim; ctx.fillText('point : charge actuelle', pad.l + 60, pad.t);
}
const STROKES = [['Détente', COL.amber], ['Échappement', COL.exh], ['Admission', COL.air], ['Compression', COL.comp]];
function drawChrono(){
  const { ctx, w, h } = fitCanvas($('#chrono'));
  if (w < 30 || h < 30) return;
  const padL = 52, padR = 12, top = 24, rowH = (h - top - 8) / 6;
  const X = a => padL + (w - padL - padR) * a / 720;
  ctx.clearRect(0, 0, w, h);
  ctx.font = '11px "IBM Plex Mono", monospace'; ctx.textBaseline = 'middle';
  for (let d = 0; d <= 720; d += 120){
    ctx.strokeStyle = COL.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(d), top - 4); ctx.lineTo(X(d), h - 8); ctx.stroke();
    ctx.fillStyle = COL.muted; ctx.textAlign = 'center'; ctx.fillText(d + '°', X(d), 10);
  }
  const seg2 = (n, a0, a1, yy, hh, col) => { ctx.fillStyle = col; const dur = Math.max(1.5, ((a1 - a0) % 720 + 720) % 720), s0 = ((FIRE[n] + a0) % 720 + 720) % 720;
    if (s0 + dur <= 720) ctx.fillRect(X(s0), yy, Math.max(2, X(s0 + dur) - X(s0)), hh);
    else { ctx.fillRect(X(s0), yy, X(720) - X(s0), hh); ctx.fillRect(X(0), yy, X(s0 + dur - 720) - X(0), hh); } };
  for (let r = 0; r < 6; r++){
    const n = r + 1, y = top + r * rowH;
    for (let k = 0; k < 4; k++){
      const s = (FIRE[n] + k * 180) % 720, e = s + 180;
      ctx.fillStyle = STROKES[k][1];
      const seg = (a, b) => ctx.fillRect(X(a) + 0.5, y + 3, X(b) - X(a) - 1, rowH - 6);
      if (e <= 720) seg(s, e); else { seg(s, 720); seg(0, e - 720); }
      if (w > 700 && e <= 720){ ctx.fillStyle = 'rgba(10,12,15,.7)'; ctx.textAlign = 'center'; ctx.font = '10px "IBM Plex Mono", monospace'; ctx.fillText(STROKES[k][0], X(s + 90), y + rowH / 2); }
    }
    if (fuelNow()){
      seg2(n, cyc.soi, cyc.eoi, y + 2, rowH - 4, COL.fuel);
      if (cyc.pilotMg > 0) seg2(n, cyc.pSoi, cyc.pEoi, y + 2, rowH - 4, COL.fuel);
    }
    if (n === lpCyl){ ctx.strokeStyle = COL.fg; ctx.lineWidth = 1.5; ctx.strokeRect(X(0) - 1, y + 1.5, X(720) - X(0) + 2, rowH - 3); }
    ctx.fillStyle = COL.fg; ctx.textAlign = 'left'; ctx.font = '600 13px "Barlow Condensed", sans-serif';
    ctx.fillText('Cyl. ' + n, 6, y + rowH / 2);
  }
  const x = X(st.theta);
  ctx.strokeStyle = COL.fg; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, top - 6); ctx.lineTo(x, h - 6); ctx.stroke();
  ctx.fillStyle = COL.fg; ctx.beginPath(); ctx.moveTo(x - 5, top - 10); ctx.lineTo(x + 5, top - 10); ctx.lineTo(x, top - 4); ctx.fill();
}

// ------------------------------------------------------------------
// Son : 6 cylindres diesel
// ------------------------------------------------------------------
// Impulsions d'échappement régulières (une tous les 120°), étouffées par la turbine,
// claquement de combustion (plus fort à faible charge et à froid), sifflement du turbo.
class DieselSynth {
  constructor(sr){
    this.sr = sr; this.phase = 0;
    this.rpm = 0; this.tRpm = 0; this.load = 0; this.tLoad = 0; this.boost = 0; this.tBoost = 0;
    this.fuel = true; this.cold = 0; this.vol = 0.9;
    this.amp = new Float32Array(6); for (let c = 0; c < 6; c++) this.amp[c] = 0.9 + Math.random() * 0.2;
    this.pT = 1e9; this.pA = 0; this.pLen = 80; this.nEnv = 0; this.kEnv = 0;
    this.res = [[85, 0.5, 1.0], [240, 0.35, 0.75], [620, 0.5, 0.3], [1300, 0.7, 0.1]].map(([f, q, g]) => ({ f, q, g, low: 0, band: 0 }));
    this.kRes = [[1900, 0.12, 1.0], [3300, 0.1, 0.8], [5200, 0.14, 0.4]].map(([f, q, g]) => ({ f, q, g, low: 0, band: 0 }));
    this.wh = { f: 3000, q: 0.08, low: 0, band: 0 }; this.ws = { f: 6000, q: 0.5, low: 0, band: 0 };
    this.thump = 0; this.lp = 0; this.dc = 0; this.whPh = 0;
  }
  setParams(p){ this.tRpm = p.rpm; this.tLoad = p.load; this.tBoost = p.boost; this.fuel = p.fuel; this.cold = p.cold; }
  svf(r, x){
    const f = 2 * Math.sin(Math.PI * Math.min(r.f, this.sr * 0.2) / this.sr);
    r.low += f * r.band; const hi = x - r.low - r.q * r.band; r.band += f * hi; return r.band;
  }
  process(Lc, Rc, n){
    const sr = this.sr, nDecay = Math.exp(-1 / (sr * 0.002)), kDecay = Math.exp(-1 / (sr * 0.0011));
    for (let i = 0; i < n; i++){
      this.rpm += (this.tRpm - this.rpm) * 0.002;
      this.load += (this.tLoad - this.load) * 0.001;
      this.boost += (this.tBoost - this.boost) * 0.0004;
      const prev = this.phase;
      this.phase += this.rpm / 60 * 360 / sr;
      let wrapped = false; if (this.phase >= 720){ this.phase -= 720; wrapped = true; }
      if (this.rpm > 60) for (let k = 0; k < 6; k++){
        const a = k * 120;
        const crossed = wrapped ? (a >= prev || a < this.phase) : (a >= prev && a < this.phase);
        if (!crossed) continue;
        const gap = 60 / (this.rpm * 3);
        this.pLen = Math.max(14, Math.round(sr * Math.min(0.0035, gap * 0.6)));
        this.pT = 0;
        if (this.fuel){
          const A = (0.3 + 0.7 * this.load) * this.amp[k] * (0.92 + Math.random() * 0.16);
          this.pA = A; this.nEnv = A * 0.3;
          this.kEnv = (0.35 + 0.65 * (1 - this.load)) * (this.cold ? 1.7 : 1) * Math.min(1, 0.35 + 1400 / Math.max(this.rpm, 700)) * (0.85 + Math.random() * 0.3);
        } else { this.pA = 0.06; this.nEnv = 0.015; }
      }
      let x = 0;
      if (this.pT < this.pLen){ x = this.pA * Math.sin(Math.PI * this.pT / this.pLen); this.pT++; }
      const nz = (Math.random() * 2 - 1) * this.nEnv; this.nEnv *= nDecay;
      const exc = x + nz * 0.5;
      let y = 0; for (let k = 0; k < this.res.length; k++) y += this.svf(this.res[k], exc) * this.res[k].g;
      this.thump += (exc - this.thump) * 0.02;
      let s = y * 0.8 + this.thump * 2.6;
      this.lp += (s - this.lp) * (0.05 + 0.12 * this.load);
      s = this.lp;
      // claquement : bruit très bref filtré dans les aigus
      const kn = (Math.random() * 2 - 1) * this.kEnv; this.kEnv *= kDecay;
      let kc = 0; for (let k = 0; k < this.kRes.length; k++) kc += this.svf(this.kRes[k], kn) * this.kRes[k].g;
      s += kc * 0.22;
      // turbo : sifflement et souffle, proportionnels à la pression
      const b = Math.min(1, this.boost);
      this.wh.f = 1800 + 5200 * b; this.ws.f = 4500 + 3000 * b;
      this.whPh += this.wh.f / sr; if (this.whPh > 1) this.whPh -= 1;
      s += Math.sin(2 * Math.PI * this.whPh) * 0.022 * Math.pow(b, 1.3);
      s += this.svf(this.ws, Math.random() * 2 - 1) * 0.05 * b;
      this.dc += (s - this.dc) * 0.0015; s -= this.dc;
      Lc[i] = Math.tanh(s * 1.4) * this.vol * 0.55;
      Rc[i] = Math.tanh((s * 0.92 + kc * 0.03) * 1.4) * this.vol * 0.55;
    }
  }
}
let audio = null;
async function startAudio(){
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
  const ctx = new AC();
  let node = null, post;
  try {
    const src = DieselSynth.toString() + `
      class DProc extends AudioWorkletProcessor {
        constructor(){ super(); this.s = new DieselSynth(sampleRate); this.port.onmessage = e => this.s.setParams(e.data); }
        process(inp, out){ const o = out[0]; this.s.process(o[0], o[1] || o[0], o[0].length); return true; }
      }
      registerProcessor('diesel-synth', DProc);`;
    const url = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
    await ctx.audioWorklet.addModule(url);
    node = new AudioWorkletNode(ctx, 'diesel-synth', { numberOfInputs: 0, outputChannelCount: [2] });
    post = m => node.port.postMessage(m);
  } catch (e){
    const synth = new DieselSynth(ctx.sampleRate);
    node = ctx.createScriptProcessor(2048, 0, 2);
    node.onaudioprocess = ev => synth.process(ev.outputBuffer.getChannelData(0), ev.outputBuffer.getChannelData(1), ev.outputBuffer.length);
    post = m => synth.setParams(m);
  }
  node.connect(ctx.destination);
  audio = { ctx, post };
  updateAudio();
  return true;
}
function updateAudio(){
  if (!audio) return;
  audio.post({ rpm: st.rpm, load: clamp(st.load, 0, 1), boost: st.boost / 1.6, fuel: st.fuelOn && st.rpm > 1, cold: st.cold ? 1 : 0 });
}

// ------------------------------------------------------------------
// Interface
// ------------------------------------------------------------------
const fmtPlay = f => f >= 0.999 ? '×1 (temps réel)' : '×1/' + nf.format(Math.round(1 / f));
function bindRange(id, fn){ const el = $('#' + id); el.addEventListener('input', () => fn(+el.value)); fn(+el.value); }
bindRange('pedal', v => { st.pedal = v / 100; });
const setPedal = v => { v = clamp(v, 0, 100); $('#pedal').value = v; st.pedal = v / 100; };
$('#pedal0').addEventListener('click', () => setPedal(0));
$('#pedal100').addEventListener('click', () => setPedal(100));
const brakeBtn = $('#brakeBtn');
const setBrake = on => { st.brake = on; brakeBtn.classList.toggle('on', on); };
brakeBtn.addEventListener('pointerdown', e => { e.preventDefault(); brakeBtn.setPointerCapture(e.pointerId); setBrake(true); });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => brakeBtn.addEventListener(ev, () => setBrake(false)));
brakeBtn.addEventListener('keydown', e => { if (e.key === 'Enter') setBrake(true); });
brakeBtn.addEventListener('keyup', e => { if (e.key === 'Enter') setBrake(false); });
document.querySelectorAll('[data-sel]').forEach(b => b.addEventListener('click', () => selectGear(b.dataset.sel)));
$('#shiftUp').addEventListener('click', () => paddle(1));
$('#shiftDown').addEventListener('click', () => paddle(-1));
$('#vmaxSel').addEventListener('change', e => { const v = +e.target.value; CAR.vmax = v ? v / 3.6 : Infinity; });
$('#cold').addEventListener('change', e => { st.cold = e.target.checked; });
function applyVer(k){
  st.ver = VERS[k];
  $('#verHint').textContent = st.ver.hint;
  let hp = 0, hpR = 0, nm = 0;
  for (let r = 1000; r <= SPEC.redline; r += 50){ const t = fullTorque(r), h = t * r / 9549 / 0.7355; if (h > hp){ hp = h; hpR = r; } nm = Math.max(nm, t); }
  let r0 = 0, r1 = 0; for (let r = 750; r <= SPEC.redline; r += 50) if (fullTorque(r) >= nm - 0.5){ if (!r0) r0 = r; r1 = r; }
  $('#specCc').textContent = `${nf.format(st.ver.cc)} cm³`;
  $('#specBs').textContent = st.ver.bs;
  $('#specHp').textContent = `${nf.format(Math.round(hp))} ch`; $('#specHpRpm').textContent = `à ${nf.format(Math.round(hpR / 100) * 100)} tr/min`;
  $('#specNm').textContent = `${nf.format(nm)} N·m`; $('#specNmRpm').textContent = r1 > r0 ? `de ${nf.format(r0)} à ${nf.format(r1)} tr/min` : `à ${nf.format(r0)} tr/min`;
  $('#specVer').textContent = st.ver.short; $('#specVerTxt').textContent = st.ver.txt;
}
$('#ver').addEventListener('change', e => applyVer(e.target.value));
bindRange('play', v => { st.playback = Math.pow(10, -3 + 3 * v / 100); setHTML('playOut', fmtPlay(st.playback)); setHTML('badgePlay', fmtPlay(st.playback)); });
bindRange('angle', v => { if (st.paused) st.theta = v; });
$('#pauseBtn').addEventListener('click', () => setPaused(!st.paused));
$('#soundBtn').addEventListener('click', async () => {
  if (!audio){ if (await startAudio()) $('#soundBtn').textContent = 'Son : actif'; return; }
  if (audio.ctx.state === 'running'){ audio.ctx.suspend(); $('#soundBtn').textContent = 'Son : coupé'; }
  else { audio.ctx.resume(); $('#soundBtn').textContent = 'Son : actif'; }
});
window.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'select' || (tag === 'input' && e.target.type !== 'checkbox')) return;
  if (e.key === 'ArrowUp'){ e.preventDefault(); setPedal(+$('#pedal').value + 10); }
  else if (e.key === 'ArrowDown'){ e.preventDefault(); setPedal(+$('#pedal').value - 10); }
  else if (e.key === ' ' && !e.repeat){ e.preventDefault(); setBrake(true); }
  else if (e.key === '+' || e.key === '='){ paddle(1); }
  else if (e.key === '-'){ paddle(-1); }
});
window.addEventListener('keyup', e => { if (e.key === ' ') setBrake(false); });
document.querySelectorAll('input[data-layer]').forEach(cb => {
  const apply = () => { if (layers[cb.dataset.layer]) layers[cb.dataset.layer].visible = cb.checked; };
  cb.addEventListener('change', apply); apply();
});
const ALL = ['block','heads','valvetrain','manifolds','turbo','rail','liners','gas','flow','pistons','rods','crank','labels'];
const PRESETS = {
  full:     { layers: ALL, block: 0.94, head: 0.96, cover: 0.97, plenum: 0.9 },
  xray:     { layers: ALL, block: 0.1, head: 0.16, cover: 0.14, plenum: 0.22 },
  skeleton: { layers: ['valvetrain','rail','gas','flow','pistons','rods','crank','labels'], block: 0.1, head: 0.16, cover: 0.14, plenum: 0.22 },
};
document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
  const p = PRESETS[b.dataset.preset];
  document.querySelectorAll('[data-preset]').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('input[data-layer]').forEach(cb => { cb.checked = p.layers.includes(cb.dataset.layer); cb.dispatchEvent(new Event('change')); });
  [['block', p.block], ['head', p.head], ['cover', p.cover], ['plenum', p.plenum]].forEach(([k, o]) => {
    M[k].opacity = o; M[k].depthWrite = o > 0.8; M[k].needsUpdate = true;
  });
  M.edge.opacity = p.block > 0.8 ? 0.15 : 0.45;
}));
let camAnim = null;
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
  camAnim = { from: camera.position.clone(), to: new THREE.Vector3(...VIEWS[b.dataset.view]), tFrom: controls.target.clone(), tTo: new THREE.Vector3(0, 1.2, 0), t: 0 };
}));
function resize(){
  const w = viewport.clientWidth, h = viewport.clientHeight;
  if (w < 2 || h < 2) return;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport); resize();

// ------------------------------------------------------------------
// Flux dans la vue principale : air, gazole, échappement, air suralimenté
// ------------------------------------------------------------------
function sampleTab(tab, u, out){
  const f = clamp(u, 0, 1) * (tab.length - 1), i = Math.min(tab.length - 2, Math.floor(f));
  return out.copy(tab[i]).lerp(tab[i + 1], f - i);
}
const FIN = 22, FEX = 30, FFU = 16, FPER = FIN + FEX + FFU, NCHG = 90;
const flowPos = new Float32Array((cyls.length * FPER + NCHG) * 3).fill(-999), flowCol = new Float32Array((cyls.length * FPER + NCHG) * 3);
const flowGeo = new THREE.BufferGeometry();
flowGeo.setAttribute('position', new THREE.BufferAttribute(flowPos, 3));
flowGeo.setAttribute('color', new THREE.BufferAttribute(flowCol, 3));
const flowPts = new THREE.Points(flowGeo, new THREE.PointsMaterial({ size: 0.1, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
flowPts.frustumCulled = false; layer('flow').add(flowPts);
cyls.forEach(cy => {
  cy.fu = Float32Array.from({ length: FPER }, () => Math.random());
  cy.fo = Float32Array.from({ length: FPER * 3 }, () => rv(0.07));
  cy.fl = new Float32Array(FFU); cy.fd = Float32Array.from({ length: FFU * 3 }, () => rv(1));
});
const chg = { u: Float32Array.from({ length: NCHG }, () => Math.random()), o: Float32Array.from({ length: NCHG * 3 }, () => rv(0.08)) };
const cAirF = new THREE.Color(COL.air), cFuelF = new THREE.Color(COL.fuel), cExHot = new THREE.Color(0xff7a2a), cExCold = new THREE.Color(0x6d6a66);
const _v = new THREE.Vector3(), _c = new THREE.Color();
function updateFlow(dA){
  const big = dA > 60 || dA < 0, fuel = fuelNow();
  const put = (idx, v, col, off, o3) => { const o = idx * 3; flowPos[o] = v.x + o3[0] * off; flowPos[o + 1] = v.y + o3[1] * off; flowPos[o + 2] = v.z + o3[2] * off;
    flowCol[o] = col.r; flowCol[o + 1] = col.g; flowCol[o + 2] = col.b; };
  const o3 = [0, 0, 0];
  cyls.forEach((cy, ci) => {
    const base = ci * FPER, a = cy.a;
    const li = lift(a, IN_OPEN, IN_CLOSE), le = lift(a, EX_OPEN, EX_CLOSE);
    for (let k = 0; k < FIN; k++){
      cy.fu[k] = big ? Math.random() : (cy.fu[k] + dA * 0.0045 * li) % 1;
      sampleTab(cy.inTab, cy.fu[k], _v);
      _c.copy(cAirF).multiplyScalar(0.15 + 0.75 * li);
      o3[0] = cy.fo[k * 3]; o3[1] = cy.fo[k * 3 + 1]; o3[2] = cy.fo[k * 3 + 2];
      put(base + k, _v, _c, 1, o3);
    }
    for (let k = 0; k < FEX; k++){
      const kk = FIN + k;
      cy.fu[kk] = big ? Math.random() : (cy.fu[kk] + dA * (0.003 * le * (a < 200 ? 2.2 : 1) + 0.0007)) % 1;
      sampleTab(cy.exTab, cy.fu[kk], _v);
      const hot = fuel ? Math.max(0, 1 - cy.fu[kk] * 1.25) * (0.4 + 0.6 * cyc.load) : 0;
      _c.copy(cExCold).lerp(cExHot, hot).multiplyScalar(0.2 + 0.6 * Math.max(le, 0.25));
      o3[0] = cy.fo[kk * 3]; o3[1] = cy.fo[kk * 3 + 1]; o3[2] = cy.fo[kk * 3 + 2];
      put(base + kk, _v, _c, 1, o3);
    }
    const injOn = mainOn(a) || pilotOn(a);
    for (let k = 0; k < FFU; k++){
      const kk = FIN + FEX + k, idx = base + kk;
      let life = cy.fl[k];
      if (big) life = injOn ? Math.random() : 0;
      else if (life <= 0 && injOn && dA > 0 && Math.random() < 0.6) life = 1;
      else if (life > 0) life -= dA * 0.12;
      if (st.paused && injOn && life <= 0) life = 0.2 + Math.random() * 0.8;
      cy.fl[k] = life;
      if (life <= 0){ flowPos[idx * 3 + 1] = -999; continue; }
      const t = 1 - life, d = cy.fd;
      _v.set(cy.injTip.x + d[k * 3] * 0.32 * t, cy.injTip.y - 0.05 * t - 0.05 * t * Math.abs(d[k * 3 + 1]), cy.injTip.z + d[k * 3 + 2] * 0.32 * t);
      _c.copy(cFuelF).multiplyScalar(0.4 + 0.6 * life);
      o3[0] = o3[1] = o3[2] = 0; put(idx, _v, _c, 0, o3);
    }
  });
  const flow = (0.15 + 0.85 * st.boost / 1.9) * Math.max(st.rpm, 700) / 4000;
  for (let k = 0; k < NCHG; k++){
    chg.u[k] = big ? Math.random() : (chg.u[k] + Math.abs(dA) * 0.0012 * flow + 0.0002) % 1;
    sampleTab(CHG_TAB, chg.u[k], _v);
    _c.copy(cAirF).multiplyScalar(0.2 + 0.6 * clamp(st.boost / 1.2, 0, 1));
    o3[0] = chg.o[k * 3]; o3[1] = chg.o[k * 3 + 1]; o3[2] = chg.o[k * 3 + 2];
    put(cyls.length * FPER + k, _v, _c, 1, o3);
  }
  flowGeo.attributes.position.needsUpdate = true; flowGeo.attributes.color.needsUpdate = true;
}

// ------------------------------------------------------------------
// Coupe détaillée d'un cylindre diesel (seconde scène)
// ------------------------------------------------------------------
const lpView = $('#loupeView');
const lr = new THREE.WebGLRenderer({ canvas: $('#loupe'), antialias: true, alpha: true });
lr.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
lr.setClearColor(0x000000, 0);
lr.outputEncoding = THREE.sRGBEncoding;
lr.toneMapping = THREE.ACESFilmicToneMapping;
lr.toneMappingExposure = 1.05;
lr.localClippingEnabled = true;
const ls = new THREE.Scene();
ls.environment = makeEnvTexture(lr);
ls.add(new THREE.HemisphereLight(0xbfd4ee, 0x1a1410, 0.45));
const lkey = new THREE.DirectionalLight(0xffffff, 0.9); lkey.position.set(3, 7, 9); ls.add(lkey);
const lcam = new THREE.PerspectiveCamera(30, 1, 0.02, 100);
const lctl = new THREE.OrbitControls(lcam, $('#loupe'));
lctl.enableDamping = true; lctl.dampingFactor = 0.08; lctl.minDistance = 0.3; lctl.maxDistance = 20;
const Y0 = DECK;
const LP_VIEWS = {
  all:     { pos: [-0.35, 1.95, 8.8], tgt: [-0.35, 1.95, 0] },
  chamber: { pos: [0.1, Y0 + 0.55, 1.75], tgt: [0, Y0 - 0.1, -0.12] },
  nozzle:  { pos: [0.05, Y0 + 0.28, 0.85], tgt: [0, Y0 - 0.06, -0.1] },
  glow:    { pos: [-0.3, Y0 + 0.22, 1.05], tgt: [-0.12, Y0 + 0.1, 0] },
  valves:  { pos: [0.3, Y0 + 0.75, 3.6], tgt: [0, Y0 + 0.7, 0] },
};
lcam.position.set(...LP_VIEWS.all.pos); lctl.target.set(...LP_VIEWS.all.tgt);
let lpCamAnim = null;

const CUT = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)];
function hatchTex(base, line){
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 64, 64);
  if (line){ g.strokeStyle = line; g.lineWidth = 3; for (let i = -64; i <= 128; i += 16){ g.beginPath(); g.moveTo(i, 64); g.lineTo(i + 64, 0); g.stroke(); } }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 5); return t;
}
const HATCH = {
  alu: hatchTex('#5b6673', '#7a8694'), iron: hatchTex('#3f454c', '#5a6068'), steel: hatchTex('#48505a', '#68717c'), ceramic: hatchTex('#d6cfc1', '#eee8dc'),
  bronze: hatchTex('#6b4a2a', '#8e653a'), dark: hatchTex('#202428', '#343a41'), water: hatchTex('#2a5f8f', null), copper: hatchTex('#8a4f23', '#a8652f'),
  rail: hatchTex('#5c636c', '#7a828c'), fuel: hatchTex('#8a6c10', null),
};
const cutMats = {};
const cutMat = k => cutMats[k] || (cutMats[k] = new THREE.MeshBasicMaterial({ map: HATCH[k], side: THREE.BackSide, clippingPlanes: CUT }));
const clipStd = o => new THREE.MeshStandardMaterial(Object.assign({ clippingPlanes: CUT }, o));
const LM = {
  alu:     clipStd({ color: 0xb4bdc8, metalness: 0.55, roughness: 0.42 }),
  iron:    clipStd({ color: 0x80878f, metalness: 0.6, roughness: 0.5 }),
  bore:    clipStd({ color: 0xa3acb6, metalness: 0.85, roughness: 0.22, side: THREE.DoubleSide }),
  water:   clipStd({ color: 0x3d8bd4, metalness: 0, roughness: 0.2, transparent: true, opacity: 0.55, depthWrite: false }),
  steel:   clipStd({ color: 0xb9c1ca, metalness: 0.95, roughness: 0.26 }),
  ceramic: clipStd({ color: 0xf1ece2, metalness: 0, roughness: 0.4 }),
  bronze:  clipStd({ color: 0xb07a45, metalness: 0.8, roughness: 0.35 }),
  dark:    clipStd({ color: 0x24282d, metalness: 0.4, roughness: 0.5 }),
  runner:  clipStd({ color: 0x3a4048, metalness: 0.3, roughness: 0.5, side: THREE.DoubleSide }),
  header:  clipStd({ color: 0x9b8774, metalness: 0.85, roughness: 0.33, side: THREE.DoubleSide, emissive: 0xff4d12, emissiveIntensity: 0 }),
  turbo:   clipStd({ color: 0x8e8378, metalness: 0.8, roughness: 0.4, side: THREE.DoubleSide }),
  shell:   clipStd({ color: 0x2b2f35, metalness: 0.2, roughness: 0.6, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }),
  rail:    clipStd({ color: 0x9aa1aa, metalness: 0.9, roughness: 0.28 }),
  copper:  clipStd({ color: 0xc8773a, metalness: 0.9, roughness: 0.3 }),
  // pièces actives laissées entières (non coupées) pour que leur lueur reste visible
  piezo:   new THREE.MeshStandardMaterial({ color: 0x3b3f6b, metalness: 0.3, roughness: 0.5, emissive: 0x6a7cff, emissiveIntensity: 0 }),
  glowTip: new THREE.MeshStandardMaterial({ color: 0x2a2420, metalness: 0.3, roughness: 0.6, emissive: 0xff4a0a, emissiveIntensity: 0 }),
  rubber:  clipStd({ color: 0x5a1d1a, metalness: 0.1, roughness: 0.7 }),
};
const lp = new THREE.Group(); ls.add(lp);
function sect(geo, mat, hatch){
  const g = new THREE.Group(); g.add(new THREE.Mesh(geo, mat));
  if (hatch) g.add(new THREE.Mesh(geo, cutMat(hatch)));
  return g;
}
const exG = (shape, depth = 1) => { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 }); g.translate(0, 0, -depth / 2); return g; };
const V2 = p => new THREE.Vector2(p[0], p[1]);
const poly = (pts, holes = []) => { const s = new THREE.Shape(pts.map(V2)); holes.forEach(h => s.holes.push(new THREE.Path(h.map(V2)))); return s; };
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const mirror = pts => pts.map(([x, y]) => [-x, y]).reverse();
const quadPts = (p0, c, p1, n = 16) => { const out = []; for (let i = 0; i <= n; i++){ const t = i / n, u = 1 - t;
  out.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]); } return out; };

// Bloc en fonte : parois, chemises d'eau, alésage
const jkt = rect(-0.8, 1.15, -0.6, Y0 - 0.12);
const wall = rect(-0.98, 0.82, -0.44, Y0 - 0.006);
lp.add(sect(exG(poly(wall, [jkt])), LM.iron, 'iron'));
lp.add(sect(exG(poly(mirror(wall), [mirror(jkt)])), LM.iron, 'iron'));
lp.add(sect(exG(poly(jkt)), LM.water, 'water'));
lp.add(sect(exG(poly(mirror(jkt))), LM.water, 'water'));
lp.add(sect(exG(poly(rect(-0.98, -0.75, -0.88, 0.82))), LM.iron, 'iron'));
lp.add(sect(exG(poly(mirror(rect(-0.98, -0.75, -0.88, 0.82)))), LM.iron, 'iron'));
lp.add(sect(exG(poly(rect(-1.05, Y0 - 0.006, -0.43, Y0 + 0.002))), LM.dark, 'dark'));
lp.add(sect(exG(poly(mirror(rect(-1.05, Y0 - 0.006, -0.43, Y0 + 0.002)))), LM.dark, 'dark'));
const boreG = new THREE.CylinderGeometry(BORE_R + 0.008, BORE_R + 0.008, Y0 - 0.82, 48, 1, true); boreG.translate(0, (Y0 + 0.82) / 2, 0);
lp.add(new THREE.Mesh(boreG, LM.bore));

// Culasse à toit plat : conduits d'admission (gauche) et d'échappement (droite), puits d'injecteur et de bougie de préchauffage
const GT = new THREE.Vector3(-0.1, Y0 - 0.012, 0), GD = new THREE.Vector3(-Math.sin(5 * DEG), Math.cos(5 * DEG), 0), GN = new THREE.Vector3(GD.y, -GD.x, 0);
const gEdge = (side, h) => { const w = 0.042 * side; return [GT.x + GN.x * w + GD.x * h, Math.max(Y0, GT.y + GN.y * w + GD.y * h)]; };
const INJ_W = 0.05;
const topL = [[-1.05, Y0 + 0.40], ...quadPts([-1.05, Y0 + 0.40], [-0.35, Y0 + 0.40], [-0.15, Y0 + 0.06]).slice(1),
  [-0.15, Y0], gEdge(-1, 0), gEdge(-1, 0.5), gEdge(1, 0.5), gEdge(1, 0), [-INJ_W, Y0], [-INJ_W, Y0 + 0.72], [-1.05, Y0 + 0.72]];
lp.add(sect(exG(poly(topL, [rect(-0.98, Y0 + 0.6, -0.6, Y0 + 0.67)])), LM.alu, 'alu'));
const topR = [[INJ_W, Y0 + 0.72], [INJ_W, Y0], [0.15, Y0], ...quadPts([0.15, Y0 + 0.06], [0.35, Y0 + 0.40], [1.05, Y0 + 0.40]), [1.05, Y0 + 0.72]];
lp.add(sect(exG(poly(topR, [rect(0.6, Y0 + 0.6, 0.98, Y0 + 0.67)])), LM.alu, 'alu'));
const lowL = [[-1.05, Y0], [-0.39, Y0], ...quadPts([-0.39, Y0 + 0.06], [-0.7, Y0 + 0.08], [-1.05, Y0 + 0.2])];
lp.add(sect(exG(poly(lowL, [rect(-1.0, Y0 + 0.025, -0.74, Y0 + 0.085)])), LM.alu, 'alu'));
lp.add(sect(exG(poly(mirror(lowL), [mirror(rect(-1.0, Y0 + 0.025, -0.74, Y0 + 0.085))])), LM.alu, 'alu'));
[rect(-0.98, Y0 + 0.6, -0.6, Y0 + 0.67), rect(0.6, Y0 + 0.6, 0.98, Y0 + 0.67), rect(-1.0, Y0 + 0.025, -0.74, Y0 + 0.085), mirror(rect(-1.0, Y0 + 0.025, -0.74, Y0 + 0.085))]
  .forEach(r => lp.add(sect(exG(poly(r)), LM.water, 'water')));
const coverG = new THREE.BoxGeometry(2.1, 0.85, 1.0); coverG.translate(0, Y0 + 1.15, 0);
lp.add(new THREE.Mesh(coverG, LM.shell));

// Soupapes verticales, guides, ressorts, poussoirs, cames
class Helix extends THREE.Curve {
  getPoint(t, out = new THREE.Vector3()){ const a = t * Math.PI * 2 * 7; return out.set(0.095 * Math.cos(a), t, 0.095 * Math.sin(a)); }
}
const springGeo = new THREE.TubeGeometry(new Helix(), 280, 0.011, 6, false);
const VALVES = [
  { kind: 'in', c: new THREE.Vector3(-0.27, Y0 + 0.002, 0), r: 0.12, lmax: 0.085, open: IN_OPEN, close: IN_CLOSE },
  { kind: 'ex', c: new THREE.Vector3(0.27, Y0 + 0.002, 0), r: 0.11, lmax: 0.085, open: EX_OPEN, close: EX_CLOSE },
];
const CAM_BASE = 0.12;
VALVES.forEach(vd => {
  const dur = ((vd.close - vd.open) % 720 + 720) % 720;
  vd.peak = (vd.open + dur / 2) % 720;
  const half = dur / 4;
  const fixed = new THREE.Group(); fixed.position.copy(vd.c); lp.add(fixed);
  const seat = new THREE.TorusGeometry(vd.r - 0.01, 0.018, 8, 40); seat.rotateX(Math.PI / 2);
  fixed.add(sect(seat, LM.bronze, 'bronze'));
  const guide = new THREE.CylinderGeometry(0.046, 0.046, 0.3, 20); guide.translate(0, 0.45, 0);
  fixed.add(sect(guide, LM.bronze, 'bronze'));
  const washer = new THREE.CylinderGeometry(0.115, 0.115, 0.015, 24); washer.translate(0, 0.615, 0);
  fixed.add(sect(washer, LM.steel, 'steel'));
  const spring = new THREE.Mesh(springGeo, clipStd({ color: 0x6f8aa6, metalness: 0.8, roughness: 0.35 }));
  spring.position.y = 0.62; fixed.add(spring); vd.spring = spring;
  const mv = new THREE.Group(); lp.add(mv); vd.mv = mv;
  const head = new THREE.CylinderGeometry(0.05, vd.r, 0.045, 36); head.translate(0, 0.0225, 0);
  const neck = new THREE.CylinderGeometry(0.026, 0.05, 0.1, 20); neck.translate(0, 0.095, 0);
  const stem = new THREE.CylinderGeometry(0.026, 0.026, 0.86, 12); stem.translate(0, 0.575, 0);
  [head, neck, stem].forEach(g => mv.add(new THREE.Mesh(g, M.valve)));
  const ret = new THREE.CylinderGeometry(0.1, 0.065, 0.04, 24); ret.translate(0, 0.92, 0);
  mv.add(sect(ret, LM.steel, 'steel'));
  const bucket = new THREE.CylinderGeometry(0.13, 0.13, 0.12, 32); bucket.translate(0, 1.0, 0);
  mv.add(sect(bucket, LM.steel, 'steel'));
  const camC = vd.c.clone().add(new THREE.Vector3(0, 1.06 + CAM_BASE, 0));
  const cam = new THREE.Group(); cam.position.copy(camC); lp.add(cam);
  const piv = new THREE.Group(); cam.add(piv); vd.piv = piv;
  const sh = new THREE.Shape();
  for (let i = 0; i <= 240; i++){
    const phi = i / 240 * Math.PI * 2;
    let d = (phi / DEG + 90) % 360; if (d > 180) d -= 360;
    const b = Math.abs(d) < half ? Math.pow(Math.sin(Math.PI * (d + half) / (2 * half)), 1.4) : 0;
    const r = CAM_BASE + vd.lmax * b;
    i ? sh.lineTo(r * Math.cos(phi), r * Math.sin(phi)) : sh.moveTo(r * Math.cos(phi), r * Math.sin(phi));
  }
  piv.add(sect(exG(sh, 0.15), LM.steel, 'steel'));
  const camShaft = new THREE.CylinderGeometry(0.065, 0.065, 1.0, 24); camShaft.rotateX(Math.PI / 2);
  piv.add(sect(camShaft, LM.steel, 'steel'));
  vd.camC = camC;
});

// Injecteur piézo central : nez à 7 trous, aiguille, pile piézo, arrivée haute pression, retour
const NOZ = new THREE.Vector3(0, Y0 - 0.022, 0);
const injG = new THREE.Group(); lp.add(injG);
const iNoz = new THREE.LatheGeometry([[0, Y0 - 0.026], [0.012, Y0 - 0.024], [0.022, Y0 - 0.005], [0.03, Y0 + 0.06], [0.03, Y0 + 0.2], [0, Y0 + 0.2]].map(V2), 32);
injG.add(sect(iNoz, LM.steel, 'steel'));
const iBody = new THREE.CylinderGeometry(0.045, 0.045, 0.58, 28); iBody.translate(0, Y0 + 0.49, 0); injG.add(sect(iBody, LM.dark, 'dark'));
const iPiezo = new THREE.CylinderGeometry(0.03, 0.03, 0.26, 20); iPiezo.translate(0, Y0 + 0.9, 0);
injG.add(new THREE.Mesh(iPiezo, LM.piezo));
for (let y = Y0 + 0.79; y < Y0 + 1.02; y += 0.025){ const t = new THREE.TorusGeometry(0.031, 0.004, 4, 24); t.rotateX(Math.PI / 2); t.translate(0, y, 0); injG.add(sect(t, LM.copper)); }
const iTop = new THREE.CylinderGeometry(0.045, 0.045, 0.32, 28, 1, true); iTop.translate(0, Y0 + 0.9, 0); injG.add(new THREE.Mesh(iTop, LM.shell));
const iConn = new THREE.BoxGeometry(0.12, 0.09, 0.1); iConn.translate(0.03, Y0 + 1.1, 0); injG.add(sect(iConn, LM.dark, 'dark'));
const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.005, 0.5, 8), M.steel); needle.position.y = Y0 + 0.23; injG.add(needle);
const iSeal = new THREE.TorusGeometry(0.034, 0.008, 6, 24); iSeal.rotateX(Math.PI / 2); iSeal.translate(0, Y0 + 0.02, 0); injG.add(sect(iSeal, LM.copper, 'copper'));
// rampe commune et conduite haute pression
const RAILP = new THREE.Vector3(-0.8, Y0 + 1.52, 0);
const railG = new THREE.CylinderGeometry(0.09, 0.09, 1.0, 28); railG.rotateX(Math.PI / 2); railG.translate(RAILP.x, RAILP.y, 0);
lp.add(sect(railG, LM.rail, 'rail'));
const railIn = new THREE.CylinderGeometry(0.035, 0.035, 1.0, 20); railIn.rotateX(Math.PI / 2); railIn.translate(RAILP.x, RAILP.y, 0);
const fuelInRail = new THREE.Mesh(railIn, clipStd({ color: 0xffd34d, metalness: 0, roughness: 0.3, emissive: 0x6b5200, emissiveIntensity: 0.4 }));
lp.add(fuelInRail);
const hpCurve = new THREE.CatmullRomCurve3([RAILP.clone().add(new THREE.Vector3(0.08, 0, 0)), new THREE.Vector3(-0.3, Y0 + 1.52, 0), new THREE.Vector3(-0.12, Y0 + 1.42, 0), new THREE.Vector3(-0.045, Y0 + 1.33, 0)]);
lp.add(new THREE.Mesh(new THREE.TubeGeometry(hpCurve, 40, 0.022, 12, false), LM.rail));
const hpFuel = new THREE.Mesh(new THREE.TubeGeometry(hpCurve, 40, 0.01, 8, false), new THREE.MeshBasicMaterial({ color: 0xffd34d }));
lp.add(hpFuel);

// Bougie de préchauffage inclinée côté admission
const glowG = new THREE.Group(); glowG.position.copy(GT); glowG.rotation.z = -Math.atan2(GD.x, GD.y); lp.add(glowG);
const gTipG = new THREE.CylinderGeometry(0.018, 0.02, 0.13, 20); gTipG.translate(0, 0.065, 0); glowG.add(new THREE.Mesh(gTipG, LM.glowTip));
const gBodyG = new THREE.CylinderGeometry(0.032, 0.032, 0.31, 24); gBodyG.translate(0, 0.285, 0); glowG.add(sect(gBodyG, LM.steel, 'steel'));
const gHexG = new THREE.CylinderGeometry(0.04, 0.04, 0.06, 6); gHexG.translate(0, 0.47, 0); glowG.add(sect(gHexG, LM.steel, 'steel'));
const gTermG = new THREE.CylinderGeometry(0.014, 0.014, 0.08, 10); gTermG.translate(0, 0.54, 0); glowG.add(sect(gTermG, LM.copper, 'copper'));
const glowLight = new THREE.PointLight(0xff6a20, 0, 0.6, 2); glowLight.position.copy(GT).add(new THREE.Vector3(0.02, -0.03, 0.08)); ls.add(glowLight);

// Admission : répartiteur, conduit, volet de turbulence, arrivée EGR
const inCurve = new THREE.CatmullRomCurve3([[-2.55, Y0 + 1.05], [-2.0, Y0 + 0.68], [-1.45, Y0 + 0.38], [-1.05, Y0 + 0.30]].map(p => new THREE.Vector3(p[0], p[1], 0)));
lp.add(new THREE.Mesh(new THREE.TubeGeometry(inCurve, 80, 0.11, 28, false), LM.runner));
const FL_T = 0.5, flP = inCurve.getPointAt(FL_T), flT = inCurve.getTangentAt(FL_T);
const flapBase = -Math.atan2(flT.x, flT.y);
const lpFlap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 32), M.flap); lpFlap.position.copy(flP); lp.add(lpFlap);
const flapShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.3, 10), M.steel); flapShaft.rotation.x = Math.PI / 2; flapShaft.position.copy(flP); lp.add(flapShaft);
const plenG = new THREE.BoxGeometry(1.0, 0.9, 1.3); plenG.translate(-2.95, Y0 + 1.35, 0);
lp.add(new THREE.Mesh(plenG, LM.shell));
const egrCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-2.95, Y0 + 2.4, 0), new THREE.Vector3(-2.95, Y0 + 1.85, 0)]);
lp.add(new THREE.Mesh(new THREE.TubeGeometry(egrCurve, 8, 0.06, 16, false), LM.runner));

// Échappement et turbine
const exCurve = new THREE.CatmullRomCurve3([[1.05, Y0 + 0.30], [1.45, Y0 + 0.28], [1.85, Y0 + 0.02], [2.0, Y0 - 0.55]].map(p => new THREE.Vector3(p[0], p[1], 0)));
lp.add(new THREE.Mesh(new THREE.TubeGeometry(exCurve, 80, 0.11, 24, false), LM.header));
const TBC = new THREE.Vector3(2.0, Y0 - 0.95, -0.15);
{ const vol = new THREE.TorusGeometry(0.3, 0.14, 18, 48); vol.translate(TBC.x, TBC.y, TBC.z); lp.add(sect(vol, LM.turbo, 'iron')); }
const lpTurbine = new THREE.Group(); lpTurbine.position.copy(TBC); lp.add(lpTurbine);
lpTurbine.add(new THREE.Mesh(zAxis(new THREE.CylinderGeometry(0.04, 0.12, 0.12, 20)), M.steel));
for (let i = 0; i < 11; i++){ const b = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.14, 0.1), M.steel); const a = i / 11 * Math.PI * 2;
  b.position.set(Math.sin(a) * 0.09, Math.cos(a) * 0.09, 0); b.rotation.z = -a + 0.45; lpTurbine.add(b); }

// Piston diesel à bol (chambre de combustion creusée dans le piston)
const BOWL = [[0, 0.045], [0.06, 0.12], [0.13, 0.17], [0.2, 0.155], [0.245, 0.09], [0.255, 0]];
const bowlDepth = r => { if (r >= 0.255) return 0; for (let i = 1; i < BOWL.length; i++) if (r <= BOWL[i][0]){ const [x0, y0] = BOWL[i - 1], [x1, y1] = BOWL[i]; return y0 + (y1 - y0) * (r - x0) / (x1 - x0); } return 0; };
const lpPiston = new THREE.Group(); lp.add(lpPiston);
const PR = BORE_R - 0.004;
const pProf = [[0, PTC - 0.045], [0.06, PTC - 0.12], [0.13, PTC - 0.17], [0.2, PTC - 0.155], [0.245, PTC - 0.09], [0.232, PTC - 0.03], [0.255, PTC],
  [PR - 0.015, PTC], [PR, PTC - 0.015],
  [PR, PTC - 0.07], [PR - 0.024, PTC - 0.07], [PR - 0.024, PTC - 0.088], [PR, PTC - 0.088],
  [PR, PTC - 0.115], [PR - 0.022, PTC - 0.115], [PR - 0.022, PTC - 0.13], [PR, PTC - 0.13],
  [PR, PTC - 0.16], [PR - 0.026, PTC - 0.16], [PR - 0.026, PTC - 0.185], [PR, PTC - 0.185],
  [PR, -0.18], [PR - 0.01, -0.2], [PR - 0.05, -0.2], [PR - 0.055, 0.0], [0.33, PTC - 0.27], [0, PTC - 0.27]];
lpPiston.add(sect(new THREE.LatheGeometry(pProf.slice().reverse().map(V2), 64), LM.alu, 'alu'));
[PTC - 0.079, PTC - 0.1225, PTC - 0.1725].forEach((y, i) => {
  const t = new THREE.TorusGeometry(PR - 0.008, i === 2 ? 0.012 : 0.008, 6, 64); t.rotateX(Math.PI / 2); t.translate(0, y, 0);
  lpPiston.add(sect(t, LM.dark, 'steel'));
});
const pinG = new THREE.LatheGeometry([[0.07, -0.37], [0.13, -0.37], [0.13, 0.37], [0.07, 0.37], [0.07, -0.37]].map(V2), 32); pinG.rotateX(Math.PI / 2);
lpPiston.add(sect(pinG, LM.steel, 'steel'));
const lpRod = new THREE.Group(); lp.add(lpRod);
lpRod.add(new THREE.Mesh(bigUpGeo, M.forged)); lpRod.add(new THREE.Mesh(shankGeo, M.forged)); lpRod.add(new THREE.Mesh(capGeo, M.forged));
{ const sm = new THREE.Mesh(smallGeo, M.forged); sm.position.y = L; lpRod.add(sm); }
const lpCrank = new THREE.Group(); lp.add(lpCrank);
{ const w = new THREE.Mesh(webGeo, M.forged); w.position.z = -0.27; lpCrank.add(w);
  const pin = new THREE.Mesh(zAxis(new THREE.CylinderGeometry(PIN_R, PIN_R, 0.36, 32)), M.steel); pin.position.set(0, R, -0.06); lpCrank.add(pin);
  const mj = new THREE.Mesh(zAxis(new THREE.CylinderGeometry(0.29, 0.29, 0.3, 32)), M.steel); mj.position.z = -0.45; lpCrank.add(mj); }

// Gaz : volume au-dessus du piston et dans le bol (moitié arrière)
const gasMat = new THREE.MeshBasicMaterial({ color: 0x5cb4e8, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
const lpGas = new THREE.Mesh(new THREE.CylinderGeometry(BORE_R - 0.008, BORE_R - 0.008, 1, 48, 1, false, Math.PI / 2, Math.PI).translate(0, 0.5, 0), gasMat);
lp.add(lpGas);
const bowlGas = new THREE.Mesh(new THREE.LatheGeometry([[0, 0.002], ...BOWL.map(([x, d]) => [Math.max(0, x - 0.006), -d + 0.006]), [0.25, 0.002]].map(V2), 40, Math.PI / 2, Math.PI), gasMat);
lp.add(bowlGas);

// Flamme de diffusion : volume calculé autour des jets de gazole, puis dans le bol
const SPRAY_DOWN = 14 * DEG;
const PLUMES = [];
for (let k = 0; k < 7; k++){
  const phi = Math.PI + k * 2 * Math.PI / 7;
  if (Math.sin(phi) > 0.05) continue;
  PLUMES.push(new THREE.Vector3(Math.cos(phi) * Math.cos(SPRAY_DOWN), -Math.sin(SPRAY_DOWN), Math.sin(phi) * Math.cos(SPRAY_DOWN)));
}
const flameMat = new THREE.ShaderMaterial({
  uniforms: { uMin: { value: new THREE.Vector3() }, uMax: { value: new THREE.Vector3() }, uN: { value: NOZ.clone() }, uD: { value: PLUMES },
    uLift: { value: 0.04 }, uLen: { value: 0.3 }, uW: { value: 0.04 }, uFill: { value: 0 }, uOut: { value: 0 }, uCrown: { value: 0 }, uY0: { value: Y0 },
    uBore: { value: BORE_R - 0.006 }, uTime: { value: 0 }, uFade: { value: 1 }, uBlue: { value: 0 } },
  vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform vec3 uMin, uMax, uN; uniform vec3 uD[${PLUMES.length}];
    uniform float uLift, uLen, uW, uFill, uOut, uCrown, uY0, uBore, uTime, uFade, uBlue; varying vec3 vW;
    float h(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
    float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }
    float depthAt(float r){ return r < 0.255 ? mix(0.045, 0.17, smoothstep(0.0, 0.13, r)) * (1.0 - smoothstep(0.2, 0.255, r)) + 0.06 * smoothstep(0.13, 0.2, r) * (1.0 - smoothstep(0.2, 0.255, r)) : 0.0; }
    void main(){
      vec3 ro = cameraPosition, rd = normalize(vW - ro);
      vec3 inv = 1.0 / rd, t0 = (uMin - ro) * inv, t1 = (uMax - ro) * inv;
      vec3 tmn = min(t0, t1), tmx = max(t0, t1);
      float tn = max(max(tmn.x, tmn.y), max(tmn.z, 0.0)), tf = min(min(tmx.x, tmx.y), tmx.z);
      if (tf <= tn) discard;
      float dt = (tf - tn) / 60.0;
      vec3 acc = vec3(0.0); float al = 0.0;
      for (int i = 0; i < 60; i++){
        vec3 p = ro + rd * (tn + (float(i) + 0.5) * dt);
        float r = length(p.xz);
        if (r > uBore || p.z > 0.0 || p.y > uY0 || p.y < uCrown - depthAt(r)) continue;
        float nz = n3(p * 26.0 + vec3(0.0, uTime, 0.0)) * 0.6 + n3(p * 63.0 - vec3(uTime)) * 0.4;
        float f = 0.0;
        for (int k = 0; k < ${PLUMES.length}; k++){
          vec3 v = p - uN; float t = clamp(dot(v, uD[k]), uLift, uLen);
          float d = length(v - uD[k] * t);
          float w = uW * (0.35 + 2.4 * t / 0.3);
          f = max(f, 1.0 - d / max(w, 1e-3) * (0.8 + 0.4 * nz));
        }
        if (r < 0.26 && p.y < uCrown + 0.02) f = max(f, uFill * (0.55 + 0.45 * nz) - 0.08);
        f = max(f, uOut * (0.4 + 0.5 * nz) - 0.15);
        if (f <= 0.0) continue;
        vec3 col = mix(vec3(0.85, 0.3, 0.05), vec3(1.0, 0.82, 0.38), smoothstep(0.2, 0.75, f));
        col = mix(col, vec3(0.3, 0.5, 1.0), uBlue * (1.0 - smoothstep(0.0, 0.5, f)));
        float dens = (0.25 + 1.4 * smoothstep(0.05, 0.6, f)) * dt * 7.0;
        acc += (1.0 - al) * col * dens; al += (1.0 - al) * dens * 0.8;
        if (al > 0.97) break;
      }
      if (al < 0.003) discard;
      gl_FragColor = vec4(min(acc, vec3(0.92)) * uFade, 1.0);
    }`,
  transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
});
const flame = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), flameMat); flame.visible = false; flame.renderOrder = 5; lp.add(flame);
const flameLight = new THREE.PointLight(0xff8a2a, 0, 2.5, 2); flameLight.position.set(0, Y0 - 0.1, 0.2); ls.add(flameLight);

// ---------------- Particules de la coupe ----------------
const NRUN = 300, NDROP = 520, NCH = 900, NEXH = 420;
const O_RUN = 0, O_CH = NRUN, O_EX = O_CH + NCH, O_DROP = O_EX + NEXH, NTOT = O_DROP + NDROP;   // gouttelettes dessinées en dernier
const lpPos = new Float32Array(NTOT * 3), lpRGBA = new Float32Array(NTOT * 4), lpSize = new Float32Array(NTOT);
const lpGeo = new THREE.BufferGeometry();
lpGeo.setAttribute('position', new THREE.BufferAttribute(lpPos, 3));
lpGeo.setAttribute('rgba', new THREE.BufferAttribute(lpRGBA, 4));
lpGeo.setAttribute('size', new THREE.BufferAttribute(lpSize, 1));
const lpPtsMat = new THREE.ShaderMaterial({
  uniforms: { map: { value: dotTex }, uScale: { value: 400 } },
  vertexShader: `attribute float size; attribute vec4 rgba; varying vec4 vC; uniform float uScale;
    void main(){ vC = rgba; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform sampler2D map; varying vec4 vC; void main(){ float a = texture2D(map, gl_PointCoord).a; if (vC.a * a < 0.01) discard; gl_FragColor = vec4(vC.rgb, vC.a * a); }`,
  transparent: true, depthWrite: false,
});
const lpPts = new THREE.Points(lpGeo, lpPtsMat); lpPts.frustumCulled = false; ls.add(lpPts);

const tabFrom = pts => new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], 0))).getSpacedPoints(200);
const AIR_TAB = tabFrom([[-2.95, Y0 + 1.25], [-2.55, Y0 + 1.05], [-2.0, Y0 + 0.68], [-1.45, Y0 + 0.38], [-1.05, Y0 + 0.30], [-0.62, Y0 + 0.22], [-0.38, Y0 + 0.12], [-0.3, Y0 - 0.02]]);
const EX_TAB = tabFrom([[0.3, Y0 - 0.02], [0.36, Y0 + 0.12], [0.62, Y0 + 0.22], [1.05, Y0 + 0.30], [1.45, Y0 + 0.28], [1.85, Y0 + 0.02], [2.0, Y0 - 0.55], [2.0, Y0 - 0.82]]);
const tabNormal = (tab, u, out) => {
  const f = clamp(u, 0, 0.999) * (tab.length - 1), i = Math.floor(f);
  const d = tab[i + 1].clone().sub(tab[i]).normalize(); return out.set(-d.y, d.x, 0);
};
const _n = new THREE.Vector3(), _w = new THREE.Vector3();
const run = { u: new Float32Array(NRUN), off: new Float32Array(NRUN), z: new Float32Array(NRUN) };
for (let i = 0; i < NRUN; i++){ run.u[i] = Math.random(); run.off[i] = rv(1); run.z[i] = -Math.random() * 0.1; }
// gouttelettes : k = jet, s = distance parcourue depuis le nez, j = dispersion
const drop = { on: new Uint8Array(NDROP), k: new Uint8Array(NDROP), s: new Float32Array(NDROP), jx: new Float32Array(NDROP), jy: new Float32Array(NDROP), jz: new Float32Array(NDROP),
  lim: new Float32Array(NDROP), next: 0, acc: 0 };
// charge : r (0..1), phi (π..2π, moitié arrière), v (hauteur 0..1), fuel (vapeur), burn (âge de la combustion en degrés, -1 sinon)
const ch = { on: new Uint8Array(NCH), r: new Float32Array(NCH), phi: new Float32Array(NCH), v: new Float32Array(NCH), fuel: new Uint8Array(NCH), burn: new Float32Array(NCH), n: 0 };
const exh = { on: new Uint8Array(NEXH), u: new Float32Array(NEXH), off: new Float32Array(NEXH), z: new Float32Array(NEXH), heat: new Float32Array(NEXH), next: 0 };
const BI = BORE_R - 0.03;
let lpCrown = Y0;
function chWorld(i, out){
  const rr = ch.r[i] * BI, X = rr * Math.cos(ch.phi[i]), Z = rr * Math.sin(ch.phi[i]);
  const yb = lpCrown - bowlDepth(rr) + 0.008, yt = Y0 - 0.008;
  return out.set(X, yb + ch.v[i] * Math.max(0.003, yt - yb), Z);
}
function chSpawn(r, phi, v, fuel, burned){
  for (let i = 0; i < NCH; i++) if (!ch.on[i]){
    ch.on[i] = 1; ch.r[i] = r; ch.phi[i] = phi; ch.v[i] = v; ch.fuel[i] = fuel ? 1 : 0; ch.burn[i] = burned ? 300 : -1; ch.n++; return i;
  }
  return -1;
}
const randPhi = () => Math.PI + Math.random() * Math.PI;
function exSpawn(heat){
  const i = exh.next; exh.next = (exh.next + 1) % NEXH;
  exh.on[i] = 1; exh.u[i] = Math.random() * 0.03; exh.off[i] = rv(1); exh.z[i] = -Math.random() * 0.1; exh.heat[i] = heat;
}
const nFull = () => Math.round(clamp(700 * cyc.airMg / 1250, 160, 820));
const chTarget = a => { const N = nFull(), ai = Math.floor(a) % 720; return Math.round(N * (1 - 0.94 * EX_CUM[ai] + 0.94 * IN_CUM[ai])); };
const liquidLen = () => clamp(0.09 + 0.08 * (cyc.prail / 1600) - 0.03 * clamp((cyc.T[700] - 800) / 300, 0, 1), 0.06, 0.2);
function dropEmit(){
  const i = drop.next; drop.next = (drop.next + 1) % NDROP;
  drop.on[i] = 1; drop.k[i] = Math.floor(Math.random() * PLUMES.length); drop.s[i] = 0.004;
  drop.jx[i] = rv(0.07); drop.jy[i] = rv(0.07); drop.jz[i] = rv(0.07);
  drop.lim[i] = liquidLen() * (0.75 + Math.random() * 0.5);
  return i;
}
function dropPos(i, out){
  const d = PLUMES[drop.k[i]], s = drop.s[i], sp = s * 1.0;
  return out.set(NOZ.x + (d.x + drop.jx[i]) * sp, NOZ.y + (d.y + drop.jy[i] * 0.6) * sp, Math.min(0, NOZ.z + (d.z + drop.jz[i]) * sp));
}
// une gouttelette évaporée devient une particule de vapeur de gazole dans la charge
function vaporize(i){ dropPos(i, _w); vaporAt(_w); }
function vaporAt(_w){
  const rr = Math.hypot(_w.x, _w.z), phi = Math.atan2(_w.z, _w.x);
  const yb = lpCrown - bowlDepth(rr) + 0.008, yt = Y0 - 0.008;
  if (ch.n < NCH - 5) chSpawn(clamp(rr / BI, 0, 0.98), phi <= 0 ? phi + 2 * Math.PI : Math.max(Math.PI, phi), clamp((_w.y - yb) / Math.max(0.003, yt - yb), 0, 1), true, false);
}
const plumeDist = p => { let m = 9; for (const d of PLUMES){ _n.copy(p).sub(NOZ); const t = clamp(_n.dot(d), 0.02, 0.32); m = Math.min(m, _n.addScaledVector(d, -t).length()); } return m; };
function burnState(a){
  const ai = Math.floor(a) % 720, xb = cyc.xb[ai];
  const on = fuelNow() && xb > 0.002 && (a < EVO || a >= IVC);
  const reach = Math.min(1.15, 1.15 / Math.max(1, cyc.lambda * 0.85));
  return { on, xb, thr: on ? 0.03 + 0.42 * Math.pow(xb, 0.6) * reach : 0 };
}
function lpRebuild(a){
  const ai = Math.floor(a) % 720, fuel = fuelNow();
  ch.on.fill(0); ch.n = 0;
  const N = chTarget(a), full = nFull(), fresh = Math.round(0.94 * full * IN_CUM[ai]);
  const bs = burnState(a);
  const afterMain = fuel && (a >= cyc.soi || a < EVO) && (a >= IVC || a < EVO) && inWin(a, cyc.soi, EVO);
  for (let k = 0; k < N; k++){
    const isVap = afterMain && !bs.on && Math.random() < 0.05;
    const i = chSpawn(Math.sqrt(Math.random()), randPhi(), Math.random(), isVap, false);
    if (i < 0) break;
    const postBurn = fuel && (a < IN_OPEN || (a < 385 && k >= fresh));
    if (postBurn && a >= EVO) ch.burn[i] = 300;
    else if (bs.on){ chWorld(i, _w); if (plumeDist(_w) < bs.thr) ch.burn[i] = 40; }
    else if (a >= IN_OPEN && k < full * 0.05 && fuel) ch.burn[i] = 300;
  }
  for (let i = 0; i < NRUN; i++) run.u[i] = Math.random();
  // vapeur de gazole déjà formée au bout des jets depuis le début de l'injection
  const since = (((a - cyc.soi) % 720) + 720) % 720;
  if (fuel && since < cyc.injDeg + 3 && !bs.on){
    const LL = liquidLen(), pen = Math.min(0.27, LL + 0.04 * since), nV = Math.round(40 + 140 * Math.min(1, since / Math.max(3, cyc.injDeg)) * Math.min(1, cyc.load + 0.2));
    for (let k = 0; k < nV; k++){ const d = PLUMES[Math.floor(Math.random() * PLUMES.length)], sp = LL + Math.random() * Math.max(0.01, pen - LL), j = 0.05 + 0.25 * sp;
      _w.set(NOZ.x + (d.x + rv(j)) * sp, NOZ.y + (d.y + rv(j) * 0.6) * sp, Math.min(0, NOZ.z + (d.z + rv(j)) * sp)); vaporAt(_w); }
  }
  drop.on.fill(0);
  if (mainOn(a) || pilotOn(a)){
    const LL = liquidLen();
    const nD = mainOn(a) ? 220 : 50;
    for (let k = 0; k < nD; k++){ const i = dropEmit(); drop.s[i] = Math.random() * Math.min(LL, drop.lim[i]); }
  }
  exh.on.fill(0);
  const nEx = a >= EVO && a < 420 ? 220 : 60;
  for (let k = 0; k < nEx; k++){ exSpawn(fuel ? 1 : 0); exh.u[(exh.next + NEXH - 1) % NEXH] = Math.random(); }
}
function lpStep(a, dA){
  const ai = Math.floor(a) % 720, fuel = fuelNow();
  const li = lift(a, IN_OPEN, IN_CLOSE), le = lift(a, EX_OPEN, EX_CLOSE);
  const flow = 0.0048 * li * (0.6 + 0.4 * Math.min(1, st.boost));
  for (let i = 0; i < NRUN; i++){ run.u[i] += dA * flow * (run.u[i] > 0.7 ? 1.8 : 1); if (run.u[i] > 1){ run.u[i] -= 1; run.off[i] = rv(1); } }
  // jets de gazole : gouttelettes rapides qui s'évaporent au bout de la longueur liquide
  const injOn = mainOn(a) || pilotOn(a);
  if (injOn){ drop.acc += dA * (pilotOn(a) ? 25 : 70); while (drop.acc >= 1){ drop.acc -= 1; dropEmit(); } }
  const v0 = Math.sqrt(Math.max(100, cyc.prail) / 1600) * 600 / (6 * Math.max(st.rpm, 300)) * 10;   // unités par degré
  for (let i = 0; i < NDROP; i++){
    if (!drop.on[i]) continue;
    drop.s[i] += dA * v0 / (1 + drop.s[i] / 0.025);
    if (drop.s[i] >= drop.lim[i]){ drop.on[i] = 0; if (Math.random() < 0.45) vaporize(i); }
  }
  // charge : tourbillon (swirl) autour de l'axe, effet de chasse au PMH, combustion
  const swirlK = flapOpen() ? 1 : 1.6;
  const sw = (a >= IN_OPEN && a < IVC ? 1.8 * li + 0.3 : a >= IVC || a < 60 ? 0.9 : 0.25) * swirlK * dA * DEG;
  const gap = Y0 - lpCrown;
  const squish = clamp(1 - gap / 0.08, 0, 1);
  const bs = burnState(a);
  const sweep = le > 0.02 ? 0.006 * le * dA * (a < 200 ? 2.5 : 1) : 0;
  for (let i = 0; i < NCH; i++){
    if (!ch.on[i]) continue;
    let r = ch.r[i], phi = ch.phi[i], v = ch.v[i];
    phi += sw * (r < 0.62 ? 1 + squish * 1.2 : 1);
    if (phi > 2 * Math.PI) phi -= Math.PI; else if (phi < Math.PI) phi += Math.PI;
    r += rv(0.012) * Math.sqrt(dA); v += rv(0.02) * Math.sqrt(dA);
    if (squish > 0 && (a >= IVC) && r > 0.6) r -= 0.02 * squish * dA * (r - 0.55);
    if (sweep){ r += sweep * (0.7 - r) * 1.5; v += sweep * (1 - v) * 1.5; }
    ch.r[i] = clamp(Math.abs(r), 0, 0.99); ch.phi[i] = phi; ch.v[i] = clamp(v, 0, 1);
    if (ch.burn[i] >= 0) ch.burn[i] += dA;
    else if (bs.on && (ch.fuel[i] || Math.random() < 0.5)){ chWorld(i, _w); if (plumeDist(_w) < bs.thr * (ch.fuel[i] ? 1.3 : 1)) ch.burn[i] = 0; }
  }
  const target = chTarget(a);
  if (ch.n > target && le > 0.01){
    let excess = ch.n - target;
    for (let pass = 0; pass < 2 && excess > 0; pass++){
      for (let i = 0; i < NCH && excess > 0; i++){
        if (!ch.on[i]) continue;
        if (pass === 0 && !(Math.cos(ch.phi[i]) > 0.2 && ch.v[i] > 0.5)) continue;
        if (pass === 1 && Math.random() > 0.3) continue;
        ch.on[i] = 0; ch.n--; excess--;
        exSpawn(ch.burn[i] >= 0 ? clamp((cyc.T[ai] - 500) / 1200, 0.2, 1) : 0);
      }
    }
  }
  if (ch.n < target && li > 0.01){
    let need = Math.min(target - ch.n, 40);
    while (need-- > 0) chSpawn(0.55 + Math.random() * 0.4, Math.PI + Math.random() * 0.5, 0.75 + Math.random() * 0.25, false, false);
  }
  const exFlow = 0.004 * le * (a < 200 ? 2.6 : 1.2) + 0.0006;
  for (let i = 0; i < NEXH; i++){ if (!exh.on[i]) continue; exh.u[i] += exFlow * dA * (exh.u[i] < 0.3 ? 1.5 : 1); if (exh.u[i] > 1) exh.on[i] = 0; }
}
const cA = new THREE.Color(COL.air), cF = new THREE.Color(COL.fuel), cC = new THREE.Color(COL.comp);
const cW = new THREE.Color(1, 0.95, 0.75), cO = new THREE.Color(1, 0.55, 0.15), cB = new THREE.Color(C('--burnt')), cG = new THREE.Color(0.42, 0.4, 0.38);
const _pc = new THREE.Color();
function setP(k, x, y, z, col, al, sz){ lpPos[k * 3] = x; lpPos[k * 3 + 1] = y; lpPos[k * 3 + 2] = z; lpRGBA[k * 4] = col.r; lpRGBA[k * 4 + 1] = col.g; lpRGBA[k * 4 + 2] = col.b; lpRGBA[k * 4 + 3] = al; lpSize[k] = sz; }
function lpWrite(a){
  const ai = Math.floor(a) % 720, T = cyc.T[ai], li = lift(a, IN_OPEN, IN_CLOSE);
  for (let i = 0; i < NRUN; i++){
    const u = run.u[i]; sampleTab(AIR_TAB, u, _w); tabNormal(AIR_TAB, u, _n);
    const r = u > 0.8 ? 0.06 : 0.085;
    setP(O_RUN + i, _w.x + _n.x * run.off[i] * r, _w.y + _n.y * run.off[i] * r, run.z[i], cA, 0.3 + 0.6 * li, 0.042);
  }
  for (let i = 0; i < NDROP; i++){
    const k = O_DROP + i;
    if (!drop.on[i]){ lpSize[k] = 0; lpRGBA[k * 4 + 3] = 0; continue; }
    dropPos(i, _w);
    const t = drop.s[i] / drop.lim[i];
    _pc.copy(cF).lerp(cW, 0.35 * (1 - t));
    setP(k, _w.x, _w.y, _w.z, _pc, 1 - 0.35 * t, 0.03 + 0.025 * t);
  }
  const heat = clamp((T - 600) / 1600, 0, 1);
  const comp = clamp((T - 330) / 600, 0, 1);
  for (let i = 0; i < NCH; i++){
    const k = O_CH + i;
    if (!ch.on[i]){ lpSize[k] = 0; lpRGBA[k * 4 + 3] = 0; continue; }
    chWorld(i, _w);
    const b = ch.burn[i];
    let al = 0.8, sz = 0.045;
    if (b < 0){ _pc.copy(ch.fuel[i] ? cF : cA); if (!ch.fuel[i]) _pc.lerp(cC, comp * 0.55); else { al = 0.7; sz = 0.05; } }
    else if (b < 14){ _pc.copy(cW).lerp(cO, b / 14); sz = 0.058; al = 1; }
    else { _pc.copy(cG).lerp(cB, Math.min(1, heat * 1.6)).lerp(cO, Math.max(0, heat - 0.5) * 1.6); al = 0.72; }
    setP(k, _w.x, _w.y, _w.z, _pc, al, sz);
  }
  for (let i = 0; i < NEXH; i++){
    const k = O_EX + i;
    if (!exh.on[i]){ lpSize[k] = 0; lpRGBA[k * 4 + 3] = 0; continue; }
    const u = exh.u[i]; sampleTab(EX_TAB, u, _w); tabNormal(EX_TAB, u, _n);
    const r = u < 0.15 ? 0.06 : 0.085;
    _pc.copy(cG).lerp(cO, exh.heat[i] * Math.max(0, 1 - u * 1.3) * (0.4 + 0.6 * cyc.load));
    if (!exh.heat[i]) _pc.copy(cA).multiplyScalar(0.8);
    setP(k, _w.x + _n.x * exh.off[i] * r, _w.y + _n.y * exh.off[i] * r, exh.z[i], _pc, 0.75 * (1 - u * 0.5), 0.05);
  }
  lpGeo.attributes.position.needsUpdate = true; lpGeo.attributes.rgba.needsUpdate = true; lpGeo.attributes.size.needsUpdate = true;
}
let lpCyl = 1, lpPrevTheta = null, lpVisible = true, lpFast = false, lpTime = 0;
function lpPose(a){
  const g = a * DEG, s = pistonS(g);
  lpPiston.position.y = s; lpCrown = s + PTC;
  lpCrank.rotation.z = -g;
  const px = R * Math.sin(g), py = R * Math.cos(g);
  lpRod.position.set(px, py, 0); lpRod.rotation.z = -Math.atan2(-px, s - py);
  VALVES.forEach(vd => {
    const Lf = vd.lmax * lift(a, vd.open, vd.close);
    vd.mv.position.copy(vd.c).y -= Lf;
    vd.spring.scale.y = 0.28 - Lf;
    vd.piv.rotation.z = (a - vd.peak) / 2 * DEG;
  });
  lpFlap.rotation.z = flapBase + (flapOpen() ? 90 : 0) * DEG;
  const fuel = fuelNow();
  const injOn = mainOn(a) || pilotOn(a);
  needle.position.y = Y0 + 0.23 + (injOn ? 0.012 : 0);
  LM.piezo.emissiveIntensity = injOn ? 1.2 : 0;
  hpFuel.material.color.setHex(fuel ? 0xffd34d : 0x8a7a3a);
  const ai = Math.floor(a) % 720, fr = a - Math.floor(a), ai2 = (ai + 1) % 720;
  const xb = cyc.xb[ai] + (cyc.xb[ai2] - cyc.xb[ai]) * fr;
  const T = cyc.T[ai] + (cyc.T[ai2] - cyc.T[ai]) * fr;
  const burning = fuel && xb > 0.002 && xb < 0.995 && (a < EVO || a >= IVC);
  flame.visible = burning;
  if (burning){
    const bot = lpCrown - 0.18, bx = BORE_R;
    flame.position.set(0, (bot + Y0) / 2, -bx / 2); flame.scale.set(bx * 2, Math.max(0.01, Y0 - bot), bx);
    const u = flameMat.uniforms;
    u.uMin.value.set(-bx, bot, -bx); u.uMax.value.set(bx, Y0, 0);
    const d = a < 360 ? a : a - 720;
    const sinceMain = d - cyc.d0, eoiD = cyc.soiDeg + cyc.injDeg;
    const injecting = mainOn(a);
    u.uLen.value = 0.06 + 0.26 * smooth(0, 4, sinceMain);
    u.uLift.value = injecting || sinceMain < 0 ? 0.035 : Math.min(0.3, 0.035 + (d - eoiD) * 0.012);
    u.uW.value = 0.022 + 0.05 * Math.pow(Math.min(1, xb * 1.3), 0.6) * Math.min(1, 2 / Math.max(1, cyc.lambda - 0.5));
    u.uFill.value = smooth(0.15, 0.8, xb) * Math.min(1, 2.2 / Math.max(1, cyc.lambda));
    u.uOut.value = smooth(0.55, 0.95, xb) * Math.min(1, 1.6 / Math.max(1, cyc.lambda)) * 0.6;
    u.uBlue.value = 1 - smooth(0, 5, sinceMain);
    u.uCrown.value = lpCrown; u.uTime.value = lpTime;
    u.uFade.value = (xb > 0.9 ? (0.995 - xb) / 0.095 : 1) * (0.75 + 0.4 * clamp((T - 1100) / 1200, 0, 1));
  }
  flameLight.intensity = burning ? clamp((T - 900) / 1300, 0, 1) * 3 : 0;
  LM.glowTip.emissiveIntensity = st.cold ? 0.85 + 0.15 * Math.sin(lpTime * 2) : 0;
  glowLight.intensity = st.cold ? 1.2 : 0;
  lpGas.position.y = lpCrown; lpGas.scale.y = Math.max(0.004, Y0 - lpCrown);
  bowlGas.position.y = lpCrown;
  const hot = clamp((T - 400) / 1900, 0, 1);
  gasMat.color.copy(cA).lerp(cC, clamp((T - 330) / 600, 0, 1) * 0.5).lerp(cB, Math.min(1, Math.max(0, hot - 0.25) * 2)).lerp(cO, Math.max(0, hot - 0.45) * 1.6);
  gasMat.opacity = 0.06 + 0.2 * hot;
  LM.header.emissiveIntensity = fuel ? clamp(cyc.load * 0.5 - 0.1, 0, 0.4) : LM.header.emissiveIntensity * 0.99;
}
function lpUpdate(dt){
  if (!lpVisible){ lpPrevTheta = null; return; }
  const a = cycleOf(st.theta, lpCyl);
  lpTime += dt * (0.6 + st.rpm * st.playback / 400);
  lpCrown = pistonS(a * DEG) + PTC;
  if (lpPrevTheta === null) lpRebuild(a);
  else {
    let d = st.theta - lpPrevTheta; if (d < -360) d += 720;
    lpFast = d > 45;
    if (d < 0 || d > 45){ lpCrown = pistonS(a * DEG) + PTC; lpRebuild(a); }
    else if (d > 0){
      const n = Math.ceil(d / 2), a0 = cycleOf(lpPrevTheta, lpCyl);
      for (let k = 1; k <= n; k++){ const ak = (a0 + d * k / n) % 720; lpCrown = pistonS(ak * DEG) + PTC; lpStep(ak, d / n); }
    }
  }
  lpPrevTheta = st.theta;
  lpPose(a);
  lpWrite(a);
  lpTurbine.rotation.z -= dt * Math.min(40, st.turboRpm * st.playback / 60 * 2 * Math.PI * 0.02);
}

// Étiquettes de la coupe
const lpLabelsEl = $('#lpLabels');
const lpLabels = [];
const lpLabel = (text, get) => { const el = document.createElement('div'); el.className = 'lbl'; el.textContent = text; lpLabelsEl.appendChild(el); lpLabels.push({ el, get, v: new THREE.Vector3() }); };
lpLabel('Injecteur piézo', v => v.set(0.2, Y0 + 0.75, 0));
lpLabel('Pile piézoélectrique', v => v.set(0.27, Y0 + 0.95, 0));
lpLabel('Nez à 7 trous', v => v.set(0.03, Y0 + 0.1, 0));
lpLabel('Rampe commune', v => v.copy(RAILP).add(new THREE.Vector3(-0.1, 0.18, 0)));
lpLabel('Conduite haute pression', v => v.set(-0.35, Y0 + 1.65, 0));
lpLabel('Bougie de préchauffage', v => v.set(-0.12, Y0 + 0.62, 0));
lpLabel('Volet de turbulence', v => v.copy(flP).add(new THREE.Vector3(0, 0.24, 0)));
lpLabel("Arrivée des gaz EGR", v => v.set(-2.95, Y0 + 2.5, 0));
lpLabel("Répartiteur d'admission", v => v.set(-2.95, Y0 + 1.9, 0));
lpLabel("Soupape d'admission", v => v.copy(VALVES[0].mv.position).add(new THREE.Vector3(-0.45, 0.42, 0)));
lpLabel("Soupape d'échappement", v => v.copy(VALVES[1].mv.position).add(new THREE.Vector3(0.48, 0.5, 0)));
lpLabel("Came d'admission", v => v.copy(VALVES[0].camC).add(new THREE.Vector3(-0.32, 0.12, 0)));
lpLabel("Came d'échappement", v => v.copy(VALVES[1].camC).add(new THREE.Vector3(0.32, 0.12, 0)));
lpLabel('Bol du piston', v => v.set(-0.2, lpCrown - 0.24, 0));
lpLabel('Piston', v => v.set(0, lpPiston.position.y - 0.05, 0));
lpLabel('Segments', v => v.set(0.66, lpPiston.position.y + PTC - 0.14, 0));
lpLabel('Bielle', v => v.copy(lpRod.position).lerp(lpPiston.position, 0.5).add(new THREE.Vector3(0.18, 0, 0)));
lpLabel('Vilebrequin', v => v.set(0, -0.55, 0));
lpLabel('Bloc en fonte', v => v.set(-0.71, 0.95, 0));
lpLabel("Circuit d'eau", v => v.set(-0.7, 1.7, 0));
lpLabel('Turbine du turbo', v => v.copy(TBC).add(new THREE.Vector3(0.1, -0.5, 0)));
function lpUpdateLabels(){
  const W = lpView.clientWidth, H = lpView.clientHeight, show = $('#lpLabelsOn').checked;
  lpLabels.forEach(l => {
    if (!show){ l.el.style.display = 'none'; return; }
    l.get(l.v); l.v.project(lcam);
    if (l.v.z > 1 || Math.abs(l.v.x) > 1.1 || Math.abs(l.v.y) > 1.1){ l.el.style.display = 'none'; return; }
    l.el.style.display = '';
    l.el.style.transform = `translate(${(l.v.x * 0.5 + 0.5) * W}px, ${(-l.v.y * 0.5 + 0.5) * H}px) translate(-50%,-50%)`;
  });
}
function lpResize(){
  const w = lpView.clientWidth, h = lpView.clientHeight;
  if (w < 2 || h < 2) return;
  lr.setSize(w, h, false); lcam.aspect = w / h; lcam.updateProjectionMatrix();
  lpPtsMat.uniforms.uScale.value = lr.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan(lcam.fov * DEG / 2));
}
new ResizeObserver(lpResize).observe(lpView); lpResize();
new IntersectionObserver(e => { lpVisible = e[0].isIntersecting; }).observe(lpView);
function lpRender(dt){
  if (!lpVisible || lpView.clientWidth < 2) return;
  if (lpCamAnim){
    lpCamAnim.t = Math.min(1, lpCamAnim.t + dt * 1.6); const e = 1 - Math.pow(1 - lpCamAnim.t, 3);
    lcam.position.lerpVectors(lpCamAnim.from, lpCamAnim.to, e); lctl.target.lerpVectors(lpCamAnim.tFrom, lpCamAnim.tTo, e);
    if (lpCamAnim.t >= 1) lpCamAnim = null;
  }
  lctl.update();
  lr.render(ls, lcam);
  lpUpdateLabels();
}

// Textes et graphiques de la coupe
const degTxt = d => `${nf.format(Math.abs(d))}° ${d < 0 ? 'avant' : 'après'} le PMH`;
const PHASES = {
  pilot:   ['Pré‑injection', () => `L'injecteur envoie une petite dose de ${nf1.format(cyc.pilotMg)} mg de gazole. Elle s'enflamme en douceur et prépare l'injection principale, ce qui réduit le claquement.`],
  main:    ['Injection principale', () => `L'aiguille se lève : ${nf1.format(cyc.mainMg)} mg de gazole sont pulvérisés à ${nf.format(cyc.prail)} bar par 7 trous, en jets qui s'évaporent dans l'air brûlant. Le gazole ne s'enflamme pas tout de suite : délai de ${nf1.format(cyc.delayDeg)}°.`],
  burn:    ['Combustion', a => `Auto‑inflammation : le gazole s'enflamme tout seul au contact de l'air chaud, sans étincelle. La flamme se développe autour des jets puis remplit le bol du piston. ${nf.format(cyc.xb[Math.floor(a)] * 100)} % du gazole a brûlé, ${nf.format(cyc.p[Math.floor(a)])} bar.`],
  exp:     ['Détente', () => 'Les gaz brûlés poussent le piston vers le bas : c\'est le seul temps qui produit du travail.'],
  blow:    ['Échappement spontané', () => 'La soupape d\'échappement s\'ouvre avant le point mort bas : les gaz encore sous pression partent vers la turbine du turbo.'],
  exh:     ['Échappement', () => 'Le piston remonte et pousse les gaz brûlés vers le collecteur, puis la turbine qui entraîne le compresseur.'],
  overlap: ['Croisement', () => 'Les deux soupapes sont brièvement ouvertes autour du point mort haut.'],
  intake:  ['Admission', () => `Le piston descend et aspire de l'air seul, comprimé par le turbo à ${nf2.format(cyc.pman)} bar. Pas de gazole à ce stade. ${flapOpen() ? 'Volet de turbulence ouvert.' : 'Volet de turbulence fermé : l\'air entre en tournant (swirl).'}`],
  comp:    ['Compression', a => `Soupapes fermées, l'air est comprimé environ 17 fois et chauffe à ${nf.format(cyc.T[Math.floor(a)] - 273)} °C, assez pour enflammer le gazole.`],
};
function lpUI(){
  const a = cycleOf(st.theta, lpCyl), ai = Math.floor(a) % 720;
  const fuel = fuelNow();
  $('#lpTitleCyl').textContent = lpCyl;
  $('#lpCylLbl').textContent = `Cylindre n° ${lpCyl} · combustion à ${FIRE[lpCyl]}° du cycle moteur`;
  const ph = phaseOf(a), [name, desc] = PHASES[ph];
  $('#lpPhase').textContent = name;
  const d = a < 360 ? a : a - 720;
  $('#lpAngle').textContent = `Cycle ${nf.format(a)}° / 720 · ${Math.round(d) === 0 ? 'au PMH combustion' : nf.format(Math.abs(d)) + '° ' + (d < 0 ? 'avant' : 'après') + ' le PMH combustion'}`;
  let txt = desc(a);
  if (!fuel && st.rpm > 1 && st.cut) txt += st.limCut ? ' Régime maxi : injection coupée.' : st.vCut ? ' Vitesse maxi : injection coupée.' : ' Pied levé au‑dessus du ralenti : le calculateur coupe l\'injection, rien ne brûle.';
  if (st.cold && (ph === 'comp' || ph === 'main' || ph === 'pilot')) txt += ' Moteur froid : la bougie de préchauffage chauffe la chambre et le délai d\'inflammation s\'allonge.';
  $('#lpDesc').textContent = txt;
  $('#lpHint').hidden = !lpFast;
  $('#lpHint').textContent = 'Trop rapide pour suivre les gaz : baissez la vitesse de lecture ou mettez en pause.';
  const on = (id, v) => $(id).classList.toggle('on', !!v);
  on('#evIn', lift(a, IN_OPEN, IN_CLOSE) > 0.01);
  on('#evEx', lift(a, EX_OPEN, EX_CLOSE) > 0.01);
  on('#evPilot', pilotOn(a));
  on('#evInj', mainOn(a));
  on('#evGlow', st.cold);
  const set = setHTML;
  set('lpP', `${nf1.format(cyc.p[ai])}<small>bar</small>`);
  set('lpT', `${nf.format(cyc.T[ai] - 273)}<small>°C</small>`);
  set('lpV', `${nf.format(VOL[ai])}<small>cm³</small>`);
  set('lpXb', `${nf.format(cyc.xb[ai] * 100)}<small>%</small>`);
  set('lpLift', `${nf1.format(8.5 * lift(a, IN_OPEN, IN_CLOSE))} / ${nf1.format(8.5 * lift(a, EX_OPEN, EX_CLOSE))}<small>mm</small>`);
  set('lpPman', `${nf2.format(cyc.pman)}<small>bar abs.</small>`);
  set('lpAir', `${nf.format(cyc.airMg)}<small>mg</small>`);
  set('lpFuel', fuel ? `${nf1.format(cyc.fuelMg)}<small>mg</small>` : 'coupé');
  set('lpLambda', fuel ? `λ ${nf1.format(cyc.lambda)}<small> · ${nf.format(14.5 * cyc.lambda)} : 1</small>` : '–');
  set('lpRail', `${nf.format(cyc.prail)}<small>bar</small>`);
  set('lpSoi', fuel ? `${nf1.format(-cyc.soiDeg)}<small>° av. PMH</small>` : '–');
  set('lpDelay', fuel ? `${nf1.format(cyc.delayDeg)}<small>° · ${nf2.format(cyc.delayMs)} ms</small>` : '–');
}
function drawPChart(){
  const { ctx, w, h } = fitCanvas($('#pchart'));
  if (w < 30 || h < 30) return;
  const pad = { l: 30, r: 8, t: 8, b: 34 };
  const a = cycleOf(st.theta, lpCyl);
  let pm = 10; for (let i = 0; i < 720; i++) pm = Math.max(pm, cyc.p[i]);
  pm = Math.ceil(pm / 40) * 40;
  const X = d => pad.l + (w - pad.l - pad.r) * d / 720, Y = p => h - pad.b - (h - pad.t - pad.b) * p / pm;
  ctx.clearRect(0, 0, w, h);
  ctx.font = '10px "IBM Plex Mono", monospace'; ctx.textBaseline = 'middle';
  ctx.strokeStyle = COL.line; ctx.lineWidth = 1; ctx.fillStyle = COL.muted; ctx.textAlign = 'right';
  for (let k = 0; k <= 4; k++){ const p = pm * k / 4, y = Y(p); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke(); ctx.fillText(nf.format(p), pad.l - 4, y); }
  ctx.textAlign = 'center';
  [0, 180, 360, 540, 720].forEach(d => ctx.fillText(d % 360 === 0 ? 'PMH' : 'PMB', X(d), h - 6));
  const band = (s, e, y, col) => {
    ctx.fillStyle = col;
    const seg = (x0, x1) => ctx.fillRect(X(x0), y, Math.max(2, X(x1) - X(x0)), 5);
    const dur = Math.max(0.5, ((e - s) % 720 + 720) % 720); if (s + dur <= 720) seg(s, s + dur); else { seg(s, 720); seg(0, s + dur - 720); }
  };
  const yb = h - pad.b + 4;
  band(IN_OPEN, IN_CLOSE, yb, COL.air); band(EX_OPEN, EX_CLOSE, yb + 7, COL.exh);
  if (fuelNow()){
    band(cyc.soi, cyc.eoi, yb + 14, COL.fuel);
    if (cyc.pilotMg > 0) band(cyc.pSoi, cyc.pEoi, yb + 14, COL.fuel);
    ctx.strokeStyle = COL.amber; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(X(cyc.d0A), pad.t); ctx.lineTo(X(cyc.d0A), h - pad.b); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.strokeStyle = COL.amber; ctx.lineWidth = 2; ctx.beginPath();
  for (let d = 0; d < 720; d += 2){ const x = X(d), y = Y(cyc.p[d]); d ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke();
  ctx.strokeStyle = COL.fg; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(a), pad.t); ctx.lineTo(X(a), h - pad.b); ctx.stroke();
  ctx.fillStyle = COL.fg; ctx.beginPath(); ctx.arc(X(a), Y(cyc.p[Math.floor(a) % 720]), 4, 0, Math.PI * 2); ctx.fill();
  ctx.textAlign = 'left'; ctx.fillStyle = COL.muted; ctx.fillText('bar', 2, pad.t + 2);
}
function drawPV(){
  const { ctx, w, h } = fitCanvas($('#pvchart'));
  if (w < 30 || h < 30) return;
  const pad = { l: 30, r: 10, t: 8, b: 22 };
  let pm = 10; for (let i = 0; i < 720; i++) pm = Math.max(pm, cyc.p[i]);
  const lmin = Math.log(0.5), lmax = Math.log(pm * 1.3);
  const X = v => pad.l + (w - pad.l - pad.r) * v / 560, Y = p => h - pad.b - (h - pad.t - pad.b) * (Math.log(Math.max(p, 0.5)) - lmin) / (lmax - lmin);
  ctx.clearRect(0, 0, w, h);
  ctx.font = '10px "IBM Plex Mono", monospace'; ctx.textBaseline = 'middle';
  ctx.strokeStyle = COL.line; ctx.lineWidth = 1; ctx.fillStyle = COL.muted; ctx.textAlign = 'right';
  [1, 2, 5, 10, 20, 50, 100, 200].filter(p => p < pm * 1.3).forEach(p => { const y = Y(p); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke(); ctx.fillText(p, pad.l - 4, y); });
  ctx.textAlign = 'center';
  [0, 100, 200, 300, 400, 500].forEach(v => ctx.fillText(v, X(v), h - 8));
  const seg = (a0, a1, col) => { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); for (let d = a0; d <= a1; d++){ const k = d % 720, x = X(VOL[k]), y = Y(cyc.p[k]); d === a0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); };
  seg(EX_CLOSE, IVC, COL.air); seg(IVC, 720, COL.comp); seg(0, EVO, COL.amber); seg(EVO, EX_CLOSE, COL.exh);
  const a = Math.floor(cycleOf(st.theta, lpCyl)) % 720;
  ctx.fillStyle = COL.fg; ctx.beginPath(); ctx.arc(X(VOL[a]), Y(cyc.p[a]), 4, 0, Math.PI * 2); ctx.fill();
  ctx.textAlign = 'left'; ctx.fillStyle = COL.muted; ctx.fillText('bar (log) · cm³', pad.l + 4, pad.t + 4);
}

// Commandes de la coupe
$('#lpCyl').addEventListener('change', e => { lpCyl = +e.target.value; lpPrevTheta = null; });
document.querySelectorAll('[data-lpview]').forEach(b => b.addEventListener('click', () => {
  const v = LP_VIEWS[b.dataset.lpview];
  lpCamAnim = { from: lcam.position.clone(), to: new THREE.Vector3(...v.pos), tFrom: lctl.target.clone(), tTo: new THREE.Vector3(...v.tgt), t: 0 };
}));
function setPaused(p){
  st.paused = p;
  $('#pauseBtn').textContent = p ? 'Reprendre' : 'Pause'; $('#pauseBtn').classList.toggle('on', p);
  $('#lpPlay').textContent = p ? 'Lecture' : 'Pause'; $('#lpPlay').classList.toggle('on', p);
  const an = $('#angle'); an.disabled = !p; an.value = Math.round(st.theta);
}
$('#lpPlay').addEventListener('click', () => setPaused(!st.paused));
document.querySelectorAll('[data-jump]').forEach(b => b.addEventListener('click', () => {
  const j = b.dataset.jump;
  const tgt = { intake: 450, comp: 640, pilot: cyc.pSoi + 0.5, main: cyc.soi + Math.min(1, cyc.injDeg * 0.5),
    burn: (cyc.d0A + Math.max(4, cyc.injDeg * 0.6)) % 720, exp: 95, exh: 260 }[j];
  setPaused(true);
  st.theta = ((FIRE[lpCyl] + tgt) % 720 + 720) % 720;
  lpPrevTheta = null;
}));
document.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => {
  setPaused(true);
  st.theta = (st.theta + +b.dataset.step) % 720;
}));

// ------------------------------------------------------------------
// Boucle
// ------------------------------------------------------------------
let last = performance.now(), uiT = 0, firingCyl = null;
function setHTML(id, html){ const el = document.getElementById(id); if (el && el._v !== html){ el.innerHTML = html; el._v = html; } }
function updateUI(){
  setHTML('hudRpm', nf.format(Math.round(st.rpm / 10) * 10));
  setHTML('hudHp', `${nf.format(st.power)}<small>ch</small>`);
  setHTML('hudNm', `${nf.format(st.torque)}<small>N·m</small>`);
  setHTML('hudBoost', `+${nf2.format(st.boost)}<small>bar</small>`);
  const kmh = Math.abs(st.v) * 3.6;
  const gearTxt = st.sel === 'P' || st.sel === 'N' || st.sel === 'R' ? st.sel : st.sel + st.gear;
  setHTML('gearBig', gearTxt); setHTML('hudGear', gearTxt);
  setHTML('gearSub', ['D', 'S', 'M'].includes(st.sel) ? `${SEL_NAMES[st.sel]} · ${st.gear}${st.gear === 1 ? 're' : 'e'}` : SEL_NAMES[st.sel]);
  document.querySelectorAll('[data-sel]').forEach(b => b.classList.toggle('on', b.dataset.sel === st.sel));
  setHTML('hudKmh', `${nf.format(kmh)}<small>km/h</small>`);
  setHTML('limitMsg', st.vCut && isFinite(CAR.vmax) ? `Bridage électronique à ${nf.format(CAR.vmax * 3.6)} km/h : le calculateur coupe l'injection.`
    : st.limCut ? 'Régime maxi : le calculateur coupe l\'injection.' : '');
  setHTML('roKmh', `${nf.format(kmh)}<small>km/h</small>`);
  setHTML('roConv', st.conv === 'lock' ? 'Ponté' : st.conv === 'slip' ? (st.v < 0.5 && st.sel !== 'N' ? 'Glisse · calage' : 'Glisse') : 'Libre');
  setHTML('roAccel', `${nf1.format(st.accel)}<small>g</small>`);
  setHTML('ro0100', st.t0100 ? `${nf1.format(st.t0100)}<small>s</small>` : (st.t0 > 0 ? `${nf1.format((st.simT * 1000 - st.t0) / 1000)}<small>s…</small>` : '–'));
  setHTML('pedalOut', `${Math.round(st.pedal * 100)}<small>%</small>`);
  setHTML('fuelOut', `${Math.round(st.load * 100)}<small>%</small>`);
  $('#pedalBar').style.width = st.pedal * 100 + '%';
  $('#fuelBar').style.width = st.load * 100 + '%';
  setHTML('badgeAngle', `${Math.round(st.theta)}°`);
  setHTML('roBoost', `+${nf2.format(st.boost)}<small>bar</small>`);
  setHTML('roRail', `${nf.format(cyc.prail)}<small>bar</small>`);
  setHTML('roFuel', fuelNow() ? `${nf1.format(cyc.fuelMg)}<small>mg</small>` : 'coupé');
  setHTML('roLambda', fuelNow() ? `λ ${nf1.format(cyc.lambda)}` : '–');
  setHTML('roPmax', `${nf.format(st.pmax)}<small>bar</small>`);
  setHTML('roVp', `${nf1.format(2 * SPEC.stroke / 1000 * st.rpm / 60)}<small>m/s</small>`);
  setHTML('roFire', firingCyl ? `n° ${firingCyl.n}` : '–');
  setHTML('roTurbo', `≈ ${nf.format(Math.round(st.turboRpm / 5000) * 5)} 000<small>tr/min</small>`);
  if (st.paused) $('#angle').value = Math.round(st.theta);
  setHTML('angleOut', `${Math.round(st.theta)}<small>°</small>`);
  lpUI();
}
function drawGears(){
  const { ctx, w, h } = fitCanvas($('#gears'));
  if (w < 30 || h < 30) return;
  const pad = { l: 30, r: 8, t: 8, b: 18 }, vmax = 260, rmax = 5000;
  const X = k => pad.l + (w - pad.l - pad.r) * k / vmax, Y = r => h - pad.b - (h - pad.t - pad.b) * r / rmax;
  ctx.clearRect(0, 0, w, h);
  ctx.font = '10px "IBM Plex Mono", monospace'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(239,68,68,.12)'; ctx.fillRect(pad.l, Y(rmax), w - pad.l - pad.r, Y(SPEC.redline) - Y(rmax));
  ctx.strokeStyle = COL.line; ctx.lineWidth = 1; ctx.fillStyle = COL.muted; ctx.textAlign = 'right';
  [0, 2000, 4000].forEach(r => { ctx.beginPath(); ctx.moveTo(pad.l, Y(r)); ctx.lineTo(w - pad.r, Y(r)); ctx.stroke(); ctx.fillText(r / 1000 + 'k', pad.l - 4, Y(r)); });
  ctx.textAlign = 'center';
  [0, 100, 200].forEach(k => ctx.fillText(k, X(k), h - 6));
  const perKmh = g => CAR.ratios[g] * CAR.fd / CAR.r * 60 / (2 * Math.PI) / 3.6;
  for (let g = 1; g <= NG; g++){
    const cur = g === st.gear && ['D', 'S', 'M'].includes(st.sel);
    ctx.strokeStyle = cur ? COL.amber : COL.dim; ctx.lineWidth = cur ? 2 : 1;
    const kEnd = Math.min(vmax, rmax / perKmh(g));
    ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(kEnd), Y(kEnd * perKmh(g))); ctx.stroke();
    const kl = Math.min(vmax - 8, SPEC.redline / perKmh(g));
    ctx.fillStyle = cur ? COL.amber : COL.muted; ctx.fillText(g, X(kl), Y(SPEC.redline) - 7);
  }
  if (isFinite(CAR.vmax)){ const xv = X(CAR.vmax * 3.6); ctx.strokeStyle = COL.muted; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(xv, pad.t); ctx.lineTo(xv, h - pad.b); ctx.stroke(); ctx.setLineDash([]); }
  ctx.fillStyle = COL.fg; ctx.beginPath(); ctx.arc(X(Math.min(vmax, Math.abs(st.v) * 3.6)), Y(Math.min(rmax, st.rpm)), 4, 0, Math.PI * 2); ctx.fill();
  ctx.textAlign = 'left'; ctx.fillStyle = COL.muted; ctx.fillText('tr/min · km/h', pad.l + 4, pad.t + 4);
}
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let frameErr = 0;
function frame(now){
  requestAnimationFrame(frame);   // on reprogramme d'abord : une erreur ne doit jamais figer la page
  try { step(now); }
  catch (e){ if (frameErr++ < 3) console.error(e); }
}
function step(now){
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  updateEngine(dt);
  updateAudio();
  const th0 = st.theta;
  if (!st.paused) st.theta = (st.theta + st.rpm * st.playback / 60 * 360 * dt) % 720;
  let dA = st.theta - th0; if (dA < -360) dA += 720;
  pose(st.theta);
  updateFlow(dA);
  const spin = reduceMotion ? 0 : dt * Math.min(40, st.turboRpm * st.playback / 60 * 2 * Math.PI * 0.02);
  turbine.rotation.z -= spin; compWheel.rotation.z -= spin;
  lpUpdate(dt);
  if (camAnim){
    camAnim.t = Math.min(1, camAnim.t + dt * 1.6); const e = 1 - Math.pow(1 - camAnim.t, 3);
    camera.position.lerpVectors(camAnim.from, camAnim.to, e); controls.target.lerpVectors(camAnim.tFrom, camAnim.tTo, e);
    if (camAnim.t >= 1) camAnim = null;
  }
  controls.update();
  const shown = viewport.offsetParent !== null && viewport.clientWidth > 1;
  if (shown) renderer.render(scene, camera);
  firingCyl = shown ? updateLabels() : firingCyl;
  if (hl) hl.mats.forEach(m => { m.emissiveIntensity = 0.22 + 0.18 * Math.sin(now / 180); });
  lpRender(dt);
  if (shown) drawTach();
  drawChrono();
  uiT += dt;
  if (uiT > 0.08){ uiT = 0; computeCycle(); updateUI(); drawCurve(); drawGears(); if (lpVisible){ drawPChart(); drawPV(); } }
}

// ------------------------------------------------------------------
// Onglets de la fiche
// ------------------------------------------------------------------
const TABS = ['presentation', 'fonctionnement', 'pieces'];
const stageEl = document.querySelector('.stage');
function showTab(t, fromHash){
  if (!TABS.includes(t)) t = 'presentation';
  TABS.forEach(k => {
    $('#tab-' + k).hidden = k !== t;
    const b = $('#t-' + k); b.setAttribute('aria-selected', String(k === t)); b.tabIndex = k === t ? 0 : -1;
  });
  if (t === 'pieces') $('#viewerSlot').appendChild(viewport);
  else { if (viewport.parentElement !== stageEl) stageEl.prepend(viewport); clearIsolation(); }
  if (!fromHash){ try { history.replaceState(null, '', '#' + t); } catch (e) {} }
}
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
$('.tabs').addEventListener('keydown', e => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const cur = TABS.findIndex(k => $('#t-' + k).getAttribute('aria-selected') === 'true');
  const nxt = TABS[(cur + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
  showTab(nxt); $('#t-' + nxt).focus();
});
document.querySelectorAll('[data-goto]').forEach(a => a.addEventListener('click', e => {
  e.preventDefault(); showTab(a.dataset.goto);
  if (a.dataset.piece){ const i = PARTS.pieces.findIndex(x => x.nom === a.dataset.piece); if (i >= 0) selectPart(i, true); }
  window.scrollTo({ top: $('.tabs').getBoundingClientRect().top + window.scrollY - 70 });
}));
window.addEventListener('hashchange', () => showTab(location.hash.slice(1), true));

// ------------------------------------------------------------------
// Pièces et références
// ------------------------------------------------------------------
const PARTS = (window.BIBLE && window.BIBLE.pieces && window.BIBLE.pieces.m57) || { groupes: [], pieces: [] };
const ST_LABEL = { verifiee: 'Vérifiée RealOEM', recoupee: 'Recoupée', 'a-confirmer': 'À confirmer', 'a-renseigner': 'À renseigner' };
const fmtRef = r => r.length === 11 ? `${r.slice(0, 2)} ${r.slice(2, 4)} ${r.slice(4, 5)} ${r.slice(5, 8)} ${r.slice(8)}` : r;
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const VIS = {
  rods:       { layers: ['rods', 'crank', 'pistons'], mats: ['forged'], lieu: 'entre le vilebrequin et les pistons' },
  crank:      { layers: ['crank', 'rods'], mats: ['steel'], lieu: 'au fond du carter, sur sept paliers' },
  pistons:    { layers: ['pistons', 'rods', 'liners'], mats: ['alu', 'crown'], lieu: 'dans les cylindres' },
  heads:      { layers: ['heads', 'valvetrain', 'pistons'], mats: ['head', 'cover'], lieu: 'sur la culasse, au sommet du moteur' },
  valvetrain: { layers: ['valvetrain', 'heads'], mats: ['cam', 'valve'], lieu: 'distribution : arbres à cames et soupapes, en haut du moteur' },
  manifolds:  { layers: ['manifolds', 'heads'], mats: ['runner', 'plenum', 'flap', 'egr'], lieu: "côté admission, à gauche du moteur" },
  turbo:      { layers: ['turbo', 'heads'], mats: ['turbo', 'comp', 'header'], lieu: "côté échappement, à droite du moteur" },
  glow:       { layers: ['heads', 'pistons'], mats: ['glow', 'glowTip'], lieu: 'dans la culasse, une par cylindre, côté admission' },
  rail:       { layers: ['rail', 'heads'], mats: ['rail'], lieu: 'au-dessus de la culasse, côté admission, reliée à chaque injecteur' },
  inj:        { layers: ['rail', 'heads', 'pistons'], mats: ['injector'], lieu: 'au centre de chaque cylindre, à travers la culasse' },
  pump:       { layers: ['rail', 'block'], mats: ['pump'], lieu: 'entraînée par le moteur, elle alimente la rampe (position simplifiée)' },
  block:      { layers: ['block', 'crank', 'pistons'], mats: ['block'], lieu: 'sur le bloc moteur' },
};
(() => {
  const counts = {}; PARTS.pieces.forEach(p => counts[p.statut] = (counts[p.statut] || 0) + 1);
  $('#stLegend').innerHTML = Object.keys(ST_LABEL).map(k => `<span class="chip-st st-${k}">${ST_LABEL[k]} · ${counts[k] || 0}</span>`).join('');
  $('#pGroup').innerHTML = '<option value="">Tous les groupes</option>' + PARTS.groupes.map(g => `<option value="${g.id}">${g.id} · ${esc(g.nom)}</option>`).join('');
})();
let selPart = -1;
function renderParts(){
  const q = $('#pSearch').value.trim().toLowerCase().replace(/\s+/g, ''), g = $('#pGroup').value, stt = $('#pStatut').value;
  let html = '', lastSub = '';
  PARTS.pieces.forEach((p, i) => {
    if (g && p.groupe !== g) return;
    if (stt && p.statut !== stt) return;
    if (q && !(p.nom.toLowerCase().replace(/\s+/g, '').includes(q) || p.refs.some(r => r.ref.includes(q)) || p.sousGroupe.toLowerCase().replace(/\s+/g, '').includes(q))) return;
    const sub = `${p.groupe} · ${p.sousGroupe}`;
    if (sub !== lastSub){ html += `<div class="pgroup">${esc(sub)}</div>`; lastSub = sub; }
    const refs = p.refs.length ? p.refs.map(r => `<div class="refrow"><span class="refno">${fmtRef(r.ref)}</span><span class="refrole">${esc(r.role || '')}</span>
        <button class="btn mini" data-copy="${r.ref}">Copier</button>
        <a class="btn mini" href="https://www.realoem.com/bmw/enUS/partxref?q=${r.ref}" target="_blank" rel="noopener">RealOEM ↗</a></div>`).join('')
      : '<div class="empty">Référence à relever sur RealOEM.</div>';
    const src = p.sources.length ? `<details><summary>Sources (${p.sources.length})</summary><ul>${p.sources.map(x => `<li><a href="${x.url}" target="_blank" rel="noopener">${esc(x.nom)}</a></li>`).join('')}</ul></details>` : '';
    html += `<article class="part${i === selPart ? ' sel' : ''}" data-i="${i}">
      <div class="part-h"><h3>${esc(p.nom)}</h3><span class="qte">${p.qte ? 'Qté ' + esc(p.qte) : ''}</span><span class="chip-st st-${p.statut}">${ST_LABEL[p.statut]}</span></div>
      <div class="refs">${refs}</div>
      ${p.note ? `<p class="note">${esc(p.note)}</p>` : ''}
      <div class="row2">${p.vis ? `<button class="btn mini" data-show="${i}">Situer en 3D</button>` : ''}${src}</div>
    </article>`;
  });
  $('#pList').innerHTML = html || '<p class="hint">Aucune pièce ne correspond à cette recherche.</p>';
}
['input', 'change'].forEach(ev => { $('#pSearch').addEventListener(ev, renderParts); });
$('#pGroup').addEventListener('change', renderParts); $('#pStatut').addEventListener('change', renderParts);
$('#pList').addEventListener('click', e => {
  const c = e.target.closest('[data-copy]');
  if (c){
    const ref = c.dataset.copy;
    const done = () => { c.textContent = 'Copiée'; setTimeout(() => c.textContent = 'Copier', 1500); };
    try { navigator.clipboard.writeText(ref).then(done, () => { c.textContent = ref; }); } catch (err) { c.textContent = ref; }
    return;
  }
  const sb = e.target.closest('[data-show]'); if (sb) selectPart(+sb.dataset.show);
});
let savedLayers = null, hl = null;
function selectPart(i, scroll){
  selPart = i; const p = PARTS.pieces[i]; const v = VIS[p.vis];
  renderParts();
  if (!v) return;
  if (!savedLayers){ savedLayers = {}; document.querySelectorAll('input[data-layer]').forEach(cb => savedLayers[cb.dataset.layer] = cb.checked); }
  document.querySelector('[data-preset=xray]').click();
  document.querySelectorAll('input[data-layer]').forEach(cb => {
    const k = cb.dataset.layer; cb.checked = k === 'labels' || k === 'block' || v.layers.includes(k); cb.dispatchEvent(new Event('change'));
  });
  if (hl) hl.mats.forEach(m => { m.emissive.setHex(hl.base.get(m)); m.emissiveIntensity = hl.int.get(m); });
  const mats = v.mats.map(k => M[k]).filter(Boolean);
  hl = { mats, base: new Map(mats.map(m => [m, m.emissive.getHex()])), int: new Map(mats.map(m => [m, m.emissiveIntensity])) };
  mats.forEach(m => m.emissive.setHex(0xf5a524));
  $('#viewerCap').innerHTML = `<b>${esc(p.nom)}</b> · ${v.lieu}. Qté ${esc(p.qte || '–')}.`;
  if (scroll){ const el = document.querySelector(`.part[data-i="${i}"]`); if (el) el.scrollIntoView({ block: 'center' }); }
}
function clearIsolation(){
  if (hl){ hl.mats.forEach(m => { m.emissive.setHex(hl.base.get(m)); m.emissiveIntensity = hl.int.get(m); }); hl = null; }
  if (savedLayers){
    document.querySelectorAll('input[data-layer]').forEach(cb => { cb.checked = !!savedLayers[cb.dataset.layer]; cb.dispatchEvent(new Event('change')); });
    savedLayers = null;
  }
}
renderParts();
applyVer('tu2');
showTab(location.hash.slice(1), true);
computeCycle();
requestAnimationFrame(frame);
})();
