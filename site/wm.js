// Kayzee XP window manager (core).
// A window = one DOM element placed in 3D by CSS3DRenderer (never re-parented, so iframes never reload)
//          + a thick bevelled WebGL slab drawn in the front layer (with a hole where the DOM face is)
//          + an invisible box in the world that casts the window's shadow onto the grass.
// Layout lives in screen px of the rest camera (integers -> pixel-crisp text); 3D poses are derived from it.

const RIM = 11;                 // bevel visible around the face; doubles as the resize grip area
const TITLE_H = 31, FRAME = 4, STATUS_H = 22, TASKBAR_H = 40;
const ZSTEP = 1;                // depth between stacked windows (perspective is compensated per window)
const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t;

export function createWM(stage) {
  const { THREE, CSS3DObject } = stage;
  const wins = [];                     // focus order, last = top
  const internal = new Map();          // core-provided apps (welcome, games folder, error)
  const loaded = new Map();            // id -> Promise<def>
  const pendingSingle = new Map();     // id -> Promise<Win> (single-instance apps being opened)
  const listeners = new Map();
  let cascade = 0, holdN = 0, shieldN = 0, taskRect = null, active = null;

  const holeMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, blending: THREE.NoBlending, depthWrite: true, toneMapped: false });
  const unitPlane = new THREE.PlaneGeometry(1, 1);
  const cssCamera = document.querySelector('#css3d > div > div');
  const vw = () => stage.view.w, vh = () => stage.view.h;
  const workH = () => vh() - TASKBAR_H;

  function on(ev, fn) { if (!listeners.has(ev)) listeners.set(ev, new Set()); listeners.get(ev).add(fn); return () => listeners.get(ev).delete(fn); }
  function emit(ev, ...a) { (listeners.get(ev) || []).forEach((f) => { try { f(...a); } catch (e) { console.warn(e); } }); }

  function setShield(on) {
    shieldN = Math.max(0, shieldN + (on ? 1 : -1));
    document.documentElement.classList.toggle('kz-shield', shieldN > 0);
  }
  function hold(on) { holdN = Math.max(0, holdN + (on ? 1 : -1)); stage.setHold(on); setShield(on); }

  // ------------------------------------------------------------------ app loading
  function loadCSS(id) {
    return new Promise((res) => {
      const href = new URL(`./apps/${id}.css`, import.meta.url).href;
      if (document.querySelector(`link[data-app="${id}"]`)) return res();
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = href; l.dataset.app = id;
      const done = () => { clearTimeout(to); res(); };
      const to = setTimeout(done, 2500);
      l.onload = done;
      l.onerror = () => { l.remove(); done(); };
      document.head.appendChild(l);
    });
  }
  function loadApp(id) {
    if (internal.has(id)) return Promise.resolve(internal.get(id));
    if (!ID_RE.test(id)) return Promise.reject(new Error(`"${id}" is not a valid program name.`));
    if (!loaded.has(id)) {
      const p = import(new URL(`./apps/${id}.js`, import.meta.url).href).then(async (mod) => {
        const def = mod && mod.default;
        if (!def || typeof def.mount !== 'function') throw new Error(`apps/${id}.js does not export a program.`);
        if (def.css !== false) await loadCSS(id);
        return def;
      });
      p.catch(() => loaded.delete(id)); // allow a retry later
      loaded.set(id, p);
    }
    return loaded.get(id);
  }

  // ------------------------------------------------------------------ window
  class Win {
    constructor(def, args, opts = {}) {
      this.def = def; this.id = def.id; this.args = args;
      this.resizable = def.resizable !== false;
      this.canMax = !def.noMaximize && (def.maximizable ?? this.resizable);
      this.dialog = !!def.dialog;
      this.state = 'normal'; this.shown = true; this.closing = false; this.anim = null;
      this.hasStatus = !!def.statusBar;
      let [cw, ch] = Array.isArray(def.size) ? def.size : [480, 360];
      const [mw, mh] = Array.isArray(def.minSize) ? def.minSize : [Math.min(cw, 240), Math.min(ch, 140)];
      this.min = { w: Math.max(160, mw + 2 * FRAME), h: TITLE_H + mh + FRAME };
      this.auto = def.size === 'auto';
      this.buildDom(def);
      // three-side objects
      this.cssObj = new CSS3DObject(this.el);
      this.el.style.userSelect = '';
      cssCamera.appendChild(this.el); // its final parent from the start: CSS3DRenderer will never move it
      stage.cssScene.add(this.cssObj);
      this.slabMat = stage.slabMaterial(); this.slabMat.transparent = true;
      this.catchMat = new THREE.ShadowMaterial({ color: 0x0a1430, opacity: 0.30 });
      this.slab = new THREE.Mesh(new THREE.BufferGeometry(), this.slabMat); this.slab.receiveShadow = true; this.slab.renderOrder = 0;
      this.hole = new THREE.Mesh(new THREE.BufferGeometry(), holeMat); this.hole.renderOrder = 1;
      this.catcher = new THREE.Mesh(unitPlane, this.catchMat); this.catcher.position.z = 0.5; this.catcher.receiveShadow = true; this.catcher.renderOrder = 2;
      this.fx = new THREE.Group(); this.fx.add(this.slab, this.hole, this.catcher);
      stage.fxScene.add(this.fx);
      this.proxy = new THREE.Mesh(stage.boxGeo, stage.proxyMat); this.proxy.castShadow = true; this.proxy.layers.set(stage.layers.SHADOW);
      this.sh = new THREE.Group(); this.sh.add(this.proxy);
      stage.scene.add(this.sh);
      this.pose = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), s: 1, op: 1 };
      this.geoW = 0; this.geoH = 0;

      // size + place
      this.mountApp(args);
      if (this.pendingSize) [cw, ch] = this.pendingSize; // ctx.resize() during mount
      let fw = cw + 2 * FRAME, fh = TITLE_H + ch + FRAME + (this.statusEl ? STATUS_H : 0);
      if (this.auto) {
        this.face.style.height = 'auto';
        const fixedW = opts.width || def.width;
        if (fixedW) this.face.style.width = Math.min(fixedW, vw() - 16) + 'px';
        else if (stage.mobile && this.dialog) this.face.style.width = Math.min(600, vw() - 16) + 'px';
        fw = this.face.offsetWidth; fh = this.face.offsetHeight;
      }
      const maxW = vw() - 16, maxH = workH() - 8;
      if (stage.mobile && this.dialog) fw = Math.min(fw, vw() - 16);
      fw = Math.min(fw, Math.max(this.min.w, maxW)); fh = Math.min(fh, Math.max(this.min.h, maxH));
      let x, y;
      if (opts.rect) ({ x, y } = opts.rect);
      else if (def.position === 'hero') { x = Math.round(vw() / 2 - fw / 2); y = Math.round(vh() / 2 - 70 - fh / 2); }
      else if (this.dialog) { x = Math.round(vw() / 2 - fw / 2); y = Math.round(workH() / 2 - fh / 2 - 20); }
      else {
        const visible = wins.filter((w) => w.shown && !w.dialog && !w.closing).length;
        if (!visible) cascade = 0;
        const off = (cascade++ % 7) * 26;
        x = Math.round((vw() - fw) / 2 - 78 + off); y = Math.round((workH() - fh) / 2 - 52 + off);
      }
      this.rect = { x, y, w: Math.round(fw), h: Math.round(fh) };
      this.clampRect(this.rect);
      this.applySize();
      if ((stage.mobile && !this.dialog) || opts.maximized) this.maximize(true);
      wins.push(this);
      restack();
      // open: fly out of the icon / taskbar / start menu with a slight rotation
      if (opts.instant || stage.shot) { this.applyPose(this.restPose()); }
      else this.animate(this.fromPose(opts), null, 430, easeOut);
      emit('open', this);
      focus(this);
    }

    // ---------------- DOM
    buildDom(def) {
      const el = document.createElement('div');
      el.className = `kz-win kz-win-${def.id}` + (this.dialog ? ' dialog' : '') + (this.resizable ? '' : ' fixed');
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-label', def.title || def.id);
      el.style.padding = RIM + 'px';
      const face = document.createElement('div');
      face.className = 'xpwin kz-face';
      const tb = document.createElement('div');
      tb.className = 'titlebar';
      const ti = document.createElement('span'); ti.className = 'ticon'; ti.appendChild(stage.icon(def.icon || def.id, 18));
      const tt = document.createElement('span'); tt.className = 'title'; tt.textContent = def.title || def.id;
      const caps = document.createElement('div'); caps.className = 'caps';
      const mk = (cls, label, fn) => {
        const b = document.createElement('button'); b.className = 'cap ' + cls; b.setAttribute('aria-label', label); b.title = label;
        b.addEventListener('click', (e) => { e.stopPropagation(); stage.sound.play('click'); fn(); });
        b.addEventListener('pointerdown', (e) => e.stopPropagation());
        caps.appendChild(b); return b;
      };
      if (!def.noMinimize) mk('min', 'Minimise', () => this.minimize());
      if (!def.noMaximize) this.maxBtn = mk('max', 'Maximise', () => this.toggleMax());
      mk('close', 'Close', () => this.close());
      tb.append(ti, tt, caps);
      const client = document.createElement('div'); client.className = 'kz-client';
      const root = document.createElement('div'); root.className = `app-root app-${def.id}`;
      client.appendChild(root);
      face.append(tb, client);
      el.appendChild(face);
      this.el = el; this.face = face; this.titleEl = tt; this.client = client; this.root = root;
      if (this.hasStatus) this.addStatus();
      // resize grips live on the rim
      if (this.resizable) for (const d of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
        const g = document.createElement('div'); g.className = 'kz-grip ' + d; g.dataset.dir = d;
        g.addEventListener('pointerdown', (e) => this.startResize(e, d));
        el.appendChild(g);
      }
      el.addEventListener('pointerdown', () => focus(this), { capture: true });
      // iframe loads (capture: load does not bubble) end the busy cursor early
      el.addEventListener('load', (e) => { if (e.target && e.target.tagName === 'IFRAME') { this.frameLoaded = true; this.onFrameLoad && this.onFrameLoad(); } }, true);
      tb.addEventListener('pointerdown', (e) => this.startDrag(e));
      tb.addEventListener('dblclick', (e) => { if (!e.target.closest('.cap')) this.toggleMax(); });
      el.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.dialog) { e.stopPropagation(); this.close(); } });
    }
    addStatus() {
      if (this.statusEl) return;
      const s = document.createElement('div'); s.className = 'xp-statusbar kz-status';
      const t = document.createElement('span'); t.className = 'xp-status-cell'; s.appendChild(t);
      this.face.appendChild(s);
      this.statusEl = s; this.statusText = t;
    }

    mountApp(args) {
      const win = this;
      const ctx = this.ctx = {
        args,
        openApp: (id, a) => open(id, a, { fromWin: win }),
        setTitle: (t) => win.setTitle(t),
        close: () => win.close(),
        setStatus: (s) => win.setStatus(s),
        site: stage.site(),
        icon: (key, px = 16) => stage.icon(key, px),
        sound: (name) => stage.sound.play(name),
        isMobile: !!stage.mobile,
        shield: (on) => setShield(!!on),
        // optional extension: ask for a new content size (CSS px); core clamps it to the screen
        resize: (w, h) => win.setContentSize(w, h),
      };
      try {
        const r = this.def.mount(this.root, ctx);
        if (r && typeof r.then === 'function') r.then((x) => { this.inst = x || {}; this.notifyResize(); }, (e) => this.crash(e));
        else this.inst = r || {};
      } catch (e) {
        this.inst = {};
        queueMicrotask(() => this.crash(e));
      }
    }
    crash(e) {
      console.warn(`[kayzee-xp] ${this.id} crashed:`, e);
      const title = this.def.title || this.id;
      this.close(true);
      showError(`${title} has encountered a problem and needs to close.`, String((e && e.message) || e || ''));
    }

    setTitle(t) { this.titleEl.textContent = t; this.el.setAttribute('aria-label', t); emit('title', this); }
    get title() { return this.titleEl.textContent; }
    setStatus(text) {
      if (!this.statusEl) {
        this.addStatus();
        if (!this.rect) { /* still mounting: the constructor sizes the window with the bar */ }
        else if (this.state === 'max') this.notifyResize();
        else { this.rect.h += STATUS_H; this.clampRect(this.rect); this.applySize(); }
      }
      this.statusText.textContent = text == null ? '' : String(text);
    }

    setContentSize(cw, ch) {
      if (!(cw > 0) || !(ch > 0)) return;
      if (!this.rect) { this.pendingSize = [Math.round(cw), Math.round(ch)]; return; }
      if (this.state === 'max') return;
      const w = Math.round(cw + 2 * FRAME), hh = Math.round(TITLE_H + ch + FRAME + (this.statusEl ? STATUS_H : 0));
      const r = this.rect, cx = r.x + r.w / 2;
      this.rect = this.clampRect({ x: Math.round(cx - w / 2), y: r.y, w, h: hh });
      this.applySize();
    }

    // ---------------- geometry
    contentSize() { return [this.rect.w - 2 * FRAME, this.rect.h - TITLE_H - FRAME - (this.statusEl ? STATUS_H : 0)]; }
    clampRect(r) {
      r.w = Math.max(this.min.w, Math.min(r.w, vw())); r.h = Math.max(this.min.h, Math.min(r.h, workH()));
      r.x = Math.round(Math.min(Math.max(r.x, -(r.w - 90)), vw() - 90));
      r.y = Math.round(Math.min(Math.max(r.y, 0), workH() - TITLE_H));
      return r;
    }
    applySize() {
      const { w, h } = this.rect;
      if (w !== this._dw || h !== this._dh) {
        this.face.style.width = w + 'px';
        this.face.style.height = h + 'px';
        this.el.style.width = (w + 2 * RIM) + 'px';
        this.el.style.height = (h + 2 * RIM) + 'px';
        this._dw = w; this._dh = h;
        this.geoDirty = true;
        this.notifyResize();
      }
      this.updateGeometry();
      if (!this.anim) this.applyPose(this.restPose());
    }
    notifyResize() {
      const [cw, ch] = this.contentSize();
      if (this.inst && typeof this.inst.onResize === 'function') { try { this.inst.onResize(cw, ch); } catch (e) { console.warn(e); } }
    }
    updateGeometry() {
      if (!this.geoDirty) return;
      this.geoDirty = false;
      const { w, h } = this.rect;
      if (w === this.geoW && h === this.geoH) return;
      this.geoW = w; this.geoH = h;
      this.slab.geometry.dispose(); this.slab.geometry = stage.slabGeometry(w, h);
      this.hole.geometry.dispose(); this.hole.geometry = stage.faceGeometry(w, h);
      this.catcher.scale.set(w, h, 1);
      const S = stage.SLAB;
      this.proxy.scale.set(w + 2 * S.bevelS, h + 2 * S.bevelS, stage.SLAB_TOTAL);
      this.proxy.position.set(0, 0, -stage.SLAB_TOTAL / 2 - 0.8);
      stage.markFx(); stage.markShadow();
    }
    z() { return Math.max(0, wins.indexOf(this)) * ZSTEP; }
    restPose(out = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), s: 1, op: 1 }) {
      const z = this.z();
      const { x, y, w, h } = this.rect;
      stage.deskToWorld(x + w / 2, y + h / 2, z, out.pos);
      out.quat.identity(); out.s = stage.desk.scaleAt(z); out.op = 1;
      return out;
    }
    applyPose(p) {
      const P = this.pose;
      if (p !== P) { P.pos.copy(p.pos); P.quat.copy(p.quat); P.s = p.s; P.op = p.op; }
      for (const o of [this.cssObj, this.fx, this.sh]) { o.position.copy(P.pos); o.quaternion.copy(P.quat); o.scale.setScalar(P.s); }
      const op = Math.max(0, Math.min(1, P.op));
      if (op !== this._op) {
        this._op = op;
        this.el.style.opacity = op >= 0.999 ? '' : op.toFixed(3);
        this.slabMat.opacity = op; this.catchMat.opacity = 0.30 * op;
        this.slabMat.depthWrite = op > 0.98;
      }
      stage.markCss(); stage.markFx(); stage.markShadow();
    }
    fromPose(opts) {
      const rest = this.restPose();
      const p = { pos: rest.pos.clone(), quat: new THREE.Quaternion(), s: rest.s, op: 0 };
      const fw = this.rect.w;
      if (opts.from && opts.from.pos) {
        const z = opts.from.pos.z;
        p.pos.copy(opts.from.pos);
        p.s = Math.max(0.05, (opts.from.px || 120) / fw) * stage.desk.scaleAt(z);
        if (opts.from.quat) p.quat.copy(opts.from.quat).slerp(new THREE.Quaternion(), 0.35);
        p.op = 0.15;
      } else if (opts.fromRect) {
        const r = opts.fromRect;
        stage.deskToWorld(r.left + r.width / 2, r.top + r.height / 2, rest.pos.z, p.pos);
        p.s = rest.s * Math.max(0.08, Math.min(0.4, r.width / fw));
        p.quat.setFromEuler(new THREE.Euler(0.35, 0.12, 0));
      } else {
        p.s = rest.s * 0.82;
        p.quat.setFromEuler(new THREE.Euler(0.16, -0.22, 0.02));
      }
      return p;
    }
    // animate from pose `a` to pose `b` (b = null -> the live rest pose, so focus/z changes mid-flight are honoured)
    animate(a, b, dur, ease, done) {
      this.anim = { a: { pos: a.pos.clone(), quat: a.quat.clone(), s: a.s, op: a.op }, b, t0: performance.now(), dur, ease, done };
      this.applyPose(a);
    }
    tick(now) {
      const A = this.anim;
      if (this.geoDirty) this.updateGeometry();
      if (!A) return;
      const t = Math.min(1, (now - A.t0) / A.dur), e = A.ease(t);
      const b = A.b || this.restPose(this._tmp || (this._tmp = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), s: 1, op: 1 }));
      const P = this.pose;
      P.pos.lerpVectors(A.a.pos, b.pos, e);
      P.quat.slerpQuaternions(A.a.quat, b.quat, e);
      P.s = A.a.s + (b.s - A.a.s) * e;
      P.op = A.a.op + (b.op - A.a.op) * Math.min(1, e * 1.6);
      this.applyPose(P);
      if (t >= 1) { this.anim = null; if (!A.b) this.applyPose(this.restPose()); A.done && A.done(); }
    }

    // ---------------- states
    setActive(on) {
      this.el.classList.toggle('inactive', !on);
      if (this.inst) {
        const f = on ? this.inst.onFocus : this.inst.onBlur;
        if (typeof f === 'function') { try { f.call(this.inst); } catch (e) { console.warn(e); } }
      }
    }
    minimize() {
      if (!this.shown || this.closing) return;
      stage.sound.play('minimize');
      this.shown = false;
      const tr = taskRect && taskRect(this);
      const to = this.restPose();
      if (tr) stage.deskToWorld(tr.left + tr.width / 2, tr.top + tr.height / 2, to.pos.z, to.pos);
      else to.pos.y -= vh() / 2;
      to.s *= Math.max(0.06, (tr ? tr.width : 160) / this.rect.w) * 0.8;
      to.quat.setFromEuler(new THREE.Euler(0.5, 0, 0)); to.op = 0;
      this.el.style.pointerEvents = 'none';
      this.animate(this.pose, to, 240, easeIn, () => {
        this.el.style.visibility = 'hidden'; this.fx.visible = false; this.sh.visible = false;
        stage.markFx(); stage.markShadow();
      });
      emit('state', this);
      if (active === this) focusTop();
    }
    restore() {
      if (this.shown || this.closing) { focus(this); return; }
      stage.sound.play('restore');
      this.shown = true;
      this.el.style.visibility = ''; this.el.style.pointerEvents = 'auto'; this.fx.visible = true; this.sh.visible = true;
      const tr = taskRect && taskRect(this);
      const from = this.restPose();
      if (tr) stage.deskToWorld(tr.left + tr.width / 2, tr.top + tr.height / 2, from.pos.z, from.pos);
      from.s *= Math.max(0.06, (tr ? tr.width : 160) / this.rect.w) * 0.8;
      from.quat.setFromEuler(new THREE.Euler(0.5, 0, 0)); from.op = 0;
      this.animate(from, null, 260, easeOut);
      emit('state', this);
      focus(this);
    }
    maximize(instant) {
      if (this.state === 'max' || !this.canMax) return;
      this.restoreRect = { ...this.rect };
      this.state = 'max';
      this.el.classList.add('max');
      if (this.maxBtn) { this.maxBtn.classList.add('restore'); this.maxBtn.setAttribute('aria-label', 'Restore'); this.maxBtn.title = 'Restore'; }
      this.rect = { x: 0, y: 0, w: vw(), h: workH() };
      this.applySize();
      if (!instant) this.pop();
      emit('state', this);
    }
    unmaximize() {
      if (this.state !== 'max') return;
      this.state = 'normal';
      this.el.classList.remove('max');
      if (this.maxBtn) { this.maxBtn.classList.remove('restore'); this.maxBtn.setAttribute('aria-label', 'Maximise'); this.maxBtn.title = 'Maximise'; }
      const r = this.restoreRect || { x: 60, y: 40, w: Math.min(vw() - 120, 640), h: Math.min(workH() - 80, 460) };
      this.rect = this.clampRect({ ...r });
      this.applySize();
      this.pop();
      emit('state', this);
    }
    toggleMax() {
      if (!this.canMax) return;
      if (stage.mobile && !this.dialog) return; // phones keep apps maximised
      this.state === 'max' ? this.unmaximize() : this.maximize();
    }
    pop() { const a = this.restPose(); a.s *= 0.985; this.animate(a, null, 160, easeOut); }
    close(silent) {
      if (this.closing) return;
      this.closing = true;
      if (!silent) stage.sound.play('close');
      const to = this.restPose(); to.s *= 0.94; to.op = 0;
      this.el.style.pointerEvents = 'none';
      const finish = () => this.dispose();
      if (!this.shown || stage.shot) finish(); else this.animate(this.pose, to, 150, easeIn, finish);
      emit('closing', this);
      if (active === this) { active = null; focusTop(this); }
    }
    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      this.anim = null;
      try { this.inst && typeof this.inst.unmount === 'function' && this.inst.unmount(); } catch (e) { console.warn(e); }
      stage.cssScene.remove(this.cssObj); this.el.remove();
      stage.fxScene.remove(this.fx); stage.scene.remove(this.sh);
      this.slab.geometry.dispose(); this.hole.geometry.dispose(); this.slabMat.dispose(); this.catchMat.dispose();
      const i = wins.indexOf(this); if (i >= 0) wins.splice(i, 1);
      if (this.dragging || this.resizing) hold(false);
      restack();
      emit('close', this);
      stage.markFx(); stage.markShadow(); stage.markCss();
    }

    // ---------------- drag / resize (pointer-captured, integer px)
    startDrag(e) {
      if (e.button !== 0 || e.target.closest('.cap') || this.state === 'max') return;
      e.preventDefault();
      const tb = e.currentTarget;
      tb.setPointerCapture(e.pointerId);
      const sx = e.clientX, sy = e.clientY, r0 = { ...this.rect };
      this.dragging = true; hold(true);
      document.documentElement.classList.add('kz-dragging');
      const move = (ev) => {
        this.rect.x = Math.round(r0.x + ev.clientX - sx); this.rect.y = Math.round(r0.y + ev.clientY - sy);
        this.clampRect(this.rect);
        if (!this.anim) this.applyPose(this.restPose());
      };
      const up = () => {
        tb.removeEventListener('pointermove', move); tb.removeEventListener('pointerup', up); tb.removeEventListener('pointercancel', up);
        this.dragging = false; hold(false);
        document.documentElement.classList.remove('kz-dragging');
      };
      tb.addEventListener('pointermove', move); tb.addEventListener('pointerup', up); tb.addEventListener('pointercancel', up);
    }
    startResize(e, dir) {
      if (e.button !== 0 || this.state === 'max') return;
      e.preventDefault(); e.stopPropagation();
      focus(this);
      const g = e.currentTarget;
      g.setPointerCapture(e.pointerId);
      const sx = e.clientX, sy = e.clientY, r0 = { ...this.rect };
      this.resizing = true; hold(true);
      document.documentElement.classList.add('kz-dragging');
      const move = (ev) => {
        const dx = Math.round(ev.clientX - sx), dy = Math.round(ev.clientY - sy);
        let { x, y, w, h } = r0;
        if (dir.includes('e')) w = r0.w + dx;
        if (dir.includes('s')) h = r0.h + dy;
        if (dir.includes('w')) { w = r0.w - dx; }
        if (dir.includes('n')) { h = r0.h - dy; }
        w = Math.max(this.min.w, Math.min(w, vw())); h = Math.max(this.min.h, Math.min(h, workH()));
        if (dir.includes('w')) x = r0.x + (r0.w - w);
        if (dir.includes('n')) { y = r0.y + (r0.h - h); if (y < 0) { h += y; y = 0; } }
        this.rect = { x, y, w, h };
        this.applySize();
      };
      const up = () => {
        g.removeEventListener('pointermove', move); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up);
        this.resizing = false; hold(false);
        document.documentElement.classList.remove('kz-dragging');
      };
      g.addEventListener('pointermove', move); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
    }
  }

  // ------------------------------------------------------------------ stacking / focus
  function restack() {
    wins.forEach((w) => { if (!w.anim && !w.closing) w.applyPose(w.restPose()); });
    stage.markCss(); stage.markFx(); stage.markShadow();
  }
  function focus(win) {
    if (!win || win.closing) return;
    if (!win.shown) { win.restore(); return; }
    const i = wins.indexOf(win);
    if (i >= 0 && i !== wins.length - 1) { wins.splice(i, 1); wins.push(win); restack(); }
    if (active !== win) {
      const prev = active;
      active = win;
      if (prev && !prev.closing) prev.setActive(false);
      win.setActive(true);
      emit('focus', win);
    }
  }
  function focusTop(except) {
    for (let i = wins.length - 1; i >= 0; i--) {
      const w = wins[i];
      if (w !== except && w.shown && !w.closing) { focus(w); return; }
    }
    if (active && (active === except || !active.shown)) { active.setActive(false); }
    active = null;
    emit('focus', null);
  }
  // clicking into an iframe never reaches our pointer handlers: watch for the focus moving into one
  addEventListener('blur', () => setTimeout(() => {
    const a = document.activeElement;
    if (a && a.tagName === 'IFRAME') { const w = wins.find((x) => x.el.contains(a)); if (w) focus(w); }
  }, 0));
  // clicking empty desktop deactivates (XP keeps the title bar blue only on the active window)
  addEventListener('pointerdown', (e) => {
    if (e.target.closest && e.target.closest('.kz-win, #taskbar, .kz-menu, .kz-popup, .kz-balloon, .kz-screen')) return;
    if (active) { active.setActive(false); active = null; emit('focus', null); }
  });

  stage.onFrame((now) => { for (const w of wins.slice()) w.tick(now); });

  // ------------------------------------------------------------------ public API
  // "working in background" cursor from the request until the program has mounted (min ~700 ms, longer while iframes load)
  let busyN = 0;
  function busyStart() {
    busyN++; document.documentElement.classList.add('kz-busy');
    const t0 = performance.now(); let done = false;
    return (minMs = 700) => {
      if (done) return; done = true;
      setTimeout(() => { busyN = Math.max(0, busyN - 1); if (!busyN) document.documentElement.classList.remove('kz-busy'); }, Math.max(0, minMs - (performance.now() - t0)));
    };
  }
  function whenSettled(win) {
    return new Promise((res) => setTimeout(() => {
      if (!win || win.disposed || !win.root.querySelector('iframe') || win.frameLoaded) return res(700);
      const to = setTimeout(() => res(900), 2500);
      win.onFrameLoad = () => { clearTimeout(to); res(1000); };
    }, 90));
  }
  async function open(id, args, opts = {}) {
    let def;
    const endBusy = busyStart();
    try { def = await loadApp(id); }
    catch (e) {
      endBusy(0);
      console.warn(`[kayzee-xp] could not load ${id}:`, e);
      showError(`Kayzee XP cannot find '${id}'. Make sure you typed the name correctly, and then try again.`, `apps/${id}.js could not be loaded.`);
      return null;
    }
    if (def.single !== false) {
      const ex = wins.find((w) => w.id === id && !w.closing);
      if (ex) {
        endBusy(350);
        if (args !== undefined) {
          ex.args = args; ex.ctx.args = args;
          if (ex.inst && typeof ex.inst.onArgs === 'function') { try { ex.inst.onArgs(args); } catch (e) { console.warn(e); } }
        }
        ex.shown ? focus(ex) : ex.restore();
        return ex;
      }
      if (pendingSingle.has(id)) { endBusy(350); return pendingSingle.get(id); }
    }
    const settle = (w) => { whenSettled(w).then((ms) => endBusy(ms)); return w; };
    if (def.single !== false) {
      // a second request for the same single app in the same tick reuses this one
      const p = Promise.resolve().then(() => settle(create(def, args, opts)));
      pendingSingle.set(id, p);
      p.catch(() => endBusy(0)).finally(() => pendingSingle.delete(id));
      return p;
    }
    try { return settle(create(def, args, opts)); } catch (e) { endBusy(0); throw e; }
  }
  function create(def, args, opts) {
    if (!opts.silent) stage.sound.play('open');
    return new Win(def, args, opts);
  }
  function openInternal(id, opts = {}) { return create(internal.get(id), opts.args, opts); }
  function showError(message, detail) {
    stage.sound.play('error');
    return create(internal.get('error'), { message, detail }, { silent: true });
  }
  function register(def) { internal.set(def.id, def); }
  // build a window face off-screen and measure it (used once to aim the hero cursor at the welcome button)
  function measure(id, sel) {
    const def = internal.get(id);
    const box = document.createElement('div');
    box.className = 'kz-win dialog';
    box.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden;padding:0;';
    const face = document.createElement('div'); face.className = 'xpwin kz-face';
    face.innerHTML = '<div class="titlebar"><span class="ticon"></span><span class="title">x</span><div class="caps"><button class="cap min"></button><button class="cap max"></button><button class="cap close"></button></div></div>';
    const client = document.createElement('div'); client.className = 'kz-client';
    const root = document.createElement('div'); root.className = `app-root app-${id}`;
    client.appendChild(root); face.appendChild(client); box.appendChild(face);
    document.body.appendChild(box);
    def.mount(root, { args: {}, openApp() {}, setTitle() {}, close() {}, setStatus() {}, site: stage.site(), icon: stage.icon, sound() {}, isMobile: !!stage.mobile, shield() {} });
    face.style.height = 'auto';
    const fr = face.getBoundingClientRect(), er = face.querySelector(sel).getBoundingClientRect();
    const out = { w: face.offsetWidth, h: face.offsetHeight, rect: { left: er.left - fr.left, top: er.top - fr.top, width: er.width, height: er.height } };
    box.remove();
    return out;
  }
  function onViewport() {
    for (const w of wins) {
      if (w.state === 'max') { w.rect = { x: 0, y: 0, w: vw(), h: workH() }; }
      else w.clampRect(w.rect);
      w.applySize();
      if (!w.anim) w.applyPose(w.restPose());
    }
  }
  function closeAll() { for (const w of wins.slice()) { w.close(true); if (!w.disposed) w.dispose(); } }

  return {
    open, openInternal, register, measure, showError, focus, closeAll, onViewport, on,
    list: () => wins.filter((w) => !w.closing),
    active: () => active,
    setTaskRect(fn) { taskRect = fn; },
    shield: setShield,
    blocksParallax: () => holdN > 0 || wins.some((w) => w.shown && !w.closing && w.state === 'max'),
    fxGroups() {
      const vis = wins.filter((w) => w.shown || w.anim);
      vis.sort((a, b) => (a.pose.pos.z - b.pose.pos.z) || (wins.indexOf(a) - wins.indexOf(b)));
      return vis.filter((w) => w.fx.visible).map((w) => w.fx);
    },
    RIM, TITLE_H, FRAME, TASKBAR_H,
  };
}
