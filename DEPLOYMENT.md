# Deployment

Two parts to ship:
- **Source code → GitHub** (always step 1)
- **Live app → a hosting provider** (frontend + backend, each can go to a different place)

GitHub itself only hosts static sites via GitHub Pages — and venOM has a Python backend, so you'll deploy the backend to a free service (Render / Railway / Fly.io) and the frontend either to GitHub Pages or Vercel/Netlify.

---

## Part 1 — Push the code to GitHub

### Step 1: Create a GitHub repository

In a browser, go to <https://github.com/new>:
- **Repository name**: `venom-todo` (or whatever you like)
- **Private or Public**: your choice
- ⚠️ **Do NOT** check "Add a README", "Add .gitignore", or "Choose a license" — we already have these locally and the repo needs to be empty for the first push to work cleanly.

Click *Create repository*. You'll see a quick-start page with a URL like `https://github.com/<your-username>/venom-todo.git`. Keep that tab open.

### Step 2: Initialize the local repo

Open PowerShell in the project folder (`todo-app/`) and run:

```powershell
git init
git branch -M main
git add .
git commit -m "Initial commit — venOM todo app"
```

The first commit will include the backend, frontend, tests, docs, and ignore the things in `.gitignore` (your `.venv`, `node_modules`, the local SQLite DB, etc.).

If `git config user.email` and `user.name` haven't been set globally, set them once:

```powershell
git config --global user.email "you@example.com"
git config --global user.name "Your Name"
```

### Step 3: Push to GitHub

Copy the remote URL from the GitHub page, then:

```powershell
git remote add origin https://github.com/<your-username>/venom-todo.git
git push -u origin main
```

The first push prompts for your GitHub credentials. On Windows, **Git Credential Manager** handles this — it opens a browser window to sign in. Subsequent pushes are silent.

### Step 4: Verify

Refresh the GitHub repo page — you should see all your files, plus a green checkmark in a minute or two when the CI workflow finishes running both test suites (it's wired up in `.github/workflows/test.yml`).

---

## Part 2 — Deploy the live app

The frontend is a static SPA after `npm run build`. The backend is a FastAPI app that needs a Python runtime.

**Recommended free-tier combo:** Vercel (frontend) + Render (backend). Both deploy directly from your GitHub repo with no machine setup.

### A) Backend on Render

1. Go to <https://render.com> and sign in with GitHub.
2. Click **New +** → **Web Service** → select your `venom-todo` repo.
3. Configure:
   - **Name**: `venom-todo-api`
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: Free
4. Click *Create Web Service*. Wait ~2 minutes for the first deploy.
5. Copy the public URL Render gives you (something like `https://venom-todo-api.onrender.com`). You'll need it for the frontend.

**Note on SQLite + Render free tier**: Render's free tier has *ephemeral disk* — every redeploy wipes the local DB file. For a personal app that's fine if you don't mind. For persistent data, either:
- Upgrade to a paid plan (gets persistent disk), OR
- Swap SQLite for Render's free Postgres (a few-line change in `database.py`)

### B) Frontend on Vercel

1. Go to <https://vercel.com> and sign in with GitHub.
2. Click **Add New** → **Project** → import your `venom-todo` repo.
3. Configure:
   - **Root Directory**: `frontend`
   - Framework preset auto-detects as **Vite**
   - **Build Command**: `npm run build` (auto-filled)
   - **Output Directory**: `dist` (auto-filled)
4. **Environment Variables** — add one:
   - Name: `VITE_API_BASE`
   - Value: the Render URL from step A.5 (e.g. `https://venom-todo-api.onrender.com`)
5. Click *Deploy*. Wait ~1 minute.
6. Copy Vercel's URL (something like `https://venom-todo.vercel.app`) and open it in your browser. 🎉

> Note: the current frontend calls `/api/...` and Vite's dev proxy maps that to the backend at localhost. For production you need to point at the deployed backend. **See the small frontend change below.**

#### Required frontend change for production

Edit [`frontend/src/api.js`](frontend/src/api.js) to use the env var when present:

```js
const BASE = import.meta.env.VITE_API_BASE
  ? `${import.meta.env.VITE_API_BASE}`
  : '/api'   // dev — proxied to localhost:8000 by vite.config.js
```

Then in **Render → Settings → Environment**, add an env var on the backend:
- Name: `CORS_ORIGINS`
- Value: `https://venom-todo.vercel.app` (your Vercel URL)

And update [`backend/main.py`](backend/main.py) CORS:

```python
import os
origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Commit, push — Render and Vercel both auto-redeploy on every push to `main`.

---

## Alternative: GitHub Pages (frontend only)

If you'd rather keep everything on GitHub:

1. **Settings → Pages → Source: GitHub Actions**.
2. Add a workflow file at `.github/workflows/deploy-pages.yml`:

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

3. **Repository → Settings → Secrets and variables → Actions** — add `VITE_API_BASE` with your backend URL.
4. Push to main. Within ~2 minutes the site is live at `https://<your-username>.github.io/venom-todo/`.

⚠️ For GitHub Pages, you'll also need to set `base: '/venom-todo/'` in [`frontend/vite.config.js`](frontend/vite.config.js) so asset paths resolve correctly under the subpath. Vercel/Netlify don't need this.

---

## Alternative: All-in-one with Railway

If you want backend + frontend deployed together with the least clicks:

1. Go to <https://railway.app> → New Project → Deploy from GitHub repo.
2. Railway auto-detects both services. Configure each:
   - **Backend service**: root `backend`, start `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Frontend service**: root `frontend`, start `npm run build && npx serve dist`
3. Railway provides URLs for each service. Set frontend's `VITE_API_BASE` to the backend's URL.

Railway's free credit lets you run this for free for a small personal app; beyond that you pay per usage.

---

## Routine workflow after first deploy

Once GitHub + Render + Vercel are connected, your loop becomes:

```powershell
# edit code locally
git add .
git commit -m "describe the change"
git push
```

That single `git push` triggers:
1. **GitHub Actions** — runs both test suites (backend pytest + frontend vitest). Red ✗ if anything broke.
2. **Render** — pulls main, rebuilds, redeploys the API.
3. **Vercel** — pulls main, rebuilds, redeploys the frontend.

All three happen in parallel, complete in 1–3 minutes total, and you can watch progress live on each provider's dashboard.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `git push` asks for password | Set up Git Credential Manager (Windows installer includes it), or use a personal access token from <https://github.com/settings/tokens> as the password |
| Render free tier is "sleeping" | Free Render web services sleep after 15 min of no traffic. First request after sleep takes ~30s while it wakes up. |
| `CORS error` in browser console | Add your Vercel URL to `CORS_ORIGINS` env var on Render, then redeploy |
| Frontend works but data calls 404 | Double-check `VITE_API_BASE` is set on Vercel — and that you re-deployed after setting it (env-var changes need a redeploy) |
| GitHub Pages 404 on subpath | Set `base: '/<repo-name>/'` in `vite.config.js` |
| Repo too big to push | Verify `.gitignore` is excluding `node_modules` and `.venv` (root-level `.gitignore` covers both) |
