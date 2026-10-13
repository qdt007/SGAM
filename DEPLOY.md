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

## Status — live since 2026-09-24

| Piece | Where |
|---|---|
| Frontend | https://sgam-xi.vercel.app |
| API | https://pm-api-zdtj.onrender.com (`/health` for a pulse) |
| Database | Neon, 3 migrations applied, demo data loaded |
| Uploads | Cloudinary, folder `pm-uploads/` |

Verified end to end: CORS, login, register, an authenticated request, and the Socket.io
handshake. Demo login is `demo@test.com` / `Demo1234!`.

The steps below are kept as the record of how it was set up, and for rebuilding it from scratch.

**Outstanding:** rotate the Neon password (see the security note at the bottom).

---|---|
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

9. At the top of the page Render shows your URL — it carries a random suffix, so copy the real
   one rather than typing anything from this guide. **Copy it.** Open `<that URL>/health` in a browser — you should see:

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
   | `VITE_API_URL` | your Render URL **+ `/api`** |
   | `VITE_SOCKET_URL` | your Render URL, **no** `/api` |

   Use the URL Render gave you in step 3, copied from its dashboard. It contains a random
   suffix, so it is never literally `pm-api-xxxx` — that placeholder resolves to nothing and the
   app fails to log in with no visible error. Paste your own, twice, differing only by `/api`.

8. Click **Deploy**. Two to three minutes.
9. Vercel shows your deployment URL at the top of the project page. **Copy the real one** — the
   name `sgam` may already be taken by someone else, so yours is likely something like
   `sgam-qdt007.vercel.app` or `sgam-a1b2c3.vercel.app`. Open it; the login page should appear.

Logging in will still fail at this point. That is expected; step 5 fixes it.

---

## Step 5 — Introduce them to each other

The backend currently refuses requests from your Vercel address, because you set `CLIENT_URL` to
localhost in step 3. That is a security feature (CORS), not a bug.

1. In **Render** → your `pm-api` service → **Environment** in the left sidebar.
2. Edit `CLIENT_URL` and set it to **your own** Vercel URL, copied from the Vercel dashboard:

   ```
   https://YOUR-PROJECT.vercel.app
   ```

   Do not guess it and do not copy the example above. `sgam.vercel.app` belongs to someone else;
   pointing at it means your real site gets blocked by CORS and login fails with no useful error.
   No trailing slash, and `https` not `http` — it must match character for character.
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

## payOS (thanh toán thật)

Cổng chính. Checkout chọn nhà cung cấp theo biến môi trường nào có mặt: **payOS → VNPay → mô
phỏng**. Máy dev không đặt gì cả thì vẫn chạy ở chế độ mô phỏng, không cần tài khoản merchant.

**1. Lấy khoá.** Đăng nhập https://my.payos.vn, vào kênh thanh toán của bạn, lấy ba giá trị.
Cả ba phải cùng **một** kênh — trộn khoá của hai kênh là lỗi khó thấy nhất, vì nó không báo sai
khoá mà báo sai chữ ký.

**2. Đặt trên Render → Environment:**

| Biến | Lấy ở đâu |
|---|---|
| `PAYOS_CLIENT_ID` | Kênh thanh toán → Client ID |
| `PAYOS_API_KEY` | Kênh thanh toán → API Key |
| `PAYOS_CHECKSUM_KEY` | Kênh thanh toán → Checksum Key |

`PAYOS_RETURN_URL` đã khai sẵn trong `render.yaml`.

**3. Đăng ký webhook.** payOS không gửi gì cho tới khi URL được đăng ký, và việc đăng ký không
phải là lưu một chuỗi: payOS **gọi thử ngay lập tức** và từ chối nếu URL không trả 2xx. Nên
server phải đã deploy và đang thức. Mở `/health` trước cho Render dậy, rồi:

```bash
cd server
npm run payos:webhook -- https://pm-api-zdtj.onrender.com/api/billing/payos/webhook
```

Chạy từ máy bạn cũng được — nó chỉ gọi API payOS, không cần chạy trên server.

**4. Kiểm tra.** `GET /health` trả thêm `payments`:

```json
"payments": { "configured": true, "missing": [] }
```

`missing` liệt kê đúng biến nào còn thiếu.

**Webhook là thứ duy nhất bật gói Pro.** `POST /api/billing/payos/webhook` không có session —
payOS không có — nên không có gì được tin trước khi SDK xác thực chữ ký. URL return chỉ báo tin,
vì ai cũng gõ tay được.

**Không dựng lại chữ ký bằng tay.** `config/payos.ts` dùng SDK `@payos/node` cho cả ký lẫn xác
thực. VNPay bắt phải tự tái tạo chuỗi ký đến từng ký tự và mọi sai lệch đều trả về "Sai chữ ký"
không kèm manh mối — đó chính là lý do SDK ở đây là một dependency chứ không phải 90 dòng HMAC.

**Vài ràng buộc của payOS dễ vấp:**

- `orderCode` là **số nguyên**, duy nhất với merchant **vĩnh viễn**. Xin link lần hai với cùng
  một mã là lỗi, không phải link mới. Nên mỗi lần checkout sinh mã mới và đóng đơn cũ.
- `description` bị cắt còn **9 ký tự** với tài khoản ngân hàng chưa liên kết qua payOS. Đó là
  nội dung chuyển khoản người trả nhìn thấy, nên ở đây để `SGAM Pro`.
- Số tiền payOS gửi về là **đồng nguyên**, khác VNPay nhân 100.

**Webhook không chạy được trên localhost** — payOS phải gọi vào được từ internet. Muốn thử trọn
vòng ở máy thì đặt `ngrok` phía trước rồi đăng ký URL của ngrok.

---

## VNPay (dự phòng)

Giữ lại và vẫn chạy được, nhưng chỉ được dùng khi **không** có khoá payOS. Đặt
`VNPAY_TMN_CODE` và `VNPAY_HASH_SECRET` trên Render; `VNPAY_RETURN_URL` đã khai sẵn trong
`render.yaml`. Bỏ trống cả hai lẫn khoá payOS thì checkout quay về mô phỏng.

**Trong portal VNPay** (https://sandbox.vnpayment.vn/merchantv2/) khai IPN URL:

```
https://pm-api-zdtj.onrender.com/api/billing/vnpay/ipn
```

IPN là thứ duy nhất bật gói Pro. Return URL chỉ để báo tin cho người dùng, vì ai cũng gõ tay
được URL đó.

**Thẻ test sandbox:**

| Trường | Giá trị |
|---|---|
| Ngân hàng | NCB |
| Số thẻ | 9704198526191432198 |
| Tên chủ thẻ | NGUYEN VAN A |
| Ngày phát hành | 07/15 |
| OTP | 123456 |

**IPN không chạy được trên localhost** — VNPay phải gọi vào được từ internet. Test local chỉ đi
tới bước sang trang VNPay rồi quay về; muốn thử trọn vòng phải deploy, hoặc mở `ngrok`.

**Mỗi TmnCode đi với đúng một HashSecret.** Dùng lẫn secret của terminal khác thì VNPay không
báo "Sai chữ ký" — nó nhận chữ ký rồi mới chặn ở bước sau, nên lỗi trông như vấn đề khác hẳn.
Lấy cả hai từ cùng một email cấu hình của VNPay.

**Các mã lỗi VNPay trả về trên URL `Error.html?code=`** đều là trạng thái tài khoản merchant, không
phải lỗi code — sửa trong portal hoặc liên hệ VNPay, đừng sửa `config/vnpay.ts`:

| code | Nghĩa | Làm gì |
|---|---|---|
| 71 | Website chưa được phê duyệt | Chờ VNPay duyệt terminal |
| 76 | Terminal chưa bật phương thức thanh toán nào | Khai IPN URL trong SIT Testing rồi chờ duyệt |
| 03 | Dữ liệu gửi sang sai định dạng | Kiểm tra `vnp_Amount` (phải nhân 100) và `vnp_ExpireDate` |

Khi terminal đã thông, mở URL checkout sẽ thấy 302 sang
`/paymentv2/Transaction/PaymentMethod.html?token=...` — đó là trang chọn phương thức, tức đã chạy.

---

## App Android

Không deploy ở đâu cả — nó là một file APK bạn gửi cho người ta. Chi tiết trong
`mobile/README.md`; phần liên quan tới deploy chỉ có hai điều:

**1. API phải cho phép origin của app.** Capacitor báo origin là `https://localhost` (Android) và
`capacitor://localhost` (iOS). `server/src/config/cors.ts` đã khai sẵn trong `NATIVE_ORIGINS`, nên
không phải thêm gì vào `CLIENT_URL`. Nếu ai xoá mấy dòng đó, app mở ra **trắng trang** và lý do chỉ
hiện trong logcat.

**2. Địa chỉ API nung vào lúc build.** APK không có server nào ở localhost để `/api` tương đối trỏ
tới, nên nó phải là URL tuyệt đối và phải là https:

```bash
cd mobile
echo https://pm-api-zdtj.onrender.com/api > api-url.txt
npm run apk
```

Đổi domain API thì phải sửa file đó **và build lại APK** — bản đã phát ra không tự biết.

---

## Checklist

- [ ] `https://<render-url>/health` returns `{"status":"ok"}`
- [ ] The Vercel URL shows the login page
- [ ] `demo@test.com` / `Demo1234!` signs in
- [ ] Three projects are listed with tasks in them
- [ ] Dragging a card on the Kanban board sticks after a refresh
- [ ] Two browser tabs side by side — a change in one shows up in the other (realtime works)
- [ ] A file attached to a task downloads after a hard refresh (Cloudinary works)
- [ ] `/health` shows `"payments": { "configured": true }`
- [ ] Upgrading to Pro opens payOS, and paying flips the account to PRO without a refresh
- [ ] Chat nhóm gửi được, `@tên` một thành viên thì người đó thấy thông báo
- [ ] Ghim một tin → cả nhóm nhận thông báo, tin hiện ở mục "Thông báo đã ghim"
- [ ] Nêu một khó khăn mức "Đang chặn" → các thành viên khác nhận thông báo (và email nếu có SMTP)
- [ ] Đổi trạng thái dự án → thành viên khác nhận thông báo nói rõ trường nào đổi
- [ ] APK cài lên điện thoại, đăng nhập được và thấy đúng dữ liệu như trên web

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

**Render build fails with `TS7016: Could not find a declaration file for module 'express'`** (or
`TS2694: Namespace 'global.Express' has no exported member 'Multer'`). npm skips devDependencies
whenever `NODE_ENV=production`, which takes TypeScript and all the `@types` packages with it. The
build command in `render.yaml` uses `npm ci --include=dev` to override that. If you edited the
build command in the Render dashboard, put the flag back.

**Render keeps building the old commit.** Blueprint changes need a sync. Open the **Blueprint**
page (left sidebar → your blueprint) and click **Manual sync** at the top right.

**The build succeeds but the deploy fails with `P1012 ... the URL must start with the protocol
postgresql://`.** `DATABASE_URL` in Render is missing or malformed. Render stores the value
exactly as typed, so the three usual causes are:

- the variable was never filled in
- it was copied **with the surrounding quotes** — `"postgresql://..."` starts with `"`
- it was copied from Neon's `psql 'postgresql://...'` command, including the `psql ` prefix

The value must begin with `postgresql://` and end with `?sslmode=require`, with no quotes and no
trailing space. Copy it from `server/.env.remote.local`, taking everything after the `=`.

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
