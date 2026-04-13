  # Task: PRAYOGA — Component `SendEmailButton.tsx`

**Branch:** `feat/send-email-button`
**Estimasi:** 3–5 jam
**Reviewer:** Widi
**Depends on:** Task Dekres selesai (API `/api/outreach/send` sudah ada) — tapi bisa mulai dengan mock dulu

---

## 🎯 Tujuan

Buat React component `SendEmailButton` yang bisa dipakai di dashboard untuk mengirim email outreach langsung ke lead, menggunakan API yang sudah dibuat oleh Dekres.

---

## 📁 File yang Harus Dibuat

```
src/app/dashboard/components/SendEmailButton.tsx
```

---

## ✅ TASK 1 — Buat Component `SendEmailButton.tsx`

Copy dan implementasikan code berikut di file baru `src/app/dashboard/components/SendEmailButton.tsx`:

```tsx
'use client';

import { useState, useCallback } from 'react';

interface SendEmailButtonProps {
  /** Lead ID untuk update sent_at di DB */
  leadId: number;
  /** Subject email dari outreach draft */
  subject: string;
  /** Body email dari outreach draft */
  body: string;
  /** Email tujuan — auto-fill dari DEE atau enrichment jika ada */
  defaultTo?: string;
  /** Callback setelah email berhasil terkirim */
  onSent?: (sentAt: string) => void;
}

type SendState = 'idle' | 'sending' | 'sent' | 'error';

/**
 * SendEmailButton Component
 *
 * Tombol kirim email outreach via Resend API.
 * States: idle → expanded (input email) → sending → sent ✅ | error ❌
 */
export function SendEmailButton({
  leadId,
  subject,
  body,
  defaultTo = '',
  onSent,
}: SendEmailButtonProps) {
  const [sendState, setSendState] = useState<SendState>('idle');
  const [toEmail, setToEmail] = useState(defaultTo);
  const [errorMsg, setErrorMsg] = useState('');
  const [expanded, setExpanded] = useState(false);

  const handleSend = useCallback(async () => {
    if (!toEmail.trim()) {
      setErrorMsg('Masukkan alamat email tujuan');
      return;
    }

    setSendState('sending');
    setErrorMsg('');

    try {
      const res = await fetch('/api/outreach/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, to: toEmail.trim(), subject, body }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Gagal mengirim email');
      }

      setSendState('sent');
      onSent?.(data.data.sent_at);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setSendState('error');
    }
  }, [leadId, toEmail, subject, body, onSent]);

  // State: sudah terkirim
  if (sendState === 'sent') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
        <span>✅</span>
        <span>Terkirim ke <span className="font-mono">{toEmail}</span></span>
      </div>
    );
  }

  // State: collapsed (belum klik)
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all shadow-lg shadow-blue-500/20"
      >
        <span>✉️</span>
        <span>Send Email</span>
      </button>
    );
  }

  // State: expanded — tampilkan input email
  return (
    <div className="space-y-2 p-3 rounded-xl bg-black/30 border border-white/10">
      <p className="text-xs text-gray-400 font-medium">Kirim ke:</p>

      <div className="flex gap-2">
        <input
          type="email"
          value={toEmail}
          onChange={(e) => setToEmail(e.target.value)}
          placeholder="recipient@example.com"
          className="flex-1 bg-black/40 border border-white/10 focus:border-blue-500 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none transition-colors font-mono"
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          autoFocus
        />

        <button
          onClick={handleSend}
          disabled={sendState === 'sending'}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-all flex items-center gap-1.5"
        >
          {sendState === 'sending' ? (
            <>
              <span className="inline-block w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
              <span>Sending...</span>
            </>
          ) : (
            <>
              <span>✉️</span>
              <span>Send</span>
            </>
          )}
        </button>

        <button
          onClick={() => { setExpanded(false); setSendState('idle'); setErrorMsg(''); }}
          className="px-2 py-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 text-xs transition-all"
          title="Batal"
        >
          ✕
        </button>
      </div>

      {sendState === 'error' && errorMsg && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <span>❌</span>
          <span>{errorMsg}</span>
        </p>
      )}

      <p className="text-[10px] text-gray-600 truncate">
        Subject: <span className="text-gray-500">{subject}</span>
      </p>
    </div>
  );
}

export default SendEmailButton;
```

---

## ✅ TASK 2 — Verifikasi Component

Cek tidak ada TypeScript error:

```bash
npx tsc --noEmit
```

Harus: **0 errors**.

---

## ✅ TASK 3 — Test Manual

Untuk test tanpa backend:
1. Buka `src/app/dashboard/page.tsx`
2. Import component: `import { SendEmailButton } from './components/SendEmailButton';`
3. Taruh sementara di mana saja di halaman untuk test visual:
```tsx
<SendEmailButton
  leadId={1}
  subject="Test Subject"
  body="Test body email ini"
  defaultTo="test@example.com"
  onSent={(sentAt) => console.log('Sent at:', sentAt)}
/>
```
4. Buka browser, cek semua state: idle → expanded → input → (jika API belum ada, cek error state)
5. Hapus test code setelah selesai

---

## 📋 Checklist Sebelum PR

- [ ] File `src/app/dashboard/components/SendEmailButton.tsx` sudah dibuat
- [ ] Semua states visual sudah berfungsi: idle, expanded, sending, sent, error
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] Tidak ada console.log yang tertinggal
- [ ] Test code sementara sudah dihapus dari `page.tsx`

---

## 🚀 Cara Submit

```bash
git checkout -b feat/send-email-button
git add src/app/dashboard/components/SendEmailButton.tsx
git commit -m "feat(email): add SendEmailButton component with multi-state UI"
git push origin feat/send-email-button
```

Buat Pull Request ke `main`, tag reviewer: **Widi**.

> 💡 **Tip:** Lihat `src/app/dashboard/components/DeepEnrichButton.tsx` sebagai referensi pola komponen dengan multiple states.
