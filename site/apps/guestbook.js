// Guestbook: a visitors' book. Reads /api/guestbook, signs with POST /api/guestbook.
// Entries may wait for approval; the visitor's own entry is kept in localStorage so it still shows next time.
import { h, setupRoot, statusbar } from './projects.kit.js';

const MAX = { name: 40, from: 60, msg: 240 };
const MINE_KEY = 'kz.gb.mine';
const DAY = 864e5;
const LINK_RE = /https?:\/\/|www\./i;

function readMine() {
  try {
    const v = JSON.parse(localStorage.getItem(MINE_KEY) || '[]');
    return Array.isArray(v) ? v.filter((e) => e && typeof e.id === 'string' && typeof e.msg === 'string' && typeof e.ts === 'number') : [];
  } catch (_) { return []; }
}
function writeMine(list) {
  try { localStorage.setItem(MINE_KEY, JSON.stringify(list.slice(0, 5))); } catch (_) { /* private mode: only this visit */ }
}
function when(ts) {
  try { return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch (_) { return ''; }
}

export default {
  id: 'guestbook',
  title: 'Guestbook',
  icon: 'notepad',
  size: [520, 480],
  minSize: [300, 340],
  single: true,
  resizable: true,
  mount(root, ctx) {
    const bag = setupRoot(root);
    if (ctx.isMobile) root.classList.add('gb-mobile');
    let alive = true;
    let entries = null;     // approved entries from the server (null = not loaded yet)
    let mine = readMine();  // this visitor's own entries that the server does not show (yet)
    let loadError = false;
    let sending = false;
    let nick = 'Kayzee';

    // ---- the book
    const lead = h('p', { class: 'gb-lead' });
    const list = h('ol', { class: 'gb-list', 'aria-label': 'Signed entries' });
    const note = h('div', { class: 'gb-note', role: 'status' });
    const book = h('div', { class: 'gb-book xp-scroll', tabindex: '0', 'aria-label': 'Guestbook pages' },
      h('div', { class: 'gb-head' }, h('span', { class: 'gb-head-ico' }), h('div', {}, h('h2', { class: 'gb-title', text: 'Visitors\' book' }), lead)),
      note, list);
    try { const ic = ctx.icon && ctx.icon('notepad', 32); if (ic) book.querySelector('.gb-head-ico').append(ic); } catch (_) { /* no icon */ }

    // ---- the form
    const name = h('input', { class: 'xp-input', id: 'gb-name', type: 'text', name: 'name', maxlength: String(MAX.name), autocomplete: 'name', placeholder: 'Your name' });
    const from = h('input', { class: 'xp-input', id: 'gb-from', type: 'text', name: 'from', maxlength: String(MAX.from), autocomplete: 'organization', placeholder: 'Company or city (optional)' });
    const msg = h('textarea', { class: 'xp-textarea', id: 'gb-msg', name: 'msg', rows: '2', maxlength: String(MAX.msg), placeholder: 'Say hello, leave a thought, sign off' });
    // honeypot: humans never see or fill this
    const honey = h('input', { class: 'gb-hp', type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true', value: '' });
    const counter = h('span', { class: 'gb-count', 'aria-live': 'off', text: `0 / ${MAX.msg}` });
    const err = h('p', { class: 'gb-err', role: 'alert' });
    const btn = h('button', { class: 'xp-btn default', type: 'submit', text: 'Sign the guestbook' });
    const form = h('form', { class: 'gb-form', novalidate: true, autocomplete: 'on' },
      h('fieldset', { class: 'xp-groupbox' },
        h('legend', { text: 'Sign the book' }),
        h('div', { class: 'gb-row2' },
          h('label', { class: 'gb-field', for: 'gb-name' }, h('span', { text: 'Name' }), name),
          h('label', { class: 'gb-field', for: 'gb-from' }, h('span', { text: 'From' }), from)),
        h('label', { class: 'gb-field', for: 'gb-msg' }, h('span', { class: 'gb-msg-head' }, h('span', { text: 'Message' }), counter), msg),
        honey,
        h('div', { class: 'gb-actions' }, err, btn)));
    const status = statusbar([{ text: 'Opening the book...', flex: true }]);
    root.append(book, form, status);

    // ---- render
    function row(e, pending) {
      const who = h('span', { class: 'gb-who', text: e.name || 'Someone' });
      const sig = h('div', { class: 'gb-sig' }, '— ', who);
      if (e.from) sig.append(', ', h('span', { class: 'gb-from', text: e.from }));
      sig.append(h('span', { class: 'gb-date', text: when(e.ts) }));
      return h('li', { class: 'gb-entry' + (pending ? ' pending' : '') },
        h('p', { class: 'gb-msg', text: e.msg }),
        sig,
        pending ? h('div', { class: 'gb-wait', text: `waiting for ${nick} to approve` }) : null);
    }
    function render() {
      lead.textContent = `Thanks for dropping by. Leave a line for ${nick}.`;
      const shown = entries || [];
      const ids = new Set(shown.map((e) => e.id));
      const own = mine.filter((e) => !ids.has(e.id));
      const all = [...own.map((e) => ({ e, pending: e.pending !== false })), ...shown.map((e) => ({ e, pending: false }))]
        .sort((a, b) => b.e.ts - a.e.ts);
      list.textContent = '';
      note.textContent = '';
      note.className = 'gb-note';
      for (const it of all) list.append(row(it.e, it.pending));
      if (entries === null && !loadError) {
        if (!all.length) note.textContent = 'Opening the book...';
      } else if (loadError) {
        note.classList.add('warn');
        note.append('The guestbook could not be opened just now. ', h('button', { class: 'xp-link', type: 'button', text: 'Try again', onclick: () => load() }));
        status.set(0, 'Could not load the guestbook');
      } else if (!all.length) {
        note.classList.add('empty');
        note.textContent = 'Be the first to sign.';
      }
      if (entries !== null && !loadError) {
        const n = shown.length;
        const waiting = own.filter((e) => e.pending !== false).length;
        status.set(0, (n === 1 ? '1 signature' : `${n} signatures`) + (waiting ? ', yours is waiting for approval' : ''));
      }
    }

    // ---- load
    async function load() {
      loadError = false;
      if (entries === null) render();
      let data = null;
      try {
        const r = await fetch('/api/guestbook', { headers: { Accept: 'application/json' } });
        if (r.ok) data = await r.json();
      } catch (_) { data = null; }
      if (!alive) return;
      if (!data || !Array.isArray(data.entries)) { loadError = true; render(); return; }
      entries = data.entries.filter((e) => e && typeof e.id === 'string' && typeof e.msg === 'string');
      // Forget my own copies once the approved one arrives, or when they are too old to still be waiting.
      const ids = new Set(entries.map((e) => e.id));
      const now = Date.now();
      const keep = mine.filter((e) => !ids.has(e.id) && now - e.ts < (e.pending !== false ? 30 * DAY : 10 * 60_000));
      if (keep.length !== mine.length) { mine = keep; writeMine(mine); }
      render();
    }

    // ---- sign
    const count = () => {
      const n = msg.value.length;
      counter.textContent = `${n} / ${MAX.msg}`;
      counter.classList.toggle('full', n >= MAX.msg);
    };
    function fail(text, field) {
      err.textContent = text;
      if (field) { field.classList.add('invalid'); field.focus(); }
      ctx.sound && ctx.sound('error');
    }
    async function sign() {
      if (sending) return;
      err.textContent = '';
      [name, from, msg].forEach((f) => f.classList.remove('invalid'));
      const body = { name: name.value.trim(), from: from.value.trim(), msg: msg.value.trim(), website: honey.value };
      if (!body.name) return fail('Please sign with your name.', name);
      if (!body.msg) return fail('Please write a short message.', msg);
      if (LINK_RE.test(body.msg) || LINK_RE.test(body.name) || LINK_RE.test(body.from)) return fail('Links are not allowed in the guestbook. Please take the web address out.', msg);
      sending = true;
      btn.disabled = true;
      btn.textContent = 'Signing...';
      let status_ = 0;
      let data = null;
      try {
        const r = await fetch('/api/guestbook', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
        status_ = r.status;
        data = await r.json().catch(() => null);
      } catch (_) { status_ = 0; }
      sending = false;
      if (!alive) return;
      btn.disabled = false;
      btn.textContent = 'Sign the guestbook';

      if (status_ === 200 && data && data.ok && data.entry) {
        const e = { ...data.entry, pending: data.pending === true };
        mine = [e, ...mine.filter((x) => x.id !== e.id)];
        writeMine(mine);
        if (!e.pending && entries) entries = [data.entry, ...entries];
        msg.value = '';
        count();
        render();
        book.scrollTop = 0;
        ctx.sound && ctx.sound('ding');
        status.set(0, e.pending ? `Thanks for signing! ${nick} will approve it soon.` : 'Thanks for signing!');
        return;
      }
      if (data && Array.isArray(data.errors) && data.errors.length) return fail(data.errors.join(' '));
      if (status_ === 503) return fail('The guestbook is not switched on yet. Please try again another day.');
      if (status_ === 429) return fail('That is a lot of signing in a short time. Please try again later.');
      if (status_ === 0) return fail('Could not reach the guestbook. Check your connection and try again.');
      fail('The guestbook could not save that just now. Please try again in a moment.');
    }

    bag.on(msg, 'input', count);
    [name, from, msg].forEach((f) => bag.on(f, 'input', () => { f.classList.remove('invalid'); err.textContent = ''; }));
    bag.on(form, 'submit', (e) => { e.preventDefault(); sign(); });
    bag.on(msg, 'keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); sign(); } });

    ctx.site.then((site) => {
      if (!alive) return;
      const s = (site && site.settings) || {};
      nick = s.nickname || (s.displayName || '').split(' ')[0] || nick;
      render();
    }).catch(() => {});
    render();
    load();

    return {
      unmount() { alive = false; bag.dispose(); },
    };
  },
};
