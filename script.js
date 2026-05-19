/* ══════════════════════════════════════════════
   SOMA — 3D Human Body Viewer
   Three.js r128 · No build tools required
══════════════════════════════════════════════ */

'use strict';

// ── Scene setup ──────────────────────────────
const wrap   = document.getElementById('canvas-wrap');
const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 1.2, 4.5);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
wrap.appendChild(renderer.domElement);

function resize() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener('resize', resize);

// ── Fog & background ─────────────────────────
scene.background = null;
scene.fog = new THREE.FogExp2(0x060a10, 0.06);

// ── Lights ────────────────────────────────────
const ambient = new THREE.AmbientLight(0x0d2040, 1.2);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0x00d4ff, 1.8);
keyLight.position.set(3, 5, 3);
keyLight.castShadow = true;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x0044ff, 0.6);
fillLight.position.set(-3, 2, -2);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0x00ffaa, 0.4);
rimLight.position.set(0, -3, -3);
scene.add(rimLight);

// ── Orbit controls (manual, no import needed) ─
const controls = (() => {
  let isDragging = false, prevX = 0, prevY = 0;
  let rotX = 0, rotY = 0;
  let targetRotX = 0, targetRotY = 0;
  let zoom = 4.5, targetZoom = 4.5;
  let lastTouchDist = null;

  const el = renderer.domElement;

  el.addEventListener('mousedown',  e => { isDragging = true; prevX = e.clientX; prevY = e.clientY; });
  window.addEventListener('mouseup',   () => isDragging = false);
  window.addEventListener('mousemove', e => {
    if (!isDragging) return;
    targetRotY += (e.clientX - prevX) * 0.005;
    targetRotX += (e.clientY - prevY) * 0.005;
    targetRotX = Math.max(-1.2, Math.min(1.2, targetRotX));
    prevX = e.clientX; prevY = e.clientY;
  });

  el.addEventListener('wheel', e => {
    e.preventDefault();
    targetZoom += e.deltaY * 0.005;
    targetZoom = Math.max(2, Math.min(9, targetZoom));
  }, { passive: false });

  // Touch
  el.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      isDragging = true;
      prevX = e.touches[0].clientX;
      prevY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      lastTouchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  });
  el.addEventListener('touchend', () => { isDragging = false; lastTouchDist = null; });
  el.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 1 && isDragging) {
      targetRotY += (e.touches[0].clientX - prevX) * 0.007;
      targetRotX += (e.touches[0].clientY - prevY) * 0.007;
      targetRotX = Math.max(-1.2, Math.min(1.2, targetRotX));
      prevX = e.touches[0].clientX;
      prevY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (lastTouchDist) {
        targetZoom -= (dist - lastTouchDist) * 0.02;
        targetZoom = Math.max(2, Math.min(9, targetZoom));
      }
      lastTouchDist = dist;
    }
  }, { passive: false });

  return {
    update() {
      rotX += (targetRotX - rotX) * 0.1;
      rotY += (targetRotY - rotY) * 0.1;
      zoom += (targetZoom - zoom) * 0.1;
      camera.position.x = Math.sin(rotY) * Math.cos(rotX) * zoom;
      camera.position.y = Math.sin(rotX) * zoom + 1.2;
      camera.position.z = Math.cos(rotY) * Math.cos(rotX) * zoom;
      camera.lookAt(0, 1.2, 0);
    },
    addRotY(v) { targetRotY += v; }
  };
})();

// ── Materials ─────────────────────────────────
const matBody = new THREE.MeshPhongMaterial({
  color: 0x8899aa,
  specular: 0x336688,
  shininess: 60,
  transparent: false,
  opacity: 1,
});

const matBodyXray = new THREE.MeshPhongMaterial({
  color: 0x0077aa,
  specular: 0x00ddff,
  shininess: 100,
  transparent: true,
  opacity: 0.18,
  side: THREE.DoubleSide,
  depthWrite: false,
});

const matSkeleton = new THREE.MeshPhongMaterial({
  color: 0xddeeff,
  specular: 0xffffff,
  shininess: 120,
  emissive: 0x112233,
});

const matOrgan = (hex, emissive) => new THREE.MeshPhongMaterial({
  color: hex,
  specular: 0xffffff,
  shininess: 80,
  emissive: emissive || 0x000000,
  transparent: true,
  opacity: .92,
});

const matNervous = new THREE.MeshPhongMaterial({
  color: 0xffff44,
  emissive: 0x444400,
  shininess: 200,
  transparent: true,
  opacity: 0.85,
});

// ── Body group ────────────────────────────────
const bodyGroup = new THREE.Group();
scene.add(bodyGroup);

const layers = {
  body:     new THREE.Group(),
  skeleton: new THREE.Group(),
  organs:   new THREE.Group(),
  nervous:  new THREE.Group(),
};

Object.values(layers).forEach(g => bodyGroup.add(g));

// ── Helper ────────────────────────────────────
function addMesh(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  (parent || layers.body).add(m);
  return m;
}

// ── Musculature ───────────────────────────────
// Torso
addMesh(new THREE.CylinderGeometry(.38, .32, 1.4, 14), matBody, 0, 1.25, 0);
addMesh(new THREE.SphereGeometry(.42, 14, 10), matBody, 0, 1.7, 0);
addMesh(new THREE.CylinderGeometry(.30, .34, .5, 12), matBody, 0, .65, 0);
// Pelvis
addMesh(new THREE.CylinderGeometry(.35, .28, .35, 12), matBody, 0, .3, 0);
// Head & neck
addMesh(new THREE.SphereGeometry(.22, 16, 12), matBody, 0, 2.42, 0);
addMesh(new THREE.CylinderGeometry(.1, .12, .25, 10), matBody, 0, 2.15, 0);
// Shoulders
addMesh(new THREE.SphereGeometry(.17, 12, 10), matBody, -.52, 1.92, 0);
addMesh(new THREE.SphereGeometry(.17, 12, 10), matBody,  .52, 1.92, 0);
// Upper arms
addMesh(new THREE.CylinderGeometry(.10, .09, .55, 10), matBody, -.58, 1.58, 0,  .10);
addMesh(new THREE.CylinderGeometry(.10, .09, .55, 10), matBody,  .58, 1.58, 0, -.10);
// Elbows
addMesh(new THREE.SphereGeometry(.10, 10, 8), matBody, -.60, 1.26, 0);
addMesh(new THREE.SphereGeometry(.10, 10, 8), matBody,  .60, 1.26, 0);
// Forearms
addMesh(new THREE.CylinderGeometry(.08, .065, .50, 10), matBody, -.62, .97, 0, -.05);
addMesh(new THREE.CylinderGeometry(.08, .065, .50, 10), matBody,  .62, .97, 0,  .05);
// Hands
addMesh(new THREE.BoxGeometry(.10, .14, .06), matBody, -.63, .67, 0);
addMesh(new THREE.BoxGeometry(.10, .14, .06), matBody,  .63, .67, 0);
// Hip joints
addMesh(new THREE.SphereGeometry(.14, 12, 8), matBody, -.22, .10, 0);
addMesh(new THREE.SphereGeometry(.14, 12, 8), matBody,  .22, .10, 0);
// Upper legs
addMesh(new THREE.CylinderGeometry(.13, .11, .65, 12), matBody, -.22, -.28, 0);
addMesh(new THREE.CylinderGeometry(.13, .11, .65, 12), matBody,  .22, -.28, 0);
// Knees
addMesh(new THREE.SphereGeometry(.11, 10, 8), matBody, -.22, -.63, 0);
addMesh(new THREE.SphereGeometry(.11, 10, 8), matBody,  .22, -.63, 0);
// Lower legs
addMesh(new THREE.CylinderGeometry(.09, .07, .62, 10), matBody, -.22, -.98, 0);
addMesh(new THREE.CylinderGeometry(.09, .07, .62, 10), matBody,  .22, -.98, 0);
// Feet
addMesh(new THREE.BoxGeometry(.13, .10, .22), matBody, -.22, -1.33, .05);
addMesh(new THREE.BoxGeometry(.13, .10, .22), matBody,  .22, -1.33, .05);

// ── Skeleton ──────────────────────────────────
function bone(sx, sy, x, y, z, rx = 0, ry = 0, rz = 0) {
  addMesh(new THREE.CylinderGeometry(sx * .5, sx * .4, sy, 6),
          matSkeleton, x, y, z, rx, ry, rz, layers.skeleton);
}
function joint(r, x, y, z) {
  addMesh(new THREE.OctahedronGeometry(r, 0),
          matSkeleton, x, y, z, .4, .4, 0, layers.skeleton);
}

bone(.04, 1.8,  0, 1.20, 0);
addMesh(new THREE.IcosahedronGeometry(.20, 1), matSkeleton, 0, 2.42, 0, 0,0,0, layers.skeleton);
addMesh(new THREE.BoxGeometry(.14, .06, .14),  matSkeleton, 0, 2.22, .05, 0,0,0, layers.skeleton);
bone(.025, .48, -.28, 2.0, 0, 0, 0, Math.PI/2);
bone(.025, .48,  .28, 2.0, 0, 0, 0, Math.PI/2);
for (let i = 0; i < 6; i++) {
  const ry = 1.1 + i * .14;
  const w  = .38 - i * .018;
  addMesh(new THREE.TorusGeometry(w, .018, 4, 14, Math.PI),
          matSkeleton, 0, ry, 0, Math.PI/2, 0, 0, layers.skeleton);
}
addMesh(new THREE.TorusGeometry(.28, .03, 5, 14),
        matSkeleton, 0, .25, 0, Math.PI/2, 0, 0, layers.skeleton);
bone(.030, .55, -.58, 1.58, 0,  .10);
bone(.030, .55,  .58, 1.58, 0, -.10);
bone(.025, .50, -.62,  .97, 0, -.05);
bone(.025, .50,  .62,  .97, 0,  .05);
bone(.050, .65, -.22, -.28, 0);
bone(.050, .65,  .22, -.28, 0);
bone(.040, .62, -.22, -.98, 0);
bone(.040, .62,  .22, -.98, 0);
joint(.09,  0, 2.15, 0);
joint(.10, -.52, 1.92, 0); joint(.10, .52, 1.92, 0);
joint(.08, -.60, 1.26, 0); joint(.08, .60, 1.26, 0);
joint(.07, -.63,  .67, 0); joint(.07, .63,  .67, 0);
joint(.11, -.22,  .10, 0); joint(.11, .22,  .10, 0);
joint(.10, -.22, -.63, 0); joint(.10, .22, -.63, 0);
joint(.08, -.22,-1.33, 0); joint(.08, .22,-1.33, 0);
layers.skeleton.visible = false;

// ── Organs ────────────────────────────────────
function organ(r, x, y, z, color, emissive, scaleX = 1, scaleZ = 1) {
  const g = new THREE.SphereGeometry(r, 12, 10);
  const m = new THREE.Mesh(g, matOrgan(color, emissive));
  m.scale.set(scaleX, 1, scaleZ);
  m.position.set(x, y, z);
  m.castShadow = true;
  layers.organs.add(m);
  return m;
}
organ(.10, -.08, 1.65,  .12, 0xcc2244, 0x440011);          // heart
organ(.18, -.20, 1.55,  .05, 0xdd6688, 0x220011, 1.4, .7); // L lung
organ(.18,  .20, 1.55,  .05, 0xdd6688, 0x220011, 1.4, .7); // R lung
organ(.16,  .12, 1.15,  .10, 0x993322, 0x220800);          // liver
organ(.11, -.12, 1.10,  .08, 0x88aa44, 0x223300);          // stomach
organ(.08, -.20, 1.00, -.08, 0xaa4422, 0x220800);          // L kidney
organ(.08,  .20, 1.00, -.08, 0xaa4422, 0x220800);          // R kidney
organ(.14,  .00,  .65,  .05, 0xbb9944, 0x221100, 1.8, .9); // intestines
organ(.20,  .00, 2.42,  .00, 0xeebbcc, 0x331122);          // brain
layers.organs.visible = false;

// ── Nervous system ────────────────────────────
function nerve(sx, sy, x, y, z, rx = 0) {
  addMesh(new THREE.CylinderGeometry(sx, sx * .6, sy, 4),
          matNervous, x, y, z, rx, 0, 0, layers.nervous);
}
addMesh(new THREE.CylinderGeometry(.018,.018,1.8,6), matNervous, 0, 1.20,-.04, 0,0,0, layers.nervous);
addMesh(new THREE.CylinderGeometry(.040,.025,.25,8), matNervous, 0, 2.08,-.04, 0,0,0, layers.nervous);
nerve(.012, .55, -.56, 1.58, 0,  .12);
nerve(.012, .55,  .56, 1.58, 0, -.12);
nerve(.010, .50, -.60,  .97, 0, -.06);
nerve(.010, .50,  .60,  .97, 0,  .06);
nerve(.014, .65, -.20, -.28, 0);
nerve(.014, .65,  .20, -.28, 0);
nerve(.010, .62, -.20, -.98, 0);
nerve(.010, .62,  .20, -.98, 0);
for (let i = 0; i < 5; i++) {
  addMesh(new THREE.SphereGeometry(.025, 6, 6), matNervous,
    (Math.random()-.5)*.06, .8 + i*.22, -.03, 0,0,0, layers.nervous);
}
layers.nervous.visible = false;

// ── Glow + grid ───────────────────────────────
const glowMat = new THREE.MeshBasicMaterial({ color:0x00d4ff, transparent:true, opacity:.08, side:THREE.DoubleSide });
const glow = new THREE.Mesh(new THREE.CircleGeometry(.5,32), glowMat);
glow.rotation.x = -Math.PI/2;
glow.position.y = -1.42;
scene.add(glow);

const grid = new THREE.GridHelper(6, 20, 0x0d2540, 0x0d2540);
grid.position.y = -1.42;
scene.add(grid);

// ── Particles ─────────────────────────────────
const PC = 60;
const pPos = new Float32Array(PC * 3);
const pSpd = new Float32Array(PC);
for (let i = 0; i < PC; i++) {
  pPos[i*3]   = (Math.random()-.5)*4;
  pPos[i*3+1] = Math.random()*4 - 1.5;
  pPos[i*3+2] = (Math.random()-.5)*4;
  pSpd[i]     = .002 + Math.random()*.004;
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const pMat = new THREE.PointsMaterial({ color:0x00d4ff, size:.025, transparent:true, opacity:.35 });
scene.add(new THREE.Points(pGeo, pMat));

// ── State & controls ──────────────────────────
const state = { body:true, skeleton:false, organs:false, nervous:false, viewMode:'solid', autoRotate:false, breathe:false };

function updateBodyMaterial() {
  const inner = state.skeleton || state.organs || state.nervous;
  const useXray = state.viewMode === 'xray' || (inner && state.body);
  layers.body.traverse(c => { if (c.isMesh) c.material = useXray ? matBodyXray : matBody; });
}

function toggleLayer(name) {
  state[name] = !state[name];
  layers[name].visible = state[name];
  const btn = document.getElementById('btn-' + name);
  btn.classList.toggle('active', state[name]);
  if (name === 'skeleton') btn.classList.toggle('green', state[name]);
  if (name === 'organs')   btn.classList.toggle('red',   state[name]);
  if (name === 'nervous')  btn.classList.toggle('amber', state[name]);
  updateBodyMaterial();
}
function setView(mode) {
  state.viewMode = mode;
  document.getElementById('btn-solid').classList.toggle('active', mode==='solid');
  document.getElementById('btn-xray').classList.toggle('active',  mode==='xray');
  updateBodyMaterial();
}
function toggleAutoRotate() {
  state.autoRotate = !state.autoRotate;
  document.getElementById('btn-rotate').classList.toggle('active', state.autoRotate);
}
function toggleBreathe() {
  state.breathe = !state.breathe;
  document.getElementById('btn-breathe').classList.toggle('active', state.breathe);
}

window.toggleLayer = toggleLayer;
window.setView = setView;
window.toggleAutoRotate = toggleAutoRotate;
window.toggleBreathe = toggleBreathe;

// ── FPS & heart rate ──────────────────────────
let fps=0, frames=0, lastMs=performance.now();
const fpsEl = document.getElementById('fps-counter');
let hrDir=1, hrVal=72;
setInterval(() => {
  hrVal += hrDir*(Math.random()*2);
  if (hrVal>76||hrVal<68) hrDir*=-1;
  document.getElementById('hr-val').textContent = Math.round(hrVal)+' BPM';
}, 1000);

// ── Render loop ───────────────────────────────
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  if (state.autoRotate) controls.addRotY(.005);
  controls.update();

  bodyGroup.scale.y = state.breathe ? 1 + Math.sin(t*1.5)*.025 : 1;

  // Heart pulse
  if (layers.organs.visible) {
    const heart = layers.organs.children[0];
    if (heart) { const p = 1+Math.sin(t*8)*.07; heart.scale.setScalar(p); }
  }

  // Particles
  for (let i=0; i<PC; i++) {
    pPos[i*3+1] += pSpd[i];
    if (pPos[i*3+1] > 2.5) pPos[i*3+1] = -1.5;
  }
  pGeo.attributes.position.needsUpdate = true;

  glowMat.opacity = .05 + Math.sin(t*2)*.025;

  frames++;
  const now = performance.now();
  if (now-lastMs >= 1000) { fpsEl.textContent=frames+' FPS'; frames=0; lastMs=now; }

  renderer.render(scene, camera);
}
animate();
