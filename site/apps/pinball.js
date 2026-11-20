// Pinball: "Press Run" PR-campaign table for Kayzee XP.
// Three.js r187 renderer + a custom 2D physics solver on the table plane (fixed 1/1200 s substeps,
// distance-based capsule collisions, moving flippers with angular-velocity transfer).
// Table space: x 0..10 (left to right), y 0..21 (drain to top). Three space: X = x - 5, Z = 10.5 - y, Y up.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ------------------------------------------------------------------ constants
const TW = 10, TL = 21, BR = 0.3, LANE_X = 9.1, BALL_X = (LANE_X + 0.07 + 9.9) / 2, MID = LANE_X / 2;
const G = 28, STEP = 1 / 1200, VMAX = 58;
const FL_LEN = 1.72, FL_RB = 0.24, FL_RT = 0.12, FL_REST = -0.52, FL_UP = 0.46, FL_WUP = 26, FL_WDN = 17;
const SAVE_SECS = 10;
const LS_HI = 'kayzee-pinball-hi', LS_SND = 'kayzee-pinball-sound';
const DEG = Math.PI / 180;

// 5x7 dot font (original glyph set) used by the dot-matrix panel and the playfield art
const FONT = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [31, 2, 4, 2, 1, 17, 14],
  4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8],
  8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
  ' ': [0, 0, 0, 0, 0, 0, 0], '!': [4, 4, 4, 4, 4, 0, 4], '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8],
  ':': [0, 12, 12, 0, 12, 12, 0], '-': [0, 0, 0, 31, 0, 0, 0], '?': [14, 17, 1, 2, 4, 0, 4], '/': [1, 1, 2, 4, 8, 16, 16],
  "'": [4, 4, 8, 0, 0, 0, 0], '+': [0, 4, 4, 31, 4, 4, 0], '*': [0, 21, 14, 31, 14, 21, 0], '<': [2, 4, 8, 16, 8, 4, 2], '>': [8, 4, 2, 1, 2, 4, 8],
};
const fmt = (n) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
function lsGet(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* blocked */ } }

// ------------------------------------------------------------------ table layout (pure data, shared by physics + visuals)
function arcPts(cx, cy, r, a0, a1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * DEG; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return out;
}
const mirror = (pts) => pts.map(([x, y]) => [LANE_X - x, y]);
function buildLayout() {
  const segs = [], circles = [];
  const poly = (pts, o) => { for (let i = 0; i < pts.length - 1; i++) segs.push({ ax: pts[i][0], ay: pts[i][1], bx: pts[i + 1][0], by: pts[i + 1][1], t: 0.07, e: 0.45, kind: 'wall', vis: 'cream', h: 0.42, active: true, ...o }); };
  // outer rail: left wall, top arc, right wall
  poly([[0, 0], [0, 16], ...arcPts(5, 16, 5, 180, 0, 36).slice(1, -1), [10, 16], [10, 0]], { t: 0.1, vis: 'rail', h: 0.62 });
  // plunger lane wall + one-way gate at its top
  poly([[LANE_X, -0.4], [LANE_X, 14.6]], { t: 0.07 });
  const gn = [-(15.35 - 14.6), 10 - LANE_X], gl = Math.hypot(...gn);
  segs.push({ ax: LANE_X, ay: 14.6, bx: 10, by: 15.35, t: 0.05, e: 0.3, kind: 'gate', vis: 'gate', h: 0.3, active: true, one: [gn[0] / gl, gn[1] / gl] });
  // left orbit inner guide
  poly([[1.05, 10.3], [1.05, 16], ...arcPts(5, 16, 3.95, 180, 124, 9).slice(1)], { t: 0.08 });
  // inlane / outlane guides
  const guideL = [[0.95, 5.6], [0.95, 3.7], [2.38, 2.68]];
  poly(guideL); poly(mirror(guideL));
  circles.push({ x: 0.95, y: 5.62, r: 0.15, e: 0.75, kind: 'post' }, { x: LANE_X - 0.95, y: 5.62, r: 0.15, e: 0.75, kind: 'post' });
  // rubber deflector under the orbit exit, and a guard post under the PRESS bank
  segs.push({ ax: 0.05, ay: 9.35, bx: 1.0, by: 8.55, t: 0.08, e: 0.65, kind: 'wall', vis: 'rubber', h: 0.36, active: true });
  circles.push({ x: 8.62, y: 6.85, r: 0.13, e: 0.75, kind: 'post' });
  // slingshots (A, B, C); kick face is C->A
  const slingL = [[1.85, 5.7], [1.85, 4.2], [2.6, 3.65]], slingR = mirror(slingL);
  for (const [k, S] of [['L', slingL], ['R', slingR]]) {
    poly([S[0], S[1], S[2]], { t: 0.1, e: 0.6, vis: 'slingside' });
    segs.push({ ax: S[2][0], ay: S[2][1], bx: S[0][0], by: S[0][1], t: 0.1, e: 0.6, kind: 'sling', side: k, vis: 'rubber', h: 0.42, active: true });
    circles.push(...S.map(([x, y]) => ({ x, y, r: 0.1, e: 0.6, kind: 'post', vis: false })));
  }
  // drop targets P-R-E-S-S, standing in front of the lane wall
  const targets = [];
  'PRESS'.split('').forEach((ch, i) => {
    const yc = 9.8 - i * 0.6;
    const s = { ax: 8.78, ay: yc - 0.24, bx: 8.78, by: yc + 0.24, t: 0.09, e: 0.35, kind: 'target', idx: i, vis: false, h: 0.5, active: true };
    segs.push(s); targets.push({ ch, s, x: 8.78, y: yc, down: false, anim: 0 });
  });
  // pop bumpers
  const bumpers = [
    { x: 3.45, y: 14.5, r: 0.55, type: 'megaphone' },
    { x: 6.0, y: 15.1, r: 0.55, type: 'camera' },
    { x: 4.85, y: 12.6, r: 0.55, type: 'coffee' },
  ];
  bumpers.forEach((b) => { b.kind = 'bumper'; b.e = 0.5; b.flash = 0; circles.push(b); });
  return { segs, circles, targets, bumpers, slingL, slingR };
}

// ------------------------------------------------------------------ physics + rules (no DOM / GL here, so it can run headless)
function makeSim(hooks) {
  const L = buildLayout();
  const ball = { x: BALL_X, y: 1.3, vx: 0, vy: 0, live: false, inLane: true };
  const mkFl = (px, py, side) => ({ px, py, side, a: FL_REST, w: 0, held: false });
  const flL = mkFl(2.6, 2.3, 1), flR = mkFl(LANE_X - 2.6, 2.3, -1);
  const g = {
    t: 0, state: 'attract', score: 0, ball: 1, balls: 3, mult: 1, saveUntil: 0, saved: false, plunger: 0, pulling: false,
    orbitLit: 0, orbitA: -9, orbitB: -9, lanes: [0, 0], lastLane: [-9, -9], bonus: 0, slow: 0, hi: 0,
    stats: { tunnels: 0, escapes: 0, maxV: 0, bumps: 0, flipHits: 0, drains: 0, launches: 0, steps: 0, nudges: 0, orbits: 0, targets: 0, slings: 0 }, debug: false,
  };
  const fire = (name, ...a) => hooks[name] && hooks[name](...a);
  const add = (pts) => { g.score += pts * g.mult; fire('score'); };
  const flTip = (f) => { const ang = f.side > 0 ? f.a : Math.PI - f.a; return [f.px + Math.cos(ang) * FL_LEN, f.py + Math.sin(ang) * FL_LEN, ang]; };

  function resetBall() {
    Object.assign(ball, { x: BALL_X, y: 1.3, vx: 0, vy: 0, live: true, inLane: true });
    g.plunger = 0; g.pulling = false; g.state = 'ready'; g.slow = 0;
  }
  function newBall() {
    g.mult = 1; g.bonus = 0; g.saved = false; g.saveUntil = 0;
    L.targets.forEach((t) => { t.down = false; t.s.active = true; });
    resetBall(); fire('msg', ['BALL ' + g.ball, 'PULL THE PLUNGER'], 1.6);
  }
  function startGame() {
    g.score = 0; g.ball = 1; g.lanes = [0, 0]; g.orbitLit = 0;
    newBall(); fire('start');
  }
  function launch() {
    if (g.state !== 'ready' || !ball.inLane) { g.pulling = false; g.plunger = 0; return; }
    const restY = 0.95 - g.plunger * 0.7 + BR;
    if (ball.y < restY + 0.35 && Math.abs(ball.vy) < 3) {
      ball.vy = 21 + g.plunger * 25; g.stats.launches++;
      fire('launch', g.plunger);
    }
    g.pulling = false; g.plunger = 0;
  }
  function drain() {
    ball.live = false; g.stats.drains++;
    if (g.t < g.saveUntil && !g.saved) {
      g.saved = true; fire('msg', ['BALL SAVED', 'TRY AGAIN!'], 1.6); fire('sound', 'save');
      resetBall(); g.saved = true; return;
    }
    const bonus = g.bonus * 1000 * g.mult;
    g.score += bonus;
    fire('sound', 'drain');
    if (g.ball >= g.balls) {
      g.state = 'over';
      if (g.score > g.hi) { g.hi = g.score; fire('hi'); }
      fire('msg', ['GAME OVER', fmt(g.score)], 99);
      fire('over');
      return;
    }
    g.ball++;
    g.state = 'drain';
    fire('msg', ['BONUS ' + fmt(bonus), 'BALL ' + g.ball + ' NEXT'], 1.6);
    g.drainAt = g.t + 1.4;
  }

  // ---- collision primitives
  function contact(nx, ny, pen, e, fr) {
    ball.x += nx * pen; ball.y += ny * pen;
    const vn = ball.vx * nx + ball.vy * ny;
    if (vn < 0) {
      ball.vx -= (1 + e) * vn * nx; ball.vy -= (1 + e) * vn * ny;
      const tx = -ny, ty = nx, vt = ball.vx * tx + ball.vy * ty;
      ball.vx -= vt * tx * fr; ball.vy -= vt * ty * fr;
    }
    return -vn;
  }
  function segHit(s) {
    const dx = s.bx - s.ax, dy = s.by - s.ay;
    let t = ((ball.x - s.ax) * dx + (ball.y - s.ay) * dy) / (dx * dx + dy * dy);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = s.ax + dx * t, qy = s.ay + dy * t;
    let nx = ball.x - qx, ny = ball.y - qy;
    const d2 = nx * nx + ny * ny, rr = BR + s.t;
    if (d2 >= rr * rr) return;
    if (s.one) { // one-way gate: only blocks a ball on its outer side moving into it
      if ((ball.x - s.ax) * s.one[0] + (ball.y - s.ay) * s.one[1] < 0) return;
      if (ball.vx * s.one[0] + ball.vy * s.one[1] > 0) return;
    }
    const d = Math.sqrt(d2) || 1e-6; nx /= d; ny /= d;
    const vin = contact(nx, ny, rr - d, s.e, 0.02);
    if (s.kind === 'sling' && vin > 1.2) {
      const vn = ball.vx * nx + ball.vy * ny; if (vn < 11) { ball.vx += nx * (11 - vn); ball.vy += ny * (11 - vn); }
      add(10); g.stats.slings++; fire('sling', s.side);
    } else if (s.kind === 'target' && vin > 0.8) {
      const tg = L.targets[s.idx]; tg.down = true; s.active = false; add(500); g.bonus++; g.stats.targets++; fire('target', s.idx);
      if (L.targets.every((q) => q.down)) {
        g.mult = Math.min(5, g.mult + 1);
        add(5000); fire('msg', ['PRESS RELEASE!', 'MULTIPLIER ' + g.mult + 'X'], 2); fire('sound', 'press');
        g.resetTargetsAt = g.t + 1.2;
      }
    } else if (vin > 4) fire('thud', vin);
  }
  function circHit(c) {
    let nx = ball.x - c.x, ny = ball.y - c.y;
    const d2 = nx * nx + ny * ny, rr = BR + c.r;
    if (d2 >= rr * rr) return;
    const d = Math.sqrt(d2) || 1e-6; nx /= d; ny /= d;
    contact(nx, ny, rr - d, c.e, 0.01);
    if (c.kind === 'bumper') {
      const vn = ball.vx * nx + ball.vy * ny; if (vn < 15) { ball.vx += nx * (15 - vn); ball.vy += ny * (15 - vn); }
      c.flash = 1; add(100); g.stats.bumps++; fire('bumper', c);
    }
  }
  function flipHit(f) {
    const [tx, ty] = flTip(f);
    const dx = tx - f.px, dy = ty - f.py;
    let t = ((ball.x - f.px) * dx + (ball.y - f.py) * dy) / (dx * dx + dy * dy);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = f.px + dx * t, qy = f.py + dy * t;
    let nx = ball.x - qx, ny = ball.y - qy;
    const rf = FL_RB + (FL_RT - FL_RB) * t, rr = BR + rf, d2 = nx * nx + ny * ny;
    if (d2 >= rr * rr) return;
    const d = Math.sqrt(d2) || 1e-6; nx /= d; ny /= d;
    ball.x += nx * (rr - d); ball.y += ny * (rr - d);
    const wWorld = f.side > 0 ? f.w : -f.w;
    const cx = qx + nx * rf - f.px, cy = qy + ny * rf - f.py;
    const ux = -wWorld * cy, uy = wWorld * cx; // surface velocity of the flipper at the contact
    const rvx = ball.vx - ux, rvy = ball.vy - uy, vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      const e = 0.28;
      ball.vx -= (1 + e) * vn * nx; ball.vy -= (1 + e) * vn * ny;
      if (Math.abs(f.w) > 1) { g.stats.flipHits++; fire('flip-hit', f.side); }
    }
  }
  function updateFlipper(f, dt) {
    const a0 = f.a;
    if (f.held) f.a = Math.min(FL_UP, f.a + FL_WUP * dt); else f.a = Math.max(FL_REST, f.a - FL_WDN * dt);
    f.w = (f.a - a0) / dt;
  }
  const crosses = (x0, y0, x1, y1, s) => {
    const o = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const d1 = o(s.ax, s.ay, s.bx, s.by, x0, y0), d2 = o(s.ax, s.ay, s.bx, s.by, x1, y1);
    const d3 = o(x0, y0, x1, y1, s.ax, s.ay), d4 = o(x0, y0, x1, y1, s.bx, s.by);
    return d1 * d2 < 0 && d3 * d4 < 0;
  };
  function step() {
    const dt = STEP;
    g.t += dt; g.stats.steps++;
    updateFlipper(flL, dt); updateFlipper(flR, dt);
    if (g.pulling && g.state === 'ready') g.plunger = Math.min(1, g.plunger + dt * 1.25);
    if (g.state === 'drain' && g.t >= g.drainAt) newBall();
    if (g.resetTargetsAt && g.t >= g.resetTargetsAt) { g.resetTargetsAt = 0; L.targets.forEach((t) => { t.down = false; t.s.active = true; }); fire('targets-reset'); }
    if (!ball.live) return;
    const x0 = ball.x, y0 = ball.y;
    ball.vy -= G * dt;
    const damp = 1 - 0.06 * dt; ball.vx *= damp; ball.vy *= damp;
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp > VMAX) { ball.vx *= VMAX / sp; ball.vy *= VMAX / sp; }
    if (sp > g.stats.maxV) g.stats.maxV = sp;
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    // plunger surface
    if (ball.inLane) {
      const py = 0.95 - g.plunger * 0.7;
      if (ball.y - BR < py) { ball.y = py + BR; if (ball.vy < 0) ball.vy = -ball.vy * 0.12; if (Math.abs(ball.vy) < 0.3) ball.vy = 0; }
    }
    for (let k = 0; k < 2; k++) { // two relaxation passes for corners
      for (const s of L.segs) if (s.active) segHit(s);
      for (const c of L.circles) circHit(c);
      flipHit(flL); flipHit(flR);
    }
    if (g.debug) {
      for (const s of L.segs) if (s.active && !s.one && s.kind !== 'target' && crosses(x0, y0, ball.x, ball.y, s)) g.stats.tunnels++;
      const out = ball.x < 0.05 || ball.x > 9.95 || (ball.y > 16 && Math.hypot(ball.x - 5, ball.y - 16) > 4.95) || ball.y > 21;
      const inBumper = L.bumpers.some((b) => Math.hypot(ball.x - b.x, ball.y - b.y) < b.r);
      if (out || inBumper) g.stats.escapes++;
    }
    // lanes & sensors
    const wasLane = ball.inLane;
    ball.inLane = ball.x > LANE_X && ball.y < 14.9;
    if (wasLane && !ball.inLane && ball.y > 14) {
      if (g.state === 'ready') { g.state = 'play'; if (!g.saved) g.saveUntil = g.t + SAVE_SECS; fire('enter'); }
    }
    if (!ball.inLane && ball.x > LANE_X + 0.05 && ball.y < 14.5 && g.state === 'play') { /* fell back into the lane from above */ ball.inLane = true; g.state = 'ready'; }
    if (ball.x < 1.05 && ball.y > 10.4 && ball.y < 11.2) orbitSensor('A');
    if (ball.y > 16) { const a = Math.atan2(ball.y - 16, ball.x - 5) / DEG, r = Math.hypot(ball.x - 5, ball.y - 16); if (a > 108 && a < 124 && r > 3.95) orbitSensor('B'); }
    if (ball.y > 4.0 && ball.y < 4.8) {
      if (ball.x > 1.0 && ball.x < 1.8) laneSensor(0, 'in');
      else if (ball.x > LANE_X - 1.8 && ball.x < LANE_X - 1.0) laneSensor(1, 'in');
      else if (ball.x < 0.9) laneSensor(0, 'out');
      else if (ball.x > LANE_X - 0.9 && ball.x < LANE_X) laneSensor(1, 'out');
    }
    if (ball.y < -0.6) drain();
    // anti-stall: a ball resting somewhere odd gets a little table nudge
    if (g.state === 'play' && Math.hypot(ball.vx, ball.vy) < 0.25 && !flL.held && !flR.held) {
      g.slow += dt;
      if (g.slow > 3) { g.slow = 0; g.stats.nudges++; ball.vx += (Math.random() - 0.5) * 8; ball.vy += 7; fire('msg', ['NUDGE!', ''], 0.8); }
    } else g.slow = 0;
  }
  function orbitSensor(which) {
    const now = g.t;
    if (which === 'A') { if (now - g.orbitA < 0.5) return; g.orbitA = now; if (now - g.orbitB < 3) award(); }
    else { if (now - g.orbitB < 0.5) return; g.orbitB = now; if (now - g.orbitA < 3) award(); }
    function award() {
      g.orbitA = g.orbitB = -9;
      const lit = g.t < g.orbitLit;
      add(lit ? 5000 : 2500); g.bonus++; g.stats.orbits++;
      fire('msg', [lit ? 'SUPER ORBIT!' : 'ORBIT!', lit ? 'PRESS TOUR 5,000' : 'COVERAGE 2,500'], 1.4); fire('sound', 'orbit');
    }
  }
  function laneSensor(side, kind) {
    if (g.t - g.lastLane[side] < 0.6) return;
    g.lastLane[side] = g.t;
    if (kind === 'in') { add(200); g.lanes[side] = 1; g.orbitLit = g.t + 12; fire('lane', side); if (g.lanes[0] && g.lanes[1]) { add(2000); g.lanes = [0, 0]; fire('msg', ['HEADLINE!', 'BOTH LANES 2,000'], 1.2); } }
    else { add(1000); fire('msg', ['OFF THE RECORD', '1,000'], 1.0); }
  }
  // autoplayer for headless tests
  function autoplay() {
    if (g.state === 'ready' && ball.inLane && ball.live && Math.abs(ball.vy) < 0.01) {
      if (!g.pulling) { g.pulling = true; g.autoPow = 0.45 + Math.random() * 0.55; }
      else if (g.plunger >= g.autoPow) launch();
    }
    if (g.state === 'attract' || g.state === 'over') startGame();
    const nearL = ball.y < 3.4 && ball.x > flL.px + 0.6 && ball.x < MID + 0.2 && ball.vy < -0.5;
    const nearR = ball.y < 3.4 && ball.x < flR.px - 0.6 && ball.x > MID - 0.2 && ball.vy < -0.5;
    if (nearL) g.holdL = g.t + 0.14; if (nearR) g.holdR = g.t + 0.14;
    flL.held = g.t < (g.holdL || 0); flR.held = g.t < (g.holdR || 0);
  }
  return { L, ball, flL, flR, g, step, startGame, launch, newBall, autoplay, flTip };
}

// ------------------------------------------------------------------ voxel model builder (vertex coloured, hidden faces culled)
function voxGeo(vox, unit, centre = true) {
  const key = (x, y, z) => x + ',' + y + ',' + z;
  const map = new Map(); vox.forEach((v) => map.set(key(v[0], v[1], v[2]), v));
  let mnx = 1e9, mny = 1e9, mnz = 1e9, mxx = -1e9, mxz = -1e9;
  vox.forEach(([x, y, z]) => { mnx = Math.min(mnx, x); mny = Math.min(mny, y); mnz = Math.min(mnz, z); mxx = Math.max(mxx, x); mxz = Math.max(mxz, z); });
  const cx = centre ? (mnx + mxx + 1) / 2 : 0, cz = centre ? (mnz + mxz + 1) / 2 : 0, cy = centre ? mny : 0;
  const pos = [], nor = [], col = [], c = new THREE.Color();
  const F = [
    [[1, 0, 0], [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]], [[-1, 0, 0], [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]]],
    [[0, 1, 0], [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]], [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
    [[0, 0, 1], [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]]], [[0, 0, -1], [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]]],
  ];
  for (const [x, y, z, hex] of vox) {
    c.set(hex).convertSRGBToLinear();
    for (const [n, q] of F) {
      if (map.has(key(x + n[0], y + n[1], z + n[2]))) continue;
      const tri = [q[0], q[1], q[2], q[0], q[2], q[3]];
      for (const p of tri) {
        pos.push((x + p[0] - cx) * unit, (y + p[1] - cy) * unit, (z + p[2] - cz) * unit);
        nor.push(n[0], n[1], n[2]); col.push(c.r, c.g, c.b);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}
function modelVox(type) {
  const v = [];
  const put = (x, y, z, c) => v.push([x, y, z, c]);
  if (type === 'megaphone') { // bell points toward the player and up a little
    const prof = [1, 1, 1.4, 1.9, 2.4, 2.9, 3.4];
    for (let zi = 0; zi < prof.length; zi++) {
      const r = prof[zi];
      for (let x = -4; x <= 4; x++) for (let y = -4; y <= 4; y++) {
        const d = Math.hypot(x, y);
        if (d > r + 0.2) continue;
        const shell = d > r - 1.0 || zi < 2;
        const yy = y + 4 + Math.round(zi * 0.35);
        if (zi === prof.length - 1) put(x, yy, zi, d > r - 0.9 ? '#ffffff' : '#3b2b2b');
        else if (shell) put(x, yy, zi, zi < 2 ? '#3d3f47' : (zi === 3 ? '#ffffff' : '#e2452f'));
      }
    }
    for (let y = 0; y < 3; y++) put(0, y + 1, 2, '#3d3f47');
  } else if (type === 'camera') {
    for (let x = 0; x < 9; x++) for (let y = 0; y < 6; y++) for (let z = 0; z < 4; z++) put(x, y, z, x < 2 ? '#4a4d57' : (y === 0 ? '#cfc4a6' : '#f3ead3'));
    for (let x = 3; x < 6; x++) for (let z = 1; z < 3; z++) put(x, 6, z, '#d9cfb3');
    put(7, 6, 1, '#e2452f'); put(7, 6, 2, '#e2452f');
    put(1, 4, 4, '#ffd23f'); put(0, 4, 4, '#ffd23f');
    for (let x = 2; x <= 6; x++) for (let y = 0; y <= 4; y++) {
      const d = Math.hypot(x - 4, y - 2);
      if (d > 2.6) continue;
      put(x, y, 4, d < 1.2 ? '#3b8fe0' : '#2b2d33');
      if (d < 1.9) put(x, y, 5, d < 1.0 ? '#7fc4ff' : '#3d3f47');
    }
  } else { // coffee cup with sleeve, handle and steam
    for (let y = 0; y < 6; y++) for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
      const d = Math.hypot(x, z), r = 2.4 + (y > 3 ? 0.5 : 0);
      if (d > r) continue;
      if (y === 5 && d < r - 0.9) { put(x, y, z, '#5b3519'); continue; }
      put(x, y, z, y >= 1 && y <= 3 ? '#b8743c' : '#f7f1e3');
    }
    for (let y = 1; y <= 4; y++) { put(4, y, 0, '#f7f1e3'); }
    put(3, 4, 0, '#f7f1e3'); put(3, 1, 0, '#f7f1e3');
    [[0, 7, 0], [1, 8, 0], [0, 9, 0], [-1, 7, 1], [-2, 8, 1]].forEach(([x, y, z]) => put(x, y, z, '#ffffff'));
  }
  return v;
}

// ------------------------------------------------------------------ dot-matrix panel
function makeDMD(canvas) {
  const W = 128, H = 32, buf = new Uint8Array(W * H);
  const g = canvas.getContext('2d');
  let lastKey = '';
  const clear = () => buf.fill(0);
  const text = (s, x, y, sc = 1, v = 3) => {
    s = String(s).toUpperCase();
    for (const ch of s) {
      const gl = FONT[ch] || FONT[' '];
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (gl[r] & (16 >> c))
        for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) { const px = x + c * sc + b, py = y + r * sc + a; if (px >= 0 && py >= 0 && px < W && py < H) buf[py * W + px] = v; }
      x += 6 * sc;
    }
  };
  const width = (s, sc = 1) => String(s).length * 6 * sc - sc;
  const center = (s, y, sc = 1, v = 3) => { let k = sc; while (k > 1 && width(s, k) > W - 2) k--; text(s, Math.round((W - width(s, k)) / 2), y, k, v); return k; };
  function paint() {
    const cw = canvas.width, ch = canvas.height, p = Math.min(cw / W, ch / H), ox = (cw - p * W) / 2, oy = (ch - p * H) / 2;
    g.fillStyle = '#1a0d04'; g.fillRect(0, 0, cw, ch);
    const cols = ['#2f1a08', '#7a4512', '#c9781a', '#ffb52e'];
    const r = p * 0.36;
    for (let i = 0; i < 4; i++) {
      g.fillStyle = cols[i]; g.beginPath();
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (buf[y * W + x] === i) { const cx = ox + (x + 0.5) * p, cy = oy + (y + 0.5) * p; g.moveTo(cx + r, cy); g.arc(cx, cy, r, 0, Math.PI * 2); }
      g.fill();
    }
    g.fillStyle = 'rgba(255,240,200,.85)'; g.beginPath();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (buf[y * W + x] === 3) { const cx = ox + (x + 0.38) * p, cy = oy + (y + 0.36) * p; g.moveTo(cx + r * 0.32, cy); g.arc(cx, cy, r * 0.32, 0, Math.PI * 2); }
    g.fill();
  }
  return {
    clear, text, center, width, W, H,
    commit(key) { if (key === lastKey) return; lastKey = key; paint(); },
    force() { lastKey = ''; },
  };
}

// ------------------------------------------------------------------ playfield texture (canvas painting)
function paintPlayfield(L) {
  const S = 64, cv = document.createElement('canvas'); cv.width = TW * S; cv.height = TL * S;
  const g = cv.getContext('2d');
  const X = (x) => x * S, Y = (y) => (TL - y) * S;
  let seed = 1234; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  // sunny grass base with chunky pixel blocks
  const grad = g.createLinearGradient(0, 0, 0, cv.height);
  grad.addColorStop(0, '#86d455'); grad.addColorStop(0.55, '#62bb3e'); grad.addColorStop(1, '#4aa233');
  g.fillStyle = grad; g.fillRect(0, 0, cv.width, cv.height);
  const B = 16;
  for (let y = 0; y < cv.height; y += B) for (let x = 0; x < cv.width; x += B) {
    const k = rnd();
    if (k < 0.18) { g.fillStyle = 'rgba(30,90,10,.10)'; g.fillRect(x, y, B, B); } else if (k > 0.86) { g.fillStyle = 'rgba(255,255,200,.08)'; g.fillRect(x, y, B, B); }
  }
  for (let i = 0; i < 2600; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(40,110,20,.35)' : 'rgba(170,235,120,.35)'; g.fillRect(Math.floor(rnd() * cv.width / 4) * 4, Math.floor(rnd() * cv.height / 4) * 4, 4, 8); }
  // earth paths: plunger lane, inlanes/outlanes, orbit channel
  const earth = (pts, w) => { g.strokeStyle = '#c79a62'; g.lineWidth = w * S; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.stroke();
    g.strokeStyle = 'rgba(255,230,180,.25)'; g.lineWidth = w * S * 0.35; g.stroke(); };
  earth([[BALL_X, 0], [BALL_X, 14.6]], 0.62);
  earth([[0.5, 0.5], [0.5, 5.4]], 0.55); earth([[LANE_X - 0.5, 0.5], [LANE_X - 0.5, 5.4]], 0.55);
  earth([[1.4, 5.3], [1.4, 4.0], [2.3, 3.25]], 0.42); earth([[LANE_X - 1.4, 5.3], [LANE_X - 1.4, 4.0], [LANE_X - 2.3, 3.25]], 0.42);
  earth([[0.52, 10.3], [0.52, 16], ...arcPts(5, 16, 4.48, 180, 100, 12)], 0.5);
  // drain pit
  const pit = g.createLinearGradient(0, Y(2.2), 0, Y(0)); pit.addColorStop(0, 'rgba(60,35,10,0)'); pit.addColorStop(1, 'rgba(60,35,10,.55)');
  g.fillStyle = pit; g.fillRect(X(2.6), Y(2.2), X(4.05), Y(0) - Y(2.2));
  // outside-the-arc corners: darker hedge
  g.save(); g.beginPath(); g.rect(0, 0, cv.width, Y(16)); g.moveTo(X(10), Y(16)); g.arc(X(5), Y(16), 5 * S, 0, Math.PI, true); g.closePath();
  g.fillStyle = '#2f7a1f'; g.fill('evenodd'); g.restore();
  // pixel flowers
  const flower = (x, y, c) => { const p = 6; g.fillStyle = c; g.fillRect(X(x) - p, Y(y) - p * 2, p, p); g.fillRect(X(x) - p * 2, Y(y) - p, p, p); g.fillRect(X(x), Y(y) - p, p, p); g.fillRect(X(x) - p, Y(y), p, p); g.fillStyle = '#ffd23f'; g.fillRect(X(x) - p, Y(y) - p, p, p); };
  for (let i = 0; i < 40; i++) { const x = 1.4 + rnd() * 6.6, y = 4 + rnd() * 13; if (Math.hypot(x - MID, y - 9.2) < 2.2) continue; flower(x, y, rnd() < 0.6 ? '#ffffff' : '#ffb0c8'); }
  // the title badge: a pixel hill with a sun, and the table name in dot letters
  const bx = MID, by = 9.2;
  g.fillStyle = 'rgba(255,250,225,.92)'; g.beginPath(); g.arc(X(bx), Y(by), 2.05 * S, 0, Math.PI * 2); g.fill();
  g.save(); g.beginPath(); g.arc(X(bx), Y(by), 1.9 * S, 0, Math.PI * 2); g.clip();
  const sky = g.createLinearGradient(0, Y(by + 1.9), 0, Y(by)); sky.addColorStop(0, '#5aa8f3'); sky.addColorStop(1, '#bfe3ff');
  g.fillStyle = sky; g.fillRect(X(bx - 2), Y(by + 2), 4 * S, 4 * S);
  const P = 8;
  for (let x = -2; x < 2; x += P / S) { const top = by - 0.35 + 0.55 * Math.cos((x + 0.4) * 1.1); g.fillStyle = '#5cb83a'; g.fillRect(Math.floor(X(bx + x) / P) * P, Math.floor(Y(top) / P) * P, P, Y(by - 2) - Y(top)); g.fillStyle = '#9ee36a'; g.fillRect(Math.floor(X(bx + x) / P) * P, Math.floor(Y(top) / P) * P, P, P); }
  for (let y = -1; y <= 1; y += P / S) for (let x = -1; x <= 1; x += P / S) { const d = Math.hypot(x, y); if (d < 0.55) { g.fillStyle = d < 0.4 ? '#ffe46a' : '#ffc22a'; g.fillRect(Math.floor(X(bx + 0.7 + x) / P) * P, Math.floor(Y(by + 0.95 + y) / P) * P, P, P); } }
  g.restore();
  g.strokeStyle = '#e8a21a'; g.lineWidth = 6; g.beginPath(); g.arc(X(bx), Y(by), 1.98 * S, 0, Math.PI * 2); g.stroke();
  const dots = (s, cx, cy, d, col) => {
    const w = s.length * 6 * d - d; let x = X(cx) - w / 2; const y = Y(cy) - 3.5 * d;
    for (const ch of s) { const gl = FONT[ch] || FONT[' ']; for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (gl[r] & (16 >> c)) { g.fillStyle = 'rgba(40,20,0,.45)'; g.fillRect(x + c * d + 2, y + r * d + 2, d - 1, d - 1); g.fillStyle = col; g.fillRect(x + c * d, y + r * d, d - 1, d - 1); } x += 6 * d; }
  };
  g.fillStyle = '#d8452f'; g.fillRect(X(bx - 2.25), Y(by - 0.55), 4.5 * S, 0.62 * S);
  g.fillStyle = '#a8321f'; g.fillRect(X(bx - 2.25), Y(by - 1.17), 4.5 * S, 0.06 * S);
  dots('PRESS RUN', bx, by - 0.86, 4, '#ffffff');
  dots('PRESS TOUR', bx, by - 1.6, 3, '#ffffff');
  // lane arrows and labels
  const arrow = (x, y, ang, col) => { g.save(); g.translate(X(x), Y(y)); g.rotate(-ang); g.fillStyle = col; g.beginPath(); g.moveTo(26, 0); g.lineTo(-14, -18); g.lineTo(-6, 0); g.lineTo(-14, 18); g.closePath(); g.fill(); g.restore(); };
  arrow(BALL_X, 12.6, Math.PI / 2, 'rgba(255,250,225,.8)'); arrow(BALL_X, 11.6, Math.PI / 2, 'rgba(255,250,225,.55)');
  dots('ORBIT', 2.05, 10.05, 3, '#fff6d0');
  dots('PRESS', 7.75, 10.55, 3, '#fff6d0');
  // insert sockets (dark rings under the lamp meshes)
  const ring = (x, y, r) => { g.fillStyle = 'rgba(40,25,5,.45)'; g.beginPath(); g.arc(X(x), Y(y), r * S, 0, Math.PI * 2); g.fill(); };
  L.targets.forEach((t) => ring(t.x - 0.62, t.y, 0.25));
  [0, 1, 2, 3].forEach((i) => ring(MID - 1.5 + i, 6.25, 0.3));
  ring(1.6, 9.2, 0.25); ring(MID, 0.95, 0.3); ring(1.4, 4.4, 0.2); ring(LANE_X - 1.4, 4.4, 0.2);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}
function labelTex(txt, fg, bg, w = 64, h = 64) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const d = Math.floor(Math.min(w / (txt.length * 6), h / 9));
  let x = Math.round((w - (txt.length * 6 * d - d)) / 2); const y = Math.round((h - 7 * d) / 2);
  for (const ch of txt) { const gl = FONT[ch] || FONT[' ']; for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (gl[r] & (16 >> c)) { g.fillStyle = fg; g.fillRect(x + c * d, y + r * d, d, d); } x += 6 * d; }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearFilter;
  return t;
}

// ------------------------------------------------------------------ the app
export default {
  id: 'pinball',
  title: 'Pinball',
  icon: 'pinball',
  size: [560, 700],
  minSize: [360, 460],
  single: true,
  resizable: true,
  mount(root, ctx) {
    root.innerHTML = `
      <div class="pb-menubar" role="menubar">
        <div class="pb-menu"><button class="pb-mtitle" type="button"><u>G</u>ame</button>
          <div class="pb-drop" role="menu">
            <button data-a="new">New Game<span>F2</span></button>
            <button data-a="pause">Pause / Resume<span>P</span></button><hr>
            <button data-a="sound" class="check">Sound</button><hr>
            <button data-a="exit">Exit</button>
          </div></div>
        <div class="pb-menu"><button class="pb-mtitle" type="button"><u>H</u>elp</button>
          <div class="pb-drop" role="menu"><button data-a="keys">Controls</button><hr><button data-a="about">About Pinball</button></div></div>
      </div>
      <div class="pb-top"><div class="pb-bezel"><canvas class="pb-dmd" width="512" height="128" aria-label="Score display"></canvas></div></div>
      <div class="pb-view"><canvas class="pb-gl" tabindex="-1"></canvas><div class="pb-hint">Z / ← left flipper · / / → right flipper · hold Space to plunge · P pause<br><span>Touch: tap left / right half · swipe down to plunge</span></div></div>
      <div class="pb-modal" hidden></div>`;
    const $ = (s) => root.querySelector(s);
    const view = $('.pb-view'), glc = $('.pb-gl'), dmdc = $('.pb-dmd'), hint = $('.pb-hint'), modal = $('.pb-modal'), menubar = $('.pb-menubar');
    const dmd = makeDMD(dmdc);
    let soundOn = lsGet(LS_SND, true) !== false;

    // ---------------------------------------------------------------- sound: tiny synth blips, created on first gesture
    let ac = null;
    function blip(type) {
      if (!soundOn || !focused) return;
      try {
        if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ac = new AC(); }
        if (ac.state === 'suspended') ac.resume();
        const t = ac.currentTime, o = ac.createOscillator(), gn = ac.createGain();
        const P = { bump: [520, 180, 0.09, 'square', 0.05], flip: [140, 60, 0.05, 'triangle', 0.08], sling: [380, 120, 0.06, 'square', 0.04], target: [880, 660, 0.08, 'square', 0.045],
          launch: [90, 300, 0.25, 'sawtooth', 0.04], drain: [300, 70, 0.5, 'triangle', 0.08], press: [660, 1320, 0.35, 'square', 0.05], orbit: [440, 990, 0.3, 'triangle', 0.08], save: [990, 1480, 0.3, 'triangle', 0.07] }[type];
        if (!P) return;
        o.type = P[3]; o.frequency.setValueAtTime(P[0], t); o.frequency.exponentialRampToValueAtTime(P[1], t + P[2]);
        gn.gain.setValueAtTime(P[4], t); gn.gain.exponentialRampToValueAtTime(0.0001, t + P[2]);
        o.connect(gn).connect(ac.destination); o.start(t); o.stop(t + P[2] + 0.02);
      } catch { /* audio blocked */ }
    }

    // ---------------------------------------------------------------- simulation + rules
    let msg = null; // { lines, until }
    const vis = { slingKick: [0, 0], laneFlash: [0, 0], launchFx: 0 };
    const sim = makeSim({
      msg: (lines, dur) => { msg = { lines, until: sim.g.t + dur }; },
      bumper: (b) => blip('bump'), sling: (s) => { vis.slingKick[s === 'L' ? 0 : 1] = 1; blip('sling'); },
      target: () => blip('target'), launch: () => blip('launch'), 'flip-hit': () => {},
      sound: (n) => blip(n),
      lane: (s) => { vis.laneFlash[s] = 1; }, hi: () => lsSet(LS_HI, sim.g.hi), over: () => {}, start: () => {}, enter: () => {},
    });
    sim.g.hi = +lsGet(LS_HI, 0) || 0;
    const { g, ball, flL, flR, L } = sim;

    // ---------------------------------------------------------------- three.js scene
    const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 200);
    const disposables = [];
    const keep = (o) => { disposables.push(o); return o; };
    // sky backdrop
    {
      const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d');
      const gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#3f8fe8'); gr.addColorStop(0.55, '#8cc6ff'); gr.addColorStop(1, '#d8efff');
      x.fillStyle = gr; x.fillRect(0, 0, 4, 256);
      const t = keep(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; scene.background = t;
    }
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const envRT = keep(pmrem.fromScene(room, 0.04)); pmrem.dispose();
    room.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    scene.add(new THREE.HemisphereLight(0xd6ecff, 0x6a9a44, 1.55));
    const sun = new THREE.DirectionalLight(0xfff0d2, 2.7);
    sun.position.set(-7, 22, 7); sun.target.position.set(0, 0, 0);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 13, bottom: -13, near: 1, far: 50 });
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
    scene.add(sun, sun.target);

    const M = (o) => keep(new THREE.MeshStandardMaterial(o));
    const mat = {
      cream: M({ color: 0xf2ead2, roughness: 0.55 }), rail: M({ color: 0x9a6431, roughness: 0.75 }), railTop: M({ color: 0xb57a40, roughness: 0.7 }),
      rubber: M({ color: 0xf0643a, roughness: 0.6 }), gate: M({ color: 0xd8d2c0, metalness: 0.6, roughness: 0.3 }),
      ground: M({ color: 0x5cae3a, roughness: 1 }), wood: M({ color: 0x8f5a2a, roughness: 0.8 }),
      flip: M({ color: 0xfff7e6, roughness: 0.45 }), flipRub: M({ color: 0xffb21e, roughness: 0.55 }),
      vox: M({ vertexColors: true, roughness: 0.6 }), white: M({ color: 0xfafafa, roughness: 0.4 }), steel: M({ color: 0xc8ccd2, metalness: 0.9, roughness: 0.25 }),
      ball: M({ color: 0xffffff, metalness: 1, roughness: 0.08, envMap: envRT.texture, envMapIntensity: 1.25 }),
      target: M({ color: 0xffd23f, roughness: 0.5 }),
    };
    const T3 = (x, y, h = 0) => new THREE.Vector3(x - TW / 2, h, TL / 2 - y);
    const table = new THREE.Group(); scene.add(table);
    // playfield
    const pfTex = keep(paintPlayfield(L));
    const pf = new THREE.Mesh(keep(new THREE.PlaneGeometry(TW, TL)), M({ map: pfTex, roughness: 0.88 }));
    pf.rotation.x = -Math.PI / 2; pf.receiveShadow = true; table.add(pf);
    // cabinet: chunky wooden block around and under the playfield, sitting on grass
    const box = (w, h, d, m, x, y, z, cast = true) => { const b = new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, d)), m); b.position.set(x, y, z); b.castShadow = cast; b.receiveShadow = true; table.add(b); return b; };
    box(0.6, 1.9, TL + 1.6, mat.rail, -TW / 2 - 0.3, -0.3, 0); box(0.6, 1.9, TL + 1.6, mat.rail, TW / 2 + 0.3, -0.3, 0);
    box(TW, 1.9, 0.8, mat.rail, 0, -0.3, -TL / 2 - 0.4); box(TW, 1.45, 1.3, mat.rail, 0, -0.52, TL / 2 + 0.65);
    box(TW + 1.2, 0.08, 0.3, mat.railTop, 0, 0.2, TL / 2 + 1.2);
    // apron across the drain (cream with a wood lip)
    { const ap = new THREE.Shape(); ap.moveTo(0, 0); ap.lineTo(LANE_X, 0); ap.lineTo(LANE_X, -0.9); ap.lineTo(0, -0.9); ap.closePath();
      const ag = keep(new THREE.ExtrudeGeometry(ap, { depth: 0.3, bevelEnabled: false })); ag.rotateX(-Math.PI / 2);
      const am = new THREE.Mesh(ag, mat.cream); am.position.copy(T3(0, -0.15, 0)); am.castShadow = true; am.receiveShadow = true; table.add(am); }
    {
      const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
      x.fillStyle = '#62b43e'; x.fillRect(0, 0, 128, 128);
      let sd = 77; const r = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
      for (let i = 0; i < 140; i++) { x.fillStyle = r() < 0.5 ? '#57a836' : '#6fc24a'; x.fillRect(Math.floor(r() * 16) * 8, Math.floor(r() * 16) * 8, 8, 8); }
      for (let i = 0; i < 260; i++) { x.fillStyle = r() < 0.5 ? '#4c9a2e' : '#86d45a'; x.fillRect(Math.floor(r() * 64) * 2, Math.floor(r() * 64) * 2, 2, 4); }
      const t = keep(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30, 30);
      t.magFilter = THREE.NearestFilter; mat.ground.map = t; mat.ground.color.set(0xffffff);
    }
    const ground = new THREE.Mesh(keep(new THREE.PlaneGeometry(120, 120)), mat.ground);
    ground.rotation.x = -Math.PI / 2; ground.position.y = -1.25; ground.receiveShadow = true; scene.add(ground);
    { // voxel flowers and grass tufts scattered around the cabinet
      const U = 0.14, vox = []; let sd = 9; const r = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
      const petals = ['#ffffff', '#ffd23f', '#ffb0c8', '#ff8a5a'];
      for (let i = 0; i < 90; i++) {
        const X = (r() - 0.5) * 44, Z = (r() - 0.5) * 50;
        if (Math.abs(X) < 6.4 && Math.abs(Z) < 12.6) continue;
        const gx = Math.round(X / U), gz = Math.round(Z / U);
        if (r() < 0.55) { // tuft
          const hgt = 2 + Math.floor(r() * 2);
          for (let y = 0; y < hgt; y++) vox.push([gx, y, gz, y ? '#7fd04f' : '#4c9a2e']);
          vox.push([gx + 1, 0, gz, '#5cb83a'], [gx - 1, 1, gz, '#6cc243'], [gx, 0, gz + 1, '#5cb83a']);
        } else { // flower
          const c = petals[Math.floor(r() * petals.length)];
          for (let y = 0; y < 3; y++) vox.push([gx, y, gz, '#4c9a2e']);
          vox.push([gx, 3, gz, '#ffd23f'], [gx + 1, 3, gz, c], [gx - 1, 3, gz, c], [gx, 3, gz + 1, c], [gx, 3, gz - 1, c], [gx, 4, gz, c]);
          vox.push([gx + 1, 1, gz, '#6cc243']);
        }
      }
      const deco = new THREE.Mesh(keep(voxGeo(vox, U, false)), mat.vox); deco.position.y = -1.25; deco.castShadow = true; deco.receiveShadow = true; scene.add(deco);
    }
    // the wooden crown above the arc (rectangle minus the half circle)
    {
      const s = new THREE.Shape();
      s.moveTo(-0.1, 16); s.lineTo(-0.1, TL + 0.05); s.lineTo(TW + 0.1, TL + 0.05); s.lineTo(TW + 0.1, 16);
      for (let i = 0; i <= 36; i++) { const a = i / 36 * Math.PI; s.lineTo(5 + Math.cos(a) * 5.1, 16 + Math.sin(a) * 5.1); }
      const geo = keep(new THREE.ExtrudeGeometry(s, { depth: 0.62, bevelEnabled: false }));
      geo.rotateX(-Math.PI / 2); geo.translate(-TW / 2, 0, TL / 2);
      const m = new THREE.Mesh(geo, mat.rail); m.castShadow = true; m.receiveShadow = true; table.add(m);
    }
    // walls as instanced boxes
    const wallGroups = { cream: [], rail: [], rubber: [], slingside: [], gate: [] };
    L.segs.forEach((s) => { if (s.vis && wallGroups[s.vis]) wallGroups[s.vis].push(s); });
    const dummy = new THREE.Object3D();
    const boxGeo = keep(new THREE.BoxGeometry(1, 1, 1));
    const instWalls = (list, m) => {
      if (!list.length) return null;
      const im = new THREE.InstancedMesh(boxGeo, m, list.length); im.castShadow = true; im.receiveShadow = true;
      list.forEach((s, i) => {
        const len = Math.hypot(s.bx - s.ax, s.by - s.ay);
        dummy.position.copy(T3((s.ax + s.bx) / 2, (s.ay + s.by) / 2, s.h / 2));
        dummy.rotation.set(0, Math.atan2(s.by - s.ay, s.bx - s.ax), 0);
        dummy.scale.set(len + s.t * 1.6, s.h, s.t * 2);
        dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
      });
      table.add(im); return im;
    };
    instWalls(wallGroups.rubber.filter((q) => q.kind !== 'sling'), mat.rubber);
    instWalls(wallGroups.cream, mat.cream); instWalls(wallGroups.rail, mat.railTop); instWalls(wallGroups.slingside, mat.cream); instWalls(wallGroups.gate, mat.gate);
    // posts (rubber capped cylinders)
    const postGeo = keep(new THREE.CylinderGeometry(1, 1, 1, 16));
    L.circles.filter((c) => c.kind === 'post' && c.vis !== false).forEach((c) => {
      const m = new THREE.Mesh(postGeo, mat.rubber); m.scale.set(c.r, 0.5, c.r); m.position.copy(T3(c.x, c.y, 0.25)); m.castShadow = true; table.add(m);
      const cap = new THREE.Mesh(postGeo, mat.white); cap.scale.set(c.r * 0.7, 0.08, c.r * 0.7); cap.position.copy(T3(c.x, c.y, 0.54)); table.add(cap);
    });
    // slingshots: cream wedge + orange rubber band on the kick face
    const slingMeshes = [];
    for (const S of [L.slingL, L.slingR]) {
      const sh = new THREE.Shape(); sh.moveTo(S[0][0], S[0][1]); sh.lineTo(S[1][0], S[1][1]); sh.lineTo(S[2][0], S[2][1]); sh.closePath();
      const geo = keep(new THREE.ExtrudeGeometry(sh, { depth: 0.38, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 1 }));
      geo.rotateX(-Math.PI / 2); geo.translate(-TW / 2, 0, TL / 2);
      const m = new THREE.Mesh(geo, mat.cream); m.castShadow = true; m.receiveShadow = true; table.add(m);
      const len = Math.hypot(S[0][0] - S[2][0], S[0][1] - S[2][1]);
      const band = new THREE.Mesh(boxGeo, mat.rubber);
      band.scale.set(len, 0.28, 0.12); band.rotation.y = Math.atan2(S[0][1] - S[2][1], S[0][0] - S[2][0]);
      band.position.copy(T3((S[0][0] + S[2][0]) / 2, (S[0][1] + S[2][1]) / 2, 0.22)); band.castShadow = true; table.add(band);
      const nx = -(S[0][1] - S[2][1]) / len, ny = (S[0][0] - S[2][0]) / len; // outward normal (toward centre)
      const sgn = (MID - (band.position.x + TW / 2)) * nx > 0 ? 1 : -1;
      slingMeshes.push({ band, base: band.position.clone(), n: new THREE.Vector3(nx * sgn, 0, -ny * sgn) });
    }
    // flippers: tapered capsule extruded, yellow rubber skirt
    function flipperMesh() {
      const sh = new THREE.Shape(), n = 14, pts = [];
      const ang = Math.asin((FL_RB - FL_RT) / FL_LEN);
      for (let i = 0; i <= n; i++) { const a = Math.PI / 2 + ang + (Math.PI - 2 * ang) * i / n; pts.push([Math.cos(a) * FL_RB, Math.sin(a) * FL_RB]); }
      for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + ang + (Math.PI - 2 * ang) * i / n; pts.push([FL_LEN + Math.cos(a) * FL_RT, Math.sin(a) * FL_RT]); }
      pts.reverse(); pts.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
      const geo = keep(new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }));
      geo.rotateX(-Math.PI / 2);
      const grp = new THREE.Group();
      const body = new THREE.Mesh(geo, mat.flip); body.position.y = 0.17; body.castShadow = true;
      const skirt = new THREE.Mesh(geo, mat.flipRub); skirt.scale.set(1.0, 0.7, 1.0); skirt.position.y = 0.02; skirt.castShadow = true;
      const pin = new THREE.Mesh(postGeo, mat.steel); pin.scale.set(0.08, 0.1, 0.08); pin.position.y = 0.45;
      grp.add(body, skirt, pin); table.add(grp);
      return grp;
    }
    const flMeshL = flipperMesh(), flMeshR = flipperMesh();
    flMeshL.position.copy(T3(flL.px, flL.py)); flMeshR.position.copy(T3(flR.px, flR.py));
    // pop bumpers with voxel PR props on top
    const bumperMeshes = L.bumpers.map((b) => {
      const grp = new THREE.Group(); grp.position.copy(T3(b.x, b.y));
      const bodyCol = { megaphone: 0xffd23f, camera: 0x5aa8f3, coffee: 0x6cc243 }[b.type];
      const bodyMat = M({ color: bodyCol, roughness: 0.45, emissive: bodyCol, emissiveIntensity: 0 });
      const skirt = new THREE.Mesh(postGeo, mat.white); skirt.scale.set(b.r + 0.04, 0.1, b.r + 0.04); skirt.position.y = 0.05;
      const ring = new THREE.Mesh(keep(new THREE.TorusGeometry(b.r - 0.02, 0.07, 8, 28)), mat.rubber); ring.rotation.x = Math.PI / 2; ring.position.y = 0.2;
      const body = new THREE.Mesh(keep(new THREE.CylinderGeometry(b.r - 0.08, b.r - 0.02, 0.42, 24)), bodyMat); body.position.y = 0.33;
      const cap = new THREE.Mesh(postGeo, mat.white); cap.scale.set(b.r - 0.04, 0.06, b.r - 0.04); cap.position.y = 0.57;
      const vg = keep(voxGeo(modelVox(b.type), b.type === 'coffee' ? 0.14 : 0.135));
      const prop = new THREE.Mesh(vg, mat.vox); prop.position.y = 0.6; prop.castShadow = true;
      if (b.type === 'megaphone') { prop.rotation.x = 0.15; prop.rotation.y = 0.5; }
      if (b.type === 'camera') prop.rotation.y = -0.35;
      if (b.type === 'coffee') prop.rotation.y = 0.6;
      [skirt, ring, body, cap].forEach((m) => { m.castShadow = true; m.receiveShadow = true; });
      grp.add(skirt, ring, body, cap, prop); table.add(grp);
      return { b, grp, bodyMat, prop };
    });
    // drop targets
    const targetMeshes = L.targets.map((t) => {
      const lt = keep(labelTex(t.ch, '#3a2208', '#ffd23f'));
      const face = M({ map: lt, roughness: 0.5 });
      const m = new THREE.Mesh(keep(new THREE.BoxGeometry(0.2, 0.56, 0.5)), [mat.target, face, mat.target, mat.target, mat.target, mat.target]);
      m.position.copy(T3(t.x + 0.04, t.y, 0.28)); m.castShadow = true; table.add(m);
      return { t, m };
    });
    // lamp inserts
    const lampGeo = keep(new THREE.CylinderGeometry(1, 1, 0.03, 24));
    function lamp(x, y, r, color, label) {
      const tex = label ? keep(labelTex(label, '#ffffff', '#' + new THREE.Color(color).getHexString(), 64, 64)) : null;
      const m = M({ color, emissive: color, emissiveIntensity: 0.05, roughness: 0.3, transparent: true, opacity: 0.92, map: tex, emissiveMap: tex });
      const mesh = new THREE.Mesh(lampGeo, m); mesh.scale.set(r, 1, r); mesh.rotation.y = Math.PI / 2; mesh.position.copy(T3(x, y, 0.016)); table.add(mesh);
      return { m, on: 0 };
    }
    const lamps = {
      press: L.targets.map((t) => lamp(t.x - 0.62, t.y, 0.22, 0xffa21e, t.ch)),
      mult: ['2X', '3X', '4X', '5X'].map((s, i) => lamp(MID - 1.5 + i, 6.25, 0.27, 0xff5a3a, s)),
      orbit: lamp(1.6, 9.2, 0.22, 0x3aa0ff, '<'), save: lamp(MID, 0.95, 0.27, 0x45d0ff, 'S'),
      laneL: lamp(1.4, 4.4, 0.17, 0xffe23a), laneR: lamp(LANE_X - 1.4, 4.4, 0.17, 0xffe23a),
    };
    // plunger
    const plunger = new THREE.Group();
    { const rod = new THREE.Mesh(postGeo, mat.steel); rod.scale.set(0.07, 1.6, 0.07); rod.rotation.x = Math.PI / 2; rod.position.set(0, 0.3, 0.8);
      const tip = new THREE.Mesh(postGeo, mat.rubber); tip.scale.set(0.26, 0.2, 0.26); tip.rotation.x = Math.PI / 2; tip.position.set(0, 0.3, 0);
      const knob = new THREE.Mesh(keep(new THREE.SphereGeometry(0.2, 16, 12)), mat.rubber); knob.position.set(0, 0.3, 1.7);
      [rod, tip, knob].forEach((m) => { m.castShadow = true; }); plunger.add(rod, tip, knob); table.add(plunger); }
    // ball
    const ballMesh = new THREE.Mesh(keep(new THREE.SphereGeometry(BR, 32, 20)), mat.ball);
    ballMesh.castShadow = true; table.add(ballMesh);

    // ---------------------------------------------------------------- camera fit (classic 3/4 view)
    const tilt = 52 * DEG;
    function fitCamera() {
      const w = view.clientWidth || 1, h = view.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w / h > 1.1 ? 30 : 36;
      camera.updateProjectionMatrix();
      const dir = new THREE.Vector3(0, Math.sin(tilt), Math.cos(tilt));
      const pts = [];
      for (const x of [-TW / 2 - 0.6, TW / 2 + 0.6]) for (const z of [-TL / 2 - 0.8, TL / 2 + 1.35]) for (const y of [0, 0.8]) pts.push(new THREE.Vector3(x, y, z));
      const tgt = new THREE.Vector3(0, 0, 0.6);
      let dist = 30;
      for (let it = 0; it < 4; it++) {
        let lo = 5, hi = 120;
        for (let k = 0; k < 26; k++) {
          const mid = (lo + hi) / 2;
          camera.position.copy(tgt).addScaledVector(dir, mid); camera.lookAt(tgt); camera.updateMatrixWorld();
          const ok = pts.every((p) => { const q = p.clone().project(camera); return Math.abs(q.x) < 0.965 && Math.abs(q.y) < 0.95 && q.z < 1; });
          if (ok) hi = mid; else lo = mid;
        }
        dist = hi;
        camera.position.copy(tgt).addScaledVector(dir, dist); camera.lookAt(tgt); camera.updateMatrixWorld();
        let ymin = 9, ymax = -9; pts.forEach((p) => { const q = p.clone().project(camera); ymin = Math.min(ymin, q.y); ymax = Math.max(ymax, q.y); });
        const off = (ymin + ymax) / 2; tgt.z -= off * dist * 0.3;
      }
      camera.position.copy(tgt).addScaledVector(dir, dist); camera.lookAt(tgt);
    }

    // ---------------------------------------------------------------- per-frame visuals
    const tmp = new THREE.Vector3();
    function syncVisuals(dt) {
      const t = g.t, blink = (hz) => (Math.sin(t * hz * Math.PI * 2) > 0 ? 1 : 0);
      ballMesh.visible = ball.live && ball.y > -0.35;
      ballMesh.position.copy(T3(ball.x, ball.y, BR));
      ballMesh.rotation.x -= ball.vy * dt / BR; ballMesh.rotation.z -= ball.vx * dt / BR;
      flMeshL.rotation.y = flL.a; flMeshR.rotation.y = Math.PI - flR.a;
      plunger.position.copy(T3(BALL_X, 0.95 - g.plunger * 0.7 - 0.1, 0)); plunger.position.y = 0;
      for (const bm of bumperMeshes) {
        bm.b.flash = Math.max(0, bm.b.flash - dt * 5);
        bm.bodyMat.emissiveIntensity = bm.b.flash * 1.6;
        const s = 1 + bm.b.flash * 0.14; bm.prop.scale.set(s, s, s);
        bm.prop.rotation.y += dt * (0.3 + bm.b.flash * 6);
      }
      slingMeshes.forEach((sm, i) => { vis.slingKick[i] = Math.max(0, vis.slingKick[i] - dt * 7); tmp.copy(sm.base).addScaledVector(sm.n, vis.slingKick[i] * 0.12); sm.band.position.copy(tmp); });
      for (const tm of targetMeshes) {
        const goal = tm.t.down ? -0.3 : 0.28; tm.m.position.y += (goal - tm.m.position.y) * Math.min(1, dt * 18);
        tm.m.visible = tm.m.position.y > -0.28;
      }
      const set = (lp, on) => { lp.m.emissiveIntensity = on ? 1.5 : 0.04; lp.m.opacity = on ? 1 : 0.7; };
      lamps.press.forEach((lp, i) => set(lp, L.targets[i].down || (g.state === 'attract' && blink(1.5) && (Math.floor(t * 3) % 5 === i))));
      lamps.mult.forEach((lp, i) => set(lp, g.mult >= i + 2));
      set(lamps.orbit, t < g.orbitLit ? blink(3) : 0);
      set(lamps.save, g.state === 'ready' || (t < g.saveUntil && !g.saved) ? blink(t < g.saveUntil - 3 ? 1.2 : 4) : 0);
      vis.laneFlash = vis.laneFlash.map((v) => Math.max(0, v - dt * 2));
      set(lamps.laneL, g.lanes[0] || vis.laneFlash[0] > 0.5); set(lamps.laneR, g.lanes[1] || vis.laneFlash[1] > 0.5);
    }
    function drawDMD() {
      dmd.clear();
      const t = g.t, wall = performance.now() / 1000;
      let key;
      if (paused && g.state !== 'attract') {
        dmd.center('PAUSED', 3, 2); dmd.center(focused ? 'PRESS P OR CLICK' : 'CLICK TO RESUME', 22, 1, 2); key = 'p' + focused;
      } else if (g.state === 'attract') {
        const page = Math.floor(wall / 2.6) % 3;
        if (page === 0) { dmd.center('PRESS RUN', 2, 2); dmd.center('A PR CAMPAIGN PINBALL', 23, 1, 2); }
        else if (page === 1) { dmd.center('SPACE TO PLAY', 3, 2); dmd.center('OR TAP THE TABLE', 23, 1, 2); }
        else { dmd.center('HIGH SCORE', 3, 1, 2); dmd.center(fmt(g.hi), 13, 2); }
        key = 'a' + page + g.hi;
      } else if (msg && (t < msg.until || g.state === 'over')) {
        const on = g.state === 'over' || Math.floor(t * 6) % 6 !== 0;
        const alt = g.state === 'over' && Math.floor(wall / 1.6) % 2;
        dmd.center(msg.lines[0], 3, 2, on ? 3 : 2); dmd.center(alt ? 'SPACE: NEW GAME' : (msg.lines[1] || ''), 22, 1, alt ? 3 : 2);
        key = 'm' + msg.lines.join('|') + on + alt;
      } else {
        const s = fmt(g.score);
        dmd.center(s, 2, 2);
        dmd.text('BALL ' + g.ball, 1, 24, 1, 2);
        const m = g.mult + 'X'; dmd.text(m, 127 - dmd.width(m), 24, 1, g.mult > 1 ? 3 : 1);
        const save = t < g.saveUntil && !g.saved && Math.floor(t * 4) % 2;
        if (save) dmd.center('SAVE', 24, 1, 3);
        else if (g.state === 'ready') dmd.center(g.pulling ? 'POWER ' + Math.round(g.plunger * 100) : 'SHOOT!', 24, 1, 2);
        key = 's' + s + g.ball + m + save + g.state + (g.pulling ? Math.round(g.plunger * 20) : '');
      }
      dmd.commit(key);
    }

    // ---------------------------------------------------------------- loop, pause, visibility
    let raf = 0, last = 0, acc = 0, paused = false, focused = false, disposed = false;
    const visible = () => !document.hidden && root.isConnected && view.clientWidth > 0 && view.clientHeight > 0;
    const live = () => !paused && focused && visible();
    function frame(now) {
      raf = 0;
      if (disposed) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
      if (!live()) { renderOnce(); return; }
      if (g.state !== 'attract' && g.state !== 'over') {
        acc += dt; let n = 0;
        while (acc >= STEP && n < 80) { sim.step(); acc -= STEP; n++; }
      } else { g.t += dt; acc = 0; }
      syncVisuals(dt);
      drawDMD();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf && !disposed) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    function renderOnce() { if (disposed) return; syncVisuals(0); drawDMD(); renderer.render(scene, camera); }
    function setPaused(v) {
      if (paused === v) return;
      paused = v;
      if (v) { flL.held = flR.held = false; g.pulling = false; }
      view.classList.toggle('paused', v && g.state !== 'attract' && g.state !== 'over');
      dmd.force(); renderOnce(); if (!v) kick();
    }
    const onVis = () => { if (document.hidden) setPaused(true); };
    document.addEventListener('visibilitychange', onVis);

    // ---------------------------------------------------------------- controls
    const keys = { L: new Set(['KeyZ', 'ShiftLeft', 'ArrowLeft']), R: new Set(['Slash', 'ShiftRight', 'ArrowRight']), P: new Set(['Space', 'ArrowDown']) };
    function startOrResume() {
      if (paused) { setPaused(false); return true; }
      if (g.state === 'attract' || g.state === 'over') { msg = null; sim.startGame(); hint.classList.add('gone'); kick(); return true; }
      return false;
    }
    const onKeyDown = (e) => {
      if (!focused || !modal.hidden) return;
      const c = e.code;
      if (c === 'F2') { e.preventDefault(); msg = null; setPaused(false); sim.startGame(); hint.classList.add('gone'); kick(); return; }
      if (c === 'KeyP') { e.preventDefault(); if (g.state !== 'attract' && g.state !== 'over') setPaused(!paused); return; }
      if (keys.L.has(c) || keys.R.has(c) || keys.P.has(c) || c === 'Enter') {
        e.preventDefault();
        if (e.repeat) return;
        if (paused) { setPaused(false); return; }
        if ((g.state === 'attract' || g.state === 'over') && (keys.P.has(c) || c === 'Enter')) { startOrResume(); return; }
        if (keys.L.has(c)) { flL.held = true; blip('flip'); }
        if (keys.R.has(c)) { flR.held = true; blip('flip'); }
        if (keys.P.has(c) && g.state === 'ready') g.pulling = true;
      }
    };
    const onKeyUp = (e) => {
      const c = e.code;
      if (keys.L.has(c)) flL.held = false;
      if (keys.R.has(c)) flR.held = false;
      if (keys.P.has(c) && g.pulling) sim.launch();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    const onRootDown = () => { if (!focused) { focused = true; dmd.force(); kick(); } };
    root.addEventListener('pointerdown', onRootDown);
    // pointer: halves = flippers, swipe down = plunger
    const ptrs = new Map();
    const holdSide = () => { let l = false, r = false; for (const p of ptrs.values()) if (!p.plunge) { if (p.side === 'L') l = true; else r = true; } flL.held = l; flR.held = r; };
    glc.addEventListener('pointerdown', (e) => {
      focused = true;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      try { glc.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      if (startOrResume()) return;
      const side = e.offsetX < glc.clientWidth / 2 ? 'L' : 'R';
      ptrs.set(e.pointerId, { side, y0: e.offsetY, plunge: false });
      holdSide(); blip('flip');
    });
    glc.addEventListener('pointermove', (e) => {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      const dy = e.offsetY - p.y0;
      if (!p.plunge && dy > 22 && g.state === 'ready') { p.plunge = true; holdSide(); }
      if (p.plunge) { g.plunger = Math.max(0, Math.min(1, (dy - 22) / 110)); g.pulling = false; }
    });
    const ptrUp = (e) => {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      ptrs.delete(e.pointerId);
      if (p.plunge) { g.pulling = true; sim.launch(); }
      holdSide();
    };
    glc.addEventListener('pointerup', ptrUp); glc.addEventListener('pointercancel', ptrUp);
    glc.addEventListener('contextmenu', (e) => e.preventDefault());

    // ---------------------------------------------------------------- menus
    let openMenu = null;
    function setMenu(m) {
      openMenu = m;
      root.querySelectorAll('.pb-menu').forEach((el) => el.classList.toggle('open', el === m));
      if (m) root.querySelector('[data-a="sound"]').classList.toggle('on', soundOn);
    }
    menubar.addEventListener('pointerdown', (e) => { const t = e.target.closest('.pb-mtitle'); if (t) { e.preventDefault(); setMenu(openMenu === t.parentElement ? null : t.parentElement); } });
    menubar.addEventListener('pointerover', (e) => { const t = e.target.closest('.pb-mtitle'); if (t && openMenu && openMenu !== t.parentElement) setMenu(t.parentElement); });
    menubar.addEventListener('click', (e) => { const b = e.target.closest('.pb-drop button'); if (b) { setMenu(null); action(b.dataset.a); } });
    const outside = (e) => { if (openMenu && !openMenu.contains(e.target)) setMenu(null); if (!root.contains(e.target) && focused) { focused = false; if (g.state !== 'attract' && g.state !== 'over') setPaused(true); } };
    document.addEventListener('pointerdown', outside, true);
    function action(a) {
      if (a === 'new') { msg = null; setPaused(false); sim.startGame(); hint.classList.add('gone'); kick(); }
      else if (a === 'pause') { if (g.state !== 'attract' && g.state !== 'over') setPaused(!paused); }
      else if (a === 'sound') { soundOn = !soundOn; lsSet(LS_SND, soundOn); }
      else if (a === 'exit') ctx.close && ctx.close();
      else if (a === 'keys') dialog('Controls', `<table class="pb-keys"><tr><td>Left flipper</td><td><kbd>Z</kbd> <kbd>Left Shift</kbd> <kbd>←</kbd></td></tr>
        <tr><td>Right flipper</td><td><kbd>/</kbd> <kbd>Right Shift</kbd> <kbd>→</kbd></td></tr><tr><td>Plunger</td><td>hold <kbd>Space</kbd> or <kbd>↓</kbd>, release</td></tr>
        <tr><td>Pause</td><td><kbd>P</kbd></td></tr><tr><td>New game</td><td><kbd>F2</kbd></td></tr><tr><td>Touch</td><td>tap left / right half; swipe down to plunge</td></tr></table>
        <p>Drop all five <b>P-R-E-S-S</b> targets to raise the multiplier. Loop the left orbit for coverage; light it from an inlane for a super orbit.</p>`);
      else if (a === 'about') dialog('About Pinball', `<p><b>Pinball: Press Run</b>, a PR-campaign table for Kayzee XP.</p><p>Original table, art and physics. A fan homage to classic desktop pinball; not affiliated with any operating-system vendor.</p>`);
    }
    function dialog(title, html) {
      setPaused(true);
      modal.innerHTML = `<div class="pb-dlg" role="dialog" aria-label="${title}"><div class="pb-dlg-t">${title}</div><div class="pb-dlg-b">${html}</div><div class="pb-dlg-f"><button type="button" class="pb-btn">OK</button></div></div>`;
      modal.querySelector('button').addEventListener('click', () => { modal.hidden = true; });
      modal.hidden = false;
    }

    // ---------------------------------------------------------------- resize & start
    const ro = new ResizeObserver(() => { fitCamera(); dmdSize(); renderOnce(); });
    function dmdSize() {
      const w = Math.max(60, Math.round(dmdc.clientWidth * Math.min(2, window.devicePixelRatio || 1)));
      if (dmdc.width !== w) { dmdc.width = w; dmdc.height = Math.round(w / 4); dmd.force(); }
    }
    ro.observe(view); ro.observe(dmdc);
    fitCamera(); dmdSize(); renderOnce();

    // test hook: headless simulation for the CDP harness
    Object.defineProperty(root, '_kzPinball', { configurable: true, value: {
      get g() { return { state: g.state, score: g.score, ball: g.ball, mult: g.mult, t: g.t, plunger: g.plunger, saveUntil: g.saveUntil, stats: { ...g.stats } }; },
      get ball() { return { ...ball }; }, get flippers() { return [flL.a, flR.a]; }, get paused() { return paused; }, get running() { return !!raf; },
      simulate(secs, { auto = true } = {}) {
        g.debug = true; const n = Math.round(secs / STEP); let lastScore = g.score, scoreUps = 0;
        for (let i = 0; i < n; i++) { if (auto) sim.autoplay(); sim.step(); if (g.score > lastScore) { scoreUps++; lastScore = g.score; } }
        g.debug = false; flL.held = flR.held = false; renderOnce();
        return { ...g.stats, scoreUps, score: g.score, state: g.state, ball: g.ball };
      },
      place(x, y, vx, vy) { Object.assign(ball, { x, y, vx, vy, live: true, inLane: x > LANE_X }); g.state = 'play'; },
      start() { startOrResume(); },
    } });

    return {
      onResize() { fitCamera(); dmdSize(); renderOnce(); },
      onFocus() { focused = true; dmd.force(); kick(); },
      onBlur() { focused = false; setMenu(null); if (g.state !== 'attract' && g.state !== 'over') setPaused(true); else renderOnce(); },
      unmount() {
        disposed = true; cancelAnimationFrame(raf); raf = 0;
        ro.disconnect();
        window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp);
        document.removeEventListener('pointerdown', outside, true); document.removeEventListener('visibilitychange', onVis);
        scene.traverse((o) => { if (o.isMesh || o.isInstancedMesh) { o.geometry && o.geometry.dispose(); } });
        disposables.forEach((d) => { try { d.dispose(); } catch { /* ignore */ } });
        renderer.dispose(); try { renderer.forceContextLoss(); } catch { /* ignore */ }
        if (ac) try { ac.close(); } catch { /* ignore */ }
        delete root._kzPinball;
        root.innerHTML = '';
      },
    };
  },
};
