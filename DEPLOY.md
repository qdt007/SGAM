# Deploying — step by step

Written for someone who has not used these sites before. Follow it top to bottom.
Nothing here gets installed on your computer; every step is a web page or a command you paste.

**The shape:** your code lives on GitHub. Render builds the backend from it, Vercel builds the
frontend from it. The database is at Neon and uploaded files go to Cloudinary. Your laptop can be
switched off and the site stays up.

```
GitHub ──┬──> Render  (server/)  ──> Neon        (database)
         │                       └─> Cloudinary  (uploaded files)
         └──> Vercel  (client/)  ──> talks to Render over HTTPS
```

---

## Status

| Step | State |
|---|---|
| Neon database | **Done** — 3 migrations applied, demo data loaded (7 users, 3 projects, 32 tasks) |
| Push to GitHub | **Done** — commit `c2b01df` on `main` |
| Cloudinary | Step 1 below |
| Render (backend) | Step 3 below |
| Vercel (frontend) | Step 4 below |
| Connect the two | Step 5 below |

Your Neon connection strings are saved in `server/.env.remote.local`. That file is gitignored —
it must never be committed. Open it when a step below asks for the database URL.

---

## Step 1 — Cloudinary (file uploads)

Render deletes its own disk every time it redeploys, so uploaded files cannot live there.
Cloudinary stores them instead. Free, no card.

1. Go to **cloudinary.com** and click **Sign up for free**.
2. Sign up with Google or GitHub — fastest, and it skips the password step.
3. It asks what you do. Any answer is fine, it only changes the marketing email.
4. Confirm your email if it sends one.
5. You land on the **Dashboard**. At the top is a box titled **Product Environment Credentials**
   (older accounts call it **Account Details**) with three values:

   ```
   Cloud name:  something like  dxxxxxxxx
   API Key:     a long number   123456789012345
   API Secret:  hidden — click the eye icon to reveal it
   ```

6. Copy all three somewhere for a minute. You will paste them into Render in step 3.

**Do not** put these in any file in the project. They go in the Render dashboard only.

---

## Step 2 — Push the code to GitHub — already done

Render and Vercel can only build what is on GitHub. This is done: commit `c2b01df` is on `main`
at `github.com/qdt007/SGAM`, with `render.yaml` and `client/vercel.json` in place and no `.env`
file anywhere in the repo.

Nothing to do here. For future changes, pushing to `main` is enough — Render and Vercel both
rebuild automatically when they see a new commit.

```powershell
git add -A
git commit -m "your message"
git push
```

---

## Step 3 — Render (the backend)

Render runs the Node server: the API, the realtime socket, the reminder job.

1. Go to **render.com** → **Get Started** → **Sign in with GitHub**.
2. GitHub asks permission for Render to see your repos. Approve it. You can choose
   **Only select repositories** and pick just `SGAM` if you prefer.
3. Render may ask for a credit card to verify you are a person. It does not charge the free plan.
   If you would rather not give one, say so and we will use a host that does not ask.
4. In the Render dashboard click **New +** → **Blueprint**.
5. Pick the `SGAM` repository → **Connect**.
6. Render reads `render.yaml` from the repo and shows a service named **pm-api**. Click
   **Apply** / **Create Resources**.
7. It now asks for the values that are not stored in git. Fill in five:

   | Field | What to paste |
   |---|---|
   | `DATABASE_URL` | the **pooled** URL from `server/.env.remote.local` (the one containing `-pooler`) |
   | `CLIENT_URL` | `http://localhost:5173` for now — the real one comes in step 5 |
   | `CLOUDINARY_CLOUD_NAME` | from step 1 |
   | `CLOUDINARY_API_KEY` | from step 1 |
   | `CLOUDINARY_API_SECRET` | from step 1 |

   Leave every SMTP field blank. Emails are optional; in-app notifications still work.
   `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` fill themselves in — do not touch them.

8. The first build takes 3–6 minutes. Watch the **Logs** tab. You want it to end at:

   ```
   All migrations have been successfully applied.
   Server running on port 5000 [production]
   ```

   The migrations are already applied, so it will say there is nothing to do. That is correct.

9. At the top of the page Render shows your URL, like `https://pm-api-xxxx.onrender.com`.
   **Copy it.** Open `<that URL>/health` in a browser — you should see:

   ```json
   {"status":"ok","timestamp":"..."}
   ```

If you see that, the backend is live.

---

## Step 4 — Vercel (the frontend)

1. Go to **vercel.com** → **Sign Up** → **Continue with GitHub**.
2. Choose the **Hobby** plan (free) when asked. It is for personal projects — this qualifies.
3. Click **Add New...** → **Project**.
4. Find `SGAM` in the repo list → **Import**.
5. **This is the step people get wrong.** Expand **Root Directory**, click **Edit**, and choose
   the `client` folder. If you leave it at the repo root the build fails, because the React app
   is not there.
6. Framework Preset should say **Vite**. Leave the build settings alone; `client/vercel.json`
   already sets them.
7. Expand **Environment Variables** and add two, both using your Render URL from step 3:

   | Name | Value |
   |---|---|
   | `VITE_API_URL` | `https://pm-api-xxxx.onrender.com/api` — note the `/api` on the end |
   | `VITE_SOCKET_URL` | `https://pm-api-xxxx.onrender.com` — no `/api` |

8. Click **Deploy**. Two to three minutes.
9. You get a URL like `https://sgam.vercel.app`. Open it — the login page should appear.

Logging in will still fail at this point. That is expected; step 5 fixes it.

---

## Step 5 — Introduce them to each other

The backend currently refuses requests from your Vercel address, because you set `CLIENT_URL` to
localhost in step 3. That is a security feature (CORS), not a bug.

1. In **Render** → your `pm-api` service → **Environment** in the left sidebar.
2. Edit `CLIENT_URL` and set it to your exact Vercel URL:

   ```
   https://sgam.vercel.app
   ```

   No trailing slash. It must match exactly — `http` instead of `https`, or a `/` on the end, and
   it will not work.
3. **Save Changes**. Render redeploys automatically, about 2 minutes.
4. Reload your Vercel URL and sign in:

   ```
   demo@test.com / Demo1234!
   ```

You should see three projects with tasks, comments and time logs already in them.

---

## Step 6 — Re-seed so the file attachments work

The demo data is already in Neon, but its three attachments were stored locally before Cloudinary
existed, so they will not download. Once step 1 is done, re-run the seed with the Cloudinary keys
and it repairs them.

Open `server/.env.remote.local`, copy the **DIRECT_URL** value (the one without `-pooler`), then
in PowerShell:

```powershell
cd server
$env:DATABASE_URL="<paste DIRECT_URL here>"
$env:STORAGE_TYPE="cloudinary"
$env:CLOUDINARY_CLOUD_NAME="<from step 1>"
$env:CLOUDINARY_API_KEY="<from step 1>"
$env:CLOUDINARY_API_SECRET="<from step 1>"
npm run seed
```

The last lines of the output should read `files 3 (stored via cloudinary)`.

Close that terminal window afterwards. Those variables stay set until you do, and the next
`npm run seed` would hit the live database instead of your local one.

Re-running is safe: it deletes only the three projects and five accounts it created, and clears
the previous run's files out of Cloudinary.

---

## Checklist

- [ ] `https://<render-url>/health` returns `{"status":"ok"}`
- [ ] The Vercel URL shows the login page
- [ ] `demo@test.com` / `Demo1234!` signs in
- [ ] Three projects are listed with tasks in them
- [ ] Dragging a card on the Kanban board sticks after a refresh
- [ ] Two browser tabs side by side — a change in one shows up in the other (realtime works)
- [ ] A file attached to a task downloads after a hard refresh (Cloudinary works)

---

## When something breaks

**The site is very slow the first time, then fine.** Normal. Render's free plan puts the server to
sleep after 15 minutes of no traffic, and waking it takes about 50 seconds. Open
`<render-url>/health` first and wait for it before blaming the app.

**Login fails and the browser console mentions CORS.** `CLIENT_URL` on Render does not exactly
match your Vercel address. Recheck step 5 — usually a trailing slash, or `http` vs `https`.

**Everything loads but nothing updates live.** Same cause, different symptom: the WebSocket is
blocked while ordinary requests still work. Fix `CLIENT_URL`.

**The Vercel build fails with "could not resolve entry" or similar.** Root Directory is not set to
`client`. Project → Settings → General → Root Directory.

**Render build fails on `prisma generate`.** Almost always `DATABASE_URL` — check it is the
**pooled** string and ends with `?sslmode=require`.

**A task attachment gives 404.** Step 6 has not been run with the Cloudinary keys yet.

---

## Security note

The Neon password is in `server/.env.remote.local` and was pasted into a chat. Once everything
above works, rotate it: Neon dashboard → **Roles** → `neondb_owner` → **Reset password**, then
update `DATABASE_URL` in Render → Environment, and in `server/.env.remote.local`. Two minutes,
and the old password stops working.

## Local development is unaffected

`server/.env` still points at your local PostgreSQL with `STORAGE_TYPE=local`, so `start-all.bat`
works exactly as before. Nothing above changed how you work on your machine.
