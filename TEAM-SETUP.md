# 🚀 Team Setup Guide — XTools Intelligent

Panduan untuk semua anggota tim sebelum mulai mengerjakan task.

---

## 👋 Langkah Pertama — Bilang ke AI Kamu

Sebelum apapun, buka Windsurf dan ketik perintah ini ke AI-mu:

> **"Cari file `task-[namakamu].md` di root project ini, baca isinya, dan bantu saya mengerjakan semua task di file tersebut step by step. Mulai dari branch `feat/[branch-di-file-task]`."**

Contoh untuk Dekres:
> *"Cari file `task-dekres.md` di root project ini, baca isinya, dan bantu saya mengerjakan semua task di file tersebut step by step. Mulai dari branch `feat/email-send-api`."*

| Nama | File Task | Branch |
|------|-----------|--------|
| **Yastika** | `task-yastika.md` | `feat/email-setup` |
| **Dekres** | `task-dekres.md` | `feat/email-send-api` |
| **Prayoga** | `task-prayoga.md` | `feat/send-email-button` |
| **Qiuqiu** | `task-qiuqiu.md` | `feat/dashboard-email-ui` |
| **Widi** | `task-widi.md` | `feat/queue-upgrade` |

---

## 📥 Step 1 — Clone atau Pull Project

**Jika belum punya project di komputer (clone pertama kali):**

```bash
git clone https://github.com/Cannon-xco/x-tools-inteligent.git
cd x-tools-inteligent
```

**Jika sudah punya project (update ke versi terbaru):**

```bash
git fetch origin
git checkout main
git pull origin main
```

---

## 🌿 Step 2 — Buat Branch Nama Kamu

Buat branch sesuai yang tertulis di file task masing-masing:

```bash
# Ganti feat/nama-branch sesuai branch di file task kamu
git checkout -b feat/email-setup       # Yastika
git checkout -b feat/email-send-api    # Dekres
git checkout -b feat/send-email-button # Prayoga
git checkout -b feat/dashboard-email-ui # Qiuqiu
git checkout -b feat/queue-upgrade     # Widi
```

> Jika branch sudah ada sebelumnya: `git checkout feat/nama-branch`

---

## ⚙️ Step 3 — Install Dependencies

```bash
npm install
```

---

## 🔑 Step 4 — Setup Environment

```bash
copy env.example .env.local
```

Buka `.env.local` dan isi nilai yang nyata (minta dari Widi):

| Variable | Isi dengan |
|----------|-----------|
| `DATABASE_URL` | Minta dari Widi |
| `OPENROUTER_API_KEY` | Minta dari Widi |
| `RESEND_API_KEY` | Minta dari Widi |
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` |
| `RESEND_FROM_NAME` | `XTools Outreach` |
| `ALLOWED_ORIGINS` | `localhost:3000` |

> ⚠️ Jangan commit `.env.local` — sudah di `.gitignore`

---

## 📖 Step 5 — Baca File Task Kamu

Buka file task sesuai namamu dan ikuti semua instruksi di dalamnya:

```
task-yastika.md   ← Yastika
task-dekres.md    ← Dekres
task-prayoga.md   ← Prayoga
task-qiuqiu.md   ← Qiuqiu
task-widi.md      ← Widi
```

---

## 💻 Step 6 — Jalankan Dev Server (untuk test)

```bash
npm run dev
```

Buka browser: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

---

## ✅ Step 7 — Cek TypeScript Sebelum Commit

```bash
npx tsc --noEmit
```

Harus output kosong (0 errors) sebelum commit.

---

## 🚀 Step 8 — Commit dan Push

```bash
git add .
git commit -m "feat(email): deskripsi singkat perubahan kamu"
git push origin feat/nama-branch-kamu
```

---

## 🔁 Step 9 — Buat Pull Request

1. Buka [github.com/Cannon-xco/x-tools-inteligent](https://github.com/Cannon-xco/x-tools-inteligent)
2. Klik **"Compare & pull request"**
3. Target branch: `main`
4. Judul PR: `feat(email): [deskripsi singkat]`
5. Tag reviewer: **@Widi**
6. Klik **"Create pull request"**

---

## ❓ Rules Umum

- ⛔ Jangan edit file yang tidak ada di task kamu
- ⛔ Jangan hardcode API key di dalam code
- ✅ Selalu buat branch baru, jangan langsung kerja di `main`
- ✅ Tanya AI dulu sebelum tanya ke Widi
- ✅ Jika bingung, buka file task dan baca ulang dari awal
