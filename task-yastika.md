  # Task: YASTIKA — Install Resend + Setup Environment

**Branch:** `feat/email-setup`
**Estimasi:** 3–4 jam
**Reviewer:** Widi

---

## 🎯 Tujuan

Setup library pengiriman email (`resend`) dan pastikan semua environment variable sudah terkonfigurasi di local dan Railway.

---

## ✅ TASK 1 — Install Package Resend

Jalankan command berikut di root project:

```bash
npm install resend
```

Setelah install, pastikan `package.json` sudah ada entry:
```json
"resend": "^x.x.x"
```

---

## ✅ TASK 2 — Setup `.env.local`

File `env.example` di root project sudah berisi **semua variable yang dibutuhkan** (sudah lengkap, tidak perlu diedit).

**Langkah:**

1. Copy file `env.example` → buat file baru bernama `.env.local`:
   ```bash
   copy env.example .env.local
   ```

2. Buka `.env.local` dan isi nilai yang nyata:

   | Variable | Isi dengan |
   |----------|-----------|
   | `DATABASE_URL` | Minta dari Widi atau pakai local Docker |
   | `OPENROUTER_API_KEY` | Minta dari Widi |
   | `OPENROUTER_MODEL` | Biarkan default (`z-ai/glm-4.5-air:free`) |
   | `RESEND_API_KEY` | Minta dari Widi |
   | `RESEND_FROM_EMAIL` | `onboarding@resend.dev` (untuk testing) |
   | `RESEND_FROM_NAME` | `XTools Outreach` |
   | `ALLOWED_ORIGINS` | `localhost:3000` (untuk local dev) |

> ⚠️ **Jangan pernah commit `.env.local` ke git!** File ini sudah ada di `.gitignore`.

---

## ✅ TASK 3 — Set Env Vars di Railway

1. Buka project di [railway.app](https://railway.app)
2. Pergi ke tab **Variables**
3. Tambahkan 3 variable berikut:

| Variable | Value |
|----------|-------|
| `RESEND_API_KEY` | Minta dari Widi |
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` |
| `RESEND_FROM_NAME` | `XTools Outreach` |

---

## ✅ TASK 4 — Test Instalasi

Jalankan perintah berikut untuk memastikan tidak ada TypeScript error:

```bash
npx tsc --noEmit
```

Output harus: **tidak ada error** (kosong).

---

## ✅ TASK 5 — Buat Test Script Sederhana

Buat file `scripts/test-resend.ts` (jangan di `src/`) untuk memastikan Resend bisa digunakan:

```typescript
// scripts/test-resend.ts
// Jalankan: npx ts-node scripts/test-resend.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function main() {
  const { data, error } = await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: 'kadekwidi@deltaxs.co',   // ganti dengan email test kamu
    subject: 'Test from XTools',
    html: '<p>Email test berhasil! 🎉</p>',
  });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ Email terkirim! ID:', data?.id);
}

main();
```

> Minta API key dari Widi sebelum menjalankan script ini.

---

## 📋 Checklist Sebelum PR

- [ ] `npm install resend` sudah dijalankan
- [ ] `env.example` di-copy ke `.env.local` dan sudah diisi nilai nyata
- [ ] `.env.local` sudah ada `RESEND_API_KEY` (dari Widi)
- [ ] Railway env vars sudah diset
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `scripts/test-resend.ts` sudah dibuat

---

## 🚀 Cara Submit

```bash
git checkout -b feat/email-setup
git add package.json package-lock.json scripts/
git commit -m "feat(email): add resend package and env configuration"
git push origin feat/email-setup
```

Buat Pull Request ke `main`, tag reviewer: **Widi**.
