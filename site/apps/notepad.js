// Notepad: a plain text window. Ships with Welcome.txt (a short guide for recruiters).
import { h, setupRoot, menubar, statusbar, msgbox, downloadBlob } from './projects.kit.js';

const WELCOME = (name = 'Kshitiz Mittal', nick = 'Kayzee') => `Welcome to ${nick} XP
${'='.repeat(`Welcome to ${nick} XP`.length)}

Hi, I'm ${name} ("${nick}"), a PR, content and brand storytelling graduate based in Dundalk, Ireland.

If you're here to hire, double-click any of these on the desktop:

  My Resume     my full CV, ready to print or save
  My Projects   campaign, event and brand work
  Contact Me    send me a message, I'll reply by email

Tip: the Start menu has games. Mines is good for a coffee break.

Thanks for stopping by,
${name.split(' ')[0]}
`;

/** Built-in documents other apps can open by name: ctx.openApp('notepad', { file: 'Welcome.txt' }) */
export const DOCS = {
  'Welcome.txt': (s) => WELCOME(s.displayName || undefined, s.nickname || undefined),
};

function untitled() { return { name: 'Untitled.txt', text: '' }; }

export default {
  id: 'notepad',
  title: 'Notepad',
  icon: 'notepad',
  size: [580, 420],
  minSize: [280, 200],
  single: false,
  resizable: true,
  mount(root, ctx) {
    const bag = setupRoot(root);
    let doc = untitled();
    let saved = '';
    let wrap = true;

    const ta = h('textarea', { class: 'np-text', spellcheck: 'false', 'aria-label': 'Document text', wrap: 'soft' });
    const status = statusbar([{ text: '', flex: true }, { text: 'Ln 1, Col 1', width: 130 }]);
    status.hidden = false;

    const menus = menubar([
      { label: '&File', items: [
        { label: '&New', shortcut: 'Ctrl+N', action: () => guard(() => load(untitled())) },
        { label: 'Save &As...', shortcut: 'Ctrl+S', action: () => saveAs() },
        { sep: true },
        { label: 'E&xit', action: () => guard(() => ctx.close()) },
      ] },
      { label: '&Edit', items: [
        { label: '&Undo', shortcut: 'Ctrl+Z', action: () => cmd('undo') },
        { sep: true },
        { label: 'Cu&t', shortcut: 'Ctrl+X', action: () => cmd('cut') },
        { label: '&Copy', shortcut: 'Ctrl+C', action: () => cmd('copy') },
        { label: '&Paste', shortcut: 'Ctrl+V', action: () => paste() },
        { label: 'De&lete', shortcut: 'Del', action: () => cmd('delete') },
        { sep: true },
        { label: 'Select &All', shortcut: 'Ctrl+A', action: () => { ta.focus(); ta.select(); } },
        { label: 'Time/&Date', shortcut: 'F5', action: () => insertDate() },
      ] },
      { label: 'F&ormat', items: [
        { label: '&Word Wrap', checked: () => wrap, action: () => setWrap(!wrap) },
      ] },
      { label: '&View', items: [
        { label: '&Status Bar', checked: () => !status.hidden, action: () => { status.hidden = !status.hidden; } },
      ] },
      { label: '&Help', items: [
        { label: '&About Notepad', action: () => msgbox(root, { title: 'About Notepad', icon: 'info32', text: 'Notepad, version 1.0\n\nPart of Kayzee XP. Plain text, no fuss.' }) },
      ] },
    ], { logo: false });

    root.append(menus, h('div', { class: 'np-wrap' }, ta), status);

    function title() { ctx.setTitle(`${doc.name} - Notepad`); }
    function load(d) {
      doc = { name: d.name || 'Untitled.txt', text: d.text || '' };
      ta.value = doc.text; saved = doc.text;
      ta.scrollTop = 0; ta.setSelectionRange(0, 0);
      title(); caret();
    }
    async function guard(next) {
      if (ta.value === saved) return next();
      const r = await msgbox(root, { title: 'Notepad', icon: 'warn32', text: `The text in ${doc.name} has changed.\n\nDo you want to save the changes?`, buttons: ['Yes', 'No', 'Cancel'] });
      if (r === 0) { saveAs(); next(); } else if (r === 1) next();
    }
    function saveAs() {
      const name = /\.txt$/i.test(doc.name) ? doc.name : doc.name.replace(/\.[^.]+$/, '') + '.txt';
      downloadBlob(new Blob([ta.value.replace(/\n/g, '\r\n')], { type: 'text/plain;charset=utf-8' }), name);
      saved = ta.value;
      status.set(0, `Saved ${name} to your Downloads`);
    }
    function cmd(c) { ta.focus(); try { document.execCommand(c); } catch (_) { /* */ } caret(); }
    function paste() {
      ta.focus();
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then((t) => { document.execCommand('insertText', false, t); caret(); })
          .catch(() => status.set(0, 'Use Ctrl+V to paste'));
      } else status.set(0, 'Use Ctrl+V to paste');
    }
    function insertDate() {
      const d = new Date();
      const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + ' ' + d.toLocaleDateString();
      ta.focus(); document.execCommand('insertText', false, t); caret();
    }
    function setWrap(on) {
      wrap = on; ta.setAttribute('wrap', on ? 'soft' : 'off'); root.classList.toggle('np-nowrap', !on);
    }
    function caret() {
      const pos = ta.selectionStart || 0;
      const before = ta.value.slice(0, pos);
      const ln = before.split('\n').length;
      const col = pos - before.lastIndexOf('\n');
      status.set(1, `Ln ${ln}, Col ${col}`);
    }
    ['keyup', 'click', 'input', 'select'].forEach((t) => bag.on(ta, t, caret));
    bag.on(ta, 'input', () => status.set(0, ''));
    bag.on(root, 'keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveAs(); }
      else if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); guard(() => load(untitled())); }
      else if (e.key === 'F5') { e.preventDefault(); insertDate(); }
    });

    // ---- initial document
    const a = ctx.args || {};
    const f = a.file;
    let alive = true;
    if (f && typeof f === 'object') load({ name: f.name, text: f.text });
    else if (typeof a.text === 'string') load({ name: a.name || 'Untitled.txt', text: a.text });
    else {
      const name = typeof f === 'string' ? f : 'Welcome.txt';
      if (DOCS[name]) {
        load({ name, text: DOCS[name]({}) });
        ctx.site.then((site) => {
          if (!alive || ta.value !== saved) return; // don't clobber edits
          load({ name, text: DOCS[name]((site && site.settings) || {}) });
        }).catch(() => {});
      } else load({ name, text: '' });
    }
    requestAnimationFrame(() => { if (!ctx.isMobile) ta.focus({ preventScroll: true }); ta.setSelectionRange(0, 0); });

    return {
      unmount() { alive = false; bag.dispose(); },
    };
  },
};
