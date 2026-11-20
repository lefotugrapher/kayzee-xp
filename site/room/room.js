// Kayzee XP: the room. The look is a film-quality Blender (Cycles) render projected back onto the real 3D
// geometry from two viewpoints (the seat, and a close-up in front of the monitor), so the camera can drift,
// push in and park on the CRT, where the live site takes over the glass.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const params = new URLSearchParams(location.search);
const SHOT = params.has('shot');
const DPR = Math.min(devicePixelRatio, 2);
const MAX_FOV = 67;                                   // the seat render covers 72°, so every screen shape stays inside it
const B = (a) => new THREE.Vector3(a[0], a[2], -a[1]); // Blender (x, y, z-up) -> three (x, y-up, z)
// a personal link (/hi/<slug>, made on the admin page) greets one recruiter by name and opens what they should see first
const SLUG = ((location.pathname.match(/^\/hi\/([a-z0-9-]{1,40})\/?$/i) || [])[1] || params.get('for') || '').toLowerCase();
const siteP = fetch('/api/site').then((r) => (r.ok ? r.json() : Promise.reject())).catch(() => fetch('/data/site.json').then((r) => r.json())).catch(() => ({ settings: {}, projects: [] }));
const linkP = SLUG ? fetch('/api/link?s=' + encodeURIComponent(SLUG)).then((r) => (r.ok ? r.json() : null)).then((j) => (j && j.ok ? j : null)).catch(() => null) : Promise.resolve(null);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: SHOT });
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;           // the renders are already graded in Blender (AgX)
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x140c07);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.02, 60);

// ---------------------------------------------------------------- load
const bar = document.querySelector('#loadbar i');
const prog = { meta: 0, glb: 0, a: 0 };
const showP = () => { bar.style.width = Math.round(4 + 172 * (prog.meta * 0.05 + prog.glb * 0.45 + prog.a * 0.5)) + 'px'; };
const texLoader = new THREE.TextureLoader();
function loadTex(url) {
  return texLoader.loadAsync(url).then((t) => {
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = true;
    return t;
  });
}
const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/libs/draco/');
const gltfLoader = new GLTFLoader().setDRACOLoader(draco);
const [meta, gltf, texA] = await Promise.all([
  fetch('/room/room.json').then((r) => r.json()).then((m) => { prog.meta = 1; showP(); return m; }),
  gltfLoader.loadAsync('/room/room.glb', (e) => { if (e.total) { prog.glb = e.loaded / e.total; showP(); } }).then((g) => { prog.glb = 1; showP(); return g; }),
  loadTex('/room/projA.jpg').then((t) => { prog.a = 1; showP(); return t; }),
]);

function projector(c) {
  const cam = new THREE.PerspectiveCamera(c.fov, 1, PN, PF);
  cam.position.copy(B(c.pos)); cam.up.copy(B(c.up)); cam.lookAt(B(c.pos).add(B(c.fwd)));
  cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
  return { cam, vp: new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse) };
}
const PN = 0.1, PF = 14;
const projA = projector(meta.camA), projB = projector(meta.camB);
const roomMat = new THREE.ShaderMaterial({
  uniforms: { tA: { value: texA }, tAoff: { value: texA }, tB: { value: texA }, uVPa: { value: projA.vp }, uVPb: { value: projB.vp }, tDa: { value: null }, tDb: { value: null },
              uCa: { value: projA.cam.position.clone() }, uCb: { value: projB.cam.position.clone() },
              uMixB: { value: 0 }, uHasB: { value: 0 }, uLamp: { value: 1 }, uHasOff: { value: 0 },
              uHot: { value: 0 }, uHotMin: { value: new THREE.Vector3() }, uHotMax: { value: new THREE.Vector3() },
              uB0: { value: Number(params.get('b0') || 0.004) }, uBs: { value: Number(params.get('bs') || 1.1) } },
  vertexShader: `
    uniform mat4 uVPa, uVPb; varying vec4 vPa, vPb; varying vec3 vW;
    void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vPa = uVPa * w; vPb = uVPb * w; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `
    uniform sampler2D tA, tAoff, tB, tDa, tDb; uniform float uMixB, uHasB, uLamp, uHasOff, uHot, uB0, uBs;
    uniform vec3 uCa, uCb, uHotMin, uHotMax; varying vec4 vPa, vPb; varying vec3 vW;
    float lin(float d){ return (2.0 * ${PN.toFixed(2)} * ${PF.toFixed(1)}) / (${(PF + PN).toFixed(2)} - (d * 2.0 - 1.0) * ${(PF - PN).toFixed(2)}); }
    // how much depth slack a surface needs: more when the projector sees it at a grazing angle, hardly any when face-on
    // (a small slack keeps thin things like the lamp arm and the lanyard from being painted onto whatever is behind them)
    float slack(vec3 n, vec3 c, float dist, float per){ float k = max(abs(dot(n, normalize(c - vW))), 0.05); return clamp(uB0 + dist * per * uBs * sqrt(1.0 - k * k) / k, uB0, 0.02); }
    float seen(sampler2D dm, vec2 uv, float fd, float b){
      vec2 c = clamp(uv, 0.003, 0.997); const float T = 1.0 / 2048.0;
      // farthest of five neighbouring depth samples: steep or curved surfaces stop striping
      float far = max(max(texture2D(dm, c).r, texture2D(dm, c + vec2(T, 0.0)).r), max(texture2D(dm, c - vec2(T, 0.0)).r, max(texture2D(dm, c + vec2(0.0, T)).r, texture2D(dm, c - vec2(0.0, T)).r)));
      // nearest a little further out: right beside the outline of something in front, the render holds that thing's soft edge, so skip it
      float near = min(min(texture2D(dm, c + vec2(2.0 * T, 0.0)).r, texture2D(dm, c - vec2(2.0 * T, 0.0)).r), min(texture2D(dm, c + vec2(0.0, 2.0 * T)).r, texture2D(dm, c - vec2(0.0, 2.0 * T)).r));
      return step(fd, lin(far) + b) * step(fd, lin(near) + 0.012 + b * 2.0);
    }
    float inside(vec2 uv, float w){ vec2 e = smoothstep(vec2(0.0), vec2(0.02), uv) * smoothstep(vec2(0.0), vec2(0.02), 1.0 - uv); return e.x * e.y * step(0.0, w); }
    // a spot neither camera could see (it was hidden behind something): borrow the picture from just beside the thing in the way
    vec3 fill(sampler2D tex, sampler2D tex2, float k2, sampler2D dm, vec2 uv, float fd, vec3 fallback){
      vec3 acc = vec3(0.0); float n = 0.0;
      for (int r = 0; r < 6; r++){
        float rad = 0.0025 * pow(1.8, float(r)), wr = 1.0 / (1.0 + float(r) * float(r));
        for (int k = 0; k < 8; k++){
          float a = float(k) * 0.7853982 + float(r) * 0.39;
          vec2 q = uv + vec2(cos(a), sin(a)) * rad;
          if (q.x < 0.002 || q.y < 0.002 || q.x > 0.998 || q.y > 0.998) continue;
          float d = lin(texture2D(dm, q).r);
          if (d > fd - 0.02 && d < fd + 0.5){ acc += mix(texture2D(tex2, q).rgb, texture2D(tex, q).rgb, k2) * wr; n += wr; }
        }
        if (n > 2.5) break;
      }
      return n > 0.0 ? acc / n : fallback * 0.5;
    }
    void main(){
      vec2 ua = vPa.xy / vPa.w * 0.5 + 0.5, ub = vPb.xy / vPb.w * 0.5 + 0.5;
      vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
      float ina = inside(ua, vPa.w), inb = inside(ub, vPb.w) * uHasB;
      float ia = ina * seen(tDa, ua, vPa.w, slack(n, uCa, vPa.w, ${(2 * Math.tan(meta.camA.fov * Math.PI / 360) / 2048).toFixed(6)})), ib = inb * seen(tDb, ub, vPb.w, slack(n, uCb, vPb.w, ${(2 * Math.tan(meta.camB.fov * Math.PI / 360) / 2048).toFixed(6)}));
      vec2 ca2 = clamp(ua, 0.001, 0.999);
      vec3 ca = texture2D(tA, ca2).rgb;
      if (uHasOff > 0.5 && uLamp < 0.999) ca = mix(texture2D(tAoff, ca2).rgb, ca, uLamp);
      vec3 cb = texture2D(tB, clamp(ub, 0.001, 0.999)).rgb;
      vec3 col;
      if (ia + ib < 0.02) {
        if (inb > 0.5 && (uMixB > 0.5 || ina < 0.02)) col = fill(tB, tB, 1.0, tDb, ub, vPb.w, cb);
        else if (ina > 0.02) col = fill(tA, tAoff, uHasOff > 0.5 ? uLamp : 1.0, tDa, ua, vPa.w, ca);
        else col = ca;
      } else {
        float wb = ib * max(uMixB, 1.0 - ia);
        col = mix(ca, cb, wb);
      }
      // standing where a render was taken, that render is exactly right as it is: use it untouched (no seams at all from the chair or on the glass)
      col = mix(col, ca, ina * (1.0 - smoothstep(0.04, 0.09, distance(cameraPosition, uCa))));
      col = mix(col, cb, inb * uMixB * (1.0 - smoothstep(0.003, 0.02, distance(cameraPosition, uCb))));
      ${params.get('only') === 'a' ? 'col = ia > 0.5 ? ca : vec3(1.0, 0.0, 1.0);' : params.get('only') === 'b' ? 'col = ib > 0.5 ? cb : vec3(1.0, 0.0, 1.0);' : ''}
      ${params.has('dbg') ? 'if (ia + ib < 0.02) col = vec3(1.0, 0.0, 1.0); else if (ia < 0.5) col *= vec3(0.6, 1.0, 0.6); else if (ib < 0.5) col *= vec3(1.0, 0.7, 0.7);' : ''}
      if (uHot > 0.001) { vec3 q = step(uHotMin, vW) * step(vW, uHotMax); col *= 1.0 + 0.30 * uHot * q.x * q.y * q.z; }
      gl_FragColor = vec4(col, 1.0);
    }`,
  side: THREE.DoubleSide,
});

// ---------------------------------------------------------------- CRT screen (canvas → texture → tube shader)
const scr = document.createElement('canvas'); scr.width = 1024; scr.height = 768;
const g = scr.getContext('2d');
const scrTex = new THREE.CanvasTexture(scr); scrTex.colorSpace = THREE.SRGBColorSpace;
const desk = new Image(); desk.src = '/room/desktop.jpg';
let power = 0, bootT = -1;
function roundRect(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
let saver = false; const sv = { x: 300, y: 200, vx: 150, vy: 110, hue: 28 };
function drawSaver(dt) {
  sv.x += sv.vx * dt; sv.y += sv.vy * dt;
  if (sv.x < 20 || sv.x > 1024 - 380) { sv.vx *= -1; sv.x = Math.max(20, Math.min(1024 - 380, sv.x)); sv.hue = (sv.hue + 67) % 360; }
  if (sv.y < 90 || sv.y > 768 - 40) { sv.vy *= -1; sv.y = Math.max(90, Math.min(768 - 40, sv.y)); sv.hue = (sv.hue + 67) % 360; }
  g.textAlign = 'left'; g.fillStyle = `hsl(${sv.hue} 90% 62%)`; g.font = 'bold 84px Tahoma, Verdana, sans-serif'; g.fillText('Kayzee', sv.x, sv.y);
  g.font = 'bold 44px Tahoma, Verdana, sans-serif'; g.fillStyle = '#fff'; g.fillText('xp', sv.x + 300, sv.y - 44);
}
function drawScreen(dt = 0.016) {
  g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 768);
  if (bootT < 0) return;
  if (saver && bootT > 4) { drawSaver(dt); return; }
  if (bootT < 3.4) {
    g.fillStyle = '#fff'; g.font = 'bold 120px Tahoma, Verdana, sans-serif'; g.textAlign = 'center'; g.fillText('Kayzee', 500, 400);
    g.fillStyle = '#ff7a1a'; g.font = 'bold 60px Tahoma, Verdana, sans-serif'; g.fillText('xp', 735, 330);
    g.fillStyle = '#fff'; g.font = 'bold 26px Tahoma, Verdana, sans-serif'; g.textAlign = 'left'; g.fillText('Kshitiz Mittal®', 318, 290);
    g.strokeStyle = '#b8b8b8'; g.lineWidth = 3; roundRect(392, 500, 240, 26, 8); g.stroke();
    const p = ((bootT * 0.62) % 1) * 300 - 50;
    for (let i = 0; i < 3; i++) {
      const x = 392 + p + i * 22; if (x < 396 || x > 610) continue;
      const gr = g.createLinearGradient(0, 504, 0, 522); gr.addColorStop(0, '#9fb6ff'); gr.addColorStop(0.5, '#2a52e8'); gr.addColorStop(1, '#5b7dff');
      g.fillStyle = gr; g.fillRect(x, 504, 16, 18);
    }
  } else if (desk.complete && desk.naturalWidth) {
    g.globalAlpha = Math.min(1, (bootT - 3.4) / 0.6); g.drawImage(desk, 0, 0, 1024, 768); g.globalAlpha = 1;
  }
}
const crtMat = new THREE.ShaderMaterial({
  uniforms: { uTex: { value: scrTex }, uTime: { value: 0 }, uPower: { value: 0 }, uBlank: { value: 0 }, uFlipY: { value: params.has('flip') ? 0 : 1 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D uTex; uniform float uTime, uPower, uFlipY, uBlank; varying vec2 vUv;
    void main(){
      vec2 uv = vUv; if (uFlipY > 0.5) uv.y = 1.0 - uv.y;
      vec2 c = uv - 0.5; float r2 = dot(c, c);
      vec2 d = 0.5 + c * (1.0 + 0.03 * r2);
      float inside = step(0.0, d.x) * step(d.x, 1.0) * step(0.0, d.y) * step(d.y, 1.0);
      vec3 col = texture2D(uTex, d).rgb;
      col *= 0.86 + 0.14 * sin(d.y * 768.0 * 3.14159);
      col *= 1.0 - 0.55 * r2 * 2.2;
      col += vec3(0.02, 0.03, 0.035);
      float open = smoothstep(0.0, 1.0, uPower);
      float band = 1.0 - smoothstep(open * 0.5, open * 0.5 + 0.004, abs(uv.y - 0.5));
      float flash = (1.0 - smoothstep(0.0, 0.35, uPower)) * smoothstep(0.0, 0.05, uPower);
      col = mix(vec3(0.012, 0.016, 0.016), col * band + vec3(flash) * band, step(0.001, uPower));
      col *= 0.97 + 0.03 * sin(uTime * 60.0);
      gl_FragColor = vec4(col * inside * 1.15 * (1.0 - uBlank), 1.0);
      #include <colorspace_fragment>
    }`,
});

let screenMesh = null;
const pickables = [], roomMeshes = [];
gltf.scene.traverse((o) => {
  if (!o.isMesh) return;
  if (/screen/i.test(o.name) || /screen/i.test(o.parent?.name || '')) { o.material = crtMat; screenMesh = o; }
  else { o.material = roomMat; roomMeshes.push(o); }
  pickables.push(o);
});
scene.add(gltf.scene);
scene.updateMatrixWorld(true);
// depth as seen from each projector, so a render is only used on surfaces that projector could really see
function depthFrom(cam) {
  const rt = new THREE.WebGLRenderTarget(2048, 2048, { depthTexture: new THREE.DepthTexture(2048, 2048, THREE.UnsignedIntType) });
  rt.depthTexture.minFilter = rt.depthTexture.magFilter = THREE.NearestFilter;
  scene.overrideMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(null);
  scene.overrideMaterial = null;
  return rt.depthTexture;
}
roomMat.uniforms.tDa.value = depthFrom(projA.cam); roomMat.uniforms.tDb.value = depthFrom(projB.cam);
const screenCenter = B(meta.screen.center), screenNormal = new THREE.Vector3(0, 0, 1), screenH = meta.screen.h;

// ---------------------------------------------------------------- live atmosphere: sun shaft, dust in the beam, fairy-light glow
const SUN = B(meta.sunDir).normalize();
const W = meta.window;
const WIN = B([(W.x0 + W.x1) / 2, W.y - 0.04, (W.z0 + W.z1) / 2 + 0.1]);
const BEAM_LEN = 2.6;
const beamGroup = new THREE.Group();
const beamMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uStrength: { value: Number(params.get('beam') || 0.05) } },
  vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform float uTime, uStrength; varying vec3 vP;
    void main(){
      float along = vP.z / ${BEAM_LEN.toFixed(2)};
      float ex = 1.0 - smoothstep(0.10, 0.27, abs(vP.x));
      float ey = 1.0 - smoothstep(0.25, 0.48, abs(vP.y));
      float bars = 0.75 + 0.25 * smoothstep(0.02, 0.06, abs(vP.x)) * smoothstep(0.02, 0.06, abs(vP.y - 0.12));   // window cross
      float fall = smoothstep(0.0, 0.08, along) * (1.0 - smoothstep(0.35, 1.0, along));
      float shimmer = 0.85 + 0.15 * sin(vP.x * 9.0 + uTime * 0.6) * sin(vP.y * 7.0 - uTime * 0.4);
      float a = ex * ey * bars * fall * shimmer * uStrength;
      gl_FragColor = vec4(vec3(1.0, 0.72, 0.42) * a, a);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});
{
  const geo = new THREE.BoxGeometry(0.56, 0.98, BEAM_LEN, 1, 1, 1); geo.translate(0, 0, BEAM_LEN / 2);
  const beam = new THREE.Mesh(geo, beamMat); beam.renderOrder = 5; beamGroup.add(beam);
  beamGroup.position.copy(WIN); beamGroup.lookAt(WIN.clone().add(SUN)); scene.add(beamGroup);
}
// dust: only motes that sit inside the sunbeam (traced back to the window opening)
const dustMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uDpr: { value: DPR } },
  vertexShader: `
    attribute float seed; uniform float uTime, uDpr; varying float vA;
    void main(){
      vec3 p = position;
      p.x += sin(uTime * 0.13 + seed) * 0.04; p.y += sin(uTime * 0.09 + seed * 1.7) * 0.05; p.z += cos(uTime * 0.11 + seed * 0.7) * 0.04;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vA = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.5 + fract(seed) * 1.3) + seed * 5.0));
      gl_PointSize = (1.4 + fract(seed * 3.1) * 2.2) * uDpr * (1.3 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA * 0.5; gl_FragColor = vec4(vec3(1.0, 0.80, 0.52) * a, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
{
  const s = meta.sunDir, pos = [], seed = [];
  let tries = 0;
  while (pos.length < 520 * 3 && tries++ < 60000) {
    const p = [-0.7 + Math.random() * 2.3, -1.3 + Math.random() * 2.05, 0.25 + Math.random() * 1.9];
    const t = (p[1] - W.y) / s[1]; if (t < 0) continue;
    const hx = p[0] - s[0] * t, hz = p[2] - s[2] * t;
    if (hx < W.x0 + 0.1 || hx > W.x1 - 0.08 || hz < W.z0 + 0.12 || hz > W.z1) continue;
    const v = B(p); pos.push(v.x, v.y, v.z); seed.push(Math.random() * 100);
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); dg.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 1));
  const dust = new THREE.Points(dg, dustMat); dust.renderOrder = 6; dust.frustumCulled = false; scene.add(dust);
}
// fairy lights: soft twinkling glow on each bulb
const glowMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uDpr: { value: DPR }, uParty: { value: 0 } },
  vertexShader: `
    attribute float seed; uniform float uTime, uDpr; varying float vA; varying float vS;
    void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vS = seed;
      vA = 0.55 + 0.45 * sin(uTime * (0.7 + fract(seed) * 1.6) + seed * 9.0);
      gl_PointSize = 26.0 * uDpr * (1.6 / -mv.z); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uParty, uTime; varying float vA; varying float vS; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - d), 2.2) * vA * 0.55 * (1.0 + uParty * 1.6);
      vec3 c = mix(vec3(1.0, 0.70, 0.36), 0.5 + 0.5 * cos(6.2832 * (vS * 0.37 + uTime * 0.7 + vec3(0.0, 0.33, 0.67))), uParty); gl_FragColor = vec4(c * a, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
{
  const pos = [], seed = [];
  for (const b of meta.bulbs || []) { const v = B(b); pos.push(v.x, v.y, v.z + 0.012); seed.push(Math.random() * 100); }
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 1));
  const pts = new THREE.Points(gg, glowMat); pts.renderOrder = 7; pts.frustumCulled = false; scene.add(pts);
}

// ---------------------------------------------------------------- the push-in as a short pre-rendered film
// Moving between the two renders by re-projection always leaves thin seams where one thing passes in front of another.
// So the move itself is 48 real Blender frames along the same camera path, played as a film behind the live extras
// (screen, notes, fairy-light glow, dust), which stay in register because the page moves its camera along that path too.
const PATH = { frames: 48, fps: 24, t0: Math.tan(36 * Math.PI / 180), t1: Math.tan(meta.camB.fov * Math.PI / 360) };
const filmMat = new THREE.ShaderMaterial({
  uniforms: { tV: { value: null }, uScale: { value: new THREE.Vector2(1, 1) } },
  vertexShader: `uniform vec2 uScale; varying vec2 vUv; void main(){ vUv = 0.5 + position.xy * uScale * 0.5; gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
  fragmentShader: `uniform sampler2D tV; varying vec2 vUv;
    // video pixels arrive display-encoded; the rest of the scene is worked in linear light, so decode them here
    void main(){ vec3 c = texture2D(tV, clamp(vUv, 0.0, 1.0)).rgb; c = mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); gl_FragColor = vec4(c, 1.0); }`,
  depthTest: false, depthWrite: false,
});
const film = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), filmMat); film.frustumCulled = false; film.renderOrder = -10; film.visible = false; scene.add(film);
const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });   // the room still hides what is behind it
const films = {};
function loadFilm() {
  if (films.in || params.has('nofilm')) return;
  for (const dir of ['in', 'out']) {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.preload = 'auto'; v.crossOrigin = 'anonymous';
    v.src = `/room/push-${dir}.mp4`; v.load();
    const tex = new THREE.VideoTexture(v); tex.colorSpace = THREE.NoColorSpace; tex.generateMipmaps = false; tex.minFilter = tex.magFilter = THREE.LinearFilter;
    films[dir] = { v, tex, mt: 0, seen: false };
  }
}
function startFilm(dir, rate) {
  const f = films[dir];
  if (!f || f.v.readyState < 3 || f.v.error) return null;
  f.mt = 0; f.seen = false;
  try { f.v.currentTime = 0; f.v.playbackRate = rate; } catch (_) { return null; }
  if (f.v.requestVideoFrameCallback) {
    const cb = (_, md) => { f.mt = md.mediaTime; f.seen = true; if (zoom && zoom.film === f) f.v.requestVideoFrameCallback(cb); };
    f.v.requestVideoFrameCallback(cb);
  }
  const p = f.v.play(); if (p && p.catch) p.catch(() => { f.failed = true; });
  return f;
}
function filmFrame(f) {   // which rendered frame is on screen right now
  if (!f.v.requestVideoFrameCallback) { f.mt = f.v.currentTime; f.seen = f.v.currentTime > 0; }
  return Math.max(0, Math.min(PATH.frames - 1, Math.round(f.mt * PATH.fps)));
}
function showFilm(f) {
  const on = !!f;
  if (film.visible === on) return;
  film.visible = on; if (on) filmMat.uniforms.tV.value = f.tex;
  for (const m of roomMeshes) m.material = on ? depthOnly : roomMat;
}

// ---------------------------------------------------------------- camera framing
const camPos0 = B(meta.camA.pos), camUp = B(meta.camA.up), fwdA = B(meta.camA.fwd).normalize();
const lookTarget = camPos0.clone().addScaledVector(fwdA, camPos0.distanceTo(screenCenter));
camera.up.copy(camUp);
function roomFov() {
  const aspect = innerWidth / innerHeight;
  return aspect >= 1 ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(MAX_FOV) / 2) / aspect)) : MAX_FOV;
}
function fitFov() { camera.aspect = innerWidth / innerHeight; camera.fov = roomFov(); camera.updateProjectionMatrix(); }
fitFov(); camera.position.copy(camPos0); camera.lookAt(lookTarget);

// ---------------------------------------------------------------- post: gentle bloom, vignette, grain
const composer = new EffectComposer(renderer);
composer.setPixelRatio(DPR); composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.22, 0.7, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const finish = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(innerWidth, innerHeight) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      vec2 q = vUv - 0.5; c *= 1.0 - 0.75 * dot(q, q);
      c += (h(vUv * uRes + fract(uTime) * 91.0) - 0.5) * 0.028;
      gl_FragColor = vec4(c, 1.0);
    }`,
});
composer.addPass(finish);

// ---------------------------------------------------------------- handwriting on the sticky notes (blank in the render, so a note can greet a recruiter)
const noteTex = [];
function drawNote(i, text) {
  const n = noteTex[i]; if (!n) return;
  const c = n.canvas, x = c.getContext('2d'); x.clearRect(0, 0, 256, 256);
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  let size = 78, lines = [];
  for (; size >= 30; size -= 4) {
    x.font = `600 ${size}px Caveat, "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive`;
    lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width > 216 && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur);
    if (lines.length * size * 0.92 <= 214 && lines.every((l) => x.measureText(l).width <= 224)) break;
  }
  x.fillStyle = 'rgba(38, 30, 26, 0.9)'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const lh = size * 0.92, y0 = 132 - (lines.length - 1) * lh / 2;
  lines.forEach((l, k) => x.fillText(l, 128, y0 + k * lh));
  n.tex.needsUpdate = true; kick();
}
for (const n of meta.notes || []) {
  const c = n.corners.map(B);                                   // TL, TR, BR, BL
  const nrm = new THREE.Vector3().subVectors(c[1], c[0]).cross(new THREE.Vector3().subVectors(c[3], c[0])).normalize();
  if (nrm.dot(B(meta.camA.pos).sub(c[0])) < 0) nrm.negate();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(c.flatMap((v) => { const p = v.clone().addScaledVector(nrm, 0.0016); return [p.x, p.y, p.z]; }), 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2)); geo.setIndex([0, 3, 2, 0, 2, 1]);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  mesh.renderOrder = 3; scene.add(mesh);
  noteTex.push({ canvas, tex, text: n.text });
}
const writeNotes = () => noteTex.forEach((n, i) => drawNote(i, n.text));

// ---------------------------------------------------------------- things in the room you can click
const hint = document.getElementById('hint'), crt = document.getElementById('crt'), poster = document.getElementById('poster');
const tip = document.getElementById('tip'), toastEl = document.getElementById('toast');
const COARSE = matchMedia('(pointer: coarse)').matches;
if (COARSE) hint.textContent = 'Tap the computer to power on';
const PHONE = Math.min(innerWidth, innerHeight) < 620 || (COARSE && innerWidth < 900);
if (PHONE) document.body.classList.add('phone');
try { if (sessionStorage.getItem('kz.note') === '0') document.body.classList.add('note-off'); } catch (_) {}
document.getElementById('note-x').addEventListener('click', (e) => { e.stopPropagation(); document.body.classList.add('note-off'); try { sessionStorage.setItem('kz.note', '0'); } catch (_) {} });

const ART = [
  { hot: 'poster_destress', src: 'poster-destress', t: 'It’s That Time of the Year', d: 'Pre-exam Destress campaign poster · DkIT Students’ Union' },
  { hot: 'poster_ball', src: 'poster-ball', t: 'Enchanted Ball', d: 'Event poster · ESN DkIT' },
  { hot: 'poster_reset', src: 'poster-reset', t: 'Reset in 60 seconds', d: 'Carousel cover · DkIT Students’ Union' },
  { hot: 'drawing0', src: 'draw-2-breathe-in-a-box', t: 'Breathe in a box', d: 'Slide from “Reset in 60 seconds”' },
  { hot: 'drawing1', src: 'draw-6-go-look-at-the-sky', t: 'Go look at the sky', d: 'Slide from “Reset in 60 seconds”' },
  { hot: 'drawing2', src: 'draw-3-shake-it-out', t: 'Shake it out', d: 'Slide from “Reset in 60 seconds”' },
  { hot: 'drawing3', src: 'draw-5-look-around', t: 'Look around', d: 'Slide from “Reset in 60 seconds”' },
  { hot: 'drawing4', src: 'draw-8-do-it-together', t: 'Do it together', d: 'Slide from “Reset in 60 seconds”' },
  { hot: 'mags', src: 'mag-2-everything-due', t: 'Everything due', d: 'Slide from the Destress campaign' },
  { src: 'mag-5-start-small', t: 'Start small', d: 'Slide from the Destress campaign' },
  { src: 'mag-6-not-alone', t: 'Not alone', d: 'Slide from the Destress campaign' },
];
const ACT = {
  computer: { tip: COARSE ? 'Tap to power on' : 'Power on the computer', run: () => enter(false) },
  boombox: { tip: 'Play my playlist', run: () => enter(false, { id: 'music', args: { shuffle: true } }) },
  lanyard: { tip: 'Students’ Union: see my résumé', run: () => enter(false, { id: 'resume' }) },
  note0: { tip: 'Get in touch', run: () => enter(false, { id: 'contact' }) },
  note1: { tip: 'call mum', run: () => toast('Done. She says hi.') },
  camera: { tip: 'See my projects', run: () => enter(false, { id: 'projects' }) },
  cube: { tip: 'Play a game', run: () => enter(false, { id: 'games' }) },
  lamp: { tip: 'Switch the lamp', run: () => toggleLamp() },
};
ART.forEach((a, i) => { if (a.hot) ACT[a.hot] = { tip: a.t, run: () => openArt(i) }; });
// easter eggs: small things around the room that answer back
function getCv() {
  const a = document.createElement('a'); a.href = '/room/Kshitiz_Mittal_CV.pdf'; a.download = 'Kshitiz_Mittal_CV.pdf'; a.target = '_blank'; a.rel = 'noopener';
  document.body.append(a); a.click(); a.remove(); seen('cv-download'); toast('CV.DOC saved to your downloads.');
}
let bearPokes = 0;
Object.assign(ACT, {
  bear: { tip: 'Hello', run: () => toast(++bearPokes >= 5 ? 'Okay, okay. He likes you.' : 'He has sat through every draft.') },
  trophy: { tip: 'Trophy', run: () => toast('Awarded for most browser tabs open at once.') },
  globe: { tip: 'Globe', run: () => toast('Arunachal Pradesh to Dundalk. Long commute.') },
  robot: { tip: 'Robot', run: () => { beep(); toast('BEEP. Portfolio compiled. Zero errors.'); } },
  alarm: { tip: 'What time is it?', run: () => toast(`It is ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Good moment to send an interview invite.`) },
  mug: { tip: 'Mug', run: () => toast('Empty. A deadline must be close.') },
  headphones: { tip: 'Put the headphones on', run: () => enter(false, { id: 'music', args: { shuffle: true } }) },
  plant: { tip: 'Plant', run: () => toast('Still alive. I keep content calendars the same way.') },
  succulent: { tip: 'Succulent', run: () => toast('Low maintenance. High output.') },
  switch: { tip: 'Light switch', run: () => party('Party mode. Eight seconds only, this is a workplace.') },
  toybox: { tip: 'Toy box', run: () => toast('Old toys, new tricks.') },
  backpack: { tip: 'Backpack', run: () => toast('Packed: camera, drone, laptop, charger. Always the charger.') },
});
for (let i = 0; i < 4; i++) ACT['car' + i] = { tip: 'Toy car', run: () => { beep(140, 0.25, 'sawtooth'); toast('Vroom.'); } };
for (const [k, b] of Object.entries(meta.hot || {})) {
  if (!/^floppy\d/.test(k)) continue;
  ACT[k] = (b[0][0] + b[1][0]) / 2 < 0 ? { tip: 'GAMES disk', run: () => enter(false, { id: 'games' }) } : { tip: 'CV.DOC: take a copy', run: getCv };
}
const hotBoxes = [];
for (const [k, b] of Object.entries(meta.hot || {})) {
  if (!ACT[k]) continue;
  const box = new THREE.Box3(new THREE.Vector3(b[0][0], b[0][2], -b[1][1]), new THREE.Vector3(b[1][0], b[1][2], -b[0][1])).expandByScalar(0.012);
  const sz = box.getSize(new THREE.Vector3());
  hotBoxes.push({ k, box, vol: sz.x * sz.y * sz.z });
}
hotBoxes.sort((p, q) => p.vol - q.vol);
const mouse = new THREE.Vector2(0, 0), ray = new THREE.Raycaster();
function pick(cx, cy) {
  ray.setFromCamera(new THREE.Vector2(cx / innerWidth * 2 - 1, -(cy / innerHeight * 2 - 1)), camera);
  const hit = ray.intersectObjects(pickables, false)[0];
  if (!hit) return null;
  if (hit.object === screenMesh) return 'computer';
  const h = hotBoxes.find((b) => b.box.containsPoint(hit.point));
  return h ? h.k : null;
}
let hover = null, hotCur = 0, pendingMove = null;
function setHover(k, x, y) {
  if (k !== hover) {
    hover = k;
    document.body.style.cursor = k ? 'pointer' : 'default';
    const hb = k && hotBoxes.find((b) => b.k === k);
    if (hb) { roomMat.uniforms.uHotMin.value.copy(hb.box.min); roomMat.uniforms.uHotMax.value.copy(hb.box.max); }
    tip.textContent = k ? ACT[k].tip : ''; tip.classList.toggle('on', !!k && !COARSE);
    kick();
  }
  if (k) { tip.style.left = Math.min(innerWidth - 12, x + 16) + 'px'; tip.style.top = (y + 18) + 'px'; }
}
let toastT = 0;
function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 2600); }

// how many of the room's secrets this visitor has found (kept on their device only)
const eggsEl = document.getElementById('eggs');
let eggs = new Set();
try { eggs = new Set(JSON.parse(localStorage.getItem('kz.eggs') || '[]')); } catch (_) {}
const EGG_KEYS = () => [...new Set(hotBoxes.map((b) => b.k.replace(/\d+$/, '')).filter((k) => k !== 'computer')), 'konami', 'hire', 'screensaver'];
function showEggs() { const all = EGG_KEYS(), n = all.filter((k) => eggs.has(k)).length; if (n) { eggsEl.textContent = `Secrets found: ${n} / ${all.length}`; eggsEl.classList.add('on'); } return [n, all.length]; }
function found(k) {
  k = k.replace(/\d+$/, '');
  if (k === 'computer' || eggs.has(k)) return;
  eggs.add(k); try { localStorage.setItem('kz.eggs', JSON.stringify([...eggs])); } catch (_) {}
  const [n, total] = showEggs();
  if (n === total) setTimeout(() => toast('Every secret found. You have an eye for detail. So do I.'), 2800);
}
function beep(freq = 880, dur = 0.12, type = 'square') {
  try {
    const AC = window.AudioContext || window.webkitAudioContext; click.ctx = click.ctx || new AC();
    const c = click.ctx, o = c.createOscillator(), gn = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, c.currentTime); o.frequency.exponentialRampToValueAtTime(freq * 1.5, c.currentTime + dur);
    gn.gain.setValueAtTime(0.04, c.currentTime); gn.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(gn).connect(c.destination); o.start(); o.stop(c.currentTime + dur + 0.02);
  } catch (_) {}
}
let partyT = 0;
function party(msg) { glowMat.uniforms.uParty.value = 1; clearTimeout(partyT); partyT = setTimeout(() => { glowMat.uniforms.uParty.value = 0; }, 8000); if (msg) toast(msg); }

// lamp switch: the same seat render with the lamp off, loaded on first use
let lampTarget = 1, lampCur = 1, offReq = null;
function loadOff() { return offReq || (offReq = loadTex('/room/projA_off.jpg').then((t) => { roomMat.uniforms.tAoff.value = t; roomMat.uniforms.uHasOff.value = 1; }).catch(() => { offReq = null; })); }
function click() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext; click.ctx = click.ctx || new AC();
    const c = click.ctx, o = c.createOscillator(), gn = c.createGain();
    o.type = 'square'; o.frequency.value = 1900; gn.gain.setValueAtTime(0.05, c.currentTime); gn.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.035);
    o.connect(gn).connect(c.destination); o.start(); o.stop(c.currentTime + 0.04);
  } catch (_) {}
}
function toggleLamp() { click(); loadOff().then(() => { if (roomMat.uniforms.uHasOff.value) { lampTarget = lampTarget > 0.5 ? 0 : 1; kick(); } }); }

// ---------------------------------------------------------------- lightbox: the work on the wall, up close
const lb = document.getElementById('lb'), lbImg = document.getElementById('lb-img'), lbT = document.getElementById('lb-t'), lbD = document.getElementById('lb-d');
let artIdx = -1;
function openArt(i) {
  artIdx = (i + ART.length) % ART.length; const a = ART[artIdx];
  lbImg.src = `/room/art/${a.src}.jpg`; lbImg.alt = a.t; lbT.textContent = a.t; lbD.textContent = a.d;
  lb.classList.add('on'); setHover(null); seen('lightbox');
}
function closeArt() { lb.classList.remove('on'); artIdx = -1; }
document.getElementById('lb-prev').addEventListener('click', (e) => { e.stopPropagation(); openArt(artIdx - 1); });
document.getElementById('lb-next').addEventListener('click', (e) => { e.stopPropagation(); openArt(artIdx + 1); });
document.getElementById('lb-x').addEventListener('click', (e) => { e.stopPropagation(); closeArt(); });
document.getElementById('lb-more').addEventListener('click', (e) => { e.stopPropagation(); closeArt(); enter(false, { id: 'projects' }); });
lb.addEventListener('click', (e) => { e.stopPropagation(); if (e.target === lb) closeArt(); });

// ---------------------------------------------------------------- fast lane: résumé, best work and contact without booting anything
const lane = document.getElementById('lane');
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
let laneBuilt = false;
async function openLane() {
  usedFast = true; seen('fastlane');
  lane.classList.add('on'); setHover(null);
  if (laneBuilt) return; laneBuilt = true;
  const site = await siteP, st = site.settings || {}, body = document.getElementById('lane-body');
  body.textContent = '';
  body.append(el('h1', null, st.displayName || 'Kshitiz Mittal'), el('p', 'role', st.role || ''), el('p', 'about', st.about || ''));
  const row = el('div', 'row');
  const cv = el('a', 'go primary', 'Download CV (PDF)'); cv.href = st.resumePdfUrl || '/room/Kshitiz_Mittal_CV.pdf'; cv.download = 'Kshitiz_Mittal_CV.pdf'; cv.target = '_blank'; cv.rel = 'noopener';
  cv.addEventListener('click', () => seen('cv-download'));
  row.append(cv);
  if (st.contactEmail) { const m = el('a', 'go', 'Email me'); m.href = 'mailto:' + st.contactEmail; row.append(m); }
  if (st.linkedin) { const l = el('a', 'go', 'LinkedIn'); l.href = st.linkedin; l.target = '_blank'; l.rel = 'noopener'; row.append(l); }
  body.append(row, el('h2', null, 'Top work'));
  const list = el('div', 'cards');
  for (const p of (site.projects || []).filter((p) => p.visible !== false).slice(0, 3)) {
    const c = el('button', 'card'); c.type = 'button';
    if (p.cover) { const im = el('img', 'pic'); im.src = p.cover; im.alt = ''; im.loading = 'lazy'; im.referrerPolicy = 'no-referrer'; im.addEventListener('error', () => im.remove(), { once: true }); c.append(im); }
    c.append(el('span', 'cat', [p.category, p.year].filter(Boolean).join(' · ')), el('strong', null, p.title), el('span', 'desc', p.description || ''), el('span', 'open', 'Open on the computer ›'));
    c.addEventListener('click', (e) => { e.stopPropagation(); closeLane(); enter(true, { id: 'project:' + p.id }); });
    list.append(c);
  }
  body.append(list);
  const all = el('button', 'go wide', 'See everything on the computer ›'); all.type = 'button';
  all.addEventListener('click', (e) => { e.stopPropagation(); closeLane(); enter(true); });
  body.append(all);
}
function closeLane() { lane.classList.remove('on'); }
document.getElementById('fast').addEventListener('click', (e) => { e.stopPropagation(); if (zoomed) leave(); openLane(); });
document.getElementById('lane-x').addEventListener('click', (e) => { e.stopPropagation(); closeLane(); });
lane.addEventListener('click', (e) => { e.stopPropagation(); if (e.target === lane) closeLane(); });

// ---------------------------------------------------------------- the computer: push in, park on the glass, live site takes over
let zoom = null, zoomed = false, iframe = null, siteReady = false, queued = null, revealAt = 0;
const SITE_URL = params.get('site') || '/';
const UP = new THREE.Vector3(0, 1, 0);
const D2R = Math.PI / 180;
function parkPose() {   // stand exactly where the close-up was rendered (so the picture is that render, untouched) and zoom the lens until the glass fills ~84% of the height
  const pos = B(meta.camB.pos), d = pos.distanceTo(screenCenter), sw = meta.screen.w;
  const small = Math.min(innerWidth, innerHeight) < 620;      // phones: let the glass fill as much of the display as it can
  const th = Math.max((screenH / (small ? 0.94 : 0.84)) / 2 / d, (sw / (small ? 0.985 : 0.92)) / 2 / (d * camera.aspect));
  return { pos, look: screenCenter.clone(), fov: 2 * Math.atan(th) / D2R };
}
function setFov(f) { camera.fov = f; camera.updateProjectionMatrix(); }
function placeCrt() {
  const hw = meta.screen.w / 2, hh = meta.screen.h / 2, c = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) c.push(new THREE.Vector3(screenCenter.x + sx * hw, screenCenter.y + sy * hh, screenCenter.z).project(camera));
  const xs = c.map((v) => (v.x + 1) / 2 * innerWidth), ys = c.map((v) => (1 - v.y) / 2 * innerHeight);
  const l = Math.round(Math.min(...xs)), t = Math.round(Math.min(...ys));
  const w = Math.round(Math.max(...xs) - l), h = Math.round(Math.max(...ys) - t);
  Object.assign(crt.style, { left: l + 'px', top: t + 'px', width: w + 'px', height: h + 'px' });
  fitIframe(w, h);
}
// small glass (phones): run the site at a real desktop size and scale the picture down onto the tube, like a real CRT
const VIRTUAL_W = Number(params.get('vw') || 1024);
function fitIframe(w, h) {
  if (!iframe) return;
  if (w < 620) {
    const k = w / VIRTUAL_W;
    Object.assign(iframe.style, { width: VIRTUAL_W + 'px', height: Math.round(h / k) + 'px', transform: `scale(${k})`, transformOrigin: '0 0' });
  } else Object.assign(iframe.style, { width: '100%', height: '100%', transform: 'none' });
}
// the site starts on the desktop (the room already played the boot), so what the tube showed from the chair is what you land on
function siteUrl(target) {
  const u = new URL(SITE_URL, location.origin);
  if (target) { u.searchParams.set('open', target.id); if (target.args && target.args.shuffle) u.searchParams.set('shuffle', '1'); }
  else u.searchParams.set('desktop', '1');
  u.searchParams.set('room', '1');
  return u.pathname + u.search;
}
function tellSite(target) {
  const m = /^project:(.+)$/.exec(target.id);
  try { iframe.contentWindow.postMessage(m ? { kz: 'open', id: 'browser', args: { projectId: m[1] } } : { kz: 'open', id: target.id, args: target.args || null }, location.origin); } catch (_) {}
}
function ensureIframe(target) {
  if (iframe) { if (target) { if (siteReady) tellSite(target); else queued = target; } return; }
  try { localStorage.setItem('kz.seen', '1'); } catch (_) {}
  iframe = document.createElement('iframe');
  fitIframe(parseFloat(crt.style.width), parseFloat(crt.style.height));
  iframe.src = siteUrl(target); iframe.title = 'Kayzee XP portfolio'; iframe.allow = 'autoplay; encrypted-media; fullscreen; clipboard-write';
  crt.prepend(iframe);
  setTimeout(() => { if (!siteReady) { siteReady = true; reveal(); } }, 9000);      // never leave the glass waiting for a slow load
}
function reveal() {     // the live site goes on the glass only once it has drawn its desktop, so there is no blank frame in between
  if (!zoomed || !siteReady || crt.classList.contains('on')) return;
  if (queued) { tellSite(queued); queued = null; }
  crt.classList.add('on'); try { iframe.focus(); } catch (_) {}
  revealAt = performance.now(); kick();
}
addEventListener('message', (e) => {
  if (e.origin !== location.origin || !e.data || typeof e.data !== 'object') return;
  if (e.data.kz === 'ready') { siteReady = true; reveal(); }
  else if (e.data.kz === 'app' && typeof e.data.id === 'string') seen(e.data.id.slice(0, 60));
});
function enter(fast, target) {
  if (zoom) return;
  target = target || (linkTarget && !usedLinkTarget ? linkTarget : null);
  if (target === linkTarget) usedLinkTarget = true;
  if (zoomed) { ensureIframe(target); return; }
  closeLane(); closeArt(); setHover(null);
  if (bootT < 0) { bootT = 0; power = 0.001; }
  hint.classList.remove('on'); lampTarget = 1;
  const p = parkPose();
  // size the glass area first (as it will be once parked), so the site inside loads at its real desktop size
  const sp = camera.position.clone(), sq = camera.quaternion.clone(), su = camera.up.clone(), sf = camera.fov;
  camera.up.copy(UP); setFov(p.fov); camera.position.copy(p.pos); camera.lookAt(p.look); camera.updateMatrixWorld(); placeCrt();
  camera.up.copy(su); setFov(sf); camera.position.copy(sp); camera.quaternion.copy(sq); camera.updateMatrixWorld();
  ensureIframe(target);
  const f = ZF ? null : startFilm('in', fast ? 2.4 : 1);
  zoom = { t0: performance.now(), dur: fast ? 800 : 2000, from: f ? camPos0.clone() : camera.position.clone(), fromLook: lookTarget.clone(), to: p.pos, toLook: p.look, upFrom: camUp.clone(), upTo: UP, fovFrom: roomFov(), fovTo: p.fov, dir: 'in', film: f };
  everZoomed = true; hit('update');
  kick();
}
function leave() {
  if (zoom || !zoomed) return;
  zoomed = false; document.body.classList.remove('zoomed'); crt.classList.remove('on'); crtMat.uniforms.uBlank.value = 0;
  const f = ZF ? null : startFilm('out', 1.3);
  zoom = { t0: performance.now(), dur: 1500, from: camera.position.clone(), fromLook: screenCenter.clone(), to: camPos0.clone(), toLook: lookTarget.clone(), upFrom: UP, upTo: camUp.clone(), fovFrom: camera.fov, fovTo: roomFov(), dir: 'out', film: f };
  kick();
}
addEventListener('pointermove', (e) => {
  mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight * 2 - 1));
  if (e.pointerType === 'touch') return;
  pendingMove = (zoom || zoomed || e.target !== renderer.domElement) ? null : [e.clientX, e.clientY];
  if (!pendingMove && hover) setHover(null);
  kick();
});
addEventListener('click', (e) => {
  if (zoomed || zoom || e.target !== renderer.domElement) return;
  const k = pick(e.clientX, e.clientY);
  if (k && ACT[k]) { found(k); ACT[k].run(); }
});
document.getElementById('skip').addEventListener('click', (e) => { e.stopPropagation(); enter(true); });
document.getElementById('back').addEventListener('click', (e) => { e.stopPropagation(); leave(); });
document.getElementById('full').addEventListener('click', (e) => { e.stopPropagation(); location.href = siteUrl(null).replace(/[?&]room=1/, ''); });
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let keyBuf = [], typed = '', lastInput = performance.now();
const awake = () => { lastInput = performance.now(); };
addEventListener('pointermove', awake); addEventListener('pointerdown', awake);
addEventListener('keydown', (e) => {
  awake();
  if (!zoomed && !e.metaKey && !e.ctrlKey) {
    keyBuf.push(e.key.length === 1 ? e.key.toLowerCase() : e.key); keyBuf = keyBuf.slice(-10);
    if (KONAMI.every((k, i) => keyBuf[i] === k)) { keyBuf = []; found('konami'); party('Cheat enabled: unlimited coffee.'); }
    if (e.key.length === 1) { typed = (typed + e.key.toLowerCase()).slice(-4); if (typed === 'hire') { typed = ''; found('hire'); toast('Good instinct.'); setTimeout(() => enter(false, { id: 'contact' }), 900); } }
  }
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (lb.classList.contains('on')) closeArt(); else if (lane.classList.contains('on')) closeLane(); else if (zoomed) leave(); }
  else if (lb.classList.contains('on')) { if (e.key === 'ArrowLeft') openArt(artIdx - 1); else if (e.key === 'ArrowRight') openArt(artIdx + 1); }
  else if (!zoomed && !lane.classList.contains('on') && (e.key === 'Enter' || e.key === ' ')) enter(false);
});
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  bloom.setSize(innerWidth / 2, innerHeight / 2); finish.uniforms.uRes.value.set(innerWidth, innerHeight); fitFov();
  if (zoomed) { const p = parkPose(); camera.up.copy(UP); setFov(p.fov); camera.position.copy(p.pos); camera.lookAt(p.look); camera.updateMatrixWorld(); placeCrt(); crtMat.uniforms.uBlank.value = 0; revealAt = performance.now() - 500; }
  else if (zoom) { zoom.fovTo = zoom.dir === 'in' ? parkPose().fov : roomFov(); }
  kick();
});
// the close-up render streams in behind the scenes; the zoom uses it as soon as it is there
loadTex('/room/projB.jpg').then((t) => { roomMat.uniforms.tB.value = t; roomMat.uniforms.uHasB.value = 1; kick(); }).catch(() => {});
setTimeout(loadOff, 4000);
setTimeout(loadFilm, 1200);
window.__kzRoom = { get film() { return film.visible; }, get ready() { return Object.fromEntries(Object.entries(films).map(([k, f]) => [k, f.v.readyState])); } };   // for tests

// ---------------------------------------------------------------- who came by (no cookies, no IP kept): shown on the admin page
const sid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const seenApps = new Set(), tStart = performance.now();
let everZoomed = false, usedFast = false, hits = 0, lastEnd = 0;
const TRACK = !SHOT && !params.has('notrack') && !navigator.webdriver;
function seen(id) { seenApps.add(id); }
function hit(ev) {
  if (!TRACK || (ev !== 'open' && !hits) || hits > 7) return;
  if (ev === 'update' && hit.zoomSent) return;
  if (ev === 'update') hit.zoomSent = true;
  if (ev === 'end') { if (performance.now() - lastEnd < 15000) return; lastEnd = performance.now(); }
  hits++;
  const body = JSON.stringify({ sid, ev, link: SLUG || undefined, dev: PHONE ? 'phone' : 'desktop', w: innerWidth, h: innerHeight, ref: document.referrer || undefined,
                                zoomed: everZoomed, fast: usedFast, secs: Math.round((performance.now() - tStart) / 1000), apps: [...seenApps].slice(0, 20) });
  try {
    if (ev === 'end' && navigator.sendBeacon) navigator.sendBeacon('/api/hit', body);
    else fetch('/api/hit', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch (_) {}
}
addEventListener('pagehide', () => hit('end'));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') hit('end'); });

// a personal link: the note on the monitor greets them, and the computer opens what they should see first
let linkTarget = null, usedLinkTarget = false;
linkP.then((l) => {
  if (!l) return;
  if (l.note && noteTex[0]) { noteTex[0].text = l.note; drawNote(0, l.note); }
  if (l.open) linkTarget = { id: l.open };
  if (l.company) hint.textContent = `Hi ${l.company}. ${COARSE ? 'Tap' : 'Click'} the computer to power on`;
});

// ---------------------------------------------------------------- loop (stops while the live site is on the glass)
const ZF = Number(params.get('zf') || 0);   // debugging: hold the zoom part-way
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const t0 = performance.now();
let last = t0, running = false, firstFrame = true;
const look = new THREE.Vector3(), par = new THREE.Vector3();
setTimeout(() => { if (bootT < 0) { bootT = 0; power = 0.001; } }, SHOT ? 0 : 900);
setTimeout(() => { if (!zoom && !zoomed) hint.classList.add('on'); }, 2400);
function kick() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } }
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const t = (now - t0) / 1000;
  if (bootT >= 0) { bootT += SHOT ? 6 : dt; power = Math.min(1, power + dt * 1.6); if (SHOT) power = 1; }
  const wasSaver = saver; saver = !zoom && !zoomed && now - lastInput > 45000 && !lane.classList.contains('on') && !lb.classList.contains('on');
  if (saver && !wasSaver) found('screensaver');
  drawScreen(dt); scrTex.needsUpdate = true;
  crtMat.uniforms.uTime.value = t; crtMat.uniforms.uPower.value = power;
  beamMat.uniforms.uTime.value = t; dustMat.uniforms.uTime.value = t; glowMat.uniforms.uTime.value = t; finish.uniforms.uTime.value = t;
  if (pendingMove) { setHover(pick(pendingMove[0], pendingMove[1]), pendingMove[0], pendingMove[1]); pendingMove = null; }
  hotCur += ((hover ? 1 : 0) - hotCur) * Math.min(1, dt * 12); roomMat.uniforms.uHot.value = hotCur;
  lampCur += (lampTarget - lampCur) * Math.min(1, dt * 14); if (Math.abs(lampTarget - lampCur) < 0.002) lampCur = lampTarget;
  roomMat.uniforms.uLamp.value = lampCur;
  if (zoom) {
    let k = Math.min(ZF || 1, (now - zoom.t0) / zoom.dur), e = ease(k);
    if (zoom.film) {
      const f = zoom.film, fi = filmFrame(f);
      if (f.failed || (!f.seen && now - zoom.t0 > 900)) { zoom.film = null; zoom.t0 = now; k = 0; e = 0; try { f.v.pause(); } catch (_) {} }   // no film after all: move live instead
      else {
        const p = ease((zoom.dir === 'in' ? fi : PATH.frames - 1 - fi) / (PATH.frames - 1));   // where along the chair-to-monitor path this frame was rendered
        e = zoom.dir === 'in' ? p : 1 - p;
        k = f.seen && (f.v.ended || fi >= PATH.frames - 1) ? 1 : 0;
        if (f.seen) {
          showFilm(f);
          const tf = PATH.t0 + (PATH.t1 - PATH.t0) * p;   // the lens that frame was rendered with (square)
          const th = THREE.MathUtils.lerp(Math.tan(zoom.fovFrom * D2R / 2), Math.tan(zoom.fovTo * D2R / 2), e);   // what the window shows of it
          filmMat.uniforms.uScale.value.set(th * camera.aspect / tf, th / tf);
        }
      }
    }
    camera.position.lerpVectors(zoom.from, zoom.to, e);
    camera.up.lerpVectors(zoom.upFrom, zoom.upTo, e).normalize();      // level out on the way in, so the glass ends up a true rectangle
    setFov(2 * Math.atan(THREE.MathUtils.lerp(Math.tan(zoom.fovFrom * D2R / 2), Math.tan(zoom.fovTo * D2R / 2), e)) / D2R);
    look.lerpVectors(zoom.fromLook, zoom.toLook, e); camera.lookAt(look);
    const m = THREE.MathUtils.smoothstep(e, 0.2, 0.85);
    roomMat.uniforms.uMixB.value = zoom.dir === 'in' ? m : 1 - m;
    if (k >= 1) {
      const dir = zoom.dir, zoom_to = zoom.to, zoom_fov = zoom.fovTo; if (zoom.film) { try { zoom.film.v.pause(); } catch (_) {} } zoom = null; showFilm(null);
      roomMat.uniforms.uMixB.value = dir === 'in' ? 1 : 0;
      if (dir === 'in') {
        zoomed = true; document.body.classList.add('zoomed'); document.body.style.cursor = 'default';
        camera.up.copy(UP); setFov(zoom_fov); camera.position.copy(zoom_to); camera.lookAt(screenCenter); camera.updateMatrixWorld(); placeCrt();
        document.body.classList.toggle('small', Math.min(innerWidth, innerHeight) < 620);
        reveal();
      } else { camera.up.copy(camUp); setFov(roomFov()); }
    }
  } else if (!zoomed) {
    par.set(Math.sin(t * 0.21) * 0.010 + mouse.x * 0.028, Math.sin(t * 0.17 + 1.3) * 0.007 + mouse.y * 0.016, 0);
    camera.position.copy(camPos0).add(par); camera.lookAt(lookTarget);
  }
  const live = zoomed && !zoom && crt.classList.contains('on');
  crtMat.uniforms.uBlank.value = live && now - revealAt > 560 ? 1 : 0;      // once the live site has faded in, the tube behind it goes dark
  composer.render();
  if (firstFrame) { firstFrame = false; poster.classList.add('gone'); document.getElementById('loadbar').classList.add('gone'); window.__ready = true; hit('open'); }
  if (live && now - revealAt > 700) { running = false; return; }
  requestAnimationFrame(frame);
}
kick();
writeNotes();
if (document.fonts && document.fonts.load) document.fonts.load('600 60px Caveat').then(writeNotes).catch(() => {});
showEggs();
