// Kayzee XP apps kit: shared Luna chrome for apps-owned windows.
// Injected synchronously (no flash of unstyled content). Scoped under `.kx`,
// a class that only apps-owned roots carry. Colours follow style.css (--luna-*).
const svg = (s) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;

const CHEV_UP = svg(`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#c9d6f6"/></linearGradient></defs><circle cx="9" cy="9" r="8.2" fill="url(#a)" stroke="#a9bbe6"/><path d="M6 8.6l3-3 3 3M6 12.2l3-3 3 3" fill="none" stroke="#4a6fc4" stroke-width="1.4"/></svg>`);
const CHEV_DOWN = svg(`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#c9d6f6"/></linearGradient></defs><circle cx="9" cy="9" r="8.2" fill="url(#a)" stroke="#a9bbe6"/><path d="M6 5.8l3 3 3-3M6 9.4l3 3 3-3" fill="none" stroke="#4a6fc4" stroke-width="1.4"/></svg>`);
const CHEV_UP_W = svg(`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="8.2" fill="#3b78e6" stroke="#fff" stroke-opacity=".7"/><path d="M6 8.6l3-3 3 3M6 12.2l3-3 3 3" fill="none" stroke="#fff" stroke-width="1.4"/></svg>`);
const CHEV_DOWN_W = svg(`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="8.2" fill="#3b78e6" stroke="#fff" stroke-opacity=".7"/><path d="M6 5.8l3 3 3-3M6 9.4l3 3 3-3" fill="none" stroke="#fff" stroke-width="1.4"/></svg>`);
const CHECK = svg(`<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 9 9"><path d="M1 4.6l2.2 2.2L8 1.6" fill="none" stroke="#000" stroke-width="1.6"/></svg>`);
const CHECK_W = svg(`<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 9 9"><path d="M1 4.6l2.2 2.2L8 1.6" fill="none" stroke="#fff" stroke-width="1.6"/></svg>`);
const DROP = svg(`<svg xmlns="http://www.w3.org/2000/svg" width="7" height="4" viewBox="0 0 7 4"><path d="M0 0h7L3.5 4z" fill="#000"/></svg>`);
const COMBO = svg(`<svg xmlns="http://www.w3.org/2000/svg" width="17" height="19" viewBox="0 0 17 19"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6eeff"/><stop offset="1" stop-color="#b3c9f7"/></linearGradient></defs><rect x=".5" y=".5" width="16" height="18" rx="2" fill="url(#a)" stroke="#bccdf5"/><path d="M5 8l3.5 3.5L12 8" fill="none" stroke="#4d6185" stroke-width="1.8"/></svg>`);
const ARROW = (d, dark = '#4d6185') => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 17 17"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3ebff"/><stop offset="1" stop-color="#b6cbf7"/></linearGradient></defs><rect x=".5" y=".5" width="16" height="16" rx="2.5" fill="url(#a)" stroke="#fff"/><path d="${d}" fill="none" stroke="${dark}" stroke-width="1.8"/></svg>`);
const GRIP_V = svg(`<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8"><path d="M0 1.5h8M0 3.5h8M0 5.5h8M0 7.5h8" stroke="#eef3ff" stroke-width="1"/><path d="M0 2.5h8M0 4.5h8M0 6.5h8" stroke="#8ca4dd" stroke-width="1"/></svg>`);
const GRIP_H = svg(`<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8"><path d="M1.5 0v8M3.5 0v8M5.5 0v8M7.5 0v8" stroke="#eef3ff" stroke-width="1"/><path d="M2.5 0v8M4.5 0v8M6.5 0v8" stroke="#8ca4dd" stroke-width="1"/></svg>`);
const SIZEGRIP = svg(`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"><g fill="#fff"><rect x="9" y="1" width="2" height="2"/><rect x="5" y="5" width="2" height="2"/><rect x="9" y="5" width="2" height="2"/><rect x="1" y="9" width="2" height="2"/><rect x="5" y="9" width="2" height="2"/><rect x="9" y="9" width="2" height="2"/></g><g fill="#b6b19c"><rect x="8" y="0" width="2" height="2"/><rect x="4" y="4" width="2" height="2"/><rect x="8" y="4" width="2" height="2"/><rect x="0" y="8" width="2" height="2"/><rect x="4" y="8" width="2" height="2"/><rect x="8" y="8" width="2" height="2"/></g></svg>`);

export const KIT_CSS = `
.kx {
  --kx-beige: #ece9d8; --kx-line: #aca899; --kx-sel: #316ac5; --kx-link: #215dc6; --kx-link-hi: #428eff;
  --kx-font: Tahoma, Verdana, "Segoe UI", sans-serif; --kx-title-font: "Trebuchet MS", Tahoma, sans-serif;
  position: relative; display: flex; flex-direction: column; width: 100%; height: 100%; min-width: 0; min-height: 0;
  overflow: hidden; background: var(--kx-beige); color: #000; font: 11px/1.3 var(--kx-font);
  -webkit-user-select: none; user-select: none; outline: none; box-sizing: border-box; text-align: left;
  -webkit-tap-highlight-color: transparent;
}
.kx *, .kx *::before, .kx *::after { box-sizing: border-box; }
.kx [hidden] { display: none !important; }
.kx button { font: inherit; color: inherit; margin: 0; }
.kx .kx-ico { display: block; flex: none; overflow: visible; }
.kx .px-icon { image-rendering: pixelated; display: block; }
.kx :focus { outline: none; }
.kx button:focus-visible, .kx [tabindex]:focus-visible { outline: 1px dotted #000; outline-offset: -3px; }
.kx input, .kx textarea { -webkit-user-select: text; user-select: text; }

/* ---------------------------------------------------------------- scrollbars (Luna) */
.kx ::-webkit-scrollbar { width: 17px; height: 17px; }
.kx ::-webkit-scrollbar-track:vertical { background: linear-gradient(90deg, #f3f1ec 0, #fefefb 60%, #f3f1ec 100%); }
.kx ::-webkit-scrollbar-track:horizontal { background: linear-gradient(180deg, #f3f1ec 0, #fefefb 60%, #f3f1ec 100%); }
.kx ::-webkit-scrollbar-thumb { border: 1px solid #fff; border-radius: 3px; box-shadow: inset 0 0 0 1px #9eb5ea; }
.kx ::-webkit-scrollbar-thumb:vertical { background: ${GRIP_V} center no-repeat, linear-gradient(90deg, #c9d8fc 0, #c1d3fb 45%, #b2c6f4 100%); }
.kx ::-webkit-scrollbar-thumb:horizontal { background: ${GRIP_H} center no-repeat, linear-gradient(180deg, #c9d8fc 0, #c1d3fb 45%, #b2c6f4 100%); }
.kx ::-webkit-scrollbar-thumb:hover { box-shadow: inset 0 0 0 1px #7f9eea; }
.kx ::-webkit-scrollbar-button:single-button { display: block; width: 17px; height: 17px; background-size: 17px 17px; }
.kx ::-webkit-scrollbar-button:single-button:vertical:decrement { background-image: ${ARROW('M5 10l3.5-3.5L12 10')}; }
.kx ::-webkit-scrollbar-button:single-button:vertical:increment { background-image: ${ARROW('M5 7l3.5 3.5L12 7')}; }
.kx ::-webkit-scrollbar-button:single-button:horizontal:decrement { background-image: ${ARROW('M10 5L6.5 8.5 10 12')}; }
.kx ::-webkit-scrollbar-button:single-button:horizontal:increment { background-image: ${ARROW('M7 5l3.5 3.5L7 12')}; }
.kx ::-webkit-scrollbar-corner { background: var(--kx-beige); }

/* ---------------------------------------------------------------- menubar */
.kx .kx-menubar {
  position: relative; z-index: 30; flex: none; display: flex; align-items: center; height: 22px; padding: 0 0 0 2px;
  background: var(--kx-beige); border-bottom: 1px solid #d8d2bd; box-shadow: 0 1px 0 #fff;
}
.kx .kx-menubar-item {
  height: 18px; padding: 0 6px; border: 0; background: none; font: 11px var(--kx-font); border-radius: 0; line-height: 18px;
}
.kx .kx-menubar-item:hover, .kx .kx-menubar-item.open { background: var(--kx-sel); color: #fff; }
.kx .kx-menubar-item:focus-visible { outline: 1px dotted #000; outline-offset: -2px; }
.kx .kx-menubar-logo {
  margin-left: auto; align-self: stretch; width: 38px; display: grid; place-items: center;
  background: linear-gradient(180deg, #fff 0, #f6f6f2 100%); border-left: 1px solid #d8d2bd;
}
.kx .kx-menu {
  position: absolute; top: 20px; min-width: 176px; padding: 2px; background: #fff; border: 1px solid var(--kx-line);
  box-shadow: 2px 2px 3px rgba(0,0,0,.32); display: flex; flex-direction: column; z-index: 40;
}
.kx .kx-menu-item {
  display: flex; align-items: center; height: 19px; padding: 0 10px 0 0; border: 0; background: none; text-align: left;
  font: 11px var(--kx-font); white-space: nowrap; width: 100%;
}
.kx .kx-menu-item:hover, .kx .kx-menu-item:focus { background: var(--kx-sel); color: #fff; outline: none; }
.kx .kx-menu-item.disabled { color: #aca899; }
.kx .kx-menu-item.disabled:hover, .kx .kx-menu-item.disabled:focus { background: var(--kx-sel); color: #aca899; }
.kx .kx-menu-chk { width: 20px; height: 19px; flex: none; }
.kx .kx-menu-item.checked .kx-menu-chk { background: ${CHECK} center no-repeat; }
.kx .kx-menu-item.checked:hover .kx-menu-chk, .kx .kx-menu-item.checked:focus .kx-menu-chk { background-image: ${CHECK_W}; }
.kx .kx-menu-label { flex: 1; padding-right: 22px; }
.kx .kx-menu-key { color: inherit; opacity: .9; }
.kx .kx-popup { top: auto; z-index: 75; }
.kx .kx-menu-item.bold .kx-menu-label { font-weight: bold; }
.kx .kx-menu-sep { height: 1px; margin: 3px 1px; background: var(--kx-line); }

/* ---------------------------------------------------------------- toolbar */
.kx .kx-toolbar {
  flex: none; display: flex; align-items: center; gap: 1px; padding: 2px 4px; min-height: 28px; overflow: hidden;
  background: linear-gradient(180deg, #fcfcfa 0, #f3f2ea 40%, #ebe8da 100%);
  border-bottom: 1px solid #cdc8b2; box-shadow: inset 0 1px 0 #fff;
}
.kx .kx-toolbar.big { min-height: 40px; }
.kx .kx-tool {
  display: flex; align-items: center; gap: 4px; flex: none; height: 24px; padding: 0 3px; border: 1px solid transparent; border-radius: 3px;
  background: none; font: 11px var(--kx-font); white-space: nowrap;
}
.kx .kx-toolbar.big .kx-tool { height: 34px; padding: 0 5px 0 3px; }
.kx .kx-tool.has-label { padding-right: 7px; }
.kx .kx-tool:hover:not(:disabled) {
  border-color: #cecec3; background: linear-gradient(180deg, #fff 0, #f8f8f5 45%, #ebeae3 100%);
  box-shadow: inset 0 -1px 0 #dedcd2;
}
.kx .kx-tool:active:not(:disabled), .kx .kx-tool.pressed {
  border-color: #9d9d92; background: linear-gradient(180deg, #e4e3dc 0, #efeee8 100%);
  box-shadow: inset 1px 1px 2px rgba(0,0,0,.16);
}
.kx .kx-tool:active:not(:disabled) .kx-tool-ico { transform: translate(1px, 1px); }
.kx .kx-tool:disabled { color: #aca899; }
.kx .kx-tool:disabled .kx-tool-ico { filter: grayscale(1) contrast(.55) brightness(1.25); opacity: .7; }
.kx .kx-tool-ico { display: grid; place-items: center; }
.kx .kx-tool-arrow { width: 7px; height: 4px; margin-left: 1px; background: ${DROP} center no-repeat; }
.kx .kx-tool-sep { flex: none; width: 1px; height: 26px; margin: 0 3px; background: #c6c2b0; box-shadow: 1px 0 0 #fff; }
.kx .kx-toolbar:not(.big) .kx-tool-sep { height: 18px; }

/* ---------------------------------------------------------------- address bar */
.kx .kx-addressbar {
  flex: none; display: flex; align-items: center; gap: 4px; height: 27px; padding: 2px 4px 2px 6px;
  background: linear-gradient(180deg, #fbfbf8 0, #f1efe6 100%); border-bottom: 1px solid #cdc8b2; box-shadow: inset 0 1px 0 #fff;
}
.kx .kx-address-label { color: #6b6a63; padding-right: 2px; }
.kx .kx-address-field {
  flex: 1; min-width: 0; height: 21px; display: flex; align-items: center; gap: 3px; padding-left: 3px;
  background: #fff; border: 1px solid #7f9db9;
}
.kx .kx-address-input {
  flex: 1; min-width: 0; height: 19px; border: 0; padding: 0 2px; font: 11px var(--kx-font); background: transparent; color: #000;
}
.kx .kx-address-input[readonly] { -webkit-user-select: none; user-select: none; }
.kx .kx-address-drop { width: 17px; height: 19px; flex: none; background: ${COMBO} center no-repeat; }
.kx .kx-address-go {
  display: flex; align-items: center; gap: 3px; height: 22px; padding: 0 7px 0 3px; border: 1px solid transparent; border-radius: 3px; background: none;
}
.kx .kx-address-go:hover { border-color: #cecec3; background: linear-gradient(180deg, #fff, #ebeae3); }
.kx .kx-address-go:active { border-color: #9d9d92; background: #e4e3dc; }

/* ---------------------------------------------------------------- status bar */
.kx .kx-statusbar {
  flex: none; display: flex; height: 22px; align-items: stretch; background: var(--kx-beige);
  border-top: 1px solid #fff; box-shadow: 0 -1px 0 #d8d2bd; padding-right: 14px; position: relative;
}
.kx .kx-statusbar::after { content: ""; position: absolute; right: 2px; bottom: 2px; width: 12px; height: 12px; background: ${SIZEGRIP}; }
.kx .kx-status-part {
  display: flex; align-items: center; gap: 5px; padding: 0 7px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  border-left: 1px solid #d0ccb8; box-shadow: inset 1px 0 0 #fff; min-width: 0; flex: none;
}
.kx .kx-status-part:first-child { border-left: 0; box-shadow: none; }
.kx .kx-status-part.flex { flex: 1; display: block; line-height: 21px; }

/* ---------------------------------------------------------------- explorer task pane */
.kx .kx-sidepane {
  flex: none; width: 200px; padding: 12px 11px; overflow-y: auto; overflow-x: hidden;
  background: linear-gradient(180deg, #7ba2e7 0, #6375d6 100%);
}
.kx .kx-sidepane-box { margin-bottom: 13px; border-radius: 3px 3px 0 0; }
.kx .kx-sidepane-head {
  width: 100%; height: 25px; display: flex; align-items: center; padding: 0 3px 0 11px; border: 0; text-align: left;
  border-radius: 3px 3px 0 0; background: linear-gradient(90deg, #fff 0, #c6d3f7 100%); color: var(--kx-link); font: bold 11px var(--kx-font);
}
.kx .kx-sidepane-head:hover { color: var(--kx-link-hi); }
.kx .kx-sidepane-title { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.kx .kx-sidepane-chev { width: 18px; height: 18px; flex: none; background: ${CHEV_UP} center no-repeat; }
.kx .kx-sidepane-box.collapsed .kx-sidepane-chev { background-image: ${CHEV_DOWN}; }
.kx .kx-sidepane-box.special .kx-sidepane-head { background: linear-gradient(90deg, #0055e5 0, #2a6ef0 70%, #3c7cf2 100%); color: #fff; }
.kx .kx-sidepane-box.special .kx-sidepane-chev { background-image: ${CHEV_UP_W}; }
.kx .kx-sidepane-box.special.collapsed .kx-sidepane-chev { background-image: ${CHEV_DOWN_W}; }
.kx .kx-sidepane-body {
  padding: 8px 10px 10px 12px; background: #d6dff7; border: 1px solid #fff; border-top: 0; color: #000;
  display: flex; flex-direction: column; gap: 1px;
}
.kx .kx-sidepane-box.special .kx-sidepane-body { background: #eff3ff; }
.kx .kx-sidepane-box.collapsed .kx-sidepane-body { display: none; }
.kx .kx-sidepane-link {
  display: flex; align-items: center; gap: 6px; padding: 2px 0; border: 0; background: none; text-align: left; color: var(--kx-link);
  font: 11px/1.25 var(--kx-font);
}
.kx .kx-sidepane-link:hover:not(:disabled) { color: var(--kx-link-hi); text-decoration: underline; }
.kx .kx-sidepane-link:disabled { color: #7d8bb2; }
.kx .kx-sidepane-link:disabled .kx-sidepane-ico { filter: grayscale(1); opacity: .6; }
.kx .kx-sidepane-ico { flex: none; width: 16px; height: 16px; }

/* ---------------------------------------------------------------- buttons & inputs */
.kx .xp-btn {
  min-width: 75px; height: 23px; padding: 0 12px; font: 11px var(--kx-font); color: #000; white-space: nowrap;
  border: 1px solid #003c74; border-radius: 3px;
  background: linear-gradient(180deg, #ffffff 0%, #f7f6f1 40%, #efede4 75%, #dcd6c6 100%);
  box-shadow: inset 0 -2px 0 rgba(200,192,170,.6), inset 0 1px 0 #fff;
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
}
.kx .xp-btn.default, .kx .xp-btn:focus-visible { box-shadow: inset 0 0 0 1px #a9c4f4, inset 0 -2px 0 #87a9eb, inset 0 2px 0 #cfe0fc; }
.kx .xp-btn:focus-visible { outline: 1px dotted #000; outline-offset: -4px; }
.kx .xp-btn:hover:not(:disabled) { box-shadow: inset 0 0 0 1px #fbd47c, inset 0 -2px 0 #e9a21a, inset 0 2px 0 #fff0c4; }
.kx .xp-btn:active:not(:disabled) { background: linear-gradient(180deg, #e5e4dd 0, #ebeae3 60%, #f3f2ee 100%); box-shadow: inset 1px 1px 1px rgba(0,0,0,.12); }
.kx .xp-btn:disabled { color: #aca899; border-color: #c9c7ba; background: #f5f4ea; box-shadow: none; }
.kx .xp-input, .kx .xp-textarea, .kx .xp-select {
  font: 12px var(--kx-font); color: #000; background: #fff; border: 1px solid #7f9db9; border-radius: 0; padding: 3px 5px; min-width: 0;
}
.kx .xp-input::placeholder, .kx .xp-textarea::placeholder { color: #8d8d8d; font-style: italic; }
.kx .xp-input[readonly] { background: #f4f3ec; color: #000; }
.kx .xp-input.invalid, .kx .xp-textarea.invalid { border-color: #d24d1e; background: #fff8f4; }

/* ---------------------------------------------------------------- modal dialog */
.kx .kx-modal-shield { position: absolute; inset: 0; z-index: 80; display: grid; place-items: center; padding: 10px; background: rgba(236,233,216,.0); }
.kx .kx-dlg {
  min-width: 260px; max-width: min(420px, 100%); border-radius: 7px 7px 1px 1px; padding: 0 3px 3px;
  background: linear-gradient(90deg, #0742c6 0, #1a62ea 2px, #0b51d9 3px, #0b51d9 calc(100% - 3px), #0844c4 calc(100% - 2px), #063aad 100%);
  box-shadow: 0 10px 28px rgba(0,0,40,.4), 0 2px 6px rgba(0,0,40,.3);
}
.kx .kx-dlg-title {
  height: 26px; margin: 0 -3px; padding: 0 4px 0 8px; display: flex; align-items: center; justify-content: space-between; gap: 8px;
  border-radius: 7px 7px 0 0; color: #fff; font: bold 13px/1 var(--kx-title-font); text-shadow: 1px 1px 0 #0b2a8a;
  background: linear-gradient(180deg, #4aa0ff 0%, #2f8af9 5%, #1873f3 10%, #0d63ea 22%, #0a5be0 45%, #0958de 70%, #0b56d6 86%, #0a4cc2 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.55);
}
.kx .kx-dlg.flash .kx-dlg-title { animation: kxflash .5s steps(2) 2; }
@keyframes kxflash { 50% { filter: saturate(.25) brightness(1.25); } }
.kx .kx-dlg-close {
  width: 21px; height: 21px; border: 1px solid #fff; border-radius: 3px; position: relative; flex: none; padding: 0;
  background: radial-gradient(120% 120% at 30% 22%, #f7b49a 0%, #ec7a52 30%, #dc5428 60%, #c2400f 100%);
  box-shadow: inset -1px -1px 2px rgba(80,10,0,.35), inset 1px 1px 1px rgba(255,255,255,.55);
}
.kx .kx-dlg-close::before, .kx .kx-dlg-close::after {
  content: ""; position: absolute; left: 50%; top: 50%; width: 12px; height: 2.2px; margin: -1.1px 0 0 -6px; background: #fff; border-radius: 1px; transform: rotate(45deg);
}
.kx .kx-dlg-close::after { transform: rotate(-45deg); }
.kx .kx-dlg-body { display: flex; gap: 14px; align-items: flex-start; padding: 16px 16px 6px; background: var(--kx-beige); }
.kx .kx-dlg-ico { flex: none; filter: drop-shadow(1px 1px 1px rgba(0,0,0,.2)); }
.kx .kx-dlg-text { font: 11px/1.45 var(--kx-font); padding-top: 2px; white-space: pre-line; -webkit-user-select: text; user-select: text; }
.kx .kx-dlg-btns { display: flex; justify-content: center; gap: 7px; padding: 10px 12px 12px; background: var(--kx-beige); }

/* ---------------------------------------------------------------- balloon tip */
.kx .kx-balloon {
  position: absolute; z-index: 70; max-width: 270px; min-width: 150px; padding: 7px 24px 9px 10px;
  background: #ffffe1; border: 1px solid #000; border-radius: 7px; box-shadow: 2px 3px 5px rgba(0,0,0,.28);
  font: 11px/1.35 var(--kx-font); color: #000; animation: kxpop .16s ease-out;
}
@keyframes kxpop { from { opacity: 0; transform: translateY(3px); } }
.kx .kx-balloon::before, .kx .kx-balloon::after { content: ""; position: absolute; left: var(--tail, 18px); border: solid transparent; }
.kx .kx-balloon.below::before { top: -14px; border-width: 0 0 14px 14px; border-bottom-color: #000; border-left-width: 0; border-right-width: 14px; }
.kx .kx-balloon.below::after { top: -12px; left: calc(var(--tail, 18px) + 1px); border-width: 0 12px 13px 0; border-bottom-color: #ffffe1; }
.kx .kx-balloon.above::before { bottom: -14px; border-width: 14px 14px 0 0; border-top-color: #000; }
.kx .kx-balloon.above::after { bottom: -12px; left: calc(var(--tail, 18px) + 1px); border-width: 13px 12px 0 0; border-top-color: #ffffe1; }
.kx .kx-balloon-title { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.kx .kx-balloon-x {
  position: absolute; right: 5px; top: 5px; width: 14px; height: 14px; padding: 0; border: 1px solid #c9c5a6; border-radius: 2px; background: #ffffe1;
}
.kx .kx-balloon-x::before, .kx .kx-balloon-x::after { content: ""; position: absolute; left: 2px; top: 5.5px; width: 8px; height: 1.4px; background: #555; transform: rotate(45deg); }
.kx .kx-balloon-x::after { transform: rotate(-45deg); }
.kx .kx-balloon-x:hover { background: #f9d38a; border-color: #d29b2a; }

/* ---------------------------------------------------------------- thumbnails */
.kx .kx-thumb { display: block; flex: none; overflow: hidden; background: #dfe7f5; }
.kx .kx-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.kx .kx-thumb canvas { display: block; }

/* ---------------------------------------------------------------- explorer content area */
.kx .kx-explorer-body { flex: 1; display: flex; min-height: 0; }
.kx .kx-main { flex: 1; min-width: 0; overflow: auto; background: #fff; border-left: 1px solid #fff; }
`;
