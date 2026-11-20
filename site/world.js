// Kayzee XP spike — procedural world: sky, cumulus clouds, rolling hill, instanced grass.
import * as THREE from 'three';

// ------------------------------------------------------------------ util
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Three's ACES fit, in JS, so unlit colours (sky, clouds) can be authored in display sRGB.
function acesJS(r, g, b, exposure) {
  const e = exposure / 0.6; r *= e; g *= e; b *= e;
  const i0 = 0.59719 * r + 0.35458 * g + 0.04823 * b;
  const i1 = 0.07600 * r + 0.90834 * g + 0.01566 * b;
  const i2 = 0.02840 * r + 0.13383 * g + 0.83777 * b;
  const f = (v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081);
  const a0 = f(i0), a1 = f(i1), a2 = f(i2);
  const cl = (v) => Math.min(1, Math.max(0, v));
  return [cl(1.60475 * a0 - 0.53108 * a1 - 0.07367 * a2), cl(-0.10208 * a0 + 1.10813 * a1 - 0.00605 * a2), cl(-0.00327 * a0 - 0.07276 * a1 + 1.07602 * a2)];
}
// display sRGB hex -> scene-linear colour that lands on that hex after ACES
export function preTone(hex, exposure = 1) {
  const t = new THREE.Color(hex); // linear
  const target = [t.r, t.g, t.b];
  let x = [...target].map((v) => Math.max(v, 1e-4));
  for (let it = 0; it < 80; it++) {
    const y = acesJS(x[0], x[1], x[2], exposure);
    for (let k = 0; k < 3; k++) x[k] = Math.max(1e-5, x[k] * Math.pow(Math.max(target[k], 1e-5) / Math.max(y[k], 1e-5), 0.7));
  }
  return new THREE.Color(x[0], x[1], x[2]);
}

// ------------------------------------------------------------------ terrain height (world units = CSS px at the desktop plane)
export const GROUND0 = -262;
export function groundY(x, z) {
  const d = -z;
  let h = 300 * smooth(-900, 5400, d);
  h += -Math.tanh(x / 3200) * 120 * smooth(-500, 5000, d);
  h += 14 * Math.sin(x * 0.0017 + d * 0.0009) + 9 * Math.sin(x * 0.0043 - d * 0.0021 + 1.3);
  const over = Math.max(0, d - 5600); h -= over * over * 0.00009;
  return GROUND0 + h;
}

// GLSL noise shared by terrain + grass so patches line up exactly
export const NOISE_GLSL = /* glsl */`
float kz_hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float kz_noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(kz_hash12(i), kz_hash12(i+vec2(1,0)), u.x), mix(kz_hash12(i+vec2(0,1)), kz_hash12(i+vec2(1,1)), u.x), u.y); }
float kz_fbm(vec2 p){ float a = 0.5, s = 0.0; for(int i=0;i<5;i++){ s += a*kz_noise(p); p = p*2.03 + vec2(17.1, 9.2); a *= 0.5; } return s; }
uniform vec3 uG1; uniform vec3 uG2; uniform vec3 uG3; uniform vec3 uG4;
vec3 kz_grass(vec2 p){
  float n1 = kz_fbm(p*0.00105 + vec2(3.7, 1.1));
  float n2 = kz_fbm(p*0.0039 + vec2(7.3, 2.9));
  float n4 = kz_fbm(p*0.0021 + vec2(3.1, 8.4));
  vec3 c = mix(uG1, uG2, smoothstep(0.28, 0.60, n1));
  c = mix(c, uG3, smoothstep(0.52, 0.80, n2) * 0.65);
  c = mix(c, uG4, smoothstep(0.60, 0.86, n4) * 0.42);
  c *= mix(0.80, 1.06, smoothstep(0.25, 0.7, n2));
  return c;
}
`;

export function grassUniforms() {
  return {
    uG1: { value: new THREE.Color('#25681a') },
    uG2: { value: new THREE.Color('#4a9f22') },
    uG3: { value: new THREE.Color('#6fc032') },
    uG4: { value: new THREE.Color('#a8c93e') },
    uTime: { value: 0 },
  };
}

// ------------------------------------------------------------------ sky dome
export function makeSky(exposure) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uTop: { value: preTone('#1d5ccf', exposure) },
      uMid: { value: preTone('#3f86e6', exposure) },
      uLow: { value: preTone('#86b8ef', exposure) },
      uHor: { value: preTone('#cfe3f6', exposure) },
      uGround: { value: preTone('#6f9a55', exposure) },
      uSun: { value: new THREE.Vector3(-0.55, 0.55, 0.62).normalize() },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){ vDir = normalize((modelMatrix * vec4(position,1.0)).xyz - cameraPosition);
        vec4 p = projectionMatrix * viewMatrix * modelMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTop, uMid, uLow, uHor, uGround, uSun; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir); float e = d.y;
        vec3 c = mix(uHor, uLow, smoothstep(0.0, 0.035, e));
        c = mix(c, uMid, smoothstep(0.03, 0.13, e));
        c = mix(c, uTop, smoothstep(0.12, 0.36, e));
        float s = max(0.0, dot(d, uSun));
        c *= 1.0 + 0.10 * pow(s, 6.0);
        if (e < 0.0) c = mix(uHor, uGround, smoothstep(0.0, -0.08, e));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(60000, 48, 24), mat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  return sky;
}

// Env scene for PMREM (sky above, grass below) so plastic picks up a believable outdoor reflection
export function makeEnvScene() {
  const s = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `varying vec3 vP; void main(){ vec3 d = normalize(vP); float e = d.y;
      vec3 sky = mix(vec3(0.62,0.78,1.0)*1.25, vec3(0.10,0.28,0.85), smoothstep(0.0,0.7,e));
      vec3 gr = mix(vec3(0.30,0.45,0.18), vec3(0.06,0.20,0.03), smoothstep(0.0,-0.4,e));
      vec3 c = e > 0.0 ? sky : gr;
      float sun = pow(max(0.0, dot(d, normalize(vec3(-0.5,0.62,0.6)))), 64.0);
      c += vec3(1.2,1.1,0.95)*sun;
      gl_FragColor = vec4(c,1.0);} `,
  });
  s.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), mat));
  return s;
}

// ------------------------------------------------------------------ clouds: puff-sphere impostors with fbm erosion
const CLOUD_VS = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const CLOUD_FS = /* glsl */`
  varying vec2 vUv;
  uniform vec3 uPuffs[48]; uniform int uCount; uniform float uAspect, uSeed, uBase, uOpacity, uHaze, uTime, uSoft, uStretch;
  uniform vec3 uSun, uLit, uShade, uHazeCol;
  float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(h12(i),h12(i+vec2(1,0)),u.x), mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),u.x), u.y); }
  float fbm(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.07+vec2(5.3,1.7); a*=0.5;} return s; }
  // union of puff spheres; coverage + a blended (soft-crease) surface normal
  float puffs(vec2 q, out vec3 n){
    float cov = 0.0; vec3 acc = vec3(0.0); float wsum = 0.0;
    for (int i = 0; i < 48; i++) {
      if (i >= uCount) break;
      vec3 c = uPuffs[i]; vec2 d = q - c.xy; float k = 1.0 - dot(d,d)/(c.z*c.z);
      if (k > 0.0) {
        float h = c.z * sqrt(k);
        float wgt = pow(h, 6.0) + 1e-6;
        acc += vec3(d / c.z, sqrt(k)) * wgt; wsum += wgt;
        cov = max(cov, k);
      }
    }
    n = wsum > 0.0 ? normalize(acc / wsum) : vec3(0.0, 0.0, 1.0);
    return cov;
  }
  float dens(vec2 q, vec2 sp, out vec3 n){
    float base = smoothstep(uBase - 0.02, uBase + 0.22, q.y);
    float det = fbm(sp * 4.0);
    float det2 = fbm(sp * 9.0 + 3.0);
    float c = puffs(vec2(q.x / uStretch, q.y), n) * base;
    return c * (0.50 + 0.95 * det) - 0.09 + (det2 - 0.5) * 0.22 * c;
  }
  float billow(vec2 p){ return abs(vn(p) * 2.0 - 1.0); }
  void main(){
    vec2 p = (vUv*2.0-1.0) * vec2(uAspect, 1.0);
    vec2 sp = p + vec2(uSeed*13.1, uSeed*7.7);
    vec2 w = vec2(fbm(sp*1.7), fbm(sp*1.7 + 9.2)) - 0.5;
    vec2 q = p + w * 0.22;
    vec3 n;
    float d0 = dens(q, sp, n);
    float a = smoothstep(-0.02 - 0.04 * uSoft, 0.62 + 0.3 * uSoft, d0);
    vec2 e = abs(vUv * 2.0 - 1.0);
    a *= smoothstep(1.0, 0.86, e.x) * smoothstep(1.0, 0.80, e.y);
    if (a < 0.002) discard;
    // self-shadow: how much cloud lies toward the sun (screen-space march, 3 taps)
    vec2 s2 = normalize(uSun.xy);
    vec3 nd;
    float occ = 0.0;
    occ += max(0.0, dens(q + s2 * 0.07, sp + s2 * 0.07, nd));
    occ += max(0.0, dens(q + s2 * 0.16, sp + s2 * 0.16, nd)) * 0.8;
    occ += max(0.0, dens(q + s2 * 0.30, sp + s2 * 0.30, nd)) * 0.6;
    float self = exp(-occ * 1.15);
    vec2 bp = sp * 6.0; float e0 = 0.02;
    float b0 = billow(bp) + 0.5 * billow(bp * 2.3);
    vec2 bg = vec2(billow(bp + vec2(e0, 0.0)) + 0.5 * billow((bp + vec2(e0, 0.0)) * 2.3) - b0,
                   billow(bp + vec2(0.0, e0)) + 0.5 * billow((bp + vec2(0.0, e0)) * 2.3) - b0) / e0;
    vec3 nn = normalize(n + vec3(-bg * 0.035, 0.0));
    float lam = clamp(dot(nn, uSun) * 0.5 + 0.5, 0.0, 1.0);
    float light = clamp(lam * 0.78 + self * 0.42 - 0.12 - (1.0 - b0) * 0.07, 0.0, 1.0);
    float under = smoothstep(uBase - 0.05, uBase + 0.85, q.y);           // flat, greyer underside
    vec3 col = mix(uShade, uLit, light);
    col *= mix(0.84, 1.0, under);
    // silver lining where it thins out on the sun side
    col += uLit * 0.12 * (1.0 - smoothstep(0.02, 0.25, d0)) * lam;
    col = mix(col, uHazeCol, uHaze);
    gl_FragColor = vec4(col, a * uOpacity);
  }`;

export function makeCloud({ seed, aspect: quadAspect = 2.2, puffs = 14, haze = 0, opacity = 1, exposure = 1, tower = 0.5, lobes = true, soft = 0, stretch = 1 }) {
  const rng = mulberry32(seed * 9973 + 17);
  const aspect = quadAspect / stretch; // puffs live in x-compressed space
  const base = -0.66;
  const P = [];
  const span = aspect * 0.80;
  const nb = Math.max(Math.round(puffs * 0.40), Math.ceil(span * 2 / 0.40));
  for (let i = 0; i < nb; i++) {
    const t = (i + 0.5) / nb * 2 - 1;
    const r = 0.17 + rng() * 0.12 + (1 - Math.abs(t)) * 0.10;
    P.push(new THREE.Vector3(t * span + (rng() - 0.5) * 0.14, base + r * 0.55, r));
  }
  const peak = (rng() - 0.5) * aspect * 0.5;
  for (let i = 0; i < puffs - Math.round(puffs * 0.40); i++) {
    const t = (rng() * 2 - 1);
    const x = peak * (1 - Math.abs(t)) + t * aspect * 0.62;
    const dome = Math.max(0, 1 - Math.pow((x - peak) / (aspect * 0.78), 2));
    const r = 0.14 + (0.22 + 0.22 * tower) * dome * (0.55 + 0.45 * rng());
    const y = base + 0.12 + dome * (0.20 + (0.30 + 0.25 * tower) * rng());
    P.push(new THREE.Vector3(x, Math.min(y, 0.96 - r), r));
  }
  // cauliflower: smaller lobes riding on the upper surface of the big puffs
  const main = P.slice();
  main.sort((a, b) => b.z - a.z);
  for (const m of (lobes ? main : [])) {
    if (P.length >= 46) break;
    const nsub = m.z > 0.3 ? 3 : 2;
    for (let j = 0; j < nsub && P.length < 46; j++) {
      const ang = Math.PI * (0.15 + 0.7 * ((j + rng() * 0.8) / nsub));
      const rr = m.z * (0.34 + rng() * 0.16);
      const dist = m.z * (0.78 + rng() * 0.12);
      const x = m.x + Math.cos(ang) * dist, y = m.y + Math.sin(ang) * dist;
      if (Math.abs(x) + rr < aspect * 0.95 && y + rr < 0.95) P.push(new THREE.Vector3(x, y, rr));
    }
  }
  const count = P.length;
  while (P.length < 48) P.push(new THREE.Vector3(0, 0, 0.0001));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: {
      uPuffs: { value: P }, uCount: { value: count }, uAspect: { value: quadAspect }, uSeed: { value: seed * 0.37 },
      uBase: { value: base }, uOpacity: { value: opacity }, uHaze: { value: haze }, uTime: { value: 0 }, uSoft: { value: soft }, uStretch: { value: stretch },
      uSun: { value: new THREE.Vector3(-0.45, 0.62, 0.65).normalize() },
      uLit: { value: preTone('#f6f8fb', exposure) },
      uShade: { value: preTone('#8499bd', exposure) },
      uHazeCol: { value: preTone('#d6e6f6', exposure) },
    },
    vertexShader: CLOUD_VS, fragmentShader: CLOUD_FS,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2 * quadAspect, 2), mat);
  m.frustumCulled = false;
  return m;
}

// ------------------------------------------------------------------ terrain
export function makeTerrain(uniforms) {
  const NX = 420, NZ = 300;
  const xs = 30000, z0 = 1500, zspan = 17000;
  const pos = new Float32Array((NX + 1) * (NZ + 1) * 3);
  let k = 0;
  for (let j = 0; j <= NZ; j++) {
    const u = j / NZ;
    const z = z0 - zspan * Math.pow(u, 1.9);
    for (let i = 0; i <= NX; i++) {
      const v = i / NX * 2 - 1;
      const x = Math.sign(v) * Math.pow(Math.abs(v), 1.6) * xs / 2;
      pos[k++] = x; pos[k++] = groundY(x, z); pos[k++] = z;
    }
  }
  const idx = [];
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const a = j * (NX + 1) + i, b = a + 1, c = a + (NX + 1), d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.93, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vKzW;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvKzW = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vKzW;\n' + NOISE_GLSL)
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        {
          vec3 gc = kz_grass(vKzW.xz);
          float dist = length(vKzW - cameraPosition);
          float fine = kz_noise(vKzW.xz * 0.21) * 0.6 + kz_noise(vKzW.xz * 0.07) * 0.4;
          float fw = clamp(1.0 - dist / 5000.0, 0.0, 1.0);
          gc *= mix(1.0, 0.70 + 0.55 * fine, fw);
          // under the blades the ground is the shaded base of the turf; far away it IS the turf
          gc *= mix(0.50, 0.98, smoothstep(900.0, 5200.0, dist));
          diffuseColor.rgb = gc;
        }`);
  };
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  return mesh;
}

// ------------------------------------------------------------------ grass blades
function bladeGeometry() {
  // 3 quads + tip triangle, unit height, unit base width, gentle forward curve
  const rows = [0, 0.33, 0.62, 0.84];
  const pos = [], col = [], nrm = [], idx = [];
  const n = new THREE.Vector3(0, 1, 0.28).normalize();
  rows.forEach((t) => {
    const w = 0.5 * Math.pow(1 - t, 0.85);
    const z = 0.32 * t * t;
    pos.push(-w, t, z, w, t, z);
    const c = t < 0.01 ? [0.34, 0.38, 0.33] : [0.45 + 0.62 * t, 0.48 + 0.60 * t, 0.40 + 0.42 * t];
    col.push(...c, ...c);
    nrm.push(n.x, n.y, n.z, n.x, n.y, n.z);
  });
  pos.push(0.02, 1.0, 0.32); col.push(1.12, 1.10, 0.86); nrm.push(n.x, n.y, n.z);
  for (let r = 0; r < 3; r++) { const a = r * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  idx.push(6, 7, 8);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

export function makeGrass({ count, camZ, uniforms, seed = 7, halfFov = 0.75 }) {
  const rng = mulberry32(seed);
  const geo = bladeGeometry();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.58, metalness: 0, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + NOISE_GLSL + '\nuniform float uTime;')
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        float kzT = position.y;
        float kzW = sin(uTime * 1.6 + kzI.x * 0.0042 + kzI.z * 0.0031) * 0.6 + sin(uTime * 2.7 + kzI.x * 0.013) * 0.25;
        transformed.z += kzT * kzT * 0.22 * kzW;
        transformed.x += kzT * kzT * 0.10 * kzW;`)
      .replace('#include <shadowmap_vertex>', `
        vec4 kzWP = worldPosition;
        worldPosition = mix(worldPosition, modelMatrix * instanceMatrix * vec4(0.0, 0.25, 0.0, 1.0), 0.88);
        #include <shadowmap_vertex>
        worldPosition = kzWP;`)
      .replace('#include <color_vertex>', `
        #include <color_vertex>
        vec3 kzI = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        vColor.rgb *= kz_grass(kzI.xz);`);
    // keep the "up" normal on both faces (no flip) so blades shade like turf
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>',
      THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0'));
  };
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  const col = new THREE.Color();
  const Lmin = 430, Lmax = 7400;
  for (let i = 0; i < count; i++) {
    const u = 1 / Lmax + (1 / Lmin - 1 / Lmax) * rng();
    const L = 1 / u;
    const z = camZ - L;
    const halfW = L * halfFov + 260;
    const x = (rng() * 2 - 1) * halfW;
    const y = groundY(x, z);
    const f = Math.max(0.85, Math.pow(L / 1250, 0.62));
    const h = (11 + rng() * 15 + (rng() < 0.08 ? 10 : 0)) * f;
    const w = (1.7 + rng() * 1.5) * f;
    e.set((rng() - 0.5) * 0.7, rng() * Math.PI * 2, (rng() - 0.5) * 0.7);
    q.setFromEuler(e);
    m.compose(p.set(x, y - 1.5 * f, z), q, s.set(w, h, w));
    mesh.setMatrixAt(i, m);
    const b = 0.78 + rng() * 0.42;
    const hueShift = (rng() - 0.5) * 0.16;
    col.setRGB(b * (1 + hueShift), b, b * (1 - hueShift * 1.5));
    mesh.setColorAt(i, col);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.frustumCulled = false;
  return mesh;
}
