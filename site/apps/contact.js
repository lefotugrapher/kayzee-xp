// Mail ("Contact Me"): compose a message to Kshitiz. POSTs /api/contact; falls back to a prefilled mailto.
import { h, setupRoot, menubar, toolbar, statusbar, msgbox, balloon } from './projects.kit.js';

const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;
const MAX = 5000;

export default {
  id: 'contact',
  title: 'Contact Me',
  icon: 'contact',
  size: [600, 440],
  minSize: [360, 300],
  single: true,
  resizable: true,
  mount(root, ctx) {
    const bag = setupRoot(root);
    let settings = {};
    let sending = false;
    let lastField = null;

    const field = (id, label, input) => h('div', { class: 'ct-row' }, h('label', { class: 'ct-label', for: id, text: label }), input);
    const to = h('div', { class: 'ct-to xp-input', id: 'ct-to', role: 'textbox', 'aria-readonly': 'true', 'aria-label': 'To' },
      h('span', { class: 'ct-chip', text: 'Kshitiz Mittal' }));
    const from = h('input', { class: 'xp-input', id: 'ct-from', type: 'email', name: 'from', placeholder: 'Your email address', autocomplete: 'email', inputmode: 'email', spellcheck: 'false', maxlength: '254' });
    const subject = h('input', { class: 'xp-input', id: 'ct-subject', type: 'text', name: 'subject', placeholder: 'Subject of your message', maxlength: '150' });
    const message = h('textarea', { class: 'xp-textarea ct-msg', id: 'ct-message', name: 'message', placeholder: 'Write your message here', maxlength: String(MAX), 'aria-label': 'Message' });
    // honeypot: humans never see or fill this
    const honey = h('input', { class: 'ct-hp', type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true', value: '' });

    const fields = [from, subject, message];
    fields.forEach((f) => bag.on(f, 'focus', () => { lastField = f; }));

    const menus = menubar([
      { label: '&File', items: [
        { label: '&New Message', shortcut: 'Ctrl+N', action: () => newMessage() },
        { label: '&Send Message', shortcut: 'Ctrl+Enter', action: () => send(), disabled: () => sending },
        { sep: true },
        { label: '&Close', action: () => ctx.close() },
      ] },
      { label: '&Edit', items: [
        { label: 'Cu&t', shortcut: 'Ctrl+X', action: () => edit('cut') },
        { label: '&Copy', shortcut: 'Ctrl+C', action: () => edit('copy') },
        { label: '&Paste', shortcut: 'Ctrl+V', action: () => edit('paste') },
        { sep: true },
        { label: 'Select &All', shortcut: 'Ctrl+A', action: () => { (lastField || message).focus(); (lastField || message).select(); } },
      ] },
      { label: '&View', items: [
        { label: '&Status Bar', checked: () => !status.hidden, action: () => { status.hidden = !status.hidden; } },
      ] },
      { label: '&Tools', items: [
        { label: '&LinkedIn Profile', action: () => openLinkedIn(), disabled: () => !settings.linkedin },
        { label: 'Send by &Email App Instead', action: () => openMailto(buildMailto()) },
      ] },
      { label: '&Help', items: [
        { label: '&About Mail', action: () => msgbox(root, { title: 'About Mail', icon: 'info32', text: 'Mail, version 1.0\n\nMessages go straight to Kshitiz\'s inbox.\nHe usually replies within a day or two.' }) },
      ] },
    ]);
    const tools = toolbar([
      { id: 'send', icon: 'send', label: 'Send Message', action: () => send() },
      { id: 'new', icon: 'newmsg', label: 'New Message', action: () => newMessage() },
      '|',
      { id: 'cut', icon: 'cut', title: 'Cut', action: () => edit('cut') },
      { id: 'copy', icon: 'copy', title: 'Copy', action: () => edit('copy') },
      { id: 'paste', icon: 'paste', title: 'Paste', action: () => edit('paste') },
      '|',
      { id: 'linkedin', icon: 'linkedin', title: 'LinkedIn profile', action: () => openLinkedIn() },
    ]);
    // keep focus in the field when clicking cut/copy/paste
    ['cut', 'copy', 'paste'].forEach((k) => bag.on(tools.btns[k], 'pointerdown', (e) => e.preventDefault()));

    const form = h('form', { class: 'ct-form', novalidate: true, autocomplete: 'on' },
      field('ct-to', 'To:', to),
      field('ct-from', 'From:', from),
      field('ct-subject', 'Subject:', subject),
      h('div', { class: 'ct-body' }, message),
      honey);
    const status = statusbar([{ text: 'Ready', flex: true }, { text: '', width: 120 }]);
    root.append(menus, tools, form, status);

    const count = () => status.set(1, message.value.length ? `${message.value.length.toLocaleString()} / ${MAX.toLocaleString()}` : '');
    bag.on(message, 'input', count);
    fields.forEach((f) => bag.on(f, 'input', () => { f.classList.remove('invalid'); root.querySelectorAll(':scope > .kx-balloon').forEach((b) => b.kill ? b.kill() : b.remove()); }));
    bag.on(form, 'submit', (e) => { e.preventDefault(); send(); });
    bag.on(root, 'keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); send(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n' && !e.shiftKey) { e.preventDefault(); newMessage(); }
    });

    function edit(cmd) {
      const f = lastField || message;
      f.focus();
      if (cmd === 'paste') {
        if (navigator.clipboard && navigator.clipboard.readText) {
          navigator.clipboard.readText().then((t) => {
            const s = f.selectionStart ?? f.value.length, e2 = f.selectionEnd ?? s;
            f.setRangeText(t, s, e2, 'end'); f.dispatchEvent(new Event('input'));
          }).catch(() => status.set(0, 'Use Ctrl+V to paste'));
        } else status.set(0, 'Use Ctrl+V to paste');
        return;
      }
      try { document.execCommand(cmd); } catch (_) { /* */ }
    }
    function openLinkedIn() { if (settings.linkedin) window.open(settings.linkedin, '_blank', 'noopener'); }

    function isDirty() { return !!(from.value || subject.value || message.value); }
    async function newMessage() {
      if (isDirty() && !sending) {
        const r = await msgbox(root, { title: 'Mail', icon: 'warn32', text: 'Discard this message and start a new one?', buttons: ['Discard', 'Cancel'], defaultIndex: 1 });
        if (r !== 0) return;
      }
      from.value = ''; subject.value = ''; message.value = '';
      fields.forEach((f) => f.classList.remove('invalid'));
      count(); status.set(0, 'Ready');
      from.focus();
    }

    function invalid(el, title, text) {
      el.classList.add('invalid');
      el.focus();
      balloon(root, el, { title, text, icon: 'warn32', timeout: 7000 });
      ctx.sound && ctx.sound('error');
    }
    function buildMailto() {
      const email = settings.contactEmail || '';
      const subj = subject.value.trim() || 'Hello from your portfolio';
      const body = message.value.trim() + (from.value.trim() ? `\n\n(from ${from.value.trim()})` : '');
      return `mailto:${email}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
    }
    function openMailto(url) {
      const a = h('a', { href: url, style: { display: 'none' } });
      document.body.append(a); a.click(); a.remove();
      status.set(0, 'Opened your email app');
    }

    async function send() {
      if (sending) return;
      const f = from.value.trim(); const m = message.value.trim();
      if (!EMAIL_RE.test(f)) return invalid(from, 'Check your email address', 'Type the address Kshitiz should reply to, like name@company.ie.');
      if (m.length < 2) return invalid(message, 'Your message is empty', 'Write a line or two, then press Send Message.');
      if (!subject.value.trim()) {
        const r = await msgbox(root, { title: 'Mail', icon: 'question32', text: 'This message has no subject.\nSend it anyway?', buttons: ['Send', 'Cancel'], defaultIndex: 0 });
        if (r !== 0) { subject.focus(); return; }
      }
      sending = true;
      root.classList.add('ct-sending');
      Object.values(tools.btns).forEach((b) => { b.disabled = true; });
      status.set(0, 'Sending message...');
      let res = null;
      try {
        const r = await fetch('/api/contact', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: f, subject: subject.value.trim(), message: message.value, website: honey.value }),
        });
        res = await r.json().catch(() => null);
        if (res && typeof res === 'object') res.status = r.status;
      } catch (_) { res = null; }
      sending = false;
      root.classList.remove('ct-sending');
      Object.values(tools.btns).forEach((b) => { b.disabled = false; });
      if (!alive) return;

      if (res && res.ok) {
        status.set(0, 'Message sent');
        ctx.sound && ctx.sound('ding');
        await msgbox(root, { title: 'Message sent', icon: 'info32', text: `Thanks! Your message is on its way to Kshitiz.\nHe'll reply to ${f}.` });
        subject.value = ''; message.value = ''; count();
        return;
      }
      if (res && res.mailto) {
        openMailto(res.mailto);
        msgbox(root, { title: 'Mail', icon: 'info32', text: 'Your email app should now open with this message ready to send.\nJust press Send there.' });
        return;
      }
      if (res && Array.isArray(res.errors) && res.errors.length) {
        status.set(0, 'Message not sent');
        msgbox(root, { title: 'Mail', icon: 'warn32', text: res.errors.join('\n') });
        return;
      }
      if (res && res.error === 'too_many_messages') {
        status.set(0, 'Message not sent');
        msgbox(root, { title: 'Mail', icon: 'warn32', text: 'That\'s a lot of messages in a short time.\nPlease wait a few minutes, or use your email app instead.', buttons: ['Use Email App', 'OK'], defaultIndex: 1 })
          .then((i) => { if (i === 0) openMailto(buildMailto()); });
        return;
      }
      // network failure / no backend: hand over to the visitor's email app
      openMailto(buildMailto());
      msgbox(root, { title: 'Mail', icon: 'info32', text: 'Couldn\'t reach the mail server, so your email app should open with the message ready.\nJust press Send there.' });
    }

    let alive = true;
    ctx.site.then((site) => {
      if (!alive) return;
      settings = (site && site.settings) || {};
      const name = settings.displayName || 'Kshitiz Mittal';
      to.firstChild.textContent = name;
      tools.btns.linkedin.hidden = !settings.linkedin;
    }).catch(() => {});

    if (ctx.args && ctx.args.subject) subject.value = String(ctx.args.subject).slice(0, 150);
    requestAnimationFrame(() => { if (!ctx.isMobile) from.focus({ preventScroll: true }); });

    return {
      unmount() { alive = false; bag.dispose(); },
      onFocus() {},
    };
  },
};
