// Reversi: the classic public-domain 8x8 disc-flipping game, in the Voxel Luna style.
// You play the dark pieces, the computer plays the light ones. A felt-green board in a
// wooden frame, chunky pixel discs that flip over, and three computer levels.
// All art is drawn procedurally here (no external assets).

// ------------------------------------------------------------------ rules + search engine
// makeEngine() is completely self-contained (no outer references) because the same source
// text is also handed to a Blob Worker, so the Hard level can think without freezing the UI.
// Squares are 0..63 (row * 8 + column, a1 = top left). Pieces: 1 = dark, -1 = light, 0 = empty.
export function makeEngine() {
  const STEP = [-9, -8, -7, -1, 1, 7, 8, 9];
  const DX = [-1, 0, 1, -1, 1, -1, 0, 1];
  const DY = [-1, -1, -1, 0, 0, 1, 1, 1];
  const RLEN = new Int8Array(64 * 8); // squares available from sq in each direction
  for (let sq = 0; sq < 64; sq++) {
    for (let d = 0; d < 8; d++) {
      let x = (sq & 7) + DX[d], y = (sq >> 3) + DY[d], n = 0;
      while (x >= 0 && x < 8 && y >= 0 && y < 8) { n++; x += DX[d]; y += DY[d]; }
      RLEN[sq * 8 + d] = n;
    }
  }
  const now = typeof performance !== 'undefined' && performance.now ? () => performance.now() : () => Date.now();

  // ---------------------------------------------------------------- pure rules (plain arrays in, new arrays out)
  function startPosition() {
    const c = new Array(64).fill(0);
    c[27] = -1; c[28] = 1; c[35] = 1; c[36] = -1;
    return c;
  }
  // every disc that placing `p` on `sq` would turn over ([] = not a legal move)
  function flipsFor(cells, sq, p) {
    const out = [];
    if (sq < 0 || sq > 63 || cells[sq] !== 0) return out;
    for (let d = 0; d < 8; d++) {
      const len = RLEN[sq * 8 + d], st = STEP[d];
      let k = 1, s = sq + st;
      while (k <= len && cells[s] === -p) { s += st; k++; }
      if (k > 1 && k <= len && cells[s] === p) for (let t = sq + st; t !== s; t += st) out.push(t);
    }
    return out;
  }
  function legalMoves(cells, p) {
    const m = [];
    for (let sq = 0; sq < 64; sq++) if (cells[sq] === 0 && flipsFor(cells, sq, p).length) m.push(sq);
    return m;
  }
  function play(cells, sq, p) {
    const flips = flipsFor(cells, sq, p);
    if (!flips.length) return null;
    const next = cells.slice();
    next[sq] = p;
    for (let i = 0; i < flips.length; i++) next[flips[i]] = p;
    return { cells: next, flips };
  }
  function count(cells) {
    let dark = 0, light = 0;
    for (let i = 0; i < 64; i++) { if (cells[i] === 1) dark++; else if (cells[i] === -1) light++; }
    return { dark, light, empty: 64 - dark - light };
  }
  // who moves next after `p` has just moved: -p, or p again if -p must pass, or 0 if the game is over
  function nextTurn(cells, p) {
    if (legalMoves(cells, -p).length) return -p;
    if (legalMoves(cells, p).length) return p;
    return 0;
  }

  // ---------------------------------------------------------------- search state (make / unmake on one board)
  const b = new Int8Array(64);
  const nxt = new Int8Array(65), prv = new Int8Array(65); // linked list of empty squares, 64 = sentinel
  const stack = new Int8Array(2048); let sp = 0;           // flipped squares, for unmake
  let diff = 0, nEmpty = 0, hLo = 0, hHi = 0, ply = 0;     // diff = dark - light
  let nodes = 0, deadline = Infinity;
  const ABORT = { abort: true };
  const MV = new Int8Array(64 * 40), MS = new Int32Array(64 * 40); // per-ply move lists

  // positional table (own values, mirrored from one quadrant); also gives the static move order
  const Q = [100, -18, 14, 6, -18, -36, -4, -3, 14, -4, 8, 2, 6, -3, 2, 1];
  const PW = new Int16Array(64);
  for (let sq = 0; sq < 64; sq++) {
    const x = sq & 7, y = sq >> 3;
    PW[sq] = Q[(y < 4 ? y : 7 - y) * 4 + (x < 4 ? x : 7 - x)];
  }
  const ORDER = Array.from({ length: 64 }, (_, i) => i).sort((p, q) => PW[q] - PW[p] || p - q);
  // corner, its diagonal neighbour, its two edge neighbours, and the two edge directions
  const CORNER = [
    [0, 9, 1, 8, 1, 8], [7, 14, 6, 15, -1, 8], [56, 49, 57, 48, 1, -8], [63, 54, 62, 55, -1, -8],
  ];

  // zobrist keys (two 32-bit halves), deterministic
  const ZLo = new Int32Array(128), ZHi = new Int32Array(128);
  (function () {
    let s = 0x9e3779b9 | 0;
    const r = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return s | 0; };
    for (let i = 0; i < 128; i++) { ZLo[i] = r(); ZHi[i] = r(); }
  })();
  const SIDE_LO = 0x5bd1e995 | 0, SIDE_HI = 0x27d4eb2f | 0;
  const TT_BITS = 17, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
  const ttLo = new Int32Array(TT_SIZE), ttHi = new Int32Array(TT_SIZE), ttV = new Int16Array(TT_SIZE);
  const ttD = new Int8Array(TT_SIZE), ttF = new Int8Array(TT_SIZE), ttM = new Int8Array(TT_SIZE);

  function load(cells) {
    sp = 0; diff = 0; nEmpty = 0; hLo = 0; hHi = 0; ply = 0;
    let last = 64;
    for (let i = 0; i < 64; i++) {
      const v = cells[i]; b[i] = v;
      if (v) { diff += v; const z = i * 2 + (v === 1 ? 0 : 1); hLo ^= ZLo[z]; hHi ^= ZHi[z]; }
    }
    for (let k = 0; k < 64; k++) {
      const sq = ORDER[k];
      if (b[sq] === 0) { nxt[last] = sq; prv[sq] = last; last = sq; nEmpty++; }
    }
    nxt[last] = 64; prv[64] = last;
  }
  function countFlips(sq, p) {
    let n = 0;
    const base = sq * 8, o = -p;
    for (let d = 0; d < 8; d++) {
      const len = RLEN[base + d];
      if (len < 2) continue;
      const st = STEP[d];
      let s = sq + st;
      if (b[s] !== o) continue;
      let k = 2; s += st;
      while (k <= len && b[s] === o) { s += st; k++; }
      if (k <= len && b[s] === p) n += k - 1;
    }
    return n;
  }
  // place p on the empty square sq; returns the number of discs flipped (0 = illegal, nothing changed)
  function make(sq, p) {
    const base = sq * 8, o = -p, sp0 = sp;
    for (let d = 0; d < 8; d++) {
      const len = RLEN[base + d];
      if (len < 2) continue;
      const st = STEP[d];
      let s = sq + st;
      if (b[s] !== o) continue;
      let k = 2; s += st;
      while (k <= len && b[s] === o) { s += st; k++; }
      if (k <= len && b[s] === p) {
        for (s -= st; s !== sq; s -= st) {
          b[s] = p; stack[sp++] = s;
          hLo ^= ZLo[s * 2] ^ ZLo[s * 2 + 1]; hHi ^= ZHi[s * 2] ^ ZHi[s * 2 + 1];
        }
      }
    }
    const n = sp - sp0;
    if (n === 0) return 0;
    b[sq] = p;
    const z = sq * 2 + (p === 1 ? 0 : 1); hLo ^= ZLo[z]; hHi ^= ZHi[z];
    diff += p * (2 * n + 1); nEmpty--;
    const a = prv[sq], c = nxt[sq]; nxt[a] = c; prv[c] = a;
    return n;
  }
  function unmake(sq, p, n) {
    const o = -p;
    for (let i = 0; i < n; i++) {
      const s = stack[--sp]; b[s] = o;
      hLo ^= ZLo[s * 2] ^ ZLo[s * 2 + 1]; hHi ^= ZHi[s * 2] ^ ZHi[s * 2 + 1];
    }
    b[sq] = 0;
    const z = sq * 2 + (p === 1 ? 0 : 1); hLo ^= ZLo[z]; hHi ^= ZHi[z];
    diff -= p * (2 * n + 1); nEmpty++;
    nxt[prv[sq]] = sq; prv[nxt[sq]] = sq;
  }
  function mobility(p) {
    let n = 0;
    for (let sq = nxt[64]; sq !== 64; sq = nxt[sq]) if (countFlips(sq, p) > 0) n++;
    return n;
  }
  // leaf counter for the rules self-test (a pass counts as one ply, a finished game as one leaf)
  function perftRec(p, depth, passed) {
    if (depth === 0) return 1;
    let total = 0, any = false;
    for (let sq = nxt[64]; sq !== 64; sq = nxt[sq]) {
      const n = make(sq, p);
      if (!n) continue;
      any = true;
      total += perftRec(-p, depth - 1, false);
      unmake(sq, p, n);
    }
    if (any) return total;
    return passed ? 1 : perftRec(-p, depth - 1, true);
  }
  function perft(cells, p, depth) { load(cells); return perftRec(p, depth, false); }

  // ---------------------------------------------------------------- evaluation (always from the mover's side)
  const WIN = 20000;
  function terminal(p) {
    const d = diff * p;
    return d > 0 ? WIN + d * 100 : d < 0 ? -WIN + d * 100 : 0;
  }
  // Medium: positional weights + mobility
  function evalMedium(p) {
    let s = 0;
    for (let sq = 0; sq < 64; sq++) if (b[sq]) s += b[sq] * PW[sq];
    // squares next to a corner stop being a liability once that corner is taken
    for (let c = 0; c < 4; c++) {
      const C = CORNER[c];
      if (b[C[0]] !== 0) s += b[C[1]] * 40 + b[C[2]] * 22 + b[C[3]] * 22;
    }
    s *= p;
    s += (mobility(p) - mobility(-p)) * 7;
    if (nEmpty < 14) s += diff * p * (14 - nEmpty);
    return s;
  }
  // Hard: corners, edge anchors, mobility, frontier, parity, late disc count
  function evalHard(p) {
    let corner = 0, stable = 0, near = 0;
    for (let c = 0; c < 4; c++) {
      const C = CORNER[c], v = b[C[0]];
      if (v === 0) {
        near -= b[C[1]] * 46 + (b[C[2]] + b[C[3]]) * 15;
      } else {
        corner += v;
        for (let e = 4; e < 6; e++) { // discs on an edge chained to an owned corner can never flip
          let s = C[0] + C[e], k = 1;
          while (k < 7 && b[s] === v) { stable += v; s += C[e]; k++; }
        }
      }
    }
    let myF = 0, opF = 0, edge = 0;
    for (let sq = 0; sq < 64; sq++) {
      const v = b[sq];
      if (v === 0) continue;
      const base = sq * 8;
      let fr = 0;
      for (let d = 0; d < 8; d++) if (RLEN[base + d] > 0 && b[sq + STEP[d]] === 0) { fr = 1; break; }
      if (fr) { if (v === p) myF++; else opF++; }
      const x = sq & 7, y = sq >> 3;
      if ((x === 0 || x === 7 || y === 0 || y === 7) && PW[sq] > 0 && PW[sq] < 100) edge += v;
    }
    const myM = mobility(p), opM = mobility(-p);
    let s = (corner * 115 + stable * 16 + near + edge * 4) * p;
    s += ((myM - opM) * 96 / (myM + opM + 2)) | 0;
    if (opM === 0 && myM > 0) s += 70; else if (myM === 0 && opM > 0) s -= 70;
    s += ((opF - myF) * 60 / (myF + opF + 2)) | 0;
    if (nEmpty < 26) s += (nEmpty & 1) ? 9 : -9; // parity: who is on course for the last move
    const d = diff * p;
    if (nEmpty > 40) s -= d * 2; else if (nEmpty < 20) s += d * (2 + ((20 - nEmpty) >> 1));
    return s;
  }
  let evalFn = evalHard, ttEval = null;
  function useEval(fn) { // table entries are only meaningful for the evaluation that produced them
    evalFn = fn;
    if (ttEval !== fn) { ttEval = fn; ttLo.fill(0); ttHi.fill(0); ttD.fill(-1); }
  }

  // ---------------------------------------------------------------- midgame alpha-beta (principal variation search)
  function search(p, depth, alpha, beta, passed) {
    if ((++nodes & 255) === 0 && now() > deadline) throw ABORT;
    if (nEmpty === 0) return terminal(p);
    if (depth <= 0) return evalFn(p);
    const k1 = p === 1 ? hLo : hLo ^ SIDE_LO, k2 = p === 1 ? hHi : hHi ^ SIDE_HI;
    const ti = k1 & TT_MASK;
    let ttMove = -1;
    if (ttLo[ti] === k1 && ttHi[ti] === k2) {
      ttMove = ttM[ti];
      if (ttD[ti] >= depth) {
        const v = ttV[ti], f = ttF[ti];
        if (f === 0 || (f === 1 && v >= beta) || (f === 2 && v <= alpha)) return v;
      }
    }
    const base = ply * 40;
    let n = 0;
    if (depth >= 3) {
      for (let sq = nxt[64]; sq !== 64; sq = nxt[sq]) {
        const f = make(sq, p);
        if (!f) continue;
        const sc = sq === ttMove ? 1e6 : PW[sq] - mobility(-p) * 24; // fewest replies first
        unmake(sq, p, f);
        let i = n++;
        while (i > 0 && MS[base + i - 1] < sc) { MS[base + i] = MS[base + i - 1]; MV[base + i] = MV[base + i - 1]; i--; }
        MS[base + i] = sc; MV[base + i] = sq;
      }
    } else {
      for (let sq = nxt[64]; sq !== 64; sq = nxt[sq]) {
        if (countFlips(sq, p) === 0) continue;
        if (sq === ttMove && n > 0) { MV[base + n] = MV[base]; MV[base] = sq; } else MV[base + n] = sq;
        n++;
      }
    }
    if (n === 0) {
      if (passed) return terminal(p);
      ply++;
      const v = -search(-p, depth, -beta, -alpha, true);
      ply--;
      return v;
    }
    const a0 = alpha;
    let best = -32000, bestMove = MV[base];
    for (let i = 0; i < n; i++) {
      const sq = MV[base + i];
      const f = make(sq, p);
      ply++;
      let v;
      if (i === 0) v = -search(-p, depth - 1, -beta, -alpha, false);
      else {
        v = -search(-p, depth - 1, -alpha - 1, -alpha, false);
        if (v > alpha && v < beta) v = -search(-p, depth - 1, -beta, -alpha, false);
      }
      ply--;
      unmake(sq, p, f);
      if (v > best) {
        best = v; bestMove = sq;
        if (v > alpha) { alpha = v; if (alpha >= beta) break; }
      }
    }
    ttLo[ti] = k1; ttHi[ti] = k2; ttV[ti] = best; ttD[ti] = depth; ttM[ti] = bestMove;
    ttF[ti] = best <= a0 ? 2 : best >= beta ? 1 : 0;
    return best;
  }

  // ---------------------------------------------------------------- endgame: exact disc-difference solver
  function solve(p, alpha, beta, passed) {
    if ((++nodes & 255) === 0 && now() > deadline) throw ABORT;
    if (nEmpty === 0) return diff * p;
    if (nEmpty === 1) {
      const sq = nxt[64];
      let f = countFlips(sq, p);
      if (f) return diff * p + 2 * f + 1;
      f = countFlips(sq, -p);
      return f ? diff * p - 2 * f - 1 : diff * p;
    }
    let best = -99;
    if (nEmpty <= 4) {
      for (let sq = nxt[64]; sq !== 64; sq = nxt[sq]) {
        const f = make(sq, p);
        if (!f) continue;
        const v = -solve(-p, -beta, -alpha, false);
        unmake(sq, p, f);
        if (v > best) { best = v; if (v > alpha) { alpha = v; if (alpha >= beta) return best; } }
      }
    } else {
      const base = ply * 40;
      let n = 0;
      for (let sq = nxt[64]; sq !== 64; sq = nxt[sq]) {
        const f = make(sq, p);
        if (!f) continue;
        const sc = (PW[sq] >= 100 ? 3 : 0) - mobility(-p) * 4; // fewest replies first, corners early
        unmake(sq, p, f);
        let i = n++;
        while (i > 0 && MS[base + i - 1] < sc) { MS[base + i] = MS[base + i - 1]; MV[base + i] = MV[base + i - 1]; i--; }
        MS[base + i] = sc; MV[base + i] = sq;
      }
      for (let i = 0; i < n; i++) {
        const sq = MV[base + i];
        const f = make(sq, p);
        ply++;
        const v = -solve(-p, -beta, -alpha, false);
        ply--;
        unmake(sq, p, f);
        if (v > best) { best = v; if (v > alpha) { alpha = v; if (alpha >= beta) return best; } }
      }
    }
    if (best !== -99) return best;
    if (passed) return diff * p;
    return -solve(-p, -beta, -alpha, true);
  }

  // ---------------------------------------------------------------- move chooser (resumable, so it can be time-sliced)
  // createSearch(...).step(sliceMs) runs for about sliceMs and returns null (call again) or the result
  // { move, score, depth, nodes, ms, exact }. In a Worker it is simply stepped with a huge slice.
  const SOLVE_AT = 14; // empties at which Hard switches to the exact solver
  function createSearch(cells, player, level, budgetMs, opt) {
    opt = opt || {};
    const rnd = opt.rnd || Math.random;
    const sliced = !!opt.sliced;                 // main-thread fallback: one root move per unit, each capped
    const unitCap = opt.unitCap || 18;
    const t0 = now();
    const saved = Array.prototype.slice.call(cells);
    const root = legalMoves(saved, player);
    for (let i = root.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = root[i]; root[i] = root[j]; root[j] = t; }
    let result = null;
    const finish = (move, score, depth, exact) => {
      result = { move, score: score || 0, depth, nodes, ms: now() - t0, exact: !!exact, level };
      return result;
    };
    nodes = 0;
    if (root.length === 0) finish(-1, 0, 0, false);
    else if (root.length === 1) finish(root[0], 0, 0, false);
    else if (level === 'easy') {
      // mostly random, with a little greed
      let pick = root[0];
      if (rnd() < 0.3) {
        let bestN = -1;
        for (let i = 0; i < root.length; i++) { const f = flipsFor(saved, root[i], player).length; if (f > bestN) { bestN = f; pick = root[i]; } }
      }
      finish(pick, 0, 0, false);
    }
    if (result) return { step: () => result };

    const empties = count(saved).empty;
    const hard = level === 'hard';
    const budget = hard ? (budgetMs || 700) : 400;
    const hardEnd = t0 + budget;
    const wantExact = hard && empties <= (opt.solveAt || SOLVE_AT);
    const maxDepth = hard ? (wantExact ? Math.min(4, empties) : Math.min(empties, 30)) : (empties <= 6 ? empties : 3);
    // stable sort so the shuffle only breaks ties: corners and good squares first
    root.sort((x, y) => PW[y] - PW[x]);
    let phase = 'deepen', depth = 1, idx = 0, alpha = -32000;
    let iterBest = -1, iterScore = -32000;       // best of the iteration in progress
    let best = root[0], bestScore = 0, bestDepth = 0;
    let exactBest = -1, exactScore = -99, exactDone = 0;

    function unit() {
      const sq = root[idx];
      if (phase === 'deepen') {
        const f = make(sq, player);
        ply = 1;
        let v;
        if (idx === 0) v = -search(-player, depth - 1, -32000, 32000, false);
        else {
          v = -search(-player, depth - 1, -alpha - 1, -alpha, false);
          if (v > alpha) v = -search(-player, depth - 1, -32000, -alpha, false);
        }
        ply = 0;
        unmake(sq, player, f);
        if (v > iterScore) { iterScore = v; iterBest = sq; }
        if (v > alpha) alpha = v;
        if (++idx < root.length) return;
        // iteration complete: adopt it, put its best move first for the next one
        best = iterBest; bestScore = iterScore; bestDepth = depth;
        const at = root.indexOf(best); root.splice(at, 1); root.unshift(best);
        idx = 0; alpha = -32000; iterBest = -1; iterScore = -32000;
        const spent = now() - t0;
        if (depth >= maxDepth || (!wantExact && (Math.abs(bestScore) >= WIN || spent > budget * 0.45))) {
          if (wantExact) { phase = 'exact'; return; }
          finish(best, bestScore, bestDepth, Math.abs(bestScore) >= WIN);
          return;
        }
        depth++;
      } else {
        const f = make(sq, player);
        ply = 1;
        const v = -solve(-player, -64, -Math.max(exactScore, -64), false);
        ply = 0;
        unmake(sq, player, f);
        exactDone++;
        if (v > exactScore) { exactScore = v; exactBest = sq; }
        if (++idx >= root.length || exactScore >= 64) finish(exactBest, exactScore, empties, true);
      }
    }
    function giveUp() { // out of time: restore the board and answer with the best knowledge so far
      load(saved);
      if (phase === 'exact') {
        if (exactBest >= 0 && (exactScore > 0 || idx >= root.length - 1)) return finish(exactBest, exactScore, bestDepth, false);
        // the solved moves all lose or draw: prefer the best unsolved candidate, else the best solved one
        return finish(idx < root.length ? root[idx] : exactBest, bestScore, bestDepth, false);
      }
      if (iterBest >= 0) return finish(iterBest, iterScore, depth, false); // PV move was searched first, so this is sound
      return finish(best, bestScore, bestDepth, false);
    }
    load(saved);
    useEval(hard ? evalHard : evalMedium);
    return {
      step(sliceMs) {
        if (result) return result;
        const sliceEnd = now() + (sliceMs || 1e9);
        load(saved); // the engine is shared, another search may have run in between
        useEval(hard ? evalHard : evalMedium);
        try {
          while (!result) {
            deadline = sliced ? Math.min(hardEnd, now() + unitCap) : hardEnd;
            if (now() > hardEnd) throw ABORT;
            unit();
            if (!result && now() >= sliceEnd) return null;
          }
        } catch (e) {
          if (e !== ABORT) throw e;
          giveUp();
        }
        return result;
      },
    };
  }
  // run a whole search in one go (Worker, tests)
  function think(cells, player, level, budgetMs, opt) {
    const s = createSearch(cells, player, level, budgetMs, opt);
    let r = null;
    while (!r) r = s.step(1e9);
    return r;
  }

  return { startPosition, flipsFor, legalMoves, play, count, nextTurn, perft, createSearch, think, SOLVE_AT };
}

// ------------------------------------------------------------------ constants
const DARK = 1, LIGHT = -1;
const LEVELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const LS_STATS = 'kayzee-reversi-stats';
const LS_PREF = 'kayzee-reversi-pref';
const HEAD_H = 40, HEAD_GAP = 6, CHROME = 30; // stage margin (8) + frame padding (7), both sides
const HARD_BUDGET = 620;                      // ms of search for the Hard level (Worker)
const FALLBACK_BUDGET = 420;                  // ms when the search has to share the main thread
const FLIP_MS = 190, FLIP_STEP = 25, PLACE_MS = 110;

// ------------------------------------------------------------------ palette (original)
const P = {
  feltA: '#4fa93a', feltB: '#48a034', feltHi: '#72c653', feltLo: '#347c25', fleckA: '#5db844', fleckB: '#3d8f2c', pip: '#2c6d1e',
  wood: '#8a5a30', woodHi: '#b98045', woodMid: '#7a4d27', woodLo: '#5e3a18', woodInk: '#3e2610', label: '#f1cf95',
  shadow: 'rgba(14,52,10,.38)',
  dark: { top: '#2c3040', rim: '#181a23', hi: '#58607a', lo: '#21242f', side: '#0e0f15', mark: '#8292cf', glint: '#cdd6f5' },
  light: { top: '#f7f2e3', rim: '#d2c7a6', hi: '#ffffff', lo: '#e7dec5', side: '#a09474', mark: '#f0ad32', glint: '#ffd978' },
  cursor: '#ffd23f', cursorInk: '#6b4a08', last: '#ff6a2a', bad: '#e0321f',
};
// 3x5 pixel glyphs for the board labels and the score counters
const GLYPH = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001011001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001001010010', 8: '111101111101111', 9: '111101111001111',
  a: '010101111101101', b: '110101110101110', c: '011100100100011', d: '110101101101110',
  e: '111100110100111', f: '111100110100100', g: '011100101101011', h: '101101111101101',
};

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function lsGet(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } }
const sqName = (sq) => 'abcdefgh'[sq & 7] + ((sq >> 3) + 1);

// ------------------------------------------------------------------ sprite painter (16x16 logical grid, snapped to device pixels)
function painter(S) {
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const p = S / 16;
  const R = (v) => Math.round(v * p);
  const px = (x, y, w, h, c) => { g.fillStyle = c; const x0 = R(x), y0 = R(y); g.fillRect(x0, y0, R(x + w) - x0, R(y + h) - y0); };
  return { cv, g, px };
}
function glyph(g, ch, x, y, u, c) {
  const bits = GLYPH[ch];
  g.fillStyle = c;
  for (let i = 0; i < 15; i++) if (bits[i] === '1') g.fillRect(x + (i % 3) * u, y + ((i / 3) | 0) * u, u, u);
}
function feltTile(S, variant, alt) {
  const { cv, px } = painter(S);
  px(0, 0, 16, 16, alt ? P.feltB : P.feltA);
  px(0, 0, 16, 1, P.feltHi); px(0, 0, 1, 16, P.feltHi);
  px(0, 15, 16, 1, P.feltLo); px(15, 0, 1, 16, P.feltLo);
  const r = rng(variant * 733 + 29);
  for (let i = 0; i < 6; i++) { const x = 2 + Math.floor(r() * 12), y = 2 + Math.floor(r() * 12); px(x, y, 1, 1, r() < 0.5 ? P.fleckA : P.fleckB); }
  return cv;
}
// a chunky disc seen slightly from above: top face, a visible edge, a soft shadow
function discSprite(S, who) {
  const { cv, px } = painter(S);
  const c = who === DARK ? P.dark : P.light;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dx = x + 0.5 - 8, dy = y + 0.5 - 7.3;
    const top = Math.hypot(dx, dy);
    if (top <= 5.9) {
      let col = c.top;
      if (top > 4.85) col = c.rim;
      else if (top > 3.0 && dx + dy < -3.6) col = c.hi;
      else if (top > 3.0 && dx + dy > 3.8) col = c.lo;
      px(x, y, 1, 1, col);
    } else if (Math.hypot(dx, y + 0.5 - 9.0) <= 5.9) px(x, y, 1, 1, c.side);
    else if (Math.hypot(x + 0.5 - 8.7, y + 0.5 - 10.0) <= 6.0) px(x, y, 1, 1, P.shadow);
  }
  if (who === DARK) { // night side: a little crescent moon and a star
    px(7, 5, 2, 1, c.mark); px(6, 6, 2, 1, c.mark); px(6, 7, 1, 2, c.mark); px(6, 9, 2, 1, c.mark); px(7, 10, 2, 1, c.mark);
    px(10, 6, 1, 1, c.glint);
  } else {            // day side: a little sun
    px(7, 6, 2, 3, c.mark); px(6, 7, 4, 1, c.mark); px(7, 7, 2, 1, c.glint);
    px(5, 5, 1, 1, c.mark); px(10, 5, 1, 1, c.mark); px(5, 9, 1, 1, c.mark); px(10, 9, 1, 1, c.mark);
  }
  return cv;
}
function hintSprite(S) {
  const { cv, px } = painter(S);
  px(7, 6, 2, 4, P.pip); px(6, 7, 4, 2, P.pip);
  px(7, 7, 2, 2, '#9be36f'); px(7, 7, 1, 1, '#d6ffb8');
  return cv;
}
function cursorSprite(S) {
  const { cv, px } = painter(S);
  px(1, 1, 14, 1, P.cursorInk); px(1, 14, 14, 1, P.cursorInk); px(1, 1, 1, 14, P.cursorInk); px(14, 1, 1, 14, P.cursorInk);
  px(0, 0, 16, 1, P.cursor); px(0, 15, 16, 1, P.cursor); px(0, 0, 1, 16, P.cursor); px(15, 0, 1, 16, P.cursor);
  return cv;
}
function lastSprite(S) {
  const { cv, px } = painter(S);
  for (const [x, y, sx, sy] of [[1, 1, 1, 1], [14, 1, -1, 1], [1, 14, 1, -1], [14, 14, -1, -1]]) {
    px(x, y, 1, 1, P.last); px(x + sx, y, 1, 1, P.last); px(x, y + sy, 1, 1, P.last);
  }
  return cv;
}
function badSprite(S) {
  const { cv, px } = painter(S);
  for (let i = 0; i < 8; i++) { px(4 + i, 4 + i, 1.5, 1.5, P.bad); px(11 - i, 4 + i, 1.5, 1.5, P.bad); }
  return cv;
}
// wooden rail with coordinate labels + the 64 felt squares, rendered once per size
function boardBackground(S, F, tiles, ub) {
  const cv = document.createElement('canvas'); cv.width = cv.height = S * 8 + F * 2;
  const g = cv.getContext('2d'), W = cv.width, u = Math.max(1, Math.round(S / 16));
  g.fillStyle = P.wood; g.fillRect(0, 0, W, W);
  const r = rng(4711);
  for (let i = 0; i < 34; i++) { // grain
    const len = Math.round((3 + r() * 9) * u), side = (r() * 4) | 0, t = Math.round(r() * Math.max(0, F - 2 * u)), a = Math.round(r() * (W - len));
    g.fillStyle = r() < 0.5 ? P.woodMid : P.woodHi; g.globalAlpha = 0.4;
    if (side === 0) g.fillRect(a, t, len, u); else if (side === 1) g.fillRect(a, W - F + t, len, u);
    else if (side === 2) g.fillRect(t, a, u, len); else g.fillRect(W - F + t, a, u, len);
  }
  g.globalAlpha = 1;
  g.fillStyle = P.woodHi; g.fillRect(0, 0, W, ub); g.fillRect(0, 0, ub, W);
  g.fillStyle = P.woodLo; g.fillRect(0, W - ub, W, ub); g.fillRect(W - ub, 0, ub, W);
  g.fillStyle = P.woodInk; g.fillRect(F - ub, F - ub, S * 8 + 2 * ub, S * 8 + 2 * ub); // routed groove round the felt
  for (let i = 0; i < 64; i++) g.drawImage(tiles[i], F + (i & 7) * S, F + (i >> 3) * S);
  g.fillStyle = P.pip; // four guide dots, like on a tournament board
  for (const [cx, cy] of [[2, 2], [6, 2], [2, 6], [6, 6]]) g.fillRect(F + cx * S - u, F + cy * S - u, 2 * u, 2 * u);
  // coordinate labels in the rail, when it is wide enough to hold a 3x5 glyph
  const lu = Math.max(1, Math.floor((F - 2 * ub) / 7));
  if (F >= 9 && F - 2 * ub >= 5 * lu + 2) {
    const top = Math.round((F - ub - 5 * lu) / 2), left = Math.round((F - ub - 3 * lu) / 2), sh = Math.max(1, lu >> 1);
    for (let i = 0; i < 8; i++) {
      const mid = F + i * S + Math.round(S / 2), ch = 'abcdefgh'[i], num = String(i + 1);
      if (lu >= 2) { glyph(g, ch, mid - Math.round(1.5 * lu) + sh, top + sh, lu, P.woodInk); glyph(g, num, left + sh, mid - Math.round(2.5 * lu) + sh, lu, P.woodInk); }
      glyph(g, ch, mid - Math.round(1.5 * lu), top, lu, P.label);
      glyph(g, num, left, mid - Math.round(2.5 * lu), lu, P.label);
    }
  }
  return cv;
}
// two-digit wooden score counter
function drawCount(cv, value) {
  const dpr = Math.min(3, window.devicePixelRatio || 1), W = 11, H = 9;
  const cssW = cv.clientWidth || 33;
  cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssW * dpr * H / W);
  const g = cv.getContext('2d'), p = cv.width / W;
  const R = (v) => Math.round(v * p);
  const px = (x, y, w, h, c) => { g.fillStyle = c; const x0 = R(x), y0 = R(y); g.fillRect(x0, y0, R(x + w) - x0, R(y + h) - y0); };
  px(0, 0, W, H, '#2a180b'); px(0, 0, W, 1, '#1a0d05'); px(0, 0, 1, H, '#1a0d05'); px(0, H - 1, W, 1, '#8f6234'); px(W - 1, 0, 1, H, '#8f6234');
  const s = String(Math.max(0, Math.min(99, value | 0))).padStart(2, '0');
  for (let k = 0; k < 2; k++) {
    const bits = GLYPH[s[k]];
    for (let i = 0; i < 15; i++) {
      const on = bits[i] === '1', dim = k === 0 && s[0] === '0';
      px(2 + k * 4 + (i % 3), 2 + ((i / 3) | 0), 1, 1, on && !dim ? '#ffe9a8' : '#3d2412');
    }
  }
}

// ------------------------------------------------------------------ the app
export default {
  id: 'reversi',
  title: 'Reversi',
  icon: 'reversi',
  size: [432, 524],
  minSize: [240, 320],
  single: true,
  resizable: true,
  mount(root, ctx) {
    const E = makeEngine();
    const sound = (n) => { try { ctx.sound && ctx.sound(n); } catch { /* optional */ } };
    const pref = lsGet(LS_PREF, {});
    let level = LEVELS[pref.level] ? pref.level : 'medium';
    let hints = pref.hints !== false;
    let first = pref.first === 'cpu' ? 'cpu' : 'you';
    const blank = () => ({ w: 0, l: 0, d: 0 });
    const readStats = () => {
      const s = lsGet(LS_STATS, {}), out = {};
      for (const k of Object.keys(LEVELS)) { const v = (s && s[k]) || {}; out[k] = { w: v.w | 0, l: v.l | 0, d: v.d | 0 }; }
      return out;
    };
    let stats = readStats();
    const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    root.innerHTML = `
      <div class="rv-menubar" role="menubar">
        <div class="rv-menu" data-m="game"><button class="rv-mtitle" type="button"><u>G</u>ame</button>
          <div class="rv-drop" role="menu">
            <button data-a="new">New<span>F2</span></button>
            <button data-a="undo">Undo<span>Ctrl+Z</span></button><hr>
            <button data-a="easy" class="radio">Easy</button>
            <button data-a="medium" class="radio">Medium</button>
            <button data-a="hard" class="radio">Hard</button><hr>
            <button data-a="first-you" class="radio">You move first</button>
            <button data-a="first-cpu" class="radio">Computer moves first</button><hr>
            <button data-a="hints" class="check">Show legal moves<span>H</span></button>
            <button data-a="stats">Statistics…</button><hr>
            <button data-a="exit">Exit</button>
          </div></div>
        <div class="rv-menu" data-m="help"><button class="rv-mtitle" type="button"><u>H</u>elp</button>
          <div class="rv-drop" role="menu">
            <button data-a="howto">How to Play</button><hr>
            <button data-a="about">About Reversi</button>
          </div></div>
      </div>
      <div class="rv-stage">
        <div class="rv-frame">
          <div class="rv-head">
            <div class="rv-side rv-you"><canvas class="rv-pip"></canvas><canvas class="rv-count" aria-label="Your discs"></canvas><span class="rv-name">You</span></div>
            <div class="rv-chip"></div>
            <div class="rv-side rv-cpu"><span class="rv-name">Computer</span><canvas class="rv-count" aria-label="Computer discs"></canvas><canvas class="rv-pip"></canvas></div>
          </div>
          <div class="rv-boardwrap"><canvas class="rv-board" role="img" aria-label="Reversi board"></canvas><div class="rv-toast" aria-hidden="true"></div></div>
        </div>
      </div>
      <div class="rv-status xp-statusbar">
        <span class="rv-cell rv-msg" role="status" aria-live="polite"></span>
        <span class="rv-cell rv-sc"><i class="rv-dot rv-d"></i><em>You</em> <b class="rv-nd">2</b></span>
        <span class="rv-cell rv-sc"><i class="rv-dot rv-l"></i><em>Computer</em> <b class="rv-nl">2</b></span>
        <span class="rv-cell rv-lvl"></span>
      </div>
      <div class="rv-modal" hidden></div>`;
    const $ = (s) => root.querySelector(s);
    const stage = $('.rv-stage'), frame = $('.rv-frame'), head = $('.rv-head'), board = $('.rv-board'), toastEl = $('.rv-toast');
    const menubar = $('.rv-menubar'), modal = $('.rv-modal'), chip = $('.rv-chip');
    const msgEl = $('.rv-msg'), ndEl = $('.rv-nd'), nlEl = $('.rv-nl'), lvlEl = $('.rv-lvl');
    const youEl = $('.rv-you'), cpuEl = $('.rv-cpu');
    const [pipYou, pipCpu] = root.querySelectorAll('.rv-pip'), [cntYou, cntCpu] = root.querySelectorAll('.rv-count');
    const bg = board.getContext('2d');

    // ---------------------------------------------------------------- timers (all tracked so unmount can cancel them)
    const timers = new Set();
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
    const cancel = (id) => { if (id) { clearTimeout(id); timers.delete(id); } return 0; };
    let dead = false;

    // ---------------------------------------------------------------- game state
    let cells = E.startPosition(), turn = DARK, over = false, result = '', scored = false;
    let last = -1, legal = [], history = [], note = '', thinking = false;
    let cursor = 27, kbd = false, hover = -1, bad = -1, badTimer = 0;
    let cs = 40, fm = 12, S = 40, F = 12, dpr = 1, sprites = null, spriteKey = '', bgCv = null, bgKey = '', headOn = true;
    const anims = new Map(); // sq -> { from, to, t0, dur }
    let raf = 0, animEnd = 0;
    let reqId = 0, cpuTimer = 0, endTimer = 0, toastTimer = 0, lastThink = null;

    // ---------------------------------------------------------------- computer player (Blob Worker, time-sliced fallback)
    let worker = null, workerUrl = '', useWorker = typeof Worker === 'function' && typeof Blob === 'function';
    let pending = null, watchdog = 0, sliceTimer = 0;
    function ensureWorker() {
      if (worker || !useWorker) return worker;
      try {
        if (!workerUrl) {
          const src = 'var E=(' + makeEngine.toString() + ')();self.onmessage=function(e){var m=e.data;var r=E.think(m.cells,m.player,m.level,m.budget);self.postMessage({id:m.id,r:r});};';
          workerUrl = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
        }
        worker = new Worker(workerUrl);
        worker.onmessage = (e) => {
          const m = e.data;
          if (!pending || !m || m.id !== pending.id) return;
          const cb = pending.cb; pending = null; watchdog = cancel(watchdog);
          cb(m.r);
        };
        worker.onerror = (e) => { if (e && e.preventDefault) e.preventDefault(); workerFailed(); };
      } catch { worker = null; useWorker = false; }
      return worker;
    }
    function killWorker() { if (worker) { try { worker.terminate(); } catch { /* gone */ } worker = null; } }
    function workerFailed() { // blocked (CSP, sandbox) or stuck: carry on without it
      const p = pending; pending = null; watchdog = cancel(watchdog);
      killWorker(); useWorker = false;
      if (p && !dead) thinkSliced(p.req, p.cb);
    }
    function thinkSliced(req, cb) {
      const s = E.createSearch(req.cells, req.player, req.level, FALLBACK_BUDGET, { sliced: true });
      const run = () => {
        sliceTimer = 0;
        if (req.id !== reqId) return;
        const r = s.step(9);
        if (r) cb(r); else sliceTimer = later(run, 0);
      };
      sliceTimer = later(run, 0);
    }
    function requestMove(id, cb) {
      const req = { id, cells: cells.slice(), player: LIGHT, level, budget: HARD_BUDGET };
      if (level === 'hard' && ensureWorker()) {
        pending = { id, cb, req };
        watchdog = later(workerFailed, 3000);
        try { worker.postMessage(req); } catch { workerFailed(); }
      } else thinkSliced(req, cb); // Easy and Medium answer in a millisecond or two
    }
    function cancelThink() {
      reqId++; thinking = false;
      cpuTimer = cancel(cpuTimer); sliceTimer = cancel(sliceTimer); watchdog = cancel(watchdog);
      if (pending) { pending = null; killWorker(); } // stop burning CPU on an answer nobody wants
    }
    function cpuTurn(extraDelay) {
      thinking = true;
      const id = ++reqId, t0 = performance.now();
      const earliest = Math.max(t0, animEnd) + 170 + (extraDelay || 0);
      requestMove(id, (res) => {
        if (id !== reqId || dead) return;
        lastThink = { level: res.level, ms: res.ms, wall: performance.now() - t0, depth: res.depth, nodes: res.nodes, exact: res.exact, worker: !!worker };
        cpuTimer = later(() => {
          cpuTimer = 0;
          if (id !== reqId) return;
          thinking = false;
          const mv = E.flipsFor(cells, res.move, LIGHT).length ? res.move : E.legalMoves(cells, LIGHT)[0];
          if (mv !== undefined) place(mv, LIGHT);
        }, Math.max(0, earliest - performance.now()));
      });
    }

    // ---------------------------------------------------------------- moves
    function newGame() {
      cancelThink(); endTimer = cancel(endTimer); hideToast();
      cells = E.startPosition(); over = false; result = ''; scored = false; last = -1; history = []; note = '';
      anims.clear(); animEnd = 0; bad = -1; modal.hidden = true;
      turn = first === 'cpu' ? LIGHT : DARK;
      refresh();
      if (turn === LIGHT) cpuTurn(260);
    }
    function place(sq, p) {
      const r = E.play(cells, sq, p);
      if (!r) return false;
      const t = performance.now();
      anims.clear();
      if (!reduceMotion) {
        anims.set(sq, { from: 0, to: p, t0: t, dur: PLACE_MS });
        animEnd = t + PLACE_MS;
        for (const f of r.flips) { // a ripple outwards from the new disc; the whole cascade stays under 400 ms
          const dist = Math.max(Math.abs((f & 7) - (sq & 7)), Math.abs((f >> 3) - (sq >> 3)));
          const t1 = t + 30 + (dist - 1) * FLIP_STEP;
          anims.set(f, { from: -p, to: p, t0: t1, dur: FLIP_MS });
          animEnd = Math.max(animEnd, t1 + FLIP_MS);
        }
      } else animEnd = t;
      cells = r.cells; last = sq;
      sound('click');
      const nt = E.nextTurn(cells, p);
      note = '';
      if (nt === 0) { turn = 0; finishGame(); return true; }
      if (nt === p) {
        if (p === DARK) { note = 'Computer passes (no move). Your turn.'; toast('Computer has no move: pass!'); }
        else { note = 'You pass (no move). Computer plays on.'; toast('You have no move: pass!'); }
      }
      turn = nt;
      refresh();
      if (turn === LIGHT) cpuTurn(nt === p ? 950 : 0);
      return true;
    }
    function playerMove(sq) {
      if (over || turn !== DARK || thinking || sq < 0) return;
      if (!E.flipsFor(cells, sq, DARK).length) {
        sound('error');
        bad = sq; badTimer = cancel(badTimer); badTimer = later(() => { bad = -1; draw(); }, 320);
        draw();
        return;
      }
      history.push({ cells: cells.slice(), last });
      hideToast();
      place(sq, DARK);
    }
    function undo() {
      if (!history.length) { sound('error'); return; }
      cancelThink(); endTimer = cancel(endTimer); hideToast();
      const h = history.pop();
      cells = h.cells; last = h.last; turn = DARK; over = false; result = ''; note = '';
      anims.clear(); animEnd = 0; bad = -1; modal.hidden = true;
      sound('click');
      refresh();
    }
    function finishGame() {
      over = true; thinking = false;
      const k = E.count(cells);
      result = k.dark > k.light ? 'w' : k.dark < k.light ? 'l' : 'd';
      const counted = !scored;
      if (counted) { scored = true; stats = readStats(); stats[level][result]++; lsSet(LS_STATS, stats); }
      refresh();
      endTimer = later(() => { endTimer = 0; sound(result === 'l' ? 'error' : 'ding'); showResult(counted); }, reduceMotion ? 250 : 620);
    }
    const resultText = () => (result === 'w' ? 'You win!' : result === 'l' ? 'Computer wins' : 'It is a draw');

    // ---------------------------------------------------------------- sizing
    function fit() {
      const sw = stage.clientWidth, sh = stage.clientHeight;
      if (sw < 40 || sh < 40) return false;
      // Sizes are chosen in device pixels (one felt square = S whole pixels) and the CSS size is
      // derived from that, so the pixel art maps 1:1 to the screen even at fractional zoom levels.
      dpr = Math.min(3, window.devicePixelRatio || 1);
      const size = (withHead) => Math.floor(Math.min(sw - CHROME, sh - CHROME - (withHead ? HEAD_H + HEAD_GAP : 0)) * dpr);
      const cell = (a) => Math.floor(a / 8.6);
      headOn = !(cell(size(true)) < 23 * dpr && cell(size(false)) > cell(size(true)));
      const avail = size(headOn);
      S = Math.max(Math.round(10 * dpr), Math.min(Math.round(104 * dpr), cell(avail)));
      F = Math.max(Math.round(3 * dpr), Math.min(Math.floor((avail - S * 8) / 2), Math.round(S * 0.36)));
      cs = S / dpr; fm = F / dpr;
      const css = (S * 8 + F * 2) / dpr;
      head.hidden = !headOn;
      head.style.width = css + 'px';
      head.classList.toggle('rv-tight', css < 300);
      board.style.width = board.style.height = css + 'px';
      if (board.width !== S * 8 + F * 2) { board.width = board.height = S * 8 + F * 2; }
      if (spriteKey !== '' + S) {
        spriteKey = '' + S;
        sprites = { felt: [], disc: { [DARK]: discSprite(S, DARK), [LIGHT]: discSprite(S, LIGHT) }, hint: hintSprite(S), cursor: cursorSprite(S), last: lastSprite(S), bad: badSprite(S) };
        for (let i = 0; i < 64; i++) sprites.felt.push(feltTile(S, i, ((i & 7) + (i >> 3)) & 1));
      }
      if (bgKey !== S + ':' + F) { bgKey = S + ':' + F; bgCv = boardBackground(S, F, sprites.felt, Math.max(1, Math.round(dpr))); }
      root.classList.toggle('rv-narrow', root.clientWidth < 330);
      const pd = Math.round(26 * dpr);
      for (const [cv, who] of [[pipYou, DARK], [pipCpu, LIGHT]]) {
        if (cv.width !== pd) { cv.width = cv.height = pd; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(discSprite(pd, who), 0, 0); }
      }
      return true;
    }

    // ---------------------------------------------------------------- drawing
    function drawDisc(who, sq, sx, sy, lift) {
      const img = sprites.disc[who];
      const x = F + (sq & 7) * S, y = F + (sq >> 3) * S;
      if (sx >= 1 && sy >= 1 && !lift) { bg.drawImage(img, x, y); return; }
      const w = Math.max(1, Math.round(S * sx)), h = Math.max(1, Math.round(S * sy));
      bg.drawImage(img, x + ((S - w) >> 1), y + ((S - h) >> 1) - Math.round(lift * S / 16), w, h);
    }
    function draw(tNow) {
      if (!sprites || !bgCv) return;
      const t = tNow === undefined ? performance.now() : tNow;
      bg.imageSmoothingEnabled = false;
      bg.drawImage(bgCv, 0, 0);
      const myMove = turn === DARK && !over && !thinking;
      for (let sq = 0; sq < 64; sq++) {
        const a = anims.get(sq);
        if (a) {
          const q = (t - a.t0) / a.dur;
          if (q >= 1) { anims.delete(sq); drawDisc(a.to, sq, 1, 1, 0); }
          else if (q <= 0) { if (a.from) drawDisc(a.from, sq, 1, 1, 0); }
          else if (!a.from) { const k = 0.55 + 0.45 * q; drawDisc(a.to, sq, k, k, 0); }
          else { const k = Math.abs(Math.cos(Math.PI * q)); drawDisc(q < 0.5 ? a.from : a.to, sq, Math.max(0.12, k), 1, Math.sin(Math.PI * q) * 1.6); }
        } else if (cells[sq]) drawDisc(cells[sq], sq, 1, 1, 0);
      }
      if (myMove && hints) for (const sq of legal) if (sq !== hover) bg.drawImage(sprites.hint, F + (sq & 7) * S, F + (sq >> 3) * S);
      if (myMove && hover >= 0 && legal.includes(hover)) { bg.globalAlpha = 0.5; drawDisc(DARK, hover, 1, 1, 0); bg.globalAlpha = 1; }
      if (last >= 0) bg.drawImage(sprites.last, F + (last & 7) * S, F + (last >> 3) * S);
      if (bad >= 0) bg.drawImage(sprites.bad, F + (bad & 7) * S, F + (bad >> 3) * S);
      if (kbd && !over) bg.drawImage(sprites.cursor, F + (cursor & 7) * S, F + (cursor >> 3) * S);
    }
    function tick(t) {
      raf = 0;
      draw(t);
      if (anims.size) raf = requestAnimationFrame(tick);
    }
    function skipAnims() { if (anims.size) { anims.clear(); draw(); } }
    function refresh() {
      legal = turn === DARK && !over ? E.legalMoves(cells, DARK) : [];
      const k = E.count(cells);
      const text = over ? `Game over: ${resultText()} ${k.dark} to ${k.light}.`
        : note ? note
          : turn === DARK ? (last >= 0 ? `Your turn. Computer played ${sqName(last)}.` : 'Your turn. You play the dark pieces.')
            : 'Computer is thinking…';
      if (msgEl.textContent !== text) msgEl.textContent = text;
      ndEl.textContent = k.dark; nlEl.textContent = k.light; lvlEl.textContent = LEVELS[level];
      chip.textContent = over ? (result === 'w' ? 'You win!' : result === 'l' ? 'You lose' : 'Draw') : turn === DARK ? 'Your turn' : 'Thinking';
      youEl.classList.toggle('on', !over && turn === DARK); cpuEl.classList.toggle('on', !over && turn === LIGHT);
      if (headOn) { drawCount(cntYou, k.dark); drawCount(cntCpu, k.light); }
      board.setAttribute('aria-label', `Reversi board. You ${k.dark}, computer ${k.light}.`);
      // (no ctx.setStatus here: the window manager would add a second status bar under this one)
      if (anims.size) { if (!raf) raf = requestAnimationFrame(tick); } else draw();
    }
    function toast(text) {
      toastEl.textContent = text; toastEl.classList.add('show');
      toastTimer = cancel(toastTimer);
      toastTimer = later(() => { toastTimer = 0; toastEl.classList.remove('show'); }, 2100);
    }
    function hideToast() { toastTimer = cancel(toastTimer); toastEl.classList.remove('show'); }

    // ---------------------------------------------------------------- pointer input (mouse + touch)
    const cellAt = (e) => {
      let x = e.offsetX, y = e.offsetY;
      if (e.target !== board) { const r = board.getBoundingClientRect(); x = (e.clientX - r.left) * board.clientWidth / r.width; y = (e.clientY - r.top) * board.clientHeight / r.height; }
      const cx = Math.floor((x - fm) / cs), cy = Math.floor((y - fm) / cs);
      return cx >= 0 && cy >= 0 && cx < 8 && cy < 8 ? cy * 8 + cx : -1;
    };
    board.addEventListener('pointermove', (e) => {
      const h = e.pointerType === 'mouse' ? cellAt(e) : -1;
      if (h !== hover) { hover = h; if (!anims.size) draw(); }
    });
    board.addEventListener('pointerleave', () => { if (hover !== -1) { hover = -1; if (!anims.size) draw(); } });
    board.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') hover = -1; });
    board.addEventListener('click', (e) => {
      const sq = cellAt(e);
      skipAnims(); // the flip is only decoration: a click never waits for it
      if (kbd) { kbd = false; draw(); }
      if (sq >= 0) { cursor = sq; playerMove(sq); }
    });
    board.addEventListener('contextmenu', (e) => e.preventDefault());

    // ---------------------------------------------------------------- menus & dialogs
    let openMenu = null;
    function setMenu(m) {
      openMenu = m;
      root.querySelectorAll('.rv-menu').forEach((el) => el.classList.toggle('open', el === m));
      if (m) syncMenu();
    }
    function syncMenu() {
      root.querySelectorAll('.rv-drop .radio').forEach((b) => b.classList.toggle('on', b.dataset.a === level || b.dataset.a === 'first-' + first));
      $('[data-a="hints"]').classList.toggle('on', hints);
      $('[data-a="undo"]').classList.toggle('dis', !history.length);
    }
    menubar.addEventListener('pointerdown', (e) => {
      const t = e.target.closest('.rv-mtitle');
      if (t) { e.preventDefault(); const m = t.parentElement; setMenu(openMenu === m ? null : m); }
    });
    menubar.addEventListener('pointerover', (e) => {
      const t = e.target.closest('.rv-mtitle');
      if (t && openMenu && openMenu !== t.parentElement) setMenu(t.parentElement);
    });
    menubar.addEventListener('click', (e) => {
      const b = e.target.closest('.rv-drop button');
      if (!b) return;
      setMenu(null);
      if (b.blur) b.blur();
      if (!b.classList.contains('dis')) action(b.dataset.a);
    });
    const outside = (e) => { if (openMenu && !openMenu.contains(e.target)) setMenu(null); if (!root.contains(e.target)) setFocus(false); };
    document.addEventListener('pointerdown', outside, true);

    const savePref = () => lsSet(LS_PREF, { level, hints, first });
    function setLevel(l) { if (!LEVELS[l]) return; level = l; savePref(); newGame(); }
    function setFirst(f) { first = f === 'cpu' ? 'cpu' : 'you'; savePref(); newGame(); }
    function setHints(v) { hints = !!v; savePref(); draw(); }
    function action(a) {
      if (a === 'new') { sound('click'); newGame(); }
      else if (a === 'undo') undo();
      else if (LEVELS[a]) setLevel(a);
      else if (a === 'first-you' || a === 'first-cpu') setFirst(a.slice(6));
      else if (a === 'hints') setHints(!hints);
      else if (a === 'stats') showStats();
      else if (a === 'exit') ctx.close && ctx.close();
      else if (a === 'howto') dialog('How to Play', `<p>Take turns placing discs on the board. You are <b>dark</b>, the computer is <b>light</b>. Whoever owns more discs at the end wins.</p>
        <ul><li>A move must <b>trap</b> one or more of the other side's discs in a straight line (across, down or diagonally) between the disc you place and another of your own.</li>
        <li>Every trapped disc <b>flips</b> to your colour, in all directions at once.</li>
        <li>No legal move? Your turn is <b>passed</b>. When neither side can move, the game is over.</li>
        <li>Corners can never be flipped back. They are worth fighting for.</li></ul>
        <p class="rv-keys"><b>Mouse / touch:</b> click or tap a square. <b>Keyboard:</b> arrow keys move the cursor, Enter or Space places a disc, F2 new game, Ctrl+Z undo, H shows or hides legal moves.</p>`, [['OK', () => true]], true);
      else if (a === 'about') dialog('About Reversi', `<p><b>Reversi</b> for Kayzee XP.</p><p>Original art and code. The game itself is a public-domain classic from the 1880s; this version is not affiliated with any operating-system vendor.</p>`);
    }
    function dialog(title, html, buttons = [['OK', () => true]], wide) {
      modal.innerHTML = `<div class="rv-dlg${wide ? ' rv-wide' : ''}" role="dialog" aria-label="${title}"><div class="rv-dlg-t">${title}</div><div class="rv-dlg-b">${html}</div><div class="rv-dlg-f"></div></div>`;
      const f = modal.querySelector('.rv-dlg-f');
      buttons.forEach(([label, fn], k) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'xp-btn rv-btn' + (k === 0 ? ' default' : ''); b.textContent = label;
        b.addEventListener('click', () => { if (fn() !== false) modal.hidden = true; });
        f.appendChild(b);
      });
      modal.hidden = false;
      f.firstChild.focus({ preventScroll: true });
    }
    const tally = (s) => `${s.w} won · ${s.l} lost · ${s.d} drawn`;
    function showResult(counted) {
      const k = E.count(cells);
      dialog('Game Over', `<p class="rv-res rv-res-${result}">${resultText()}</p>
        <p class="rv-score"><i class="rv-dot rv-d"></i> You <b>${k.dark}</b> &nbsp;:&nbsp; <b>${k.light}</b> Computer <i class="rv-dot rv-l"></i></p>
        <p class="rv-tally">${LEVELS[level]} level so far: ${tally(stats[level])}${counted ? '' : '<br>(This game was already counted.)'}</p>`,
      [['New Game', () => { later(newGame, 0); return true; }], ['Close', () => true]]);
    }
    function showStats() {
      stats = readStats();
      const row = (k) => `<tr><td>${LEVELS[k]}</td><td>${stats[k].w}</td><td>${stats[k].l}</td><td>${stats[k].d}</td></tr>`;
      dialog('Statistics', `<table class="rv-table"><tr><th>Level</th><th>Won</th><th>Lost</th><th>Drawn</th></tr>${row('easy')}${row('medium')}${row('hard')}</table>`,
        [['OK', () => true], ['Reset', () => { stats = { easy: blank(), medium: blank(), hard: blank() }; lsSet(LS_STATS, stats); showStats(); return false; }]]);
    }
    modal.addEventListener('keydown', (e) => {
      e.stopPropagation(); // keys typed in a dialog never reach the board
      if (e.key === 'Escape') { modal.hidden = true; e.preventDefault(); }
      else if (e.key === 'Enter') {
        const b = (e.target.closest && e.target.closest('.rv-btn')) || modal.querySelector('.rv-btn.default');
        if (b) b.click();
        e.preventDefault();
      }
    });

    // ---------------------------------------------------------------- focus & keys
    let focused = false;
    function setFocus(v) { focused = v; }
    const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const onKey = (e) => {
      if (!focused || e.defaultPrevented) return;
      const t = e.target;
      if (t && t !== document.body && !root.contains(t) && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '')) return;
      if (!modal.hidden) {
        if (e.key === 'Escape') { modal.hidden = true; e.preventDefault(); }
        else if (e.key === 'Enter') { const b = modal.querySelector('.rv-btn.default'); if (b) { b.click(); e.preventDefault(); } }
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'F2') { e.preventDefault(); newGame(); }
      else if (e.key === 'Escape') { if (openMenu) setMenu(null); }
      else if (mod && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(); }
      else if (mod || e.altKey) return;
      else if (e.key === 'Backspace') { e.preventDefault(); undo(); }
      else if (e.key === 'h' || e.key === 'H') { e.preventDefault(); setHints(!hints); }
      else if (ARROWS[e.key]) {
        e.preventDefault(); skipAnims();
        const [dx, dy] = ARROWS[e.key];
        if (kbd) { const x = Math.max(0, Math.min(7, (cursor & 7) + dx)), y = Math.max(0, Math.min(7, (cursor >> 3) + dy)); cursor = y * 8 + x; }
        kbd = true; draw();
      } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault(); skipAnims();
        if (!kbd) { kbd = true; draw(); } else playerMove(cursor);
      }
    };
    window.addEventListener('keydown', onKey);
    root.addEventListener('pointerdown', () => setFocus(true));

    const ro = new ResizeObserver(() => { if (fit()) refresh(); });
    ro.observe(stage);
    fit();
    newGame();

    // test hook (harmless in production): lets the CDP harness inspect and drive the game
    Object.defineProperty(root, '_kzReversi', { configurable: true, value: {
      E,
      get cells() { return cells.slice(); }, get turn() { return turn; }, get over() { return over; }, get result() { return result; },
      get thinking() { return thinking; }, get legal() { return legal.slice(); }, get count() { return E.count(cells); },
      get level() { return level; }, get hints() { return hints; }, get first() { return first; }, get historyLen() { return history.length; },
      get last() { return last; }, get cursor() { return cursor; }, get kbd() { return kbd; }, get animating() { return anims.size > 0; },
      get lastThink() { return lastThink; }, get usingWorker() { return useWorker; }, get cs() { return cs; }, get note() { return note; },
      get timers() { return timers.size; },
      center(sq) { const r = board.getBoundingClientRect(), k = r.width / board.clientWidth; return { x: r.left + (fm + ((sq & 7) + 0.5) * cs) * k, y: r.top + (fm + ((sq >> 3) + 0.5) * cs) * k }; },
      newGame, setLevel, setFirst, setHints, undo,
      setWorker(v) { if (!v) { killWorker(); useWorker = false; } else useWorker = typeof Worker === 'function'; },
      load(c, t) { cancelThink(); endTimer = cancel(endTimer); cells = c.slice(); turn = t; over = false; result = ''; last = -1; history = []; note = ''; anims.clear(); modal.hidden = true; refresh(); if (turn === LIGHT) cpuTurn(0); },
    } });

    return {
      onResize() { if (fit()) refresh(); },
      onFocus() { setFocus(true); },
      onBlur() { setFocus(false); setMenu(null); },
      unmount() {
        dead = true;
        cancelThink(); killWorker();
        if (workerUrl) { try { URL.revokeObjectURL(workerUrl); } catch { /* ignore */ } workerUrl = ''; }
        timers.forEach((id) => clearTimeout(id)); timers.clear();
        if (raf) cancelAnimationFrame(raf); raf = 0;
        ro.disconnect();
        window.removeEventListener('keydown', onKey);
        document.removeEventListener('pointerdown', outside, true);
        delete root._kzReversi;
        root.innerHTML = '';
      },
    };
  },
};
