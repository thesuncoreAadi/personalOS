# Preview locally & deploy for free

The build output is **static files** and can still be hosted on Vercel or another static host. Optional cross-device
sync uses Supabase Auth and Postgres; local storage remains the offline fallback.

Two facts that shape everything below:

- **Hash routing.** Every URL looks like `https://host/#/tasks`. Nothing after `#` is ever sent to
  the server, so every page load requests `/` and the app routes itself. You need **no SPA rewrite
  rule** on any host.
- **Relative asset paths.** `vite.config.ts` sets `base: './'`, so `dist/index.html` references
  `./assets/…`. This works at a domain root *and* in a subdirectory, which is what makes GitHub
  Pages work with zero config.

---

## Part 1 — Preview on your laptop

### 1. Install Node once

Node 20 or newer. Check with `node -v`. If missing: [nodejs.org](https://nodejs.org) (LTS
installer) or `winget install OpenJS.NodeJS.LTS` on Windows / `brew install node` on macOS.

### 2. Get the project onto your laptop

Copy the `pos` folder (USB, cloud drive, or a git clone if you push it first — see Part 2, step 1).

### 3. Install dependencies

```bash
cd pos
npm install
```

Takes 20–60s, downloads into `node_modules` (already git-ignored). You only repeat this when
`package.json` changes.

### 4a. Development mode — live reload while you edit

```bash
npm run dev
```

Open **http://localhost:5173**. Edit any file and the browser updates instantly.

Note: the port is `strictPort: true`, so if 5173 is already taken the command exits with an error
rather than picking another port. Change `server.port` in `vite.config.ts` if that happens.

### 4b. Production preview — exactly what users will see

```bash
npm run build     # → dist/
npm run preview   # → http://localhost:4173
```

Use this before deploying. If something only breaks in production, it's almost always a
`base`/path issue, and this reproduces it.

### 5. Optional: see it on your phone over Wi-Fi

`vite.config.ts` already binds `0.0.0.0`, so on the same network open
`http://<your-laptop-ip>:5173`. Find the IP with `ipconfig` (Windows), `ipconfig getifaddr en0`
(macOS) or `hostname -I` (Linux). Windows will prompt for a firewall permission the first time.

### Before you publish, check these

```bash
npm test         # 107 tests
npm run typecheck
npm run build    # must exit 0
```

---

## Part 2 — Deploy free, reachable from any device

Pick **one**. All are genuinely free for a personal app of this size.

### Option A — GitHub Pages (no CLI, easiest to reason about)

Free forever for public repos. Downside: your code is public.

1. Create a GitHub account, then a **new public repository**, e.g. `pos`.
2. From inside the project folder:

   ```bash
   git init
   git add .
   git commit -m "Personal OS"
   git branch -M main
   git remote add origin https://github.com/<you>/pos.git
   git push -u origin main
   ```

   `dist/` and `node_modules/` are already in `.gitignore`, so only source goes up.

3. In the repo: **Settings → Pages → Source: Deploy from a branch → Branch: `main` → `/dist`**.
4. Problem: `/dist` isn't committed, so there's nothing to serve yet. Commit the build:

   ```bash
   npm run build
   git add -f dist        # -f because .gitignore lists dist
   git commit -m "build"
   git push
   ```

   Repeat `npm run build && git add -f dist && git commit && git push` after every change. It's
   clunky — that's why Options B–D, which build on the server, are nicer if you have a GitHub
   account anyway.

5. Your site is at `https://<you>.github.io/pos/`. Works with no extra config because of `base: './'`.

### Option B — Cloudflare Pages (auto-deploys on push, custom domain free)

1. Push to GitHub as in Option A, step 2.
2. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Create → Pages →
   Connect to Git** → pick the repo.
3. Build settings: build command `npm run build`, output directory `dist`. Save.
4. Wait ~1 minute. You get `https://pos.pages.dev`. Every future `git push` redeploys
   automatically, and it serves over HTTPS on any device.

### Option C — Netlify (same idea, drag-and-drop shortcut)

1. [app.netlify.com](https://app.netlify.com) → **Add new site → Import from Git**, or simply
   **drag the `dist` folder onto the dashboard** for an instant throwaway URL.
2. For auto-deploy: build command `npm run build`, publish directory `dist`.
3. Free tier gives you `https://<random>.netlify.app` and unlimited bandwidth for personal use.

### Option D — Vercel

`npm i -g vercel` then `vercel` inside the project. It auto-detects Vite. Deploy when it asks.
You get `https://pos.vercel.app`.

### Option E — Your own machine or server (self-host)

If you have a home server, VPS, or old laptop you can leave on:

```bash
npm run build
node scripts/static-server.mjs dist 8080     # no dependencies, Node only
```

`scripts/static-server.mjs` is a ~70-line Node-only server I verified against the real build:
`/` → 200 HTML, `assets/*.js` → 200 with `text/javascript`, `favicon.svg` → 200 `image/svg+xml`,
unknown deep paths → SPA fallback, and `../` traversal (raw and percent-encoded) returns the
fallback page rather than a file outside `dist/`.

Then reach it from other devices at `http://<that-machine's-ip>:8080` while on the same network.

To make it reachable from anywhere:

- **Cloudflare Tunnel** (`cloudflared tunnel --url http://localhost:8080`) gives you a public
  HTTPS URL without opening router ports.
- **Tailscale** on every device gives you a private network — simplest and most secure, but the
  other devices need the app installed.

Opening a port on your home router is not recommended for a personal dashboard.

---

## Supabase setup for cross-device sync

1. Create a Supabase project. In **Authentication → URL Configuration**, allow your local development URL and deployed
   Vercel URL as redirect URLs. Enable email sign-in and configure the email provider/template.
2. In the Supabase SQL editor, run `supabase/migrations/20261014000000_personal_os_workspaces.sql`.
   It creates a single JSON workspace row per user and enables Row Level Security. The browser's database access is
   limited to the authenticated user's row; saving also uses a compare-and-save RPC to detect stale device copies.
3. Copy `.env.example` to `.env.local` for local development and fill in the project URL and **publishable/anon** key.
   These values are public browser configuration. Never use the service-role key or database password in Vite variables.
4. In Vercel, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the Production, Preview, and Development
   environments you use, then redeploy. Vite embeds these values at build time.
5. Open Settings → Cross-device sync and request an email sign-in link. On first sign-in, choose whether to upload the
   local workspace. If both cloud and local workspaces exist, download the backup for the copy being replaced before
   choosing which copy to keep.

Edits save locally first and cloud writes are debounced. If a second device changed the cloud copy since this device
last loaded it, the compare-and-save call refuses the stale write and Settings asks you to resolve the copies. When
offline, the workspace stays usable locally; reconnect and sync when online. Export and Restore continue to work.

---

## Deploy checklist

- [ ] `npm test` → 107 passed
- [ ] `npm run typecheck` → clean
- [ ] `npm run build` → exit 0, `dist/` produced
- [ ] `npm run preview` → works at `http://localhost:4173`
- [ ] Load the deployed URL on a phone: nav drawer opens, all 8 routes render, modals scroll
- [ ] Settings → Export once, and keep the file somewhere safe — it's your only backup
- [ ] Bookmark the URL; add to home screen on the phone if you want an app-like launcher
