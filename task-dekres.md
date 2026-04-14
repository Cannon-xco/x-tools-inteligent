# Task Dekres — Middleware Auth + Email Prompt Improvement

## Branch
```
git checkout -b feature/auth-middleware-dekres
```

## Prerequisite
Tunggu branch `feature/auth-setup-yastika` selesai dan merge ke `main` dulu,
lalu `git merge main` ke branch ini (butuh `src/auth.ts` dari Yastika).

## Objective
1. Buat middleware untuk protect `/dashboard` route
2. Buat halaman Login dan Register
3. Perbaiki kualitas email auto-generate (lebih profesional & bisnis)

---

## Sub-task A: Middleware + Auth Pages

### 1. BUAT BARU: `src/middleware.ts`
```ts
import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Protect dashboard
  if (pathname.startsWith('/dashboard') && !session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Redirect logged-in users away from login/register
  if ((pathname === '/login' || pathname === '/register') && session) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register'],
};
```

### 2. BUAT BARU: `src/app/login/page.tsx`
Halaman login dengan:
- Form: Email + Password + tombol "Masuk"
- Link ke halaman register
- Error message jika kredensial salah
- Pakai `signIn('credentials', { email, password, redirectTo: '/dashboard' })` dari `next-auth/react`
- Design: dark theme sama seperti dashboard, centered card

### 3. BUAT BARU: `src/app/register/page.tsx`
Halaman register dengan:
- Form: Nama + Email + Password + Konfirmasi Password + tombol "Daftar"
- Link ke halaman login
- Call `POST /api/auth/register` lalu redirect ke `/login`
- Validasi client-side: password match, min 8 karakter
- Design: dark theme konsisten

---

## Sub-task B: Perbaikan Email Auto-Generate

### UPDATE: `src/lib/ai/generator.ts`

**Update `buildPrompt()`** — Prompt lebih profesional:

Ganti prompt lama dengan:
```
You are a professional B2B sales consultant writing a cold outreach email to a local business owner in Indonesia.

Business: [name]
Industry: [niche]  
Location: [location]
[rating note]

Observed opportunities:
[issues list]

Write a SHORT, PROFESSIONAL cold outreach email in INDONESIAN.
Requirements:
- Exactly 3 paragraphs, no bullet points
- Paragraph 1: Introduce yourself briefly + 1 specific observation about their business
- Paragraph 2: 1 concrete improvement you can help with + clear business benefit (more customers, more revenue)
- Paragraph 3: Soft CTA — suggest a 15-minute call or WhatsApp chat this week
- Professional but warm tone (peer-to-peer, not consultant-to-client)
- NO generic phrases like "audit gratis", "5-minute audit", "quick chat"
- Subject line: specific to their business, max 8 words, no emoji
- End with: "Salam, [Nama] | Digital Marketing Consultant"

Format EXACTLY:
SUBJECT: [subject here]
BODY: [3 paragraphs here]
```

**Update `generateTemplate()`** — Template fallback yang lebih baik:
- Subject: `Ide pertumbuhan untuk [nama bisnis]` (bukan "Quick tip")
- Body: 3 paragraf terstruktur dengan opening yang menyebut detail spesifik bisnis
- Tidak ada frasa generik seperti "free audit" atau "quick chat"

**Update `buildHumanPrompt()`** — Human-feel prompt:
- Instruksi bahasa Indonesia yang lebih kuat
- Hapus "End naturally - no 'Best regards'" → ganti dengan instruksi spesifik tanda tangan
- Tambah instruksi: jangan sebut persentase atau angka teknis kepada bisnis owner

## Done When
- Akses `/dashboard` tanpa login → redirect ke `/login`
- Halaman `/login` dan `/register` berfungsi
- Setelah register + login → bisa akses `/dashboard`
- Email yang di-generate lebih profesional dan dalam bahasa Indonesia
- Template fallback tidak generik
- Tidak ada TypeScript errors
