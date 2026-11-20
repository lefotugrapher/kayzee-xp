// Original WebAudio UI sounds (synthesised, no samples). Nothing plays before the first user gesture.
const KEY = 'kz.volume';
let ac = null, master = null, comp = null;
let state = { v: 0.7, m: false };
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && typeof s.v === 'number') state = { v: Math.min(1, Math.max(0, s.v)), m: !!s.m }; } catch (_) {}
const listeners = new Set();
let unlocked = false;

function gainValue() { return state.m ? 0 : state.v * state.v * 0.9; }

function ensure() {
  if (ac) return ac;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ac = new AC();
  comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 3;
  master = ac.createGain();
  master.gain.value = gainValue();
  master.connect(comp); comp.connect(ac.destination);
  return ac;
}

// call from any user gesture; safe to call repeatedly
export function unlock() {
  unlocked = true;
  const a = ensure();
  if (a && a.state === 'suspended') a.resume().catch(() => {});
}
['pointerdown', 'keydown', 'touchend'].forEach((t) => addEventListener(t, unlock, { capture: true, passive: true }));

export function getVolume() { return state.v; }
export function isMuted() { return state.m; }
export function setVolume(v) { state.v = Math.min(1, Math.max(0, v)); save(); }
export function setMuted(m) { state.m = !!m; save(); }
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
  if (master) master.gain.setTargetAtTime(gainValue(), ac.currentTime, 0.015);
  listeners.forEach((f) => f({ ...state }));
}
// a node app code can route its own audio through (respects master volume / mute)
export function output() { const a = ensure(); return a ? master : null; }
export function context() { return ensure(); }

// ------------------------------------------------------------ voices
function env(g, t, a, peak, d, sustain = 0.0001) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + d);
}
function tone(type, f0, f1, t, dur, peak, { a = 0.004, dest = master, detune = 0, q } = {}) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.9);
  o.detune.value = detune;
  env(g, t, a, peak, dur);
  let out = g;
  if (q) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = q; g.connect(f); out = f; }
  o.connect(g); out.connect(dest);
  o.start(t); o.stop(t + a + dur + 0.05);
}
function noise(t, dur, peak, { from = 800, to = 3000, type = 'bandpass', Q = 0.8 } = {}) {
  const n = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(); s.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = type; f.Q.value = Q;
  f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ac.createGain(); env(g, t, dur * 0.35, peak, dur * 0.65);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t); s.stop(t + dur + 0.02);
}

const VOICES = {
  click(t) { tone('sine', 2100, 1500, t, 0.035, 0.18); tone('triangle', 900, 700, t, 0.02, 0.06); },
  open(t) { tone('triangle', 523.25, 523.25, t, 0.09, 0.16); tone('triangle', 783.99, 783.99, t + 0.06, 0.16, 0.14); tone('sine', 1567.98, 1567.98, t + 0.06, 0.12, 0.03); },
  close(t) { tone('triangle', 659.25, 659.25, t, 0.07, 0.13); tone('triangle', 440, 392, t + 0.05, 0.14, 0.12); },
  minimize(t) { noise(t, 0.16, 0.10, { from: 2600, to: 500 }); },
  restore(t) { noise(t, 0.16, 0.10, { from: 500, to: 2600 }); },
  error(t) {
    tone('square', 220, 220, t, 0.16, 0.09, { q: 1400 }); tone('square', 233, 233, t, 0.16, 0.05, { q: 1400 });
    tone('square', 164.8, 164.8, t + 0.17, 0.26, 0.09, { q: 1200 });
  },
  ding(t) {
    [[1318.5, 0.16, 1.1], [2637, 0.05, 0.6], [3955, 0.02, 0.35]].forEach(([f, p, d]) => tone('sine', f, f, t, d, p, { a: 0.003 }));
  },
  startup(t) {
    // slow major-ninth swell with a rising arpeggio on top (original)
    const pad = [155.56, 233.08, 311.13, 392.0, 466.16];
    pad.forEach((f, i) => {
      [-7, 7].forEach((dt) => {
        const o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
        o.type = i < 2 ? 'sine' : 'triangle'; o.frequency.value = f; o.detune.value = dt;
        lp.type = 'lowpass'; lp.frequency.setValueAtTime(600, t); lp.frequency.linearRampToValueAtTime(2400, t + 1.6);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.045, t + 0.9);
        g.gain.setValueAtTime(0.045, t + 1.8);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);
        o.connect(lp); lp.connect(g); g.connect(master);
        o.start(t); o.stop(t + 4.3);
      });
    });
    [622.25, 783.99, 932.33, 1244.5, 1396.9, 1864.7].forEach((f, i) => {
      tone('sine', f, f, t + 0.35 + i * 0.17, 1.4 - i * 0.1, 0.07 - i * 0.006, { a: 0.012 });
    });
    tone('sine', 77.78, 77.78, t, 3.6, 0.10, { a: 0.6 });
  },
  shutdown(t) {
    [1244.5, 932.33, 783.99, 622.25].forEach((f, i) => tone('sine', f, f, t + i * 0.16, 1.0, 0.06, { a: 0.01 }));
    tone('sine', 155.56, 155.56, t, 2.2, 0.06, { a: 0.3 });
  },
  balloon(t) { tone('sine', 987.77, 987.77, t, 0.12, 0.08); tone('sine', 1318.5, 1318.5, t + 0.09, 0.22, 0.07); },
};

export function play(name) {
  if (!unlocked || state.m || state.v <= 0) return;
  const a = ensure();
  if (!a || !VOICES[name]) return;
  if (a.state === 'suspended') a.resume().catch(() => {});
  try { VOICES[name](a.currentTime + 0.01); } catch (_) {}
}
