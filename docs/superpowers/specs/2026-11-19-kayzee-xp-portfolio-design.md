# Kayzee XP — 3D portfolio desktop · Design

Date: 2026-11-19 · Owner: Kshitiz Mittal ("Kayzee") · Project folder: `~/skill/kayzee-xp`

## 1. Intent

A personal portfolio site that behaves like a working Windows XP desktop, rebuilt as a
real-time 3D world. It should feel like the reference render Kayzee shared
(`images/12.jpg` / `images/1.jpg` in the session): a sunny grassy hill under a deep blue
sky with puffy clouds, chunky pixel-art icons extruded into 3D blocks floating above the
grass, a thick XP dialog slab, a giant pixel cursor — everything casting soft shadows on
the grass. XP's Luna design language (blue glossy title bars, beige #ECE9D8 bodies, green
Start button, Tahoma type) stays recognisable; it is just *more 3D*.

**Why:** Kayzee is job-hunting (PR & Communications, Content & Social Media roles in
Ireland). The site is mainly for recruiters and hiring managers, partly for freelance
clients. It has to make him memorable ("my Claude Code one-shotted my portfolio") **and**
get a recruiter to his CV and work fast.

**Success looks like:** a recruiter lands, is charmed within 3 seconds, and reaches the
résumé or a project in ≤ 2 clicks; Kayzee can add a new Playbook project from his phone
in under a minute without touching code; it runs smoothly on a normal laptop and works
on a phone.

## 2. Goals / non-goals / anti-goals

Goals
- One consistent 3D art direction across boot, login, desktop, windows, menus, games.
- Full XP-like shell: boot → login → desktop, Start menu, taskbar with window buttons,
  tray (volume, effects toggle, clock), draggable/minimisable/maximisable windows.
- Portfolio apps: About Me, My Resume, My Projects, Contact Me, My Music.
- Projects are **only embed links** (Playbook-hosted). No media is stored by this site.
- Password-protected admin page to add/edit/reorder/hide projects and a few settings.
- Playable classic-genre games with original art.
- Works on phones (simplified), fast enough that the boot screen hides loading.

Non-goals
- No media hosting, no CMS, no database, no user accounts besides one admin password.
- No real file system, no multi-user anything, no analytics beyond what Vercel gives free.

Anti-goals (a failure even if it "works")
- Looks like a flat CSS XP clone (Mitch's site look) — the 3D world is the point.
- Inconsistent styles (e.g. 3D icons on the desktop but flat clip-art in menus).
- A recruiter can't find the CV, or the intro can't be skipped.
- Janky: dropped frames while dragging, blurry text at rest, iframes reloading when a
  window is focused or moved.
- Copies of Microsoft's assets or games (see Constraints).

## 3. Constraints

- **Originality / IP.** No Microsoft logo, no Bliss photograph, no XP sound files, no
  copied icons, no recreations of Microsoft's specific games or apps by name or look.
  We recreate the *design language* (Luna-style chrome via CSS/3D) with original assets:
  original four-pane "flag" logo, procedural hill, synthesized UI sounds, original pixel
  icons, original game art. App names are generic or Kayzee-branded ("Mines",
  "Solitaire", "Pinball", "Kayzee Explorer", "Media Player", "Mail"), never
  "Internet Explorer", "Minesweeper", "Outlook Express", "Space Cadet". A small credits
  line says it's a fan homage, not affiliated with Microsoft. No Doom/abandonware.
- **Embeds.** Playbook published pages (`https://www.playbook.com/s/kayzeem/<slug>`)
  send no X-Frame-Options / frame-ancestors (checked 2026-11-19), so they iframe fine.
  Everything inside an iframe is the third party's; we can't style or hide its cursor.
- **Fake address bar.** Project windows show a made-up URL like
  `http://www.kayzee.xp/projects/canopy` (non-existent TLD, leads nowhere). The real
  embed URL is never shown in the UI (it is still visible in devtools; unavoidable).
  No "open in new tab" control.
- **Spotify.** Use Spotify's official embed and its iFrame API (controller: `loadUri`,
  `play`, `togglePlay`, `seek`, `playback_update` events). The official embed player
  must stay visible inside the music window (attribution / embed rules). Full tracks
  for visitors logged into Spotify, 30-second previews otherwise.
  Playlist: `spotify:playlist:6rmbRweMbmm9Ne6DOQiwm6` ("My Shazam Tracks", 100 tracks).
  Track list (title, artists, duration, uri) is available without auth from the embed
  page's `__NEXT_DATA__` JSON (`props.pageProps.state.data.entity.trackList`); verified
  2026-11-19. Optional upgrade path: Spotify Web API client-credentials if
  `SPOTIFY_CLIENT_ID/SECRET` env vars exist (gives per-track album art).
- **Cost.** Vercel Hobby + free Vercel Blob for one small JSON file. Nothing else paid.
- **Privacy.** No phone number or home address on the site. CV PDF only if Kayzee sets
  a URL for it. Embed list JSON stored private, served through our API.
- **Attribution in git.** Plain commit messages, no Claude co-author trailers.

## 4. Approaches considered

A. **Real 3D desktop (chosen by Kayzee).** One Three.js WebGL world (sky, hill, grass,
   clouds, voxel icons, 3D cursor) plus windows as real DOM placed *in the same 3D
   space* via Three's `CSS3DRenderer`, sharing one camera. Windows get physical
   thickness, perspective parallax, fly-in/out from their icon, and real shadows on the
   grass via invisible shadow-caster proxies in the WebGL scene. Iframes keep working.
   Trade-off: hardest to build; text can soften slightly while the camera moves.
B. **3D world, flat windows.** Same world; windows as flat screen-space DOM with faked
   depth. Easier, always-crisp text, but windows don't live in the world — close to
   existing XP clones. Rejected by Kayzee.
C. **Everything in WebGL** (windows as textured meshes). Most 3D, but kills iframes, so
   Playbook and Spotify embeds can't work. Ruled out.

## 5. The design (decided)

### 5.1 Art direction: "Voxel Luna" (applies everywhere)
- **Light:** sunny early afternoon. Warm key light from upper-left-front, cool sky fill,
  soft but defined shadows on the grass (matches the reference). One light rig shared by
  every 3D thing.
- **World:** rolling grassy hill, horizon ~45–50% up the screen on desktop. Saturated
  green grass with visible blades near the camera and gentle wind motion; colour
  variation patches like the reference. Deep blue sky gradient, paler at the horizon,
  big soft white cumulus clouds drifting slowly with parallax depth.
- **Objects:** pixel-art sprites extruded into voxels (1 pixel = 1 slightly bevelled
  cube), satin-plastic material, crisp silhouettes — exactly the reference's CD drive,
  camera, folder, recycle bin and monitor feel. Icons float and bob gently above the
  grass and cast shadows. The **same sprite data** renders both the 3D voxel icon and
  the 2D icon used in taskbar, Start menu, title bars and Explorer views, so the icon
  language is identical everywhere.
- **Windows:** thick slabs (~12–16 CSS px deep), Luna blue glossy title bar with
  rounded top corners and the three caption buttons, beige body, bevelled edges whose
  sides are visible under parallax. They cast shadows onto the grass and sit at the
  "desktop plane" in front of the hill.
- **Cursor:** a 3D voxel arrow cursor (like the reference) follows the mouse over the
  desktop and casts a shadow; over windows/UI it swaps to a crisp pixel-arrow CSS
  cursor (iframes show their own). Off on touch devices.
- **Camera:** fixed framing; subtle mouse parallax on the desktop; eases back to the
  exact rest pose (pixel-crisp) while dragging/typing in windows or when idle in a window.
- **Finish:** light film grain, slight bloom on highlights, soft vignette, tiny
  depth-of-field on the far hill. An "effects" tray toggle adds/removes a CRT scanline
  look; a "reduce motion" path honours `prefers-reduced-motion`.
- **UI chrome:** taskbar = glossy blue slab with green 3D Start pill; Start menu =
  two-column Luna menu as a slab window; context menus, tooltips and balloon tips all
  share the same bevel/shadow tokens. One token file (colours, radii, bevel depths,
  shadow strength, fonts) drives DOM styling and 3D materials.
- **Type:** Tahoma / Trebuchet MS (title bars) with Verdana / system fallbacks.
- **Sound:** short original synthesized UI sounds (startup chime, click, error ding,
  minimise whoosh) via WebAudio; master volume + mute in the tray (like image 6),
  remembered per browser. Nothing plays before the first user click.

### 5.2 Shell flow
1. **Boot** (~2.5 s, click/any key skips): black screen, original 3D four-pane flag logo
   (voxel, slowly turning, glossy), "Kayzee xp" wordmark, tagline, XP-style marching
   progress bar. Doubles as the asset loader.
2. **Login:** blue Luna welcome screen, 3D tile for "Kshitiz Mittal" with avatar and
   role line; click to log in → original startup chime → desktop fades/zooms in.
3. **Desktop:** icons arranged in an XP-like left column (floating in 3D over the
   grass), Recycle Bin on the grass bottom-right, taskbar at the bottom. A Notepad
   "Welcome.txt" opens on first visit with a 3-line guide and quick links (Résumé,
   Projects, Contact) for recruiters.
4. **Returning visitors** (localStorage) skip boot and go straight to login.
5. **Deep links** skip boot + login and open straight to a window:
   `/?open=resume`, `/?open=projects`, `/?open=project:<slug>`, `/?open=contact`,
   `/?open=music`. Kayzee can paste these into job applications.
6. **Start menu → Log Off** returns to login; **Turn Off** shows an original
   "It's now safe to close this tab" shutdown screen.

### 5.3 Window manager
- Open/close/minimise/maximise/restore, drag by title bar, resize from edges/corner,
  focus order, taskbar buttons (with grouping not needed), keyboard: Esc closes menus,
  Alt+F4-ish not required.
- Open animation: the window flies out of its 3D icon with a slight rotation and lands
  at the desktop plane; minimise shrinks into its taskbar button.
- Iframes must never reload on focus/drag/minimise (window DOM is created once and only
  transformed; never re-parented).
- Overlap/ordering must be correct in 3D (no window poking through another).
- While dragging over iframes, a transparent shield prevents the iframe swallowing
  pointer events.
- Each app declares default size, min size, icon, title, single- or multi-instance.

### 5.4 Apps

**About Me** — XP-style window: avatar, name, role line
("PR & Communications · Content & Social Media · Brand Storytelling"), short bio,
highlight stats (VP DkIT Students' Union; co-founded Canopy Coffee (+48% avg daily sales
in month two) and Sharpz Studio (doubled bookings); presented research to a national
panel), skills chips, links (LinkedIn, Contact, Résumé). Content source: master CV
`~/skill/cv/Kshitiz_Mittal_CV.tex`. Only CV-confirmed facts; no phone, no visa info.

**My Resume** — document-viewer window (toolbar: Zoom, Save/Download, Print, Contact
Me), showing the CV rendered as a styled HTML page built from structured data (from the
master CV, minus phone). "Save" downloads the PDF from the admin-set `resumePdfUrl`
(e.g. hosted on Playbook); button hidden if unset.

**My Projects** — Explorer-style window: blue left task pane (Project Tasks / Other
Places / Details for the selected item), main pane with project tiles grouped by
category, each tile showing the cover (or a generated voxel-folder thumbnail if none),
title and year. Double-click/tap opens the project by type:
- *Page* (Playbook published page or any web page) → **Kayzee Explorer** browser
  window: back/forward/refresh/home buttons, fake address bar, throbber, status bar,
  iframe content. Home = an in-app "Projects home" page. Typing in the address bar
  and pressing Go shows an original "This page cannot be displayed" page.
- *Video* (YouTube, Vimeo, direct mp4, Playbook video embed) → **Media Player** window.
- *Image* → picture-viewer window.
Type is auto-detected from the link; admin can override.

**Contact Me** — mail-compose window like image 5: To (fixed: Kayzee), From, Subject,
Message, Send, LinkedIn button. Send: if `RESEND_API_KEY` is configured, POST to
`/api/contact` (honeypot field + basic rate limit) and show a sent balloon; otherwise
open a prefilled `mailto:` to the admin-set contact email.

**My Music** — Explorer-style window like image 11: header with playlist cover mosaic,
title, owner, "Listen on Spotify" button; a sortable track table (#, title, artists,
duration, open-in-Spotify link); bottom transport bar (prev / play-pause / next,
current track, progress) that drives the official Spotify embed through the iFrame
API. The official compact Spotify embed remains visible inside the window (e.g. above
or as part of the transport area). Track list from `/api/spotify/playlist` (server
fetch + parse of the embed page, cached 24 h; Web API path if env vars present). If the
list fails, the window still works with just the official embed. Playlist link is an
admin setting (accepts pasted iframe code or a playlist URL).

**Notepad** — simple text window; ships with Welcome.txt (recruiter guide).

**Paint** — simple paint program in XP chrome: pencil, brush, eraser, fill, line,
rectangle, ellipse, colour palette, clear, save as PNG. Original icons.

**Recycle Bin** — Explorer window with a couple of joke files (e.g.
`cv_final_FINAL_v7.doc`) that open in Notepad. Light touch.

**Games** (Start → Games, and a Games folder icon):
- **Mines** — classic mine-grid mechanics (beginner/intermediate/expert, first click
  safe, chording, flags, timer, mine counter). Original look: grass/earth voxel-style
  tiles, a little sun face as the reset button, wooden LED-ish counters. Long-press to
  flag on touch.
- **Solitaire** — Klondike (draw 1 / draw 3, drag & drop + double-click to foundation,
  undo, auto-complete, score/time). Original card faces and a card back showing the
  hill scene. Original win animation: cards fly up into the 3D world and tumble onto
  the grass (not the classic bouncing cascade).
- **Pinball** — 3D pinball table rendered in Three.js inside its window, original
  table theme (e.g. "Bliss Hill" / PR-campaign themed targets), flippers, bumpers,
  ramps, plunger, score, 3 balls. Keyboard (Z / / or ← →, Space plunger) and touch
  (left/right screen halves). Same lighting language and voxel styling.

### 5.5 Tray, menus, extras
- Tray: volume popover, effects (CRT) toggle, a network icon with a joke tooltip, clock.
- Right-click desktop: Arrange Icons, Refresh, **Properties → time of day**
  (Day / Sunset / Night presets that relight the whole 3D world). Long-press on phone.
- Balloon tip after login ("Tip: double-click My Resume").

### 5.6 Admin (`/admin`)
- Same Voxel Luna styling, styled as a "Control Panel" but optimised for practical use
  (works well on a phone).
- Login: single password from env `ADMIN_PASSWORD`; signed HttpOnly session cookie
  (`SESSION_SECRET`), 7-day expiry, simple rate limit on attempts.
- **Projects:** add by pasting a URL *or* a full `<iframe …>` embed code (we extract
  `src`); auto-detect type/provider; fields: title, category, year, short description,
  cover image URL (optional), fake URL slug (auto from title, editable), type override,
  visible toggle; reorder (drag or up/down); delete; live preview of the embed.
- **Settings:** display name, role line, about text, contact email, LinkedIn URL,
  résumé PDF URL, Spotify playlist (URL or embed code).
- Save → writes one JSON document; public site reflects it on next load (cache
  revalidated on save).
- Not linked from the public UI.

### 5.7 Data & stack
- **Next.js (App Router, TypeScript) on Vercel.** Public page `/` renders a tiny SSR
  shell (name, role, links, noscript summary for SEO/ATS bots) and loads the 3D client
  app with dynamic import (no SSR).
- **Three.js** (latest stable) for the world, voxel icons, 3D cursor, boot logo, game
  boards; `CSS3DRenderer` for windows; postprocessing for grain/bloom/vignette.
- **React** for window contents and admin; a small store (Zustand) for windows/state.
- **Storage:** one private Vercel Blob JSON (`site.json`: settings + projects). Local
  dev falls back to a JSON file in the repo when no Blob token. Read via server, cached,
  revalidated on admin save.
- **API routes:** `/api/site` (public read, strips nothing sensitive because nothing
  sensitive is stored), `/api/admin/login|logout|site` (auth required for writes),
  `/api/spotify/playlist`, `/api/contact` (optional Resend).
- **Seed data:** the 4 currently published Playbook pages:
  JP Morgan x DkIT Business Society (`/s/kayzeem/jp-morgan-business-society`),
  betmaster portfolio (`/s/kayzeem/betmaster-portfolio`),
  Ajay and Gunjan (`/s/kayzeem/ajay-and-gunjan`), Canopy (`/s/kayzeem/canopy`).

### 5.8 Phone / tablet
- Same 3D world at lower cost (lower DPR, fewer grass blades, no DOF).
- Icons in a tap grid; single tap selects, tap again / double-tap opens.
- Windows open maximised; taskbar switches between them; Start menu full-width.
- 3D cursor off; parallax from device tilt optional (off by default).

### 5.9 Quality bars
- 60 fps on an M1 MacBook Air with 2–3 windows open; adaptive quality drops effects
  before frames. No WebGL → graceful flat fallback (still usable).
- Text pixel-crisp when the camera is at rest.
- Boot screen covers loading; desktop interactive within ~4 s on a decent connection.
- Keyboard reachable icons (Tab/Enter), visible focus, alt text on images.
- Verified visually in a real browser (screenshots) at desktop and phone sizes.

## 6. Left to the builder
- Exact scene composition, camera FOV/distance, grass technique, cloud technique,
  shadow-proxy approach, and how window thickness is built (as long as §5.1/§5.3 hold).
- Physics approach for pinball (custom 2D-on-table or a physics lib).
- Folder/module layout, component breakdown, test strategy.
- Exact sprite designs (original), sound designs (original), copy for joke files.
- Icon placement details, window default sizes, animation timings.
- Whether icons are user-draggable (nice to have).

## 7. Reference images
All in `docs/reference/` (originals from the 2026-11-19 session):
- **Exact style target:** `01-3d-style-target.jpg` (the grass-hill render with the thick
  dialog, voxel icons, giant cursor). Everything 3D should match this look.
- **Layout targets (structure, not pixels):** `11-music-window.png` (My Music),
  `05-contact-window.webp` (Contact Me), `06-volume-popover.png` (tray volume),
  `04-mitch-resume-window.webp` (résumé viewer), `07-boot-screen.png`,
  `08-login-screen.png` (boot/login structure only — our logo/wordmark are original).
- **Mood / feature reference only:** `02-paint-hill-mood.jpg`,
  `03-mitch-desktop-features.webp`, `09-start-menu-classic.jpg`,
  `10-spotify-embed.png` (the playlist embed code Kayzee shared).
- Playlist data snapshot: `docs/playlist-snapshot.json`.
- Visual mockups rendered with the real tech (throwaway spike): `spike/v*/shot.png`.

## 8. Builder's calls (made by Claude, correctable)
- **Ship everything at once** ("one-shot"), but build in risk order: 3D world + CSS3D
  window manager first (prove iframes, thickness, shadows, crisp text), then the
  recruiter path (About, Résumé, Projects/Explorer, Contact, deep links, admin), then
  Music, then Notepad/Paint/Recycle Bin, then Mines, Solitaire, and Pinball last.
  If time or frame rate forces a cut, cut in reverse order: Pinball first, then
  time-of-day presets, then Paint.
- **Résumé content lives in code** as a structured data file generated from the master
  CV (not editable in admin). Admin holds only the PDF link. Updating = edit data file
  + redeploy (or ask Claude).
- **Seed projects** come from Kayzee's 4 published Playbook pages; later additions go
  through admin. The live site cannot use Claude's Playbook connector.

## 9. Open questions for Kayzee
(filled in after the mockup review)
