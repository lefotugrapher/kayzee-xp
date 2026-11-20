// Kayzee XP — core. WebGL world + CSS3D windows/labels + WebGL front layer (window slabs + 3D cursor), one camera.
// The world (sky, clouds, hill, grass, light rig, post) is the locked hero look: do not restyle it here.
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as W from './world.js';
import * as S from './sprites.js';
import { voxFor, iconImg, spriteURL } from './lib/icons.js';
import * as Sound from './lib/sound.js';
import { getSite } from './lib/site.js';
import { installCursors } from './lib/cursors.js';
import { createWM } from './wm.js';
import { createShell } from './shell.js';

const params = new URLSearchParams(location.search);
const SHOT = params.has('shot');
const FPS = params.has('fps');
const EXPOSURE = 1.0;
const FOV = 40;
const IS_TOUCH = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
const PHONE = !SHOT && (innerWidth < 768);
const MOBILE = !SHOT && (PHONE || IS_TOUCH);
const GRID = !SHOT && (innerWidth < 768 || innerWidth / innerHeight < 0.8); // portrait: icons in a tap grid
document.documentElement.classList.toggle('kz-mobile', MOBILE);
document.documentElement.classList.toggle('kz-touch', IS_TOUCH);
// ?shot renders at a fixed design size (headless resizes the viewport right before capture)
const VW = SHOT ? Number(params.get('w') || 1600) : innerWidth;
const VH = SHOT ? Number(params.get('h') || 1000) : innerHeight;
// pixel-mapped desktop plane: at z = 0, 1 world unit == 1 CSS px
const D = (VH / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const DPR_CAP = 1.25;
let DPR = SHOT ? Number(params.get('dpr') || 2) : Math.min(devicePixelRatio, DPR_CAP);
const SUN = (params.get('sun') ? new THREE.Vector3(...params.get('sun').split(',').map(Number)) : new THREE.Vector3(-0.80, 0.58, 0.17)).normalize(); // toward the sun: upper-left-front
const T_SHOT = 4.2;
// the hero composition is authored in a 1600 x 1000 frame; other viewports scale it
const KX = SHOT ? 1 : VW / 1600, KY = SHOT ? 1 : VH / 1000;
const KS = SHOT ? 1 : Math.min(1.5, Math.max(0.55, Math.min(KX, KY)));
const LAYER_SHADOW = 1, LAYER_PICK = 2, LAYER_CURSOR = 3;

// ------------------------------------------------------------------ camera
const camera = new THREE.PerspectiveCamera(FOV, VW / VH, 40, 90000);
const REST = new THREE.Vector3(0, 0, D);
camera.position.copy(REST);
const SHOT_POS = new THREE.Vector3(-96, -72, D - 30);
const SHOT_LOOK = new THREE.Vector3(18, -32, 0);
function placeShotCamera() { camera.position.copy(SHOT_POS); camera.lookAt(SHOT_LOOK); camera.updateMatrixWorld(); }
placeShotCamera(); // composition (cursor aim) is solved for this pose in both modes

// composition is authored in screen px of the hero (shot) camera
const _fwd = new THREE.Vector3();
function screenRay(sx, sy) {
  const p = new THREE.Vector3(sx / VW * 2 - 1, -(sy / VH * 2 - 1), 0.5).unproject(camera);
  return p.sub(camera.position).normalize();
}
// screen point + view depth L -> world point
function screenToWorld(sx, sy, L) {
  const dir = screenRay(sx, sy);
  camera.getWorldDirection(_fwd);
  return camera.position.clone().addScaledVector(dir, L / dir.dot(_fwd));
}
// screen point -> world point on the plane z = zp
function screenToPlaneZ(sx, sy, zp) {
  const dir = screenRay(sx, sy);
  return camera.position.clone().addScaledVector(dir, (zp - camera.position.z) / dir.z);
}
function worldToScreen(v) { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * VW, y: (1 - p.y) / 2 * VH }; }

// ------------------------------------------------------------------ main WebGL world renderer
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gl'), antialias: false, preserveDrawingBuffer: SHOT, powerPreference: 'high-performance' });
renderer.setPixelRatio(DPR);
renderer.setSize(VW, VH);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // r187: PCFSoft was folded into PCF + radius
renderer.shadowMap.autoUpdate = false;        // re-rendered only when a caster moves (see markShadow)
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = EXPOSURE;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.info.autoReset = false; // counted per frame across all composer passes (?fps)

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(W.preTone('#bcd6ef', EXPOSURE), 5200, 52000);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(W.makeEnvScene(), 0.03).texture;
scene.environmentIntensity = params.has('noamb') ? 0 : Number(params.get('env') || 0.16);

// one light rig: warm sun + cool sky fill
function makeSun(target, extent, mapSize, radius) {
  const l = new THREE.DirectionalLight(0xfff0d8, Number(params.get('sunI') || 5.4));
  l.target.position.copy(target);
  l.position.copy(target).addScaledVector(SUN, 6000);
  l.castShadow = true;
  l.shadow.mapSize.set(mapSize, mapSize);
  const c = l.shadow.camera;
  c.left = -extent; c.right = extent; c.top = extent; c.bottom = -extent; c.near = 1000; c.far = 12000;
  l.shadow.radius = radius;
  l.shadow.bias = -0.00025;
  l.shadow.normalBias = 1.0;
  return l;
}
const sun = makeSun(new THREE.Vector3(-60, -160, -650), 1900, 4096, 3);
sun.shadow.camera.layers.set(LAYER_SHADOW); // only the cheap shadow proxies are drawn into the shadow map
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xb4d4ff, 0x40702a, params.has('noamb') ? 0 : Number(params.get('hemi') || 0.16));
scene.add(hemi);

// sky + clouds
const sky = W.makeSky(EXPOSURE);
scene.add(sky);
const CLOUDS = [
  // sx, sy = centre in the hero frame; px = width; L = view depth; tower = how tall the dome grows
  { sx: 190, sy: 300, px: 980, L: 24000, seed: 1, aspect: 2.2, puffs: 15, tower: 0.55 },
  { sx: 1330, sy: 300, px: 1060, L: 27000, seed: 12, aspect: 1.9, puffs: 16, tower: 1.0 },
  { sx: 770, sy: 420, px: 1300, L: 34000, seed: 3, aspect: 3.2, puffs: 17, tower: 0.35, haze: 0.16 },
  { sx: 610, sy: 132, px: 560, L: 20000, seed: 4, aspect: 3.4, stretch: 2.0, puffs: 7, tower: 0.5, soft: 0.8 },
  { sx: 1050, sy: 50, px: 470, L: 21000, seed: 5, aspect: 3.2, stretch: 2.0, puffs: 6, tower: 0.4, soft: 0.8 },
  { sx: 1565, sy: 118, px: 500, L: 20000, seed: 6, aspect: 2.6, stretch: 1.5, puffs: 8, tower: 0.6, soft: 0.5 },
  { sx: 20, sy: 468, px: 640, L: 38000, seed: 7, aspect: 3.4, puffs: 14, tower: 0.2, haze: 0.32 },
  { sx: 1600, sy: 470, px: 700, L: 38000, seed: 8, aspect: 3.4, puffs: 14, tower: 0.2, haze: 0.32 },
];
const clouds = CLOUDS.map((c) => {
  const m = W.makeCloud({ seed: c.seed, aspect: c.aspect, haze: c.haze || 0, puffs: c.puffs, tower: c.tower, lobes: c.lobes !== false, soft: c.soft || 0, stretch: c.stretch || 1, exposure: EXPOSURE });
  const p = screenToWorld(c.sx * KX, c.sy * KY, c.L);
  const sc = (c.px * KS * c.L / D) / (2 * c.aspect);
  m.position.copy(p); m.scale.setScalar(sc);
  m.lookAt(camera.position);
  m.userData.drift = 6 + c.seed * 1.7;
  scene.add(m);
  return m;
});

// ground (grass is locked: 260000 live blades; phones keep the same blade density over their narrower view)
const grassU = W.grassUniforms();
const terrain = W.makeTerrain(grassU);
scene.add(terrain);
const GRASS_COUNT = SHOT ? 460000 : PHONE ? Math.round(260000 * Math.min(1, (VW / VH) / 1.6)) : 260000;
const grass = W.makeGrass({ count: GRASS_COUNT, camZ: D, uniforms: grassU, halfFov: Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * VW / VH * 1.06 });
scene.add(grass);

// ------------------------------------------------------------------ voxel helpers
const voxGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.06);
const voxGeoFine = new RoundedBoxGeometry(1, 1, 1, 2, 0.045);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const proxyMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
function plastic(opts = {}) {
  return new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.40, metalness: 0, clearcoat: 0.45, clearcoatRoughness: 0.32, ...opts });
}
function voxelMesh(vox, size, material, geo = voxGeo) {
  const list = vox.visible();
  const b = vox.bounds();
  const cx = (b.mnx + b.mxx) / 2, cy = (b.mny + b.mxy) / 2, cz = (b.mnz + b.mxz) / 2;
  const mesh = new THREE.InstancedMesh(geo, material, list.length);
  const m = new THREE.Matrix4(), col = new THREE.Color();
  list.forEach((v, i) => {
    m.makeScale(size * 0.998, size * 0.998, size * 0.998);
    m.setPosition((v.x - cx) * size, (v.y - cy) * size, (v.z - cz) * size);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, col.set(v.c));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return { mesh, b, cx, cy, cz, w: b.w * size, h: b.h * size, d: b.d * size };
}
// shadow-only twin: plain boxes sharing the instance matrices (rounded corners are sub-texel in the shadow map)
function shadowTwin(mesh) {
  const t = new THREE.InstancedMesh(boxGeo, proxyMat, mesh.count);
  t.instanceMatrix = mesh.instanceMatrix;
  t.castShadow = true; t.frustumCulled = false;
  t.layers.set(LAYER_SHADOW);
  t.position.copy(mesh.position);
  return t;
}

// legacy [data-sprite] hooks in static markup
document.querySelectorAll('[data-sprite]').forEach((el) => {
  const key = el.dataset.sprite;
  const big = el.classList.contains('bigicon');
  el.appendChild(S.sprite2D(voxFor(key), big ? 3 : 2, { shadow: !el.classList.contains('tico'), bevel: big }));
});

// ------------------------------------------------------------------ CSS3D layer (windows + labels)
// two CSS3D layers: icon labels sit under every window (some icons float in front of the desk plane in 3D, but their
// WebGL bodies always draw behind the DOM, so their labels must too); windows are 3D-sorted among themselves
const labelRenderer = new CSS3DRenderer({ element: document.getElementById('css3d-labels') });
labelRenderer.setSize(VW, VH);
const labelScene = new THREE.Scene();
const cssRenderer = new CSS3DRenderer({ element: document.getElementById('css3d') });
cssRenderer.setSize(VW, VH);
const cssScene = new THREE.Scene();

// ------------------------------------------------------------------ desktop icons
// at = screen px of the icon centre in the hero frame; px = on-screen width.
// Sky icons give a view depth L; ground-level icons give a clearance above the turf and the depth is solved.
const ICONS_HERO = [
  { key: 'music', label: 'My Music', at: [296, 230], L: D + 900, px: 182, rot: [0.16, -0.42, -0.12] },
  { key: 'resume', label: 'My Resume', at: [1058, 166], L: D + 560, px: 128, rot: [0.10, -0.42, 0.07], sel: true },
  { key: 'games', label: 'Games', at: [1312, 176], L: D + 720, px: 150, rot: [0.42, -0.62, 0.02] },
  { key: 'contact', label: 'Contact Me', at: [1384, 380], L: D + 380, px: 150, rot: [0.12, -0.45, 0.10] },
  { key: 'projects', label: 'My Projects', at: [300, 548], clear: 150, px: 146, rot: [0.12, -0.40, -0.04] },
  { key: 'about', label: 'About Me', at: [1306, 708], clear: 34, px: 184, rot: [0.10, -0.62, 0.0] },
  { key: 'bin', label: 'Recycle Bin', at: [190, 914], ground: true, px: 190, rot: [0.03, -0.30, 0.0] },
];
// portrait / phone: two columns the thumb can reach (authored in a 390 x 844 frame)
const ICONS_GRID = [
  { key: 'music', label: 'My Music', at: [98, 150], L: D + 700, px: 104, rot: [0.16, -0.42, -0.12] },
  { key: 'resume', label: 'My Resume', at: [292, 140], L: D + 500, px: 78, rot: [0.10, -0.42, 0.07], sel: true },
  { key: 'games', label: 'Games', at: [98, 318], L: D + 600, px: 96, rot: [0.42, -0.62, 0.02] },
  { key: 'contact', label: 'Contact Me', at: [292, 322], L: D + 420, px: 92, rot: [0.12, -0.45, 0.10] },
  { key: 'projects', label: 'My Projects', at: [98, 520], clear: 120, px: 92, rot: [0.12, -0.40, -0.04] },
  { key: 'about', label: 'About Me', at: [292, 540], clear: 40, px: 104, rot: [0.10, -0.62, 0.0] },
  { key: 'bin', label: 'Recycle Bin', at: [96, 772], ground: true, px: 112, rot: [0.03, -0.30, 0.0] },
];
const ICON_APP = { music: 'music', resume: 'resume', games: 'games', contact: 'contact', projects: 'projects', about: 'about', bin: 'recycle' };
const ICONS = (GRID ? ICONS_GRID.map((ic) => {
  const gx = VW / 390, gy = VH / 844, gs = Math.min(1.6, Math.max(0.8, Math.min(gx, gy)));
  return { ...ic, at: [ic.at[0] * gx, ic.at[1] * gy], px: ic.px * gs };
}) : ICONS_HERO.map((ic) => ({ ...ic, at: [ic.at[0] * KX, ic.at[1] * KY], px: ic.px * KS })));

// depth at which an icon centred on screen point (sx,sy) has its bottom `clear` units above the ground
function solveClearDepth(sx, sy, px, b, clear) {
  let lo = 250, hi = 8000;
  for (let it = 0; it < 48; it++) {
    const L = (lo + hi) / 2;
    const p = screenToWorld(sx, sy, L);
    const h = px * (L / D) / b.w * b.h;
    const gap = (p.y - h / 2) - W.groundY(p.x, p.z);
    if (gap > clear) lo = L; else hi = L;
  }
  return (lo + hi) / 2;
}
// depth at which the ray through (sx,sy) meets the ground
function solveGroundDepth(sx, sy) {
  let lo = 200, hi = 9000;
  for (let it = 0; it < 48; it++) {
    const L = (lo + hi) / 2; const p = screenToWorld(sx, sy, L);
    if (p.y > W.groundY(p.x, p.z)) lo = L; else hi = L;
  }
  return (lo + hi) / 2;
}
const iconObjs = [];
const pickBoxes = [];
ICONS.forEach((ic, i) => {
  const vox = voxFor(ic.key);
  const b = vox.bounds();
  if (ic.clear !== undefined) ic.L = solveClearDepth(ic.at[0], ic.at[1], ic.px, b, ic.clear);
  if (ic.ground) ic.L = solveGroundDepth(ic.at[0], ic.at[1]);
  const size = ic.px * (ic.L / D) / b.w;
  const vm = voxelMesh(vox, size, plastic());
  vm.mesh.castShadow = false; vm.mesh.receiveShadow = true;
  const g = new THREE.Group();
  g.add(vm.mesh, shadowTwin(vm.mesh));
  const pick = new THREE.Mesh(boxGeo, proxyMat);
  pick.scale.set(vm.w, vm.h, vm.d); pick.layers.set(LAYER_PICK);
  g.add(pick);
  g.rotation.set(ic.rot[0], ic.rot[1], ic.rot[2]);
  let p;
  if (ic.ground) {
    // at = where the bin's base meets the grass; sink it a touch so blades hide the contact line
    p = screenToWorld(ic.at[0], ic.at[1], ic.L);
    p.y = W.groundY(p.x, p.z) + vm.h / 2 - 0.05 * vm.h;
  } else {
    p = screenToWorld(ic.at[0], ic.at[1], ic.L);
  }
  g.position.copy(p);
  g.userData = { base: p.clone(), phase: i * 1.37, bob: ic.ground ? 0 : 5 + (i % 3) * 2 };
  scene.add(g);
  g.updateMatrixWorld(true);
  // screen-space bottom of the rotated icon -> label sits just under it
  let maxY = -1e9, sx = 0;
  for (let c = 0; c < 8; c++) {
    const v = new THREE.Vector3((c & 1 ? 0.5 : -0.5) * vm.w, (c & 2 ? 0.5 : -0.5) * vm.h, (c & 4 ? 0.5 : -0.5) * vm.d).applyMatrix4(g.matrixWorld);
    const sp = worldToScreen(v); maxY = Math.max(maxY, sp.y); sx += sp.x / 8;
  }
  // label: real DOM text in the CSS3D layer, kept ~13px on screen
  const app = ICON_APP[ic.key];
  const el = document.createElement('div');
  el.className = 'label' + (ic.sel ? ' sel' : '');
  el.textContent = ic.label;
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', `${ic.label} (double-click or press Enter to open)`);
  el.dataset.icon = String(i);
  const lo = new CSS3DObject(el);
  const k = Math.pow(ic.L / D, 0.88);
  lo.scale.setScalar(k);
  if (ic.ground) lo.position.copy(screenToWorld(ic.at[0] + ic.px * 0.5 + 58 * KS, maxY - ic.px * 0.32, ic.L));
  else lo.position.copy(screenToWorld(sx, maxY + 7 + 11 * Math.pow(D / ic.L, 0.12), ic.L - vm.d * 0.5));
  labelScene.add(lo);
  const o = { g, lo, el, ic, vm, app, i, hover: 0, hoverT: 0, lift: 16 * ic.L / D * KS, sel: !!ic.sel };
  pick.userData.icon = o;
  pickBoxes.push(pick);
  iconObjs.push(o);
});

// ------------------------------------------------------------------ window slab geometry (shared by every window)
function slabShape(w, h, rt, rb) {
  const s = new THREE.Shape(), x0 = -w / 2, y0 = -h / 2;
  s.moveTo(x0 + rb, y0);
  s.lineTo(x0 + w - rb, y0); s.absarc(x0 + w - rb, y0 + rb, rb, -Math.PI / 2, 0, false);
  s.lineTo(x0 + w, y0 + h - rt); s.absarc(x0 + w - rt, y0 + h - rt, rt, 0, Math.PI / 2, false);
  s.lineTo(x0 + rt, y0 + h); s.absarc(x0 + rt, y0 + h - rt, rt, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + rb); s.absarc(x0 + rb, y0 + rb, rb, Math.PI, Math.PI * 1.5, false);
  return s;
}
const SLAB = { depth: 12, bevelT: 11, bevelS: 11 };
const SLAB_TOTAL = SLAB.depth + 2 * SLAB.bevelT;
function slabGeometry(w, h) {
  const g = new THREE.ExtrudeGeometry(slabShape(w, h, 8, 1.5), {
    depth: SLAB.depth, bevelEnabled: true, bevelThickness: SLAB.bevelT, bevelSize: SLAB.bevelS, bevelSegments: 7, curveSegments: 12,
  });
  g.translate(0, 0, -(SLAB.depth + SLAB.bevelT) - 0.8); // front cap sits just behind the DOM face
  return g;
}
function faceGeometry(w, h) { return new THREE.ShapeGeometry(slabShape(w, h, 8, 1.5), 12); }
function slabMaterial() { return new THREE.MeshPhysicalMaterial({ color: '#1456de', roughness: 0.30, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.18 }); }

// ------------------------------------------------------------------ front layer: window slabs + 3D cursor
// Windows are painted back to front (depth cleared between them), each slab followed by a hole punched where its DOM
// face is, so a front window's bevelled rim correctly covers the DOM face of a window behind it.
const fxRenderer = new THREE.WebGLRenderer({ canvas: document.getElementById('fx'), antialias: true, alpha: true, preserveDrawingBuffer: SHOT });
fxRenderer.setPixelRatio(DPR);
fxRenderer.setSize(VW, VH);
fxRenderer.setClearColor(0x000000, 0);
fxRenderer.toneMapping = THREE.ACESFilmicToneMapping;
fxRenderer.toneMappingExposure = EXPOSURE;
fxRenderer.outputColorSpace = THREE.SRGBColorSpace;
fxRenderer.shadowMap.enabled = true;
fxRenderer.shadowMap.type = THREE.PCFShadowMap;
fxRenderer.shadowMap.autoUpdate = false;
fxRenderer.autoClear = false;
const fxScene = new THREE.Scene();
fxScene.environment = new THREE.PMREMGenerator(fxRenderer).fromScene(W.makeEnvScene(), 0.03).texture;
const FX_ENV_SLAB = 0.16, FX_HEMI_SLAB = 0.16, FX_ENV_CURSOR = 0.18, FX_HEMI_CURSOR = 0.20; // slabs match the world rig
fxScene.environmentIntensity = FX_ENV_CURSOR;
const DLG_POS = screenToPlaneZ(800 * KX, 452 * KY, 0).round();
const fxSun = makeSun(DLG_POS.clone(), 700, 2048, 4);
fxSun.shadow.camera.layers.set(LAYER_CURSOR); // only the cursor casts onto window faces
const fxHemi = new THREE.HemisphereLight(0xb4d4ff, 0x40702a, FX_HEMI_CURSOR);
[fxSun, fxHemi].forEach((l) => l.layers.enableAll());
fxScene.add(fxSun, fxSun.target, fxHemi);

const cursorVox = S.buildCursor();
const CUR_PX = 205;          // on-screen height of the arrow in the hero frame
const CUR_ROT = new THREE.Euler(-0.42, -0.62, 0.10);
function makeCursor(material, shadowOnly) {
  const vm = voxelMesh(cursorVox, 1, material, voxGeoFine);
  // pivot on the arrow tip (top-left-front corner of the first voxel)
  vm.mesh.position.set((vm.cx - vm.b.mnx + 0.5), -(vm.b.mxy - vm.cy + 0.5), -(vm.b.mxz - vm.cz + 0.5));
  const g = new THREE.Group();
  if (shadowOnly) {
    g.add(shadowTwin(vm.mesh));
  } else {
    vm.mesh.castShadow = true;
    vm.mesh.layers.set(LAYER_CURSOR);
    g.add(vm.mesh);
  }
  g.rotation.copy(CUR_ROT);
  g.userData.vm = vm;
  return g;
}
const cursor = makeCursor(plastic({ roughness: 0.34, clearcoat: 0.6 }), false);
fxScene.add(cursor);
const cursorProxy = makeCursor(proxyMat, true); // casts the cursor's shadow onto the grass
scene.add(cursorProxy);

// ------------------------------------------------------------------ post: bloom + output (ACES/sRGB) + grain/vignette
const rt = new THREE.WebGLRenderTarget(VW * DPR, VH * DPR, { type: THREE.HalfFloatType, samples: SHOT ? 0 : 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(DPR);
composer.setSize(VW, VH);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(VW, VH), 0.10, 0.05, 2.8); // the pass already works from half resolution
composer.addPass(bloom);
composer.addPass(new OutputPass());
const GRAIN = 0.042;
const finish = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(VW, VH) }, uTime: { value: 0 }, uDpr: { value: DPR }, uGrain: { value: GRAIN } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uTime, uDpr, uGrain; varying vec2 vUv;
    float h(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5; d.x *= uRes.x / uRes.y;
      float v = smoothstep(1.18, 0.32, length(d));
      c.rgb *= mix(0.70, 1.0, v);
      float l0 = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = clamp(mix(vec3(l0), c.rgb, 1.10), 0.0, 1.0);
      vec2 px = floor(gl_FragCoord.xy / uDpr);
      float g = h(px + floor(uTime * 24.0) * 7.31) + h(px * 1.37 + 11.0) - 1.0;
      float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb += g * uGrain * (1.0 - 0.55 * lum);
      gl_FragColor = c;
    }`,
});
composer.addPass(finish);

// CSS grain over everything (DOM windows, labels, taskbar) so the frame reads as one image
(function grainTile() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 192;
  const g = cv.getContext('2d'); const img = g.createImageData(192, 192);
  const rng = W.mulberry32(42);
  for (let i = 0; i < img.data.length; i += 4) { const v = 128 + (rng() + rng() - 1) * 120; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  document.getElementById('grain').style.backgroundImage = `url(${cv.toDataURL()})`;
})();

// one white pixel cursor set, native CSS (the 3D voxel cursor is only drawn for ?shot hero renders)
installCursors();

// ------------------------------------------------------------------ dirty flags
let fxDirty = true, cssDirty = true, shadowDirty = true;
const markFx = () => { fxDirty = true; };
const markCss = () => { cssDirty = true; };
const markShadow = () => { shadowDirty = true; };

// ------------------------------------------------------------------ live camera
// live rest pose: pure translation (no rotation) at z = D  ->  the desktop plane is exactly 1 unit = 1 CSS px
const REST_LIVE = new THREE.Vector3(DLG_POS.x, DLG_POS.y - 70, D);
const view = { w: VW, h: VH };
const deskOut = new THREE.Vector3();
// screen point (CSS px, rest camera) on the plane z -> world, plus the scale that undoes perspective at that depth
function deskToWorld(sx, sy, z, out = deskOut) {
  const s = (D - z) / D;
  return out.set(REST_LIVE.x + (sx - view.w / 2) * s, REST_LIVE.y - (sy - view.h / 2) * s, z);
}
const desk = { scaleAt: (z) => (D - z) / D };

// ------------------------------------------------------------------ stage API (wm.js / shell.js)
const frameHooks = new Set();
const handlers = { openIcon: null, desktopMenu: null, desktopClick: null, iconMenu: null };
const stage = {
  THREE, CSS3DObject, camera, scene, fxScene, cssScene, D, view, rest: REST_LIVE, shot: SHOT,
  mobile: MOBILE, touch: IS_TOUCH, phone: PHONE,
  layers: { SHADOW: LAYER_SHADOW }, SLAB, SLAB_TOTAL, slabGeometry, faceGeometry, slabMaterial, boxGeo, proxyMat,
  deskToWorld, desk, markFx, markCss, markShadow,
  onFrame(fn) { frameHooks.add(fn); return () => frameHooks.delete(fn); },
  sound: Sound, icon: iconImg, site: getSite, handlers,
  iconFrom, selectIcon, setPaused, setHold, setTimeOfDay, setEffects, renderOnce,
  get dpr() { return DPR; },
};

// ------------------------------------------------------------------ window manager + shell
const wm = createWM(stage);
stage.wm = wm;
const shell = createShell(stage, wm);

// cursor aim (hero frame): tip on the line of sight from the hero camera to the welcome dialog's "Open résumé" button;
// slide it toward the camera until its tail clears the turf (it floats, it doesn't stab the ground)
const aim = wm.measure('welcome', '#btn-resume');
const btnLocal = new THREE.Vector3(aim.rect.left + aim.rect.width * 0.60 - aim.w / 2, aim.h / 2 - (aim.rect.top + aim.rect.height * 0.80), 0);
const BTN_WORLD = DLG_POS.clone().add(btnLocal);
function placeCursor(zc) {
  const dir = BTN_WORLD.clone().sub(SHOT_POS);
  const tip = SHOT_POS.clone().addScaledVector(dir, (zc - SHOT_POS.z) / dir.z);
  const L = SHOT_POS.z - zc;
  const sc = CUR_PX * (L / D) / cursorVox.bounds().h;
  for (const g of [cursor, cursorProxy]) { g.position.copy(tip); g.scale.setScalar(sc); g.updateMatrixWorld(true); }
  // lowest corner vs ground
  const vm = cursor.userData.vm; let worst = 1e9;
  const bb = cursorVox.bounds();
  for (let c = 0; c < 8; c++) {
    const v = new THREE.Vector3((c & 1 ? 0.5 : -0.5) * bb.w, (c & 2 ? 0.5 : -0.5) * bb.h, (c & 4 ? 0.5 : -0.5) * bb.d)
      .add(vm.mesh.position).applyMatrix4(cursor.matrixWorld);
    worst = Math.min(worst, v.y - W.groundY(v.x, v.z));
  }
  return worst;
}
let CUR_Z = 120;
for (; CUR_Z < 900; CUR_Z += 10) if (placeCursor(CUR_Z) > 16) break;
const CUR_HERO = cursor.position.clone();

// ------------------------------------------------------------------ frame update
function update(t) {
  grassU.uTime.value = t;
  finish.uniforms.uTime.value = t;
  for (const o of iconObjs) {
    const u = o.g.userData;
    o.g.position.y = u.base.y + Math.sin(t * 1.1 + u.phase) * u.bob + o.hover * o.lift;
    o.g.rotation.y = o.ic.rot[1] + Math.sin(t * 0.5 + u.phase) * 0.06;
  }
}
function renderFx() {
  fxDirty = false;
  fxRenderer.clear();
  fxRenderer.shadowMap.needsUpdate = true;
  const groups = wm.fxGroups(); // back to front
  const cursorOn = cursor.visible;
  if (groups.length) {
    fxScene.environmentIntensity = FX_ENV_SLAB; fxHemi.intensity = FX_HEMI_SLAB;
    for (const g of groups) g.visible = false;
    for (const g of groups) {
      g.visible = true;
      fxRenderer.render(fxScene, camera);
      fxRenderer.clearDepth();
      g.visible = false;
    }
    for (const g of groups) g.visible = true;
  }
  if (cursorOn) {
    fxScene.environmentIntensity = FX_ENV_CURSOR; fxHemi.intensity = FX_HEMI_CURSOR;
    const hidden = groups.map((g) => { g.visible = false; return g; });
    camera.layers.set(LAYER_CURSOR);
    fxRenderer.render(fxScene, camera);
    camera.layers.set(0);
    hidden.forEach((g) => { g.visible = true; });
  }
}
let fxRenders = 0, shadowRenders = 0;
function render() {
  sky.position.copy(camera.position);
  renderer.info.reset();
  if (shadowDirty) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; shadowRenders++; }
  composer.render();
  if (cssDirty) { cssDirty = false; labelRenderer.render(labelScene, camera); cssRenderer.render(cssScene, camera); }
  if (fxDirty) { renderFx(); fxRenders++; }
}
function renderOnce() { update(T_SHOT + (performance.now() - t0) / 1000); markFx(); markCss(); markShadow(); render(); }

// ------------------------------------------------------------------ pointer: 3D cursor, parallax, icon hover / select / open
const ptr = { x: -1, y: -1, nx: 0, ny: 0, has: false, t: 0, moved: false, overUI: true, inside: false, touch: IS_TOUCH, down: null };
stage.pointer = ptr;
const UI_SEL = '.kz-win, #taskbar, .kz-menu, .kz-popup, .kz-balloon, .kz-screen, .kz-tip';
let holdCount = 0;          // > 0 while a window is being dragged/resized (camera eases to rest)
function setHold(on) { holdCount = Math.max(0, holdCount + (on ? 1 : -1)); }
function setCursorVisible(on) {
  if (!SHOT) on = false;
  if (cursor.visible === on) return;
  cursor.visible = on; cursorProxy.visible = on;
  markFx(); markShadow();
}
function pointerUpdate(e) {
  ptr.x = e.clientX; ptr.y = e.clientY;
  ptr.nx = e.clientX / view.w * 2 - 1; ptr.ny = e.clientY / view.h * 2 - 1;
  ptr.has = true; ptr.t = performance.now(); ptr.moved = true; ptr.inside = true;
  ptr.touch = e.pointerType === 'touch' || (IS_TOUCH && e.pointerType !== 'mouse');
  const ui = !!(e.target && e.target.closest && e.target.closest(UI_SEL));
  ptr.overUI = ui;
}
addEventListener('pointermove', pointerUpdate, { passive: true });
addEventListener('pointerdown', pointerUpdate, { passive: true, capture: true });
document.documentElement.addEventListener('pointerleave', () => { ptr.inside = false; });

const raycaster = new THREE.Raycaster();
raycaster.layers.set(LAYER_PICK);
const _ndc = new THREE.Vector2();
const _cplane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), _hit = new THREE.Vector3();
function pickIcon(x, y) {
  _ndc.set(x / view.w * 2 - 1, -(y / view.h * 2 - 1));
  raycaster.setFromCamera(_ndc, camera);
  const hits = raycaster.intersectObjects(pickBoxes, false);
  return hits.length ? hits[0].object.userData.icon : null;
}
let hovered = null;
function setHover(o) {
  if (hovered === o) return;
  if (hovered) { hovered.hoverT = 0; hovered.el.classList.remove('hover'); }
  hovered = o;
  if (o) { o.hoverT = 1; o.el.classList.add('hover'); }
}
function selectIcon(o) {
  for (const x of iconObjs) { x.sel = x === o; x.el.classList.toggle('sel', x.sel); }
}
function iconFrom(app) {
  const o = iconObjs.find((x) => x.app === app);
  if (!o) return null;
  return { pos: o.g.position.clone(), px: o.ic.px, quat: o.g.quaternion.clone() };
}
function openIcon(o) {
  selectIcon(o);
  Sound.play('click');
  handlers.openIcon && handlers.openIcon(o.app, iconFrom(o.app));
}
let lastDown = { o: null, t: 0 };
let longPress = 0;
function onDesktopDown(e) {
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  const lbl = e.target.closest && e.target.closest('.label[data-icon]');
  const o = lbl ? iconObjs[Number(lbl.dataset.icon)] : pickIcon(e.clientX, e.clientY);
  handlers.desktopClick && handlers.desktopClick(e);
  const now = performance.now();
  const touch = e.pointerType === 'touch';
  if (o) {
    const again = lastDown.o === o && (touch ? o.sel : now - lastDown.t < 480);
    if (again) { lastDown = { o: null, t: 0 }; openIcon(o); return; }
    selectIcon(o);
    lastDown = { o, t: now };
  } else {
    selectIcon(null);
    lastDown = { o: null, t: 0 };
  }
  if (touch) {
    clearTimeout(longPress);
    const x = e.clientX, y = e.clientY;
    longPress = setTimeout(() => {
      if (o) handlers.iconMenu && handlers.iconMenu(o.app, x, y, () => openIcon(o));
      else handlers.desktopMenu && handlers.desktopMenu(x, y);
    }, 560);
  }
}
function isDesktopTarget(t) { return t && !(t.closest && t.closest(UI_SEL)); }
addEventListener('pointerdown', (e) => { if (isDesktopTarget(e.target)) onDesktopDown(e); });
addEventListener('pointerup', () => clearTimeout(longPress));
addEventListener('pointercancel', () => clearTimeout(longPress));
addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') clearTimeout(longPress); }, { passive: true });
addEventListener('contextmenu', (e) => {
  if (!isDesktopTarget(e.target)) return;
  e.preventDefault();
  if (ptr.touch) return; // long-press handles touch
  const lbl = e.target.closest && e.target.closest('.label[data-icon]');
  const o = lbl ? iconObjs[Number(lbl.dataset.icon)] : pickIcon(e.clientX, e.clientY);
  if (o) { selectIcon(o); handlers.iconMenu && handlers.iconMenu(o.app, e.clientX, e.clientY, () => openIcon(o)); }
  else handlers.desktopMenu && handlers.desktopMenu(e.clientX, e.clientY);
});
// keyboard: labels are focusable buttons
for (const o of iconObjs) {
  o.el.addEventListener('focus', () => selectIcon(o));
  o.el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openIcon(o); }
    else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault(); const r = o.el.getBoundingClientRect();
      handlers.iconMenu && handlers.iconMenu(o.app, r.left, r.bottom, () => openIcon(o));
    }
  });
}
addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !document.activeElement || document.activeElement !== document.body) return;
  if (document.querySelector('.kz-win:not(.inactive)')) return;   // a focused window owns the keyboard (games use Enter)
  const o = iconObjs.find((x) => x.sel);
  if (o) openIcon(o);
});

// ------------------------------------------------------------------ desktop context-menu actions
// Arrange Icons: each icon hops and settles in turn. Refresh: the desktop blinks like a redraw.
const hops = [];
function arrangeIcons() {
  const now = performance.now();
  iconObjs.forEach((o, i) => hops.push({ o, t0: now + i * 90, dur: 520, h: 34 * o.ic.L / D * KS, spin: (i % 2 ? -1 : 1) * 0.5 }));
}
function refreshDesktop() {
  iconObjs.forEach((o) => { o.g.visible = false; o.el.style.visibility = 'hidden'; });
  markShadow(); markCss();
  setTimeout(() => { iconObjs.forEach((o) => { o.g.visible = true; o.el.style.visibility = ''; }); markShadow(); markCss(); }, 160);
}
stage.arrangeIcons = arrangeIcons;
stage.refreshDesktop = refreshDesktop;
stage.onFrame((now) => {
  for (let i = hops.length - 1; i >= 0; i--) {
    const hp = hops[i], t = (now - hp.t0) / hp.dur;
    if (t < 0) continue;
    if (t >= 1) { hops.splice(i, 1); continue; }
    hp.o.g.position.y += Math.sin(Math.PI * t) * hp.h;
    hp.o.g.rotation.y += Math.sin(Math.PI * t) * hp.spin * Math.sin(Math.PI * 2 * t);
  }
  if (hops.length) markShadow();
});

// ------------------------------------------------------------------ time of day (Day is the locked hero look)
// Every preset is a set of light / sky / cloud / grass-tint uniforms; switching crossfades between them.
// Grass geometry and blade count never change: only the shared grass colour uniforms are tinted.
const SKY_SUN0 = sky.material.uniforms.uSun.value.clone();
const CLOUD_SUN0 = clouds[0].material.uniforms.uSun.value.clone();
const GRASS_KEYS = ['uG1', 'uG2', 'uG3', 'uG4'];
const SKY_KEYS = ['uTop', 'uMid', 'uLow', 'uHor', 'uGround'];
// stars (night) and a sun / moon disc with glow (sunset, night): tiny cost, hidden when not needed
const stars = (() => {
  const N = 2200, pos = new Float32Array(N * 3), aux = new Float32Array(N * 2), rng = W.mulberry32(99);
  for (let i = 0; i < N; i++) {
    const y = 0.02 + Math.pow(rng(), 0.8) * 0.98, a = rng() * Math.PI * 2, r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(a) * r * 50000, y * 50000, Math.sin(a) * r * 50000], i * 3);
    aux.set([1.3 + rng() * rng() * 2.8, rng() * 6.28], i * 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aux', new THREE.BufferAttribute(aux, 2));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 }, uDpr: { value: DPR } },
    vertexShader: `attribute vec2 aux; uniform float uTime, uDpr; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        float tw = 0.75 + 0.25 * sin(uTime * (1.3 + aux.y * 0.4) + aux.y * 9.0);
        vA = tw * clamp(position.y / 9000.0, 0.0, 1.0); gl_PointSize = aux.x * uDpr; }`,
    fragmentShader: `uniform float uOpacity; varying float vA;
      void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(d));
        gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * a * vA * uOpacity, 1.0); }`,
  });
  const p = new THREE.Points(g, m);
  p.renderOrder = -9; p.frustumCulled = false; p.visible = false;
  scene.add(p);
  return p;
})();
const disc = (() => {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uColor: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uOpacity: { value: 0 }, uCore: { value: 0.12 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uColor, uGlow; uniform float uOpacity, uCore; varying vec2 vUv;
      void main(){ float r = length(vUv - 0.5) * 2.0;
        float core = smoothstep(uCore, uCore - 0.012, r);
        float glow = exp(-r * 5.5) * 0.9 + exp(-r * 18.0) * 0.6;
        vec3 c = uColor * core * 2.2 + uGlow * glow * (1.0 - core);
        gl_FragColor = vec4(c * uOpacity * smoothstep(1.0, 0.6, r), 1.0); }`,
  });
  const d = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
  d.renderOrder = -9; d.frustumCulled = false; d.visible = false;
  scene.add(d);
  return d;
})();
const col = (hex) => new THREE.Color(hex);
const pre = (hex) => W.preTone(hex, EXPOSURE);
function readState() {
  const c = clouds[0].material.uniforms;
  return {
    sunDir: SUN.clone(), sunColor: sun.color.clone(), sunI: sun.intensity,
    hemiSky: hemi.color.clone(), hemiGround: hemi.groundColor.clone(), hemiI: hemi.intensity,
    env: scene.environmentIntensity, exposure: renderer.toneMappingExposure, fog: scene.fog.color.clone(),
    sky: Object.fromEntries(SKY_KEYS.map((k) => [k, sky.material.uniforms[k].value.clone()])), skySun: SKY_SUN0.clone(),
    cloudLit: c.uLit.value.clone(), cloudShade: c.uShade.value.clone(), cloudHaze: c.uHazeCol.value.clone(), cloudSun: CLOUD_SUN0.clone(),
    cloudHazeAmt: clouds.map((x) => x.material.uniforms.uHaze.value),
    grass: Object.fromEntries(GRASS_KEYS.map((k) => [k, grassU[k].value.clone()])),
    stars: 0, discOp: 0, discDir: SUN.clone(), discColor: new THREE.Color(0, 0, 0), discGlow: new THREE.Color(0, 0, 0), discSize: 9000, discCore: 0.12,
    fxColor: fxSun.color.clone(), fxI: fxSun.intensity,
  };
}
const DAY = readState(); // the locked hero look, captured from the scene as built
function preset(o) {
  const b = readState();
  const dir = (v) => new THREE.Vector3(...v).normalize();
  return {
    ...b, sunDir: dir(o.sunDir), sunColor: col(o.sun), sunI: o.sunI, hemiSky: col(o.hemiSky), hemiGround: col(o.hemiGround), hemiI: o.hemiI,
    env: o.env, exposure: o.exposure, fog: pre(o.fog),
    sky: Object.fromEntries(SKY_KEYS.map((k) => [k, pre(o.sky[k])])), skySun: dir(o.sunDir),
    cloudLit: pre(o.cloud[0]), cloudShade: pre(o.cloud[1]), cloudHaze: pre(o.cloud[2]), cloudSun: dir(o.cloudSun),
    cloudHazeAmt: DAY.cloudHazeAmt.map((h) => Math.max(h, o.haze)),
    grass: Object.fromEntries(GRASS_KEYS.map((k, i) => [k, col(o.grass[i])])),
    stars: o.stars, discOp: o.disc[0], discDir: dir(o.discDir || o.sunDir), discColor: col(o.disc[1]), discGlow: col(o.disc[2]), discSize: o.disc[3], discCore: o.disc[4],
    fxColor: col(o.fx[0]), fxI: o.fx[1],
  };
}
const TOD = {
  day: DAY,
  sunset: preset({
    sunDir: [-0.36, 0.15, -0.92], sun: '#ffac6e', sunI: 3.9, hemiSky: '#c49ad2', hemiGround: '#4c3a1c', hemiI: 0.24, env: 0.12, exposure: 1.0,
    fog: '#eaa57c', sky: { uTop: '#1b2766', uMid: '#55479a', uLow: '#e2866b', uHor: '#ffc580', uGround: '#6b5331' },
    cloud: ['#ffd1a0', '#7c5a88', '#f2b08c'], cloudSun: [-0.92, 0.18, 0.35], haze: 0.10,
    grass: ['#2c6216', '#56982a', '#88b63a', '#c4bd52'],
    stars: 0.12, disc: [1, '#ffd27e', '#ff8a3c', 12000, 0.085], fx: ['#ffd6ae', 4.7],
  }),
  night: preset({
    sunDir: [0.46, 0.44, -0.77], sun: '#a8bfff', sunI: 1.7, hemiSky: '#3b58a6', hemiGround: '#0b1910', hemiI: 0.32, env: 0.08, exposure: 1.06,
    fog: '#17233f', sky: { uTop: '#02050f', uMid: '#071432', uLow: '#132755', uHor: '#223e6b', uGround: '#0d1913' },
    cloud: ['#7f91bb', '#1c2542', '#22325a'], cloudSun: [0.62, 0.55, 0.55], haze: 0.18,
    grass: ['#10331f', '#1f5634', '#317244', '#4c7d4e'],
    stars: 1, disc: [0.95, '#eef2ff', '#6f8fd8', 5200, 0.16], fx: ['#bccbff', 3.2],
  }),
};
const _v = new THREE.Vector3();
function applyState(st) {
  sun.color.copy(st.sunColor); sun.intensity = st.sunI;
  sun.position.copy(sun.target.position).addScaledVector(st.sunDir, 6000);
  hemi.color.copy(st.hemiSky); hemi.groundColor.copy(st.hemiGround); hemi.intensity = st.hemiI;
  scene.environmentIntensity = st.env; renderer.toneMappingExposure = st.exposure; scene.fog.color.copy(st.fog);
  for (const k of SKY_KEYS) sky.material.uniforms[k].value.copy(st.sky[k]);
  sky.material.uniforms.uSun.value.copy(st.skySun);
  clouds.forEach((c, i) => { const u = c.material.uniforms; u.uLit.value.copy(st.cloudLit); u.uShade.value.copy(st.cloudShade); u.uHazeCol.value.copy(st.cloudHaze); u.uSun.value.copy(st.cloudSun); u.uHaze.value = st.cloudHazeAmt[i]; });
  for (const k of GRASS_KEYS) grassU[k].value.copy(st.grass[k]);
  stars.material.uniforms.uOpacity.value = st.stars; stars.visible = st.stars > 0.002;
  const du = disc.material.uniforms;
  du.uOpacity.value = st.discOp; du.uColor.value.copy(st.discColor); du.uGlow.value.copy(st.discGlow); du.uCore.value = st.discCore;
  disc.visible = st.discOp > 0.002; disc.userData.dir = st.discDir; disc.scale.setScalar(st.discSize);
  fxSun.color.copy(st.fxColor); fxSun.intensity = st.fxI;
  markShadow(); markFx();
}
function mixState(a, b, t, out) {
  const L = (x, y) => x + (y - x) * t;
  out.sunDir.copy(a.sunDir).lerp(b.sunDir, t).normalize(); out.sunColor.copy(a.sunColor).lerp(b.sunColor, t); out.sunI = L(a.sunI, b.sunI);
  out.hemiSky.copy(a.hemiSky).lerp(b.hemiSky, t); out.hemiGround.copy(a.hemiGround).lerp(b.hemiGround, t); out.hemiI = L(a.hemiI, b.hemiI);
  out.env = L(a.env, b.env); out.exposure = L(a.exposure, b.exposure); out.fog.copy(a.fog).lerp(b.fog, t);
  for (const k of SKY_KEYS) out.sky[k].copy(a.sky[k]).lerp(b.sky[k], t);
  out.skySun.copy(a.skySun).lerp(b.skySun, t).normalize();
  out.cloudLit.copy(a.cloudLit).lerp(b.cloudLit, t); out.cloudShade.copy(a.cloudShade).lerp(b.cloudShade, t); out.cloudHaze.copy(a.cloudHaze).lerp(b.cloudHaze, t);
  out.cloudSun.copy(a.cloudSun).lerp(b.cloudSun, t).normalize();
  out.cloudHazeAmt = a.cloudHazeAmt.map((h, i) => L(h, b.cloudHazeAmt[i]));
  for (const k of GRASS_KEYS) out.grass[k].copy(a.grass[k]).lerp(b.grass[k], t);
  out.stars = L(a.stars, b.stars);
  // the disc fades out, swaps body (sun <-> moon), and fades in, rather than sliding across the sky
  const swap = a.discDir.distanceTo(b.discDir) > 0.01;
  if (swap && t < 0.5) { out.discDir.copy(a.discDir); out.discColor.copy(a.discColor); out.discGlow.copy(a.discGlow); out.discSize = a.discSize; out.discCore = a.discCore; out.discOp = a.discOp * (1 - t * 2); }
  else if (swap) { out.discDir.copy(b.discDir); out.discColor.copy(b.discColor); out.discGlow.copy(b.discGlow); out.discSize = b.discSize; out.discCore = b.discCore; out.discOp = b.discOp * (t * 2 - 1); }
  else { out.discDir.copy(b.discDir); out.discColor.copy(a.discColor).lerp(b.discColor, t); out.discGlow.copy(a.discGlow).lerp(b.discGlow, t); out.discSize = L(a.discSize, b.discSize); out.discCore = L(a.discCore, b.discCore); out.discOp = L(a.discOp, b.discOp); }
  out.fxColor.copy(a.fxColor).lerp(b.fxColor, t); out.fxI = L(a.fxI, b.fxI);
  return out;
}
let tod = 'day', todFrom = null, todTo = DAY, todT0 = 0;
const TOD_MS = 1400;
const todCur = readState();
function initialTimeOfDay() {
  try { const v = localStorage.getItem('kz.tod'); if (TOD[v]) return v; } catch (_) {}
  const h = new Date().getHours();
  return h >= 6 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'sunset' : 'night';
}
function setTimeOfDay(name, { instant = false, remember = true } = {}) {
  if (!TOD[name]) return;
  tod = name;
  document.documentElement.dataset.tod = name;
  (stage.todListeners || []).forEach((f) => f(name));
  if (remember) { try { localStorage.setItem('kz.tod', name); } catch (_) {} }
  if (instant || paused || SHOT) { todFrom = null; todTo = TOD[name]; applyState(TOD[name]); mixState(TOD[name], TOD[name], 1, todCur); return; }
  todFrom = mixState(todCur, todCur, 1, readState()); // snapshot of where we are now (mid-fade safe)
  todTo = TOD[name]; todT0 = performance.now();
}
stage.onFrame((now) => {
  stars.position.copy(camera.position); stars.material.uniforms.uTime.value = now / 1000; stars.material.uniforms.uDpr.value = DPR;
  if (disc.visible) { disc.position.copy(camera.position).addScaledVector(disc.userData.dir, 45000); disc.quaternion.copy(camera.quaternion); }
  if (!todFrom) return;
  const t = Math.min(1, (now - todT0) / TOD_MS), e = t * t * (3 - 2 * t);
  if (t >= 1) { todFrom = null; applyState(todTo); mixState(todTo, todTo, 1, todCur); return; } // exact end values (Day == locked look)
  applyState(mixState(todFrom, todTo, e, todCur));
});
stage.getTimeOfDay = () => tod;
stage.todListeners = stage.todListeners || [];

// ------------------------------------------------------------------ effects (grain / CRT)
function setEffects({ grain, crt }) {
  if (grain !== undefined) {
    finish.uniforms.uGrain.value = grain ? GRAIN : 0;
    document.getElementById('grain').style.display = grain ? '' : 'none';
  }
  if (crt !== undefined) document.documentElement.classList.toggle('kz-crt', !!crt);
}

// ------------------------------------------------------------------ resize, DPR, visibility
function applySize(w, h) {
  view.w = w; view.h = h;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan((h / 2) / D));
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setSize(w, h); composer.setSize(w, h); fxRenderer.setSize(w, h); cssRenderer.setSize(w, h); labelRenderer.setSize(w, h);
  finish.uniforms.uRes.value.set(w, h);
  markFx(); markCss(); markShadow();
}
// live resize: keep D (so z = 0 stays 1 unit = 1 px) and widen/narrow the FOV instead of re-laying out the world
if (!SHOT) addEventListener('resize', () => { applySize(innerWidth, innerHeight); wm.onViewport(); });
function setDPR(d) {
  if (d === DPR) return;
  DPR = d;
  renderer.setPixelRatio(d); composer.setPixelRatio(d); composer.setSize(view.w, view.h);
  fxRenderer.setPixelRatio(d); fxRenderer.setSize(view.w, view.h);
  finish.uniforms.uDpr.value = d;
  markFx(); markShadow();
}

let paused = true, rafId = 0, last = 0, t0 = performance.now();
let simT = 0; // seconds of animation time (frozen while paused, so nothing jumps on resume)
function setPaused(p) {
  p = !!p;
  if (p === paused) return;
  paused = p;
  if (p) { cancelAnimationFrame(rafId); rafId = 0; }
  else if (!document.hidden) { last = 0; rafId = requestAnimationFrame(loop); }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAnimationFrame(rafId); rafId = 0; }
  else if (!paused && !rafId) { last = 0; rafId = requestAnimationFrame(loop); }
});

// frame stats (?fps overlay) + adaptive resolution
const stats = { frames: 0, acc: 0, win: [], dropped: false, el: null, lastShow: 0, fx0: 0, sh0: 0 };
if (FPS) {
  stats.el = document.createElement('div');
  stats.el.id = 'kz-fps';
  document.body.appendChild(stats.el);
}
let adaptT = 0;
function trackFrame(now, dt) {
  stats.win.push(dt); if (stats.win.length > 120) stats.win.shift();
  // adaptive: average frame > 20 ms for ~2 s -> drop to DPR 1.0
  adaptT += dt;
  if (!SHOT && DPR > 1 && adaptT > 3000 && stats.win.length >= 120) {
    const avg = stats.win.reduce((a, b) => a + b, 0) / stats.win.length;
    if (avg > 20) { setDPR(1); stats.dropped = true; stats.win.length = 0; }
  }
  if (stats.el && now - stats.lastShow > 500) {
    const n = stats.win.length, avg = n ? stats.win.reduce((a, b) => a + b, 0) / n : 0;
    const sorted = stats.win.slice().sort((a, b) => a - b), p95 = n ? sorted[Math.floor(n * 0.95)] : 0;
    const secs = (now - stats.lastShow) / 1000;
    stats.el.textContent = `${(1000 / Math.max(avg, 0.001)).toFixed(0)} fps · ${avg.toFixed(1)} ms (p95 ${p95.toFixed(1)})\nDPR ${DPR}${stats.dropped ? ' (adaptive)' : ''} · draws ${renderer.info.render.calls} · tris ${(renderer.info.render.triangles / 1e6).toFixed(2)}M\nshadow ${((shadowRenders - stats.sh0) / secs).toFixed(0)}/s · fx ${((fxRenders - stats.fx0) / secs).toFixed(0)}/s · grass ${GRASS_COUNT}`;
    stats.sh0 = shadowRenders; stats.fx0 = fxRenders; stats.lastShow = now;
  }
  window.__kzStats = stats;
}

const camTarget = new THREE.Vector3();
let shadowClock = 0;
const SHADOW_HZ = 15;
function loop(now) {
  rafId = requestAnimationFrame(loop);
  const dt = last ? Math.min(100, now - last) : 16.7;
  last = now;
  trackFrame(now, dt);
  simT += dt / 1000;
  const t = T_SHOT + simT;
  // icon hover easing
  for (const o of iconObjs) {
    if (o.hover !== o.hoverT) { o.hover += (o.hoverT - o.hover) * Math.min(1, dt / 70); if (Math.abs(o.hover - o.hoverT) < 0.002) o.hover = o.hoverT; }
  }
  update(t);
  for (const c of clouds) c.position.x += c.userData.drift * dt / 1000;
  // icon bob shadows refresh at ~15 Hz (anything else that moves marks the shadow dirty itself)
  shadowClock += dt;
  if (shadowClock > 1000 / SHADOW_HZ) { shadowClock = 0; shadowDirty = true; }
  for (const f of frameHooks) f(now, dt);
  // gentle mouse parallax over the desktop; eases back to the crisp rest pose when idle, over UI, or while working a window
  const idle = !ptr.has || now - ptr.t > 1500;
  const working = ptr.overUI || holdCount > 0 || wm.blocksParallax();
  const k = (idle || working || ptr.touch || MOBILE) ? 0 : 1;
  camTarget.set(REST_LIVE.x + ptr.nx * 36 * k, REST_LIVE.y - ptr.ny * 20 * k, REST_LIVE.z);
  const camMoving = camera.position.x !== camTarget.x || camera.position.y !== camTarget.y;
  if (camMoving) {
    // drift with the mouse gently; snap back quickly (and exactly) once the pointer is working a window
    camera.position.lerp(camTarget, 1 - Math.pow(1 - (working ? 0.2 : 0.06), dt / 16.7));
    if (camera.position.distanceTo(camTarget) < 0.05) camera.position.copy(camTarget);
    camera.updateMatrixWorld();
    markCss(); markFx();
  }
  // the 3D cursor follows the pointer on its own plane in front of the desktop (tip exactly under the pointer)
  if (ptr.has && (ptr.moved || camMoving) && cursor.visible) {
    _ndc.set(ptr.nx, -ptr.ny);
    raycaster.setFromCamera(_ndc, camera);
    _cplane.constant = -CUR_Z;
    if (raycaster.ray.intersectPlane(_cplane, _hit)) { cursor.position.copy(_hit); cursorProxy.position.copy(_hit); markFx(); markShadow(); }
    // keep the face-shadow camera centred where the cursor's shadow lands on the desktop plane
    fxSun.target.position.set(_hit.x - SUN.x * _hit.z / SUN.z, _hit.y - SUN.y * _hit.z / SUN.z, 0);
    fxSun.position.copy(fxSun.target.position).addScaledVector(SUN, 6000);
  }
  if (ptr.moved || camMoving) setHover(ptr.has && !ptr.overUI && !ptr.touch ? pickIcon(ptr.x, ptr.y) : null);
  ptr.moved = false;
  render();
}

// ------------------------------------------------------------------ start
async function start() {
  try { await document.fonts.ready; } catch (_) {}
  if (SHOT) {
    placeShotCamera();
    wm.openInternal('welcome', { instant: true });
    update(T_SHOT);
    markFx(); markCss(); markShadow();
    render();
    await new Promise((r) => requestAnimationFrame(r));
    markFx(); markCss(); markShadow(); render();
    await new Promise((r) => requestAnimationFrame(r));
    markFx(); markCss(); markShadow(); render();
    window.__kzReady = true;
    document.title = 'ready';
    return;
  }
  // live: rest pose, warm the GPU (shader compile) under the boot screen, then hand over to the shell
  camera.position.copy(REST_LIVE); camera.rotation.set(0, 0, 0); camera.updateMatrixWorld();
  cursor.visible = false; cursorProxy.visible = false;
  cursor.position.copy(CUR_HERO); cursorProxy.position.copy(CUR_HERO);
  setTimeOfDay(initialTimeOfDay(), { instant: true, remember: false });
  renderOnce();
  window.__kzReady = true;
  shell.start({
    showDesktop() { setPaused(false); },
    hideDesktop() { setPaused(true); },
  });
}
start();
