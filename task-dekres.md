  # Task: DEKRES — API Route `POST /api/outreach/send`

**Branch:** `feat/email-send-api`
**Estimasi:** 4–6 jam
**Reviewer:** Widi
**Depends on:** Task Yastika selesai (`npm install resend` sudah ada)

---

## 🎯 Tujuan

Buat API endpoint yang menerima request kirim email, mengirimnya via Resend SDK, dan menyimpan timestamp pengiriman ke database.

---

## 📁 Files yang Harus Dibuat / Dimodifikasi

| File | Action |
|------|--------|
| `src/app/api/outreach/send/route.ts` | **BUAT BARU** |
| `src/lib/db/client.ts` | **TAMBAHKAN** function `updateLeadSentAt` |
| `src/types/index.ts` | **TAMBAHKAN** field `sent_at` ke interfaces |

---

## ✅ TASK 1 — Tambah `sent_at` ke Database Schema

Edit file `src/lib/db/client.ts`.

Cari bagian `ALTER TABLE leads ADD COLUMN IF NOT EXISTS deep_enriched_at TIMESTAMP;` dan tambahkan baris baru **setelah** baris tersebut:

```typescript
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP;
```

Juga tambahkan function helper baru setelah function `updateLeadOutreach`:

```typescript
export async function updateLeadSentAt(id: number, sentAt: string): Promise<void> {
  await getPool().query(
    'UPDATE leads SET sent_at = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [sentAt, id]
  );
}
```

---

## ✅ TASK 2 — Tambah `sent_at` ke TypeScript Types

Edit file `src/types/index.ts`.

**A.** Di interface `BusinessListing`, tambahkan field `sent_at` sebelum `created_at`:

```typescript
sent_at?: string;
created_at?: string;
updated_at?: string;
```

**B.** Di interface `DbLead`, tambahkan field `sent_at` sebelum `created_at`:

```typescript
deep_enriched_at: string | null;
sent_at: string | null;    // ← tambahkan ini
created_at: string;
updated_at: string;
```

---

## ✅ TASK 3 — Update Leads API untuk Include `sent_at`

Edit file `src/app/api/leads/route.ts`.

Cari bagian mapping `rows.map((row) => ({...}))` dan tambahkan `sent_at`:

```typescript
deepEnrichment: row.deep_enrichment_json ? JSON.parse(row.deep_enrichment_json) : undefined,
sent_at: row.sent_at ?? undefined,   // ← tambahkan baris ini
created_at: row.created_at,
```

---

## ✅ TASK 4 — Buat API Route `POST /api/outreach/send`

Buat file baru: `src/app/api/outreach/send/route.ts`

```typescript
// ============================================================
// API ROUTE: POST /api/outreach/send
// Kirim outreach email via Resend SDK
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { updateLeadSentAt, insertLog } from '@/lib/db/client';
import type { ApiResponse } from '@/types';

export const runtime = 'nodejs';

interface SendEmailBody {
  leadId: number;
  to: string;
  subject: string;
  body: string;
}

/**
 * Validasi format email sederhana.
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * POST /api/outreach/send
 *
 * Request body:
 * {
 *   "leadId": 123,
 *   "to": "target@example.com",
 *   "subject": "Quick tip for Acme Corp",
 *   "body": "Hi Acme Corp, ..."
 * }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';
  const fromName = process.env.RESEND_FROM_NAME ?? 'XTools Outreach';

  if (!apiKey || apiKey.startsWith('re_xxx')) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'RESEND_API_KEY belum dikonfigurasi. Tambahkan ke .env.local',
    }, { status: 503 });
  }

  let body: SendEmailBody;
  try {
    body = (await req.json()) as SendEmailBody;
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { leadId, to, subject, body: emailBody } = body;

  if (!leadId || typeof leadId !== 'number') {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'leadId harus berupa number' },
      { status: 400 }
    );
  }
  if (!to || !isValidEmail(to)) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Format email tujuan tidak valid' },
      { status: 400 }
    );
  }
  if (!subject?.trim()) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'subject tidak boleh kosong' },
      { status: 400 }
    );
  }
  if (!emailBody?.trim()) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'body email tidak boleh kosong' },
      { status: 400 }
    );
  }

  try {
    const resend = new Resend(apiKey);

    await insertLog('info', `📧 Mengirim email ke ${to} untuk lead #${leadId}`);

    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to.trim()],
      subject: subject.trim(),
      text: emailBody.trim(),
    });

    if (error) {
      await insertLog('error', `❌ Resend error untuk lead #${leadId}: ${error.message}`);
      return NextResponse.json<ApiResponse>(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    const sentAt = new Date().toISOString();
    await updateLeadSentAt(leadId, sentAt);
    await insertLog('info', `✅ Email terkirim ke ${to} untuk lead #${leadId} (id: ${data?.id})`);

    return NextResponse.json<ApiResponse<{ messageId: string; sent_at: string }>>({
      success: true,
      data: {
        messageId: data?.id ?? '',
        sent_at: sentAt,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await insertLog('error', `❌ outreach/send error untuk lead #${leadId}: ${msg}`);
    return NextResponse.json<ApiResponse>(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
```

---

## ✅ TASK 5 — Verifikasi TypeScript

```bash
npx tsc --noEmit
```

Harus: **0 errors**.

---

## 📋 Checklist Sebelum PR

- [ ] `src/lib/db/client.ts` sudah ada `ALTER TABLE ... ADD COLUMN IF NOT EXISTS sent_at`
- [ ] `src/lib/db/client.ts` sudah ada function `updateLeadSentAt()`
- [ ] `src/types/index.ts` sudah ada `sent_at` di `BusinessListing` dan `DbLead`
- [ ] `src/app/api/leads/route.ts` sudah include `sent_at` di mapping
- [ ] `src/app/api/outreach/send/route.ts` sudah dibuat
- [ ] `npx tsc --noEmit` → 0 errors

---

## 🚀 Cara Submit

```bash
git checkout -b feat/email-send-api
git add src/
git commit -m "feat(email): add POST /api/outreach/send endpoint with Resend SDK"
git push origin feat/email-send-api
```

Buat Pull Request ke `main`, tag reviewer: **Widi**.

> 💡 **Tip:** Jika bingung dengan struktur kode, buka file `src/app/api/outreach/route.ts` sebagai referensi — strukturnya mirip.
