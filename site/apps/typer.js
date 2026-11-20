// Headline Rush: an original falling-words typing game set on a newsroom wire, in the Voxel Luna style.
// Slips of copy come down the wire towards the print deadline; type a slip to file it before it lands.
// All art (paper slips, teletype rail, printing press, pixel lettering) is drawn procedurally here.

const LS_BEST = 'kayzee-typer-best';
const LS_PREF = 'kayzee-typer-pref';
const MAX_MISS = 3, PER_LEVEL = 10, SPRINT_S = 60, COFFEE_S = 8;
const FONT = 'ui-monospace, Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", "Courier New", monospace';

// ------------------------------------------------------------------ word list (original; a-z, space and hyphen only)
const list = (s) => s.trim().split(/\s+/);
const phrases = (s) => s.split('|').map((x) => x.trim()).filter(Boolean);
const WORDS = {
  // A: 3-4 letters
  A: list(`ink tip tag cut mic cue pan web ads air log dub mix copy desk edit news wire post blog feed lede lead beat
    slug deck memo spin buzz hook clip shot take reel tilt crop font kern logo link live poll scan sync tone type
    word page fold plug spot tape team demo data fact file film info item line list mail note plan push rank show
    sign site snap stat stet text tour vlog zine hype grid hero icon idea fade host quiz gala`),
  // B: 5-6 letters
  B: list(`pitch brief draft quote story media press angle proof print photo video audio radio cover layout byline
    banner teaser script sketch source survey stream studio social slogan signal series review report reader rating
    public pundit promo panel output notice motion mockup margin launch kicker insert inbox header footer format
    follow filter figure events emcee editor digest design credit column client clicks camera brand blurb awards
    anchor agenda alert album asset audit board cable chart crisis trend topic title theme style stunt stats spike
    slide share scene recap reach query pixel pivot niche lobby intro outro index image guest frame focus forum
    flyer flash event essay emoji email debut daily comms cameo`),
  // C: 7-8 letters
  C: list(`caption profile rewrite leaflet embargo keynote podcast preview publish release reporter roundup sidebar
    snippet sponsor summary tagline teletype timeline trailer webinar writers workshop headline deadline campaign
    briefing bulletin calendar channels coverage creative database dispatch document editing edition exposure
    feedback features footage graphics hashtag handout insight journal listener magazine mailing masthead message
    metrics mention montage network newsroom opinion outreach overlay pamphlet playbook platform playlist position
    premiere producer proposal readers referral register research response retainer schedule speaker strategy
    subtitle takeaway template typeface viewers visuals wording analyst archive article audience backdrop branding
    brochure cutaway`),
  // D: 9-10 letters
  D: list(`voiceover broadcast sentiment shortlist thumbnail newsletter storyboard engagement copywriter publicist
    journalist influencer interview livestream messaging moderator narrative newsworthy objectives paragraph
    photoshoot readership reputation scheduling screenplay signature soundbite statement subscriber syndicate
    transcript viewership watermark wordsmith analytics algorithm announcer awareness backstory benchmark biography
    brainstorm commentary conference consultant copyright columnist correction editorial freelancer guidelines
    highlights letterhead marketing microphone newsstand narration promotion quotation retraction typesetter
    typography publicity followers typewriter`),
  // E: 11 letters and up
  E: list(`boilerplate stakeholder proofreader spokesperson infographic impressions partnership positioning
    storytelling testimonial circulation demographic ghostwriter publication punctuation advertising attribution
    communications correspondent photojournalist sponsorship announcement presentation distribution proofreading
    broadcaster copywriting endorsement illustrator newsgathering subscription documentary commentator
    transcription`),
  // H: hyphenated terms (the hyphen is optional when typing)
  H: list(`b-roll op-ed fact-check follow-up on-air lead-in sign-off run-through tie-in q-and-a in-house long-form
    short-form real-time must-read co-host pre-roll mid-roll cut-off stand-up wrap-up roll-out kick-off drop-cap
    call-to-action off-the-record e-newsletter`),
  // P: two-word phrases
  P: phrases(`press release|media kit|press kit|news desk|back page|key message|talking points|photo call|press pass|
    style guide|house style|copy desk|news cycle|lead story|cover story|pull quote|air time|prime time|case study|
    focus group|target audience|brand voice|content plan|social post|media list|press office|news hook|story angle|
    open rate|launch day|picture desk|night editor|city desk|live blog|push alert|news alert|voice memo|rough cut|
    final cut|jump cut|title card|lower third|green room|cold open|white paper|fact sheet|one pager|pitch deck|
    mood board|brand guide|earned media|paid media|owned media|crisis plan|holding line|key visual|call sheet|
    shot list|show notes|guest list|press call|media day|photo credit|word count|first draft|final draft|copy edit|
    line edit|print run|late edition|early edition|wire copy|press room|going live|on record|no comment|soft launch|
    hard news|feature story|human interest|media training|press briefing|photo caption|content calendar|
    editorial calendar|thought leadership|public relations|media relations|internal comms|town hall|annual report|
    brand story|key takeaway|speaking notes|event recap|opening line|closing line|sound check|mic check|video edit|
    page proof|galley proof|spell check|style sheet`),
};
WORDS.h = WORDS.H.filter((w) => w.length <= 8);  // short hyphenated
WORDS.p = WORDS.P.filter((w) => w.length <= 10); // short phrases
const BREAKING = ['breaking', 'exclusive', 'scoop', 'newsflash', 'stop press', 'just in', 'front page', 'extra extra', 'developing', 'hot off press'];
const COFFEE = ['coffee', 'espresso', 'flat white', 'tea break', 'cortado', 'latte', 'mocha', 'refill', 'biscuits', 'oat milk'];
// which length groups each level draws from (one letter = one pick weight)
const LEVEL_TIERS = ['A', 'AAB', 'AB', 'BBC', 'BCh', 'BCCp', 'CCDp', 'CDPH', 'CDDEP', 'DDEPPH'];
const SPRINT_TIERS = 'AABBBC';

// ------------------------------------------------------------------ palette (original paper-and-ink)
const C = {
  paper: '#efe6cf', paperDk: '#e6dcc2', rule: '#dfd4b7', greek: '#e3d8bc', greekHd: '#d9ccab', hole: '#c9bd9c',
  slip: '#fffdf3', slipHi: '#ffffff', slipLo: '#cfc5a9', slipTab: '#8d8676',
  ink: '#1d1b18', inkSoft: '#5a5346', done: '#1c6b34', hilite: '#ffe36a', lock: '#1f55c9',
  red: '#d8342a', redDk: '#9e2018', redHi: '#ff8a7a',
  gold: '#ffd75a', goldHi: '#fff1b0', goldLo: '#d39b1c',
  blue: '#cfe5ff', blueHi: '#edf6ff', blueLo: '#7fb0e6', blueDk: '#2f6fc4',
  mach: '#33363d', machHi: '#5b606c', machLo: '#22242a', slot: '#121316', steel: '#7d8492', steelHi: '#b3bac7',
  brass: '#c9a24a', brassHi: '#ecd084', brassLo: '#8f6f26', web: '#f3ecd8', webLo: '#d6cbae', webInk: '#8a8273',
};
// tiny pixel alphabet for labels (rows of 5, variable width)
const GLYPH = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'], E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'], I: ['###', '.#.', '.#.', '.#.', '###'],
  K: ['#..#', '#.#.', '##..', '#.#.', '#..#'], L: ['#..', '#..', '#..', '#..', '###'], M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'], P: ['##.', '#.#', '##.', '#..', '#..'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'], S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'], Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], ' ': ['..', '..', '..', '..', '..'],
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['##.', '..#', '.#.', '..#', '##.'], 4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'], 8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '##.'],
};
const CUP = ['.s.s....', '..s.s...', 'wwwww...', 'wwwwwww.', 'wwwww.w.', 'wwwwwww.', '.www....', 'ddddddd.'];
const pixCells = (str) => { let n = 0; for (const ch of str) n += (GLYPH[ch] || GLYPH[' '])[0].length + 1; return Math.max(0, n - 1); };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function lsGet(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } }
const pick = (a) => a[(Math.random() * a.length) | 0];

// ------------------------------------------------------------------ the app
export default {
  id: 'typer',
  title: 'Headline Rush',
  icon: 'typer',
  size: [620, 470],
  minSize: [340, 330],
  single: true,
  resizable: true,
  mount(root, ctx) {
    const mobile = !!ctx.isMobile;
    const snd = (n) => { try { ctx.sound && ctx.sound(n); } catch { /* sound is optional */ } };
    let mode = lsGet(LS_PREF, {}).mode === 'sprint' ? 'sprint' : 'deadline';

    root.innerHTML = `
      <div class="ty-wrap">
        <div class="xp-menubar ty-menubar" role="menubar">
          <div class="ty-menu"><button class="xp-menubar-item ty-mtitle" type="button" tabindex="-1"><u>G</u>ame</button>
            <div class="ty-drop" role="menu">
              <button type="button" tabindex="-1" data-a="new">New edition<span>F2</span></button>
              <button type="button" tabindex="-1" data-a="pause"><em>Pause</em><span>Esc</span></button><hr>
              <button type="button" tabindex="-1" data-a="deadline" class="radio">Deadline mode</button>
              <button type="button" tabindex="-1" data-a="sprint" class="radio">60-second sprint</button><hr>
              <button type="button" tabindex="-1" data-a="best">Best scores…</button><hr>
              <button type="button" tabindex="-1" data-a="exit">Exit</button>
            </div></div>
          <div class="ty-menu"><button class="xp-menubar-item ty-mtitle" type="button" tabindex="-1"><u>H</u>elp</button>
            <div class="ty-drop" role="menu">
              <button type="button" tabindex="-1" data-a="howto">How to play</button><hr>
              <button type="button" tabindex="-1" data-a="about">About Headline Rush</button>
            </div></div>
        </div>
        <div class="ty-hud" aria-live="off">
          <div class="ty-stat"><span class="ty-k">Score</span><b class="ty-v" data-v="score">0</b></div>
          <div class="ty-stat"><span class="ty-k">WPM</span><b class="ty-v" data-v="wpm">0</b></div>
          <div class="ty-stat"><span class="ty-k" data-k="acc">Accuracy</span><b class="ty-v" data-v="acc">100%</b></div>
          <div class="ty-stat"><span class="ty-k" data-k="lvl">Level</span><b class="ty-v" data-v="lvl">1</b></div>
          <div class="ty-stat"><span class="ty-k">Streak</span><b class="ty-v" data-v="streak">0</b></div>
          <div class="ty-stat"><span class="ty-k" data-k="lives">Misses</span><span class="ty-lifebox"><i></i><i></i><i></i></span><b class="ty-v" data-v="words" hidden>0</b></div>
          <button class="xp-btn ty-pause" type="button" tabindex="-1" aria-label="Pause"><i></i></button>
        </div>
        <div class="ty-stage">
          <canvas class="ty-cv" aria-label="The wire: type the falling words"></canvas>
          <input class="ty-in" type="text" inputmode="text" enterkeyhint="done" autocomplete="off" autocorrect="off"
            autocapitalize="off" spellcheck="false" tabindex="-1" aria-label="Type the words on the wire">
          <div class="ty-modal" hidden></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const wrap = $('.ty-wrap'), menubar = $('.ty-menubar'), hudEl = $('.ty-hud'), stage = $('.ty-stage'), cv = $('.ty-cv');
    const inp = $('.ty-in'), modal = $('.ty-modal'), pauseBtn = $('.ty-pause'), lifeBox = $('.ty-lifebox');
    const lifeEls = [...lifeBox.children];
    const hv = {}, hk = {}, hc = {};
    root.querySelectorAll('[data-v]').forEach((el) => { hv[el.dataset.v] = el; });
    root.querySelectorAll('[data-k]').forEach((el) => { hk[el.dataset.k] = el; });
    const g = cv.getContext('2d');

    // ---------------------------------------------------------------- state
    let state = 'ready'; // ready | play | paused | over
    let words = [], target = null, uid = 0;
    let score = 0, filed = 0, streak = 0, bestStreak = 0, misses = 0, level = 1, correct = 0, wrong = 0;
    let clock = 0, started = false, timeLeft = SPRINT_S, wpmShown = 0, wpmT = 0;
    let spawnT = 0, coffeeT = 0, sinceBreaking = 0, sinceCoffee = 0, result = null, card = null;
    const recent = [];
    // view
    let W = 0, H = 0, dpr = 1, u = 2, fs = 13, railH = 18, pressH = 44, deadY = 0, slipH = 25, padX = 8, font = '';
    let bgCv = null, rollers = [], rollerKey = '';
    let raf = 0, last = 0, disposed = false, focused = false, blurTimer = 0, comp = '', justComposed = false;
    let tape = 0, web = 0, headX = 0, headTarget = 0, flash = 0, missFlash = 0, lastErr = 0, blink = 0;
    const fx = []; let banner = null;

    const D = (v) => Math.round(v * dpr);
    const rect = (x, y, w, h, c) => { g.fillStyle = c; const x0 = D(x), y0 = D(y); g.fillRect(x0, y0, D(x + w) - x0, D(y + h) - y0); };
    function pix(str, x, y, s, c, on = rect) {
      for (const ch of str) {
        const gl = GLYPH[ch] || GLYPH[' '];
        for (let r = 0; r < 5; r++) for (let i = 0; i < gl[r].length; i++) if (gl[r][i] === '#') on(x + i * s, y + r * s, s, s, c);
        x += (gl[0].length + 1) * s;
      }
    }

    // ---------------------------------------------------------------- difficulty
    const fallTime = () => (mode === 'sprint' ? 16 : Math.max(5, 11 - 0.6 * (level - 1)));
    const interval = () => (mode === 'sprint' ? 0.12 : Math.max(0.85, 2.6 - 0.17 * (level - 1)));
    const maxWords = () => (mode === 'sprint' ? (W < 440 ? 3 : 4) : Math.min(7, 2 + Math.floor(level / 2)));
    const mult = () => Math.min(6, 1 + Math.floor(streak / 5));
    const tiers = () => (mode === 'sprint' ? SPRINT_TIERS : LEVEL_TIERS[Math.min(LEVEL_TIERS.length, level) - 1]);
    const wpmNow = () => (clock >= 1 ? Math.round(correct / 5 / (clock / 60)) : 0);
    const accNow = () => (correct + wrong ? Math.round(100 * correct / (correct + wrong)) : 100);

    // ---------------------------------------------------------------- words
    const tabW = (kind) => (kind === 'breaking' ? (pixCells('BREAKING') + 4) * u : kind === 'coffee' ? 12 * u : 2 * u);
    function measure(w) {
      g.font = font;
      w.tw = g.measureText(w.disp).width / dpr;
      w.sw = Math.ceil(tabW(w.kind) + padX * 2 + w.tw);
    }
    const slipX = (w) => 7 * u + w.fx * Math.max(0, W - 14 * u - w.sw - u);
    const slipY = (w) => { const y0 = railH - slipH - u; return y0 + w.p * (deadY - slipH - y0); };
    function pickWord(pool) {
      const used = new Set(words.map((w) => w.text[0]));
      let fallback = null;
      for (let i = 0; i < 30; i++) {
        const src = Array.isArray(pool) ? pool : WORDS[pool[(Math.random() * pool.length) | 0]];
        const cand = pick(src);
        if (recent.includes(cand) || words.some((w) => w.text === cand)) continue;
        if (!used.has(cand[0])) return cand;
        if (!fallback) fallback = cand;
      }
      return fallback || pick(Array.isArray(pool) ? pool : WORDS.A);
    }
    function spawn(forceKind, forceText) {
      let kind = forceKind || 'normal';
      sinceBreaking++; sinceCoffee++;
      if (!forceKind && mode === 'deadline' && filed >= 4 && !words.some((w) => w.kind !== 'normal')) {
        const r = Math.random();
        if (words.length >= 2 && sinceBreaking >= 10 && r < 0.07) kind = 'breaking';
        else if (sinceCoffee >= 12 && coffeeT <= 0 && r > 0.955) kind = 'coffee';
      }
      if (kind === 'breaking') sinceBreaking = 0;
      if (kind === 'coffee') sinceCoffee = 0;
      const text = forceText || pickWord(kind === 'breaking' ? BREAKING : kind === 'coffee' ? COFFEE : tiers());
      const w = { id: ++uid, text, disp: text.toUpperCase(), kind, typed: 0, p: 0, fx: Math.random(), tw: 0, sw: 0, shake: 0, age: 0 };
      measure(w);
      if (mode === 'sprint') {
        // sprint slips are pinned up anywhere free in the upper half, so a fast typist never waits for copy
        for (let i = 0; i < 40; i++) {
          w.fx = Math.random(); w.p = 0.06 + Math.random() * 0.5;
          const x = slipX(w), y = slipY(w);
          if (!words.some((o) => { const ox = slipX(o), oy = slipY(o); return x < ox + o.sw + 8 && ox < x + w.sw + 8 && y < oy + slipH + 6 && oy < y + slipH + 6; })) break;
        }
      } else {
        // keep away from the slips that came out last
        const near = words.slice(-2).map((o) => slipX(o) + o.sw / 2);
        let bestD = -1, bestF = w.fx;
        for (let i = 0; i < 6; i++) {
          w.fx = Math.random();
          const cx = slipX(w) + w.sw / 2;
          const d = near.length ? Math.min(...near.map((n) => Math.abs(n - cx))) : 1e9;
          if (d > bestD) { bestD = d; bestF = w.fx; }
        }
        w.fx = bestF;
      }
      words.push(w);
      headTarget = slipX(w) + w.sw / 2;
      spawnT = interval();
      return w;
    }
    function remember(t) { recent.push(t); if (recent.length > 60) recent.shift(); }

    // ---------------------------------------------------------------- effects
    function floater(x, y, text, color) { fx.push({ k: 'f', x, y, text, color, t: 0, life: 0.9 }); }
    function burst(w, color) {
      const x = slipX(w), y = slipY(w);
      for (let i = 0; i < 10; i++) fx.push({ k: 'b', x: x + Math.random() * w.sw, y: y + Math.random() * slipH, vx: (Math.random() - 0.5) * 140, vy: -40 - Math.random() * 110, c: color, t: 0, life: 0.5 + Math.random() * 0.3 });
    }
    function setBanner(text, color) { banner = { text, color: color || C.slip, t: 0, life: 1.5 }; }

    // ---------------------------------------------------------------- rules
    function newGame(autostart) {
      words = []; target = null; fx.length = 0; banner = null; result = null;
      score = filed = streak = bestStreak = misses = correct = wrong = 0; level = 1;
      clock = 0; started = false; timeLeft = SPRINT_S; wpmShown = 0; wpmT = 0;
      spawnT = 0.5; coffeeT = 0; sinceBreaking = 0; sinceCoffee = 0; flash = 0; missFlash = 0;
      headX = headTarget = W / 2;
      state = autostart ? 'play' : 'ready';
      labels(); hud(); showCard(); status();
      if (state === 'play') { focusInput(); kick(); } else draw();
    }
    function start() {
      if (state !== 'ready') return;
      state = 'play'; showCard(); focusInput(); hud(); kick();
    }
    function setPaused(v) {
      if (v && state === 'play') { state = 'paused'; if (target) { target.typed = 0; target = null; } }
      else if (!v && state === 'paused') { state = 'play'; focusInput(); }
      else return;
      showCard(); hud(); kick(); draw();
    }
    function unlock() { if (target) { target.typed = 0; target = null; } }
    function miss() {
      wrong++; streak = 0; flash = 1;
      if (target) target.shake = 1;
      const now = performance.now();
      if (now - lastErr > 350) { lastErr = now; snd('error'); }
    }
    function type(ch) {
      if (state !== 'play') return;
      if (!target) {
        if (ch === ' ' || ch === '-') return; // separators never start a word; not counted as a slip of the finger
        let bestW = null;
        for (const w of words) if (w.text[0] === ch && (!bestW || w.p > bestW.p)) bestW = w;
        if (!bestW) return miss();
        target = bestW; target.typed = 0;
      }
      const t = target;
      let exp = t.text[t.typed];
      if (exp === '-' && ch !== '-') {
        if (ch === ' ') exp = ' ';                                    // space stands in for a hyphen
        else if (ch === t.text[t.typed + 1]) { t.typed++; exp = ch; } // or skip the hyphen altogether
      }
      if (ch !== exp) return miss();
      t.typed++; correct++; started = true;
      if (t.typed >= t.text.length) complete(t);
    }
    function complete(w) {
      const i = words.indexOf(w);
      if (i >= 0) words.splice(i, 1);
      target = null;
      const m = mult(), pts = w.text.length * 10 * m;
      score += pts; filed++; streak++; bestStreak = Math.max(bestStreak, streak);
      remember(w.text);
      burst(w, w.kind === 'breaking' ? C.gold : w.kind === 'coffee' ? C.blueLo : C.slip);
      floater(slipX(w) + w.sw / 2, slipY(w) + slipH / 2, '+' + pts, m > 1 ? C.red : C.done);
      if (w.kind === 'breaking') {
        for (const o of words) { score += o.text.length * 10; filed++; burst(o, C.goldHi); floater(slipX(o) + o.sw / 2, slipY(o) + slipH / 2, '+' + o.text.length * 10, C.goldLo); }
        words = []; spawnT = Math.min(spawnT, 0.5);
        setBanner('WIRE CLEARED', C.gold); snd('ding');
      } else if (w.kind === 'coffee') {
        coffeeT = COFFEE_S; setBanner('COFFEE BREAK', C.blue); snd('ding');
      } else snd('click');
      if (mode === 'deadline') {
        const nl = 1 + Math.floor(filed / PER_LEVEL);
        if (nl > level) { level = nl; setBanner('LEVEL ' + level, C.slip); snd('ding'); }
      }
    }
    function land(w, i) {
      words.splice(i, 1);
      if (target === w) target = null;
      streak = 0;
      const cx = slipX(w) + w.sw / 2;
      if (mode === 'deadline') {
        misses++; missFlash = 1; snd('error');
        floater(cx, deadY - slipH, 'MISSED', C.red);
        if (misses >= MAX_MISS) finish();
      } else floater(cx, deadY - slipH, 'SPIKED', C.inkSoft);
    }
    function finish() {
      state = 'over'; target = null;
      const wpm = wpmNow(), acc = accNow();
      const best = lsGet(LS_BEST, {}), fresh = {};
      if (mode === 'deadline') {
        if (score > (best.score || 0)) { best.score = score; fresh.score = true; }
        if (clock >= 20 && wpm > (best.wpm || 0)) { best.wpm = wpm; fresh.wpm = true; }
      } else {
        if (wpm > (best.wpm || 0)) { best.wpm = wpm; fresh.wpm = true; }
        if (filed > (best.sprint || 0)) { best.sprint = filed; fresh.sprint = true; }
      }
      if (fresh.score || fresh.wpm || fresh.sprint) lsSet(LS_BEST, best);
      result = { wpm, acc, fresh, mode };
      wpmShown = wpm;
      snd(mode === 'sprint' || fresh.score ? 'ding' : 'error');
      hud(); showCard(); status();
    }

    function update(dt) {
      const slow = coffeeT > 0 ? 0.4 : 1;
      if (coffeeT > 0) coffeeT = Math.max(0, coffeeT - dt);
      if (started) { clock += dt; wpmT += dt; if (wpmT >= 0.3) { wpmT = 0; wpmShown = wpmNow(); } }
      if (mode === 'sprint' && started) {
        timeLeft -= dt;
        if (timeLeft <= 0) { timeLeft = 0; clock = SPRINT_S; finish(); return; }
      }
      const dp = dt * slow / fallTime();
      tape += dt * slow * 16 * u; web += dt * slow * 22 * u; blink += dt;
      headX += (headTarget - headX) * Math.min(1, dt * 9);
      for (let i = words.length - 1; i >= 0; i--) {
        const w = words[i];
        w.age += dt; w.p += dp;
        if (w.shake > 0) w.shake = Math.max(0, w.shake - dt * 3.5);
        if (w.p >= 1) { land(w, i); if (state !== 'play') return; }
      }
      spawnT -= dt * slow;
      if (!words.length && mode === 'deadline' && spawnT > 0.35) spawnT = 0.35;
      if (spawnT <= 0 && words.length < maxWords()) spawn();
    }
    function frame(now) {
      raf = 0;
      if (disposed) return;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
      if (state === 'play') update(dt);
      for (let i = fx.length - 1; i >= 0; i--) {
        const f = fx[i]; f.t += dt;
        if (f.k === 'b') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 420 * dt; } else f.y -= 34 * dt;
        if (f.t >= f.life) fx.splice(i, 1);
      }
      if (banner) { banner.t += dt; if (banner.t >= banner.life) banner = null; }
      if (flash > 0) flash = Math.max(0, flash - dt * 4);
      if (missFlash > 0) missFlash = Math.max(0, missFlash - dt * 2);
      if (state === 'play' || state === 'over') hud();
      draw();
      if (state === 'play' || fx.length || banner || flash > 0 || missFlash > 0) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf && !disposed) { last = performance.now(); raf = requestAnimationFrame(frame); } }

    // ---------------------------------------------------------------- sizing & static art
    function layout() {
      const w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      W = w; H = h; dpr = Math.min(3, window.devicePixelRatio || 1);
      const dw = Math.round(W * dpr), dh = Math.round(H * dpr);
      if (cv.width !== dw || cv.height !== dh) { cv.width = dw; cv.height = dh; }
      u = W >= 880 && H >= 500 ? 3 : 2;
      fs = clamp(Math.round(Math.min(W / 36, H / 17)), mobile ? 15 : 13, 22);
      railH = 9 * u; pressH = 22 * u; deadY = H - pressH;
      slipH = Math.round(fs * 1.9); padX = Math.round(fs * 0.6);
      font = `700 ${Math.round(fs * dpr)}px ${FONT}`;
      for (const wd of words) measure(wd);
      if (!headX) headX = headTarget = W / 2;
      headTarget = clamp(headTarget, 8 * u, W - 8 * u);
      buildBg(); buildRollers();
      const narrow = root.clientWidth < 430;
      if (root.classList.contains('ty-narrow') !== narrow) { root.classList.toggle('ty-narrow', narrow); labels(); }
    }
    function buildBg() {
      bgCv = bgCv || document.createElement('canvas');
      bgCv.width = cv.width; bgCv.height = cv.height;
      const b = bgCv.getContext('2d');
      const R = (x, y, w, h, c) => { b.fillStyle = c; const x0 = D(x), y0 = D(y); b.fillRect(x0, y0, D(x + w) - x0, D(y + h) - y0); };
      R(0, 0, W, H, C.paper);
      // sprocket strips down both edges of the wire paper
      R(0, 0, 6 * u, H, C.paperDk); R(W - 6 * u, 0, 6 * u, H, C.paperDk);
      R(6 * u, 0, 1, H, C.rule); R(W - 6 * u - 1, 0, 1, H, C.rule);
      // faint columns of "greeked" newsprint so the page reads as a paper without fighting the words
      const r = rng(20261120);
      const x0 = 10 * u, x1 = W - 10 * u, cols = W < 460 ? 3 : W < 900 ? 4 : 6, gut = 5 * u;
      const cw = (x1 - x0 - gut * (cols - 1)) / cols;
      for (let c = 0; c < cols; c++) {
        const cx = x0 + c * (cw + gut);
        if (c > 0) R(cx - gut / 2, railH + 4 * u, 1, deadY - railH - 8 * u, C.rule);
        let y = railH + 5 * u;
        while (y < deadY - 4 * u) {
          const k = r();
          if (k < 0.07) { R(cx, y, cw * (0.5 + 0.4 * r()), 2 * u, C.greekHd); y += 5 * u; }
          else if (k < 0.14) y += 4 * u;
          else { R(cx, y, cw * (0.55 + 0.45 * r()), u, C.greek); y += 3 * u; }
        }
      }
    }
    function buildRollers() {
      const key = u + ':' + dpr;
      if (key === rollerKey) return;
      rollerKey = key; rollers = [];
      const N = 11, S = Math.round(N * u * dpr), p = S / N;
      for (let f = 0; f < 8; f++) {
        const c = document.createElement('canvas'); c.width = c.height = S;
        const x = c.getContext('2d');
        const a = f / 8 * Math.PI * 2, mx = Math.round(5 + Math.cos(a) * 3), my = Math.round(5 + Math.sin(a) * 3);
        const nx = Math.round(5 - Math.cos(a) * 3), ny = Math.round(5 - Math.sin(a) * 3);
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
          const d = Math.hypot(i - 5, j - 5);
          if (d > 5.4) continue;
          let col = d > 4.4 ? C.machLo : (i + j < 8 ? C.steelHi : C.steel);
          if (d < 1.3) col = C.machLo;
          if (i === mx && j === my) col = C.red;
          if (i === nx && j === ny) col = C.web;
          x.fillStyle = col;
          const X0 = Math.round(i * p), Y0 = Math.round(j * p);
          x.fillRect(X0, Y0, Math.round((i + 1) * p) - X0, Math.round((j + 1) * p) - Y0);
        }
        rollers.push(c);
      }
    }

    // ---------------------------------------------------------------- drawing
    const KIND = {
      normal: { body: C.slip, hi: C.slipHi, lo: C.slipLo, ink: C.ink },
      breaking: { body: C.gold, hi: C.goldHi, lo: C.goldLo, ink: '#3a2600' },
      coffee: { body: C.blue, hi: C.blueHi, lo: C.blueLo, ink: '#0f2f5c' },
    };
    function drawSlip(w) {
      const k = KIND[w.kind], locked = w === target;
      const x = slipX(w) + (w.shake > 0 ? Math.sin(w.shake * 34) * 4 * w.shake : 0), y = slipY(w), sw = w.sw;
      g.globalAlpha = (target && !locked ? 0.7 : 1) * (mode === 'sprint' ? Math.min(1, w.age * 7) : 1);
      rect(x + u, y + u, sw + u, slipH, 'rgba(70,52,20,.22)');
      rect(x, y, sw, slipH, k.body);
      rect(x, y, sw, u, k.hi);
      rect(x, y + slipH - u, sw, u, k.lo);
      for (let ty = 0; ty < slipH - u; ty += 2 * u) rect(x + sw, y + ty, u, u, k.body); // torn edge
      const tw0 = tabW(w.kind);
      if (w.kind === 'breaking') {
        rect(x, y, tw0, slipH, C.red); rect(x, y, tw0, u, C.redHi); rect(x, y + slipH - u, tw0, u, C.redDk);
        pix('BREAKING', x + 2 * u, y + Math.round((slipH - 5 * u) / 2), u, '#fff6d8');
      } else if (w.kind === 'coffee') {
        rect(x, y, tw0, slipH, C.blueDk); rect(x, y, tw0, u, '#5e97e0'); rect(x, y + slipH - u, tw0, u, '#1f4f94');
        const cy = y + Math.round((slipH - 8 * u) / 2);
        CUP.forEach((row, r) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') rect(x + 2 * u + i * u, cy + r * u, u, u, row[i] === 's' ? '#bcd8ff' : row[i] === 'd' ? '#9cc3f5' : '#ffffff'); });
      } else rect(x, y, tw0, slipH, C.slipTab);
      const tx = x + tw0 + padX, mid = D(y + slipH / 2) + Math.round(dpr);
      if (state === 'paused') rect(tx, y + slipH / 2 - u, w.tw, 2 * u, k.lo); // copy stays hidden while paused
      else {
        g.font = font; g.textBaseline = 'middle'; g.textAlign = 'left';
        if (locked && w.typed > 0) {
          const done = w.disp.slice(0, w.typed), dw = g.measureText(done).width / dpr;
          rect(tx - 2, y + 2 * u, dw + 3, slipH - 4 * u, C.hilite);
          g.fillStyle = C.done; g.fillText(done, D(tx), mid);
          g.fillStyle = k.ink; g.fillText(w.disp.slice(w.typed), D(tx) + Math.round(dw * dpr), mid);
        } else { g.fillStyle = k.ink; g.fillText(w.disp, D(tx), mid); }
        if (locked && w.typed < w.disp.length) {
          const dw = g.measureText(w.disp.slice(0, w.typed)).width / dpr, cw = g.measureText(w.disp[w.typed] === ' ' ? 'M' : w.disp[w.typed]).width / dpr;
          if (Math.floor(blink * 3) % 2 === 0 || w.disp[w.typed] === ' ') rect(tx + dw, y + slipH - 2 * u - 2, cw, 2, C.lock);
        }
      }
      if (locked) {
        const o = 2, t = 2;
        rect(x - o, y - o, sw + 2 * o, t, C.lock); rect(x - o, y + slipH + o - t, sw + 2 * o, t, C.lock);
        rect(x - o, y - o, t, slipH + 2 * o, C.lock); rect(x + sw + o - t, y - o, t, slipH + 2 * o, C.lock);
      }
      g.globalAlpha = 1;
    }
    function drawPress() {
      const y0 = deadY;
      if (missFlash > 0) rect(0, y0 - 8 * u, W, 8 * u, `rgba(216,52,42,${(0.4 * missFlash).toFixed(3)})`);
      // the deadline
      rect(0, y0, W, 2 * u, missFlash > 0.5 ? C.redHi : C.red); rect(0, y0 + 2 * u, W, u, C.redDk);
      for (let x = 2 * u; x < W; x += 10 * u) rect(x, y0, 4 * u, u, C.redHi);
      // press body
      rect(0, y0 + 3 * u, W, pressH - 3 * u, C.mach); rect(0, y0 + 3 * u, W, u, C.machHi); rect(0, y0 + pressH - 2 * u, W, 2 * u, C.machLo);
      pix('DEADLINE', 5 * u, y0 + 5 * u, u, C.redHi);
      // paper web running through the rollers
      const wy = y0 + 11 * u, per = 24 * u;
      rect(0, wy, W, 7 * u, C.web); rect(0, wy, W, u, '#fffaf0'); rect(0, wy + 6 * u, W, u, C.webLo);
      for (let x = -per + (web % per); x < W; x += per) {
        rect(x + 2 * u, wy + 2 * u, 7 * u, u, C.red); rect(x + 11 * u, wy + 2 * u, 5 * u, u, C.webInk);
        rect(x + 2 * u, wy + 4 * u, 14 * u, u, C.webInk);
      }
      const xa = 46 * u, xb = W - 26 * u, n = Math.max(2, Math.floor((xb - xa) / (38 * u)));
      const fr = rollers[Math.floor(web / (2.5 * u)) % 8];
      if (fr) for (let i = 0; i < n; i++) g.drawImage(fr, D(xa + (xb - xa) * (i + 0.5) / n - 5.5 * u), D(y0 + 9 * u));
      // finished copies stacking up at the delivery end
      const sx = W - 21 * u, layers = 1 + (filed % 5);
      rect(sx - 2 * u, y0 + 7 * u, 18 * u, 13 * u, C.machLo); rect(sx - 2 * u, y0 + 19 * u, 18 * u, u, C.machHi);
      for (let i = 0; i < layers; i++) { const sy = y0 + 17 * u - i * 2 * u; rect(sx, sy, 14 * u, 2 * u, i % 2 ? C.web : '#fffaf0'); rect(sx, sy + u, 14 * u, u, C.webLo); rect(sx + u, sy, 4 * u, u, C.red); }
    }
    function drawRail() {
      rect(0, 0, W, railH, C.mach); rect(0, 0, W, u, C.machHi);
      rect(0, railH - 2 * u, W, u, C.machLo); rect(0, railH - u, W, u, C.slot);
      pix('WIRE', 4 * u, 2 * u, u, C.brass);
      for (let x = 28 * u; x < W - 12 * u; x += 16 * u) rect(x, 3 * u, u, u, C.machHi);
      const lamp = state === 'over' ? C.red : state !== 'play' ? '#f2b33a' : coffeeT > 0 ? '#6fb1ff' : (Math.floor(blink * 2) % 2 ? '#3f8f4a' : '#7be08a');
      rect(W - 8 * u, 2 * u, 4 * u, 4 * u, C.machLo); rect(W - 7 * u, 3 * u, 2 * u, 2 * u, lamp);
      // the print head rides the rail to wherever the next slip comes out
      const hx = clamp(headX, 8 * u, W - 8 * u) - 6 * u;
      rect(hx, u, 12 * u, 6 * u, C.brass); rect(hx, u, 12 * u, u, C.brassHi); rect(hx, 6 * u, 12 * u, u, C.brassLo);
      rect(hx + 2 * u, 3 * u, 3 * u, 2 * u, C.red); rect(hx + 7 * u, 3 * u, 3 * u, 2 * u, C.ink);
      rect(hx + 5 * u, 7 * u, 2 * u, 2 * u, C.brassLo);
    }
    function draw() {
      if (!W || !H || !bgCv || disposed) return;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      g.drawImage(bgCv, 0, 0);
      if (coffeeT > 0) rect(0, 0, W, deadY, 'rgba(70,140,235,.10)');
      const hs = 7 * u;
      for (let y = -hs + (tape % hs); y < deadY; y += hs) { rect(2 * u, y, 2 * u, 2 * u, C.hole); rect(W - 4 * u, y, 2 * u, 2 * u, C.hole); }
      drawPress();
      for (const w of words) if (w !== target) drawSlip(w);
      if (target) drawSlip(target);
      drawRail();
      if (coffeeT > 0) {
        rect(0, railH, W * coffeeT / COFFEE_S, 2 * u, C.blueDk);
        const label = 'COFFEE ' + Math.ceil(coffeeT);
        pix(label, W - (pixCells(label) + 8) * u, railH + 4 * u, u, C.blueDk);
      }
      // effects
      g.font = font; g.textBaseline = 'middle'; g.textAlign = 'center';
      for (const f of fx) {
        const a = 1 - f.t / f.life;
        if (f.k === 'b') { g.globalAlpha = a; rect(f.x, f.y, 2 * u, 2 * u, f.c); rect(f.x, f.y + u, 2 * u, u, 'rgba(0,0,0,.18)'); }
        else {
          g.globalAlpha = Math.min(1, a * 1.6);
          g.lineWidth = Math.max(2, 3 * dpr); g.strokeStyle = C.slip; g.lineJoin = 'round';
          g.strokeText(f.text, D(clamp(f.x, 30, W - 30)), D(f.y)); g.fillStyle = f.color; g.fillText(f.text, D(clamp(f.x, 30, W - 30)), D(f.y));
        }
      }
      g.globalAlpha = 1; g.textAlign = 'left';
      if (banner) {
        const cells = pixCells(banner.text), c = clamp(Math.floor((W - 24) / cells), u, 3 * u);
        const a = Math.min(1, banner.t * 6, (banner.life - banner.t) * 3), by = Math.round(railH + (deadY - railH) * 0.28);
        g.globalAlpha = Math.max(0, a) * 0.86; rect(0, by - 3 * c, W, 11 * c, C.ink);
        g.globalAlpha = Math.max(0, a); rect(0, by - 3 * c, W, Math.max(1, c / 2), C.red); rect(0, by + 8 * c - Math.max(1, c / 2), W, Math.max(1, c / 2), C.red);
        pix(banner.text, Math.round((W - cells * c) / 2), by, c, banner.color);
        g.globalAlpha = 1;
      }
      if (flash > 0) {
        const t = 3 * u, col = `rgba(216,52,42,${(0.75 * flash).toFixed(3)})`;
        rect(0, 0, W, t, col); rect(0, H - t, W, t, col); rect(0, t, t, H - 2 * t, col); rect(W - t, t, t, H - 2 * t, col);
      }
    }

    // ---------------------------------------------------------------- HUD & status
    function setV(k, s) { if (hc[k] !== s) { hc[k] = s; hv[k].textContent = s; } }
    function labels() {
      const narrow = root.classList.contains('ty-narrow'), sprint = mode === 'sprint';
      hk.acc.textContent = narrow ? 'Acc.' : 'Accuracy';
      hk.lvl.textContent = sprint ? 'Time' : 'Level';
      hk.lives.textContent = sprint ? 'Filed' : 'Misses';
      lifeBox.hidden = sprint; hv.words.hidden = !sprint;
    }
    function hud() {
      setV('score', String(score));
      setV('wpm', String(wpmShown));
      setV('acc', accNow() + '%');
      setV('lvl', mode === 'sprint' ? Math.ceil(timeLeft) + 's' : String(level));
      setV('streak', streak + (mult() > 1 ? ' ×' + mult() : ''));
      if (mode === 'sprint') setV('words', String(filed));
      else if (hc.miss !== misses) { hc.miss = misses; lifeEls.forEach((el, i) => el.classList.toggle('lost', i < misses)); lifeBox.setAttribute('aria-label', `${misses} of ${MAX_MISS} misses`); }
      const p = state === 'paused';
      if (hc.paused !== p) { hc.paused = p; pauseBtn.classList.toggle('on', p); pauseBtn.setAttribute('aria-label', p ? 'Resume' : 'Pause'); }
    }
    function status() {
      const b = lsGet(LS_BEST, {});
      ctx.setStatus && ctx.setStatus(`${mode === 'sprint' ? '60-second sprint' : 'Deadline mode'} · Best ${b.score || 0} pts · ${b.wpm || 0} WPM`);
    }

    // ---------------------------------------------------------------- cards & dialogs
    function dialog(kind, title, html, buttons) {
      card = kind;
      modal.innerHTML = `<div class="ty-dlg" role="dialog" aria-label="${title}"><div class="ty-dlg-t">${title}</div><div class="ty-dlg-b xp-scroll">${html}</div><div class="ty-dlg-f"></div></div>`;
      const f = modal.querySelector('.ty-dlg-f');
      buttons.forEach(([label, fn], k) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'xp-btn ty-btn' + (k === 0 ? ' default' : ''); b.textContent = label;
        b.addEventListener('click', () => { snd('click'); fn(); });
        f.appendChild(b);
      });
      modal.hidden = false;
    }
    function closeModal() { modal.hidden = true; modal.innerHTML = ''; card = null; }
    const modeName = () => (mode === 'sprint' ? '60-second sprint' : 'Deadline mode');
    function showCard() {
      if (state === 'play') return closeModal();
      const b = lsGet(LS_BEST, {});
      if (state === 'ready') {
        dialog('ready', 'Headline Rush', `
          <div class="ty-front"><div class="ty-front-h">Headline Rush</div><div class="ty-front-s">${modeName()}</div></div>
          <p>Copy is coming down the wire. Type a slip's first letter to lock on, then finish the word to file it before it reaches the red deadline line.</p>
          <p class="ty-dim">${mode === 'sprint' ? 'File as many slips as you can in one minute. The clock starts on your first key.' : 'Three slips past the deadline and the edition is missed.'}</p>
          <p class="ty-dim">Best so far: <b>${b.score || 0}</b> pts · <b>${b.wpm || 0}</b> WPM${b.sprint ? ` · <b>${b.sprint}</b> slips in a sprint` : ''}</p>`,
        [[mobile ? 'Start' : 'Start (Enter)', start], ['How to play', () => action('howto')]]);
      } else if (state === 'paused') {
        dialog('paused', 'Paused', `
          <div class="ty-front"><div class="ty-front-h">Hold the presses</div><div class="ty-front-s">${modeName()} · paused</div></div>
          <p>The wire is on hold and the copy is covered up until you are back.</p>
          <p class="ty-dim">${mobile ? 'Tap Resume to carry on.' : 'Press Esc or Enter to carry on, F2 for a new edition.'}</p>`,
        [['Resume', () => setPaused(false)], ['New edition', () => newGame(true)]]);
      } else {
        const r = result || { wpm: 0, acc: 100, fresh: {} }, sprint = mode === 'sprint';
        const nb = (on) => (on ? ' <span class="ty-new">new best</span>' : '');
        dialog('over', sprint ? 'Sprint filed' : 'Edition missed', `
          <div class="ty-front"><div class="ty-front-h">${sprint ? 'Sprint filed' : 'Edition missed'}</div>
            <div class="ty-front-s">${sprint ? 'Sixty seconds on the wire' : 'Three slips got past the deadline'}</div>
            <div class="ty-big"><b>${sprint ? r.wpm : score}</b><span>${sprint ? 'words per minute' : 'points'}</span></div></div>
          <table class="ty-tbl">
            ${sprint ? `<tr><td>Slips filed</td><td>${filed}${nb(r.fresh.sprint)}</td></tr>` : `<tr><td>Speed</td><td>${r.wpm} WPM${nb(r.fresh.wpm)}</td></tr>`}
            <tr><td>Accuracy</td><td>${r.acc}%</td></tr>
            ${sprint ? `<tr><td>Score</td><td>${score}</td></tr>` : `<tr><td>Slips filed</td><td>${filed}</td></tr><tr><td>Level reached</td><td>${level}</td></tr>`}
            <tr><td>Longest streak</td><td>${bestStreak}</td></tr>
            <tr><td>Best ${sprint ? 'speed' : 'score'}</td><td>${sprint ? (b.wpm || 0) + ' WPM' : (b.score || 0) + ' pts'}${nb(sprint ? r.fresh.wpm : r.fresh.score)}</td></tr>
          </table>`,
        [[mobile ? 'Play again' : 'Play again (Enter)', () => newGame(true)], ['Best scores', () => action('best')]]);
      }
    }
    function info(title, html, extra) {
      if (state === 'play') setPaused(true);
      dialog('info', title, html, [['OK', showCard]].concat(extra || []));
    }
    function showBest() {
      const b = lsGet(LS_BEST, {});
      info('Best scores', `<table class="ty-tbl">
        <tr><td>Best score (deadline mode)</td><td>${b.score ? b.score + ' pts' : '—'}</td></tr>
        <tr><td>Best speed</td><td>${b.wpm ? b.wpm + ' WPM' : '—'}</td></tr>
        <tr><td>Most slips in a sprint</td><td>${b.sprint || '—'}</td></tr></table>`,
      [['Reset', () => { lsSet(LS_BEST, {}); status(); showBest(); }]]);
    }
    function setMode(m) {
      mode = m; lsSet(LS_PREF, { mode });
      newGame(false);
    }
    function action(a) {
      if (a === 'new') newGame(true);
      else if (a === 'pause') { if (state === 'play') setPaused(true); else if (state === 'paused') setPaused(false); else if (state === 'ready') start(); }
      else if (a === 'deadline' || a === 'sprint') setMode(a);
      else if (a === 'best') showBest();
      else if (a === 'exit') ctx.close && ctx.close();
      else if (a === 'howto') info('How to play', `
        <p>You are on the news desk and copy is coming down the wire. File every slip before it reaches the red <b>deadline</b> line.</p>
        <ul>
          <li>Type the <b>first letter</b> of any slip to lock on to it, then type the rest. Capitals do not matter.</li>
          <li><b>Backspace</b> or <b>Esc</b> lets go of a slip. A wrong key breaks your streak but keeps the lock.</li>
          <li>Spaces need typing. Hyphens are optional.</li>
          <li>Every 5 clean slips in a row raises the score multiplier, up to ×6.</li>
          <li>A gold <b>BREAKING</b> slip clears the whole wire. A blue <b>coffee</b> slip slows everything for 8 seconds.</li>
          <li><b>Deadline mode:</b> three slips past the line and the edition is missed. Each level is faster, longer and busier.</li>
          <li><b>60-second sprint</b> (Game menu): file as many slips as you can in a minute, then get your words per minute and accuracy.</li>
          <li><b>Esc</b> pauses when no slip is locked, <b>F2</b> starts a new edition.${mobile ? ' On a phone, tap the wire to bring the keyboard back.' : ''}</li>
        </ul>`);
      else if (a === 'about') info('About Headline Rush', `<p><b>Headline Rush</b> for Kayzee XP.</p><p>A newsroom typing game. The art, the word list and the code are all original.</p>`);
    }

    // ---------------------------------------------------------------- menus
    let openMenu = null;
    function setMenu(m) {
      if (m && state === 'play') setPaused(true);
      openMenu = m;
      root.querySelectorAll('.ty-menu').forEach((el) => { el.classList.toggle('open', el === m); el.firstElementChild.classList.toggle('open', el === m); });
      if (m) {
        root.querySelectorAll('.ty-drop .radio').forEach((b) => b.classList.toggle('on', b.dataset.a === mode));
        const pb = root.querySelector('[data-a="pause"]');
        pb.firstElementChild.textContent = state === 'paused' ? 'Resume' : state === 'ready' ? 'Start' : 'Pause';
        pb.disabled = state === 'over';
      }
    }
    menubar.addEventListener('pointerdown', (e) => {
      const t = e.target.closest('.ty-mtitle');
      if (t) { e.preventDefault(); const m = t.parentElement; setMenu(openMenu === m ? null : m); }
    });
    menubar.addEventListener('pointerover', (e) => {
      const t = e.target.closest('.ty-mtitle');
      if (t && openMenu && openMenu !== t.parentElement) setMenu(t.parentElement);
    });
    menubar.addEventListener('click', (e) => {
      const b = e.target.closest('.ty-drop button');
      if (!b || b.disabled) return;
      setMenu(null); action(b.dataset.a);
    });
    // menus and the HUD never take keyboard focus, so Space/Enter cannot re-press a button mid-game
    const noFocus = (e) => { if (e.target.closest('button')) e.preventDefault(); };
    menubar.addEventListener('mousedown', noFocus);
    hudEl.addEventListener('mousedown', noFocus);
    pauseBtn.addEventListener('click', () => { snd('click'); action('pause'); });
    const outside = (e) => {
      if (openMenu && !openMenu.contains(e.target)) setMenu(null);
      if (!root.contains(e.target) && state === 'play') setPaused(true); // a click elsewhere holds the wire
    };
    document.addEventListener('pointerdown', outside, true);

    // ---------------------------------------------------------------- keyboard
    function feedChars(str) {
      for (const raw of String(str || '')) {
        const ch = raw.toLowerCase();
        if ((ch >= 'a' && ch <= 'z') || ch === ' ' || ch === '-') type(ch);
      }
    }
    const onKey = (e) => {
      if (!focused || disposed) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return; // browser and system shortcuts are not ours
      const t = e.target;
      // keys aimed at something focused outside this window (taskbar, menus, another app) are not ours
      if (t && t.nodeType === 1 && t !== document.body && t !== document.documentElement && !host.contains(t)) return;
      if (t && t !== inp && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const k = e.key;
      if (k === 'F2') { e.preventDefault(); newGame(true); return; }
      if (e.isComposing || e.keyCode === 229) return; // soft keyboards: the characters arrive through the input events
      if (openMenu) { if (k === 'Escape') { e.preventDefault(); setMenu(null); } return; }
      if (!modal.hidden) {
        if (k === 'Escape') { e.preventDefault(); if (card === 'paused') setPaused(false); else if (card === 'info') showCard(); }
        else if (k === 'Enter' || (k === ' ' && card === 'ready')) {
          if (t && t.closest && t.closest('.ty-dlg-f')) return; // a focused dialog button handles its own Enter
          e.preventDefault();
          if (!e.repeat) { const b = modal.querySelector('.ty-btn.default'); if (b) b.click(); }
        }
        return;
      }
      if (state !== 'play') return;
      if (k === 'Escape') { e.preventDefault(); if (target) unlock(); else setPaused(true); return; }
      if (k === 'Backspace') { e.preventDefault(); unlock(); return; }
      if (k.length === 1) {
        const ch = k.toLowerCase();
        if ((ch >= 'a' && ch <= 'z') || ch === ' ' || ch === '-') { e.preventDefault(); if (!e.repeat) type(ch); }
      }
    };
    const host = root.closest('.kz-win') || root.parentElement || root;
    window.addEventListener('keydown', onKey);
    root.addEventListener('pointerdown', () => { focused = true; });

    // phones: a hidden text field keeps the on-screen keyboard up and hands us its characters
    function focusInput() {
      const a = document.activeElement;
      if (a && a !== inp && root.contains(a) && a.blur) a.blur();
      if (!mobile) return;
      clearTimeout(blurTimer);
      try { inp.focus({ preventScroll: true }); } catch { /* ignore */ }
      fitViewport();
    }
    inp.addEventListener('beforeinput', (e) => {
      const it = e.inputType || '';
      if (e.isComposing || it === 'insertCompositionText') return; // handled in 'input'
      if (it === 'insertText' || it === 'insertReplacementText') { e.preventDefault(); feedChars(e.data); }
      else if (it.startsWith('delete')) { e.preventDefault(); if (state === 'play') unlock(); }
      else if (it === 'insertLineBreak' || it === 'insertParagraph') e.preventDefault();
    });
    inp.addEventListener('input', (e) => {
      if (e.isComposing || e.inputType === 'insertCompositionText') {
        const d = e.data || '';
        if (d.length > comp.length && d.startsWith(comp)) feedChars(d.slice(comp.length));
        else if (d.length < comp.length && state === 'play') unlock();
        comp = d;
        return;
      }
      const v = inp.value; inp.value = ''; comp = '';
      if (justComposed) return; // the commit of text we already read letter by letter
      if (v) feedChars(v);
    });
    inp.addEventListener('compositionend', () => { comp = ''; justComposed = true; setTimeout(() => { justComposed = false; if (!disposed) inp.value = ''; }, 0); });
    inp.addEventListener('blur', () => {
      if (!mobile) return;
      clearTimeout(blurTimer);
      blurTimer = setTimeout(() => { if (!disposed && state === 'play' && document.activeElement !== inp) setPaused(true); }, 150);
    });
    if (mobile) {
      // a tap on the wire keeps (or brings back) the keyboard instead of dismissing it
      stage.addEventListener('mousedown', (e) => { if (state === 'play' && !e.target.closest('.ty-modal')) e.preventDefault(); });
      stage.addEventListener('pointerup', (e) => { if (state === 'play' && !e.target.closest('.ty-modal')) focusInput(); });
    }
    // keep the play area above the on-screen keyboard
    const vv = window.visualViewport || null;
    function fitViewport() {
      if (!mobile || !vv || disposed) return;
      const r = root.getBoundingClientRect();
      const sc = root.offsetHeight ? r.height / root.offsetHeight || 1 : 1;
      let cut = Math.max(0, r.bottom - (vv.offsetTop + vv.height)) / sc;
      let top = Math.max(0, vv.offsetTop - r.top) / sc;
      if (cut < 24) cut = 0;
      const room = Math.max(0, root.offsetHeight - 200);
      cut = Math.min(cut, room); top = Math.min(top, Math.max(0, room - cut));
      wrap.style.paddingBottom = cut ? Math.round(cut) + 'px' : '';
      wrap.style.paddingTop = top ? Math.round(top) + 'px' : '';
    }
    if (mobile && vv) { vv.addEventListener('resize', fitViewport); vv.addEventListener('scroll', fitViewport); }

    const onVis = () => { if (document.hidden && state === 'play') setPaused(true); };
    document.addEventListener('visibilitychange', onVis);

    const ro = new ResizeObserver(() => { layout(); draw(); });
    ro.observe(stage);
    layout();
    newGame(false);
    fitViewport();

    // test hook (harmless in production): lets the CDP harness read the wire and stage special slips
    Object.defineProperty(root, '_kzTyper', { configurable: true, value: {
      get state() { return state; }, get mode() { return mode; }, get card() { return card; },
      get words() { return words.map((w) => ({ text: w.text, kind: w.kind, typed: w.typed, p: w.p, locked: w === target, x: slipX(w), y: slipY(w), w: w.sw })); },
      get target() { return target ? target.text : null; },
      get stats() { return { score, filed, streak, misses, level, correct, wrong, clock, timeLeft, coffeeT, wpm: wpmNow(), acc: accNow(), mult: mult() }; },
      get view() { return { W, H, u, fs, slipH, deadY, railH, raf: !!raf }; },
      spawn: (kind, text) => spawn(kind, text),
      wordList: { groups: WORDS, breaking: BREAKING, coffee: COFFEE },
      clear: () => { words = []; target = null; },
      setLevel: (n) => { level = n; filed = (n - 1) * PER_LEVEL; },
      setTimeLeft: (s) => { timeLeft = s; },
    } });

    return {
      onResize() { layout(); fitViewport(); draw(); },
      onFocus() { focused = true; },
      onBlur() { focused = false; setMenu(null); if (state === 'play') setPaused(true); },
      unmount() {
        disposed = true;
        cancelAnimationFrame(raf); raf = 0;
        clearTimeout(blurTimer);
        ro.disconnect();
        window.removeEventListener('keydown', onKey);
        document.removeEventListener('pointerdown', outside, true);
        document.removeEventListener('visibilitychange', onVis);
        if (vv) { vv.removeEventListener('resize', fitViewport); vv.removeEventListener('scroll', fitViewport); }
        delete root._kzTyper;
        root.classList.remove('ty-narrow');
        root.innerHTML = '';
      },
    };
  },
};
