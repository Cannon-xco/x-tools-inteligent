# Task Prayoga — EmailDrawer Component

## Branch
```
git checkout -b feature/email-drawer-prayoga
```

## Objective
Buat komponen `EmailDrawer` — slide-out panel dari kanan layar yang muncul ketika user klik "Send Email". Gantikan logika inline expand di `SendEmailButton`.

## Files

### 1. BUAT BARU: `src/app/dashboard/components/EmailDrawer.tsx`

Komponen drawer dengan fitur:
- Slide dari kanan (fixed position, full height, width ~420px)
- Backdrop overlay gelap di belakang
- Animasi open/close (CSS transition `translate-x`)
- **Section Subject**: tampilkan subject, bisa diedit
- **Section Body**: textarea untuk edit body sebelum kirim
- **Field "Kirim ke"**: input email tujuan (pre-filled dari deepEnrichment)
- State: `idle` → `sending` → `sent ✅` | `error ❌`
- Tombol "Send Email" + tombol "Tutup (✕)"
- Setelah berhasil kirim: tampilkan success state, 2 detik lalu tutup drawer

Props interface:
```ts
interface EmailDrawerProps {
  open: boolean;
  onClose: () => void;
  leadId: number;
  leadName: string;
  subject: string;      // pre-filled, editable
  body: string;         // pre-filled, editable
  defaultTo?: string;   // auto-fill dari DEE
  onSent?: (sentAt: string) => void;
}
```

API call ke `POST /api/outreach/send` dengan body:
```json
{ "leadId": ..., "to": "...", "subject": "...", "body": "..." }
```

### 2. UPDATE: `src/app/dashboard/components/SendEmailButton.tsx`

Sederhanakan komponen — tidak perlu inline expand lagi. Cukup jadi tombol trigger:
```ts
interface SendEmailButtonProps {
  onOpenDrawer: () => void;
  hasSent?: boolean; // tampilkan badge "Sent ✉" jika sudah pernah dikirim
}
```

## Design Reference
- Background drawer: `bg-[#131620]` border kiri `border-white/10`
- Header: nama lead + tombol close
- Sama dengan style existing dashboard (dark theme)

## Dependency
Tidak ada dependency ke branch lain. Bisa langsung mulai.

## Done When
- `EmailDrawer` bisa dibuka/tutup dengan animasi
- Subject dan body bisa diedit sebelum kirim
- Email berhasil terkirim via API
- Tidak ada TypeScript errors
