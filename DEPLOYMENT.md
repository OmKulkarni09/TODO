# Deployment — get a public URL for free

This guide deploys the app to two free services that auto-redeploy on every `git push`:

- **Frontend → Vercel** — free, no sleep, custom domain, fast CDN
- **Backend → Render** — free, sleeps after 15 min idle (~30s cold start), good enough for personal use

End result: you get a URL like `https://venom-todo.vercel.app` you can share with anyone.

> ✅ **Multi-user is now built in.** Each visitor registers their own account (email + password). Tasks, categories, and stats are scoped per-user — no one sees anyone else's data. Passwords are bcrypt-hashed; sessions use signed JWTs.

The code is already prepared for deployment:
- `frontend/src/api.js` reads `VITE_API_BASE` (set on Vercel) and attaches the bearer token automatically
- `backend/main.py` reads `CORS_ORIGINS` and `SECRET_KEY` (set on Render)
- `render.yaml` bootstraps the backend service and **auto-generates** a `SECRET_KEY` on first deploy

---

## Step 1 · Deploy the backend to Render (~3 min)

1. Go to <https://dashboard.render.com/register> and sign up with your GitHub account (no credit card needed).
2. Click **New +** → **Blueprint** → connect your `OmKulkarni09/TODO` repo.
3. Render reads [`render.yaml`](render.yaml) and proposes a service called `venom-todo-api`. Click **Apply**.
4. Wait ~2 minutes for the first deploy. When done, copy the URL Render gives you — it'll look like:
   ```
   https://venom-todo-api.onrender.com
   ```
5. Test the API:
   - Visit `<your-url>/docs` — you should see the Swagger UI.
   - Visit `<your-url>/` — should return `{"name": "Modern Todo API", "status": "ok"}`.

> 📝 **Free tier note** — Render free web services sleep after 15 min of no traffic. The first request after sleep takes ~30s to wake up. Also, the disk is *ephemeral* — every redeploy wipes the SQLite DB. For personal use this is usually fine; if you need persistent data, upgrade to a paid plan or switch to Render's free Postgres (see the "Persistent data" section below).

---

## Step 2 · Deploy the frontend to Vercel (~2 min)

1. Go to <https://vercel.com/signup> and sign up with your GitHub account.
2. Click **Add New** → **Project** → import your `OmKulkarni09/TODO` repo.
3. Configure:
   - **Root Directory**: `frontend` ← click *Edit* and set this
   - Framework Preset: should auto-detect as **Vite** ✓
   - Build Command: `npm run build` (auto-filled)
   - Output Directory: `dist` (auto-filled)
4. Expand **Environment Variables** and add one:
   - **Name**: `VITE_API_BASE`
   - **Value**: the Render URL from Step 1 (e.g. `https://venom-todo-api.onrender.com`)
5. Click **Deploy**. Wait ~1 minute.
6. Vercel gives you a URL like `https://todo-omkulkarni09.vercel.app`. **This is your shareable link.** 🎉

---

## Step 3 · Lock CORS (recommended, 30 seconds)

By default the backend allows all origins (`*`). Tighten it to just your Vercel URL:

1. Back in **Render dashboard → your service → Environment**
2. Add (or edit) the `CORS_ORIGINS` env var:
   - **Name**: `CORS_ORIGINS`
   - **Value**: your Vercel URL (e.g. `https://todo-omkulkarni09.vercel.app`)
3. Save — Render redeploys automatically (~1 min).

Now only your frontend can hit the API. If you ever change the Vercel URL (e.g. custom domain), update this value.

---

## You're done

Visit your Vercel URL. The app boots up, your tasks persist (until the next backend redeploy on free tier), and you can share the link with anyone.

**Routine workflow from now on:**
```bash
# Make changes locally, test with ./start.sh / .\start.ps1
git add .
git commit -m "describe what changed"
git push
```

That single `git push` triggers:
1. GitHub Actions runs both test suites (133 backend + 66 frontend)
2. Render rebuilds + redeploys the API (~1-2 min)
3. Vercel rebuilds + redeploys the frontend (~30s)

All three run in parallel.

---

## Alternative: Railway (better for persistent data)

Render's free tier wipes the SQLite DB on every redeploy. If you want data to **persist across deploys**, use Railway instead:

1. Go to <https://railway.app> → sign in with GitHub.
2. **New Project** → **Deploy from GitHub repo** → pick your repo.
3. Railway detects the backend automatically. Configure:
   - **Service settings → Root directory**: `backend`
   - **Service settings → Start command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Volumes** → attach a 1GB volume at `/app/backend` (or wherever `todos.db` lives)
4. Railway gives you a backend URL. Use it as `VITE_API_BASE` on Vercel exactly like Step 2 above.

Railway's free tier is **$5 of monthly credit** — enough to run a small app 24/7 without ever sleeping. When the credit runs out (rarely happens for personal use), the service pauses until next month.

---

## Persistent data option (Render + Postgres)

If you want to stay on Render but need persistent data, replace SQLite with Render's free Postgres (300 MB free).

1. **Render dashboard → New + → PostgreSQL** → name it `venom-todo-db`, free plan.
2. Copy its **Internal Database URL** (e.g. `postgresql://user:pass@host/dbname`).
3. In your backend's environment, add:
   - **Name**: `DATABASE_URL`
   - **Value**: that internal URL
4. Update [`backend/database.py`](backend/database.py):
   ```python
   import os
   DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./todos.db")
   # For SQLite local dev, keep connect_args; for Postgres prod, drop it
   if DATABASE_URL.startswith("sqlite"):
       engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
   else:
       engine = create_engine(DATABASE_URL)
   ```
5. Add `psycopg2-binary` to `backend/requirements.txt`.

Now `todos.db` is used in dev, Postgres in prod. Data persists forever.

---

## GitHub Pages alternative for the frontend

If you'd rather keep everything on GitHub:

1. **Settings → Pages → Source: GitHub Actions**.
2. Add `.github/workflows/deploy-pages.yml`:

```yaml
name: Deploy frontend to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run build
        env:
          VITE_API_BASE: ${{ secrets.VITE_API_BASE }}
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: frontend/dist
      - uses: actions/deploy-pages@v4
```

3. **Repository → Settings → Secrets and variables → Actions** — add `VITE_API_BASE` = your Render URL.
4. Set `base: '/TODO/'` in `frontend/vite.config.js` (Pages serves under a subpath).
5. Push to main. Within ~2 minutes, the site is live at `https://omkulkarni09.github.io/TODO/`.

---

## Comparison table

| Option | Frontend | Backend | Always-on backend? | DB persists between deploys? | Custom domain? | Difficulty |
|---|---|---|---|---|---|---|
| **Vercel + Render** (recommended) | Vercel | Render free | ✗ (sleeps 15 min) | ✗ (ephemeral disk) | ✓ both | Easiest |
| **Vercel + Railway** | Vercel | Railway $5 credit | ✓ until credit runs out | ✓ with volume | ✓ both | Easy |
| **Vercel + Render + Postgres** | Vercel | Render free | ✗ (sleeps) | ✓ (300MB free Postgres) | ✓ both | Medium |
| **GitHub Pages + Render** | GitHub Pages | Render free | ✗ | ✗ | ✓ Pages only | Medium |
| **Fly.io** (both services) | Fly | Fly | ✓ (free allowance) | ✓ (volumes) | ✓ | Hardest |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Frontend loads but `Failed to fetch` in console | `VITE_API_BASE` not set on Vercel, or the backend's URL is wrong. Check the value matches Render's URL exactly (incl. `https://`). |
| `CORS error` blocked by browser | The Render backend's `CORS_ORIGINS` env var doesn't include your Vercel URL. Update it on Render and wait for redeploy. |
| Render says *"deploy failed: pip install error"* | Most often a Python version mismatch — `render.yaml` pins 3.12. Check Render service logs. |
| Render service sleeps after 15 min | This is the free-tier behavior. First request after sleep takes ~30s. Use Railway or paid Render plan for always-on. |
| Data disappeared after I made a code change | Render's free tier disk is ephemeral — every redeploy wipes `todos.db` (your **users + tasks all reset**). Switch to Postgres (steps above) for persistence — strongly recommended once you have real users. |
| All users got logged out after a redeploy | `SECRET_KEY` was regenerated. If you set it manually in Render, it stays stable; `generateValue: true` in `render.yaml` only generates it on FIRST deploy. |
| Vercel build fails on `npm run build` | Run `npm run build` locally first to confirm it works. Most often a missing env var or a syntax error caught by Vite. |
| Login works locally but fails on prod | Most often: backend's `CORS_ORIGINS` doesn't include your Vercel URL, OR `VITE_API_BASE` on Vercel is wrong. Check both. |
| First push to GitHub asked for password | On Windows, Git Credential Manager opens a browser to sign in to GitHub. On Linux/macOS, use a [personal access token](https://github.com/settings/tokens) as the password. |
