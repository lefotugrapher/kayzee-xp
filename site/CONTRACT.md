# Kayzee XP: build contract (read this before editing anything)

Static site with plain ES modules. There is no bundler and no React. Three.js r187 is loaded through the importmap in `index.html`.
Hosting is Vercel: static files plus serverless functions in `/api/*.js`. Local dev runs `node dev/server.mjs`, which
serves the static files, routes `/api/*` to the same handler files, and listens on port **7500**.

The look is LOCKED. The art direction is whatever `index.html` / `main.js` / `world.js` / `sprites.js` / `style.css` render today
(it started as the `spike/v1-hero-liked` mockup, which the owner loves).
- NEVER change the grass: `world.js makeGrass`, its shader, colours and blade shapes, and the live blade count of 260000
  in `main.js`. You may improve speed elsewhere (shadow-map updates only when something changes, no per-frame
  allocations, a DPR cap, cheaper bloom, rendering the fx layer only when needed), but the grass must look identical.
- Sky, clouds, lighting, voxel icon style, Luna chrome: keep as is. New UI must match it (same tokens as `style.css`).

## Ownership (only edit files you own)
- **core**: `index.html`, `main.js`, `world.js`, `sprites.js`, `style.css`, `wm.js`, `shell.js`, `xp.css`, `lib/*`
- **apps**: `apps/about.*`, `apps/resume.*`, `apps/projects.*`, `apps/browser.*`, `apps/media.*`, `apps/contact.*`, `apps/notepad.*`, `apps/recycle.*`, `apps/paint.*`, `lib/resume-data.js`
- **music**: `apps/music.*`
- **games**: `apps/mines.*`, `apps/solitaire.*`, `apps/pinball.*`
- **backend**: `api/**`, `admin/**`, `dev/server.mjs`, `vercel.json`, `package.json`, `data/site.json`

Each owner may also add its own test harness at `dev/<name>-test.html`.

## App module contract
Each app is `apps/<id>.js` with an optional `apps/<id>.css`. The window manager loads the CSS automatically through a `<link>`.
```js
export default {
  id: 'projects',                 // must match the file name
  title: 'My Projects',           // window title (may be changed later via ctx.setTitle)
  icon: 'projects',               // sprite key; core provides sprite2D icons for these keys:
                                  // about resume projects music contact games recycle notepad paint browser media mines solitaire pinball folder sun net speaker
  size: [760, 520],               // default content size in CSS px (the window chrome is added around it)
  minSize: [420, 300],
  single: true,                   // true = focus the existing window instead of opening a 2nd one
  resizable: true,
  mount(root, ctx) {              // root = empty window-body <div class="app-root app-<id>">, already in the DOM
    // build UI into root. Return an optional { unmount(), onResize(w,h), onFocus(), onBlur() }
  },
};
```
`ctx` (provided by core):
- `ctx.args`: whatever was passed to `openApp`
- `ctx.openApp(id, args)`: open or focus another app (e.g. `ctx.openApp('browser', { projectId })`)
- `ctx.setTitle(str)`, `ctx.close()`, `ctx.setStatus(str)` (status bar text, if the window has one)
- `ctx.site`: a Promise for the site JSON `{ settings, projects }` (core fetches `/api/site`, falling back to `/data/site.json`)
- `ctx.icon(key, px=16)`: returns an `<img>` (or canvas) of the voxel sprite in 2D at that size, so the icon language stays consistent
- `ctx.sound(name)`: `'click' | 'error' | 'ding' | 'open' | 'close'` (synth, may be a no-op)
- `ctx.isMobile`: boolean
- `ctx.shield(on)`: core puts a transparent shield over iframes while dragging. Apps with iframes should add the class
  `xp-iframe` to them so core can find them.

Apps must work at any size from `minSize` to fullscreen (mobile opens apps maximised). No global CSS leaks: prefix every
selector with `.app-<id>`. Use the shared classes from `xp.css` (owned by core) for common controls:
`.xp-btn` (XP button), `.xp-input`, `.xp-textarea`, `.xp-select`, `.xp-toolbar` + `.xp-tool` (toolbar button with icon + label),
`.xp-addressbar`, `.xp-statusbar`, `.xp-sidepane` + `.xp-sidepane-box` (blue Explorer task pane), `.xp-listview` (table),
`.xp-menubar` (File Edit View ...), `.xp-groupbox`, `.xp-scroll` (XP-style scrollbars).
If core hasn't written `xp.css` yet when you start, style these classes yourself inside your `.app-<id>` scope, using the
same colours as `style.css` (`--luna-*` tokens). Core will keep these class names.

## Deep links / registry
Core keeps a registry list in `apps/index.js` (core owns it): `['about','resume','projects','browser','media','contact','music','notepad','recycle','paint','mines','solitaire','pinball']`.
`/?open=<id>` or `/?open=project:<projectId>` skips boot and login.

## Data
`data/site.json` holds `{ settings: {displayName, nickname, role, location, about, contactEmail, linkedin, resumePdfUrl, spotifyPlaylist}, projects: [{id,title,category,year,description,url,type:'page'|'video'|'image',cover,visible}] }`.
Read it through `ctx.site` only. The backend serves it from Vercel Blob in production.
- `/api/spotify?playlist=<id or url>` returns `{name, owner, cover, tracks:[{title, artists, ms, uri}]}`. Fall back to `/data/playlist-snapshot.json`.
- `/api/contact` takes a POST `{from, subject, message, website(honeypot)}` and returns `{ok:true}`, or `{ok:false, mailto}` when no email provider is configured.

## Originality rules (hard)
- No Microsoft logos, Bliss photo, XP sounds, or copied icons or games.
- No MS product names. Use these names: "Kayzee Explorer" (browser), "Media Player", "Mail", "Mines", "Solitaire", "Pinball", "Paint", "Notepad".
- All game art must be original.

## Quality
Test in real headless Chrome:
```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --use-angle=metal --enable-gpu --hide-scrollbars --user-data-dir=<tmp> --window-size=1600,1000 --virtual-time-budget=9000 --screenshot=<png> <url>
```
View screenshots with the Read tool. For interaction tests use a node script over the Chrome DevTools protocol
(`--remote-debugging-port`, built-in WebSocket/fetch, no npm). No console errors. Do not git commit, do not deploy.
