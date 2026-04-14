# Task Qiuqiu — Dashboard Integration (EmailDrawer + Auth UI)

## Branch
```
git checkout -b feature/dashboard-drawer-qiuqiu
```

## Prerequisite
Tunggu branch `feature/email-drawer-prayoga` selesai dan merge ke `main` dulu,
lalu `git merge main` ke branch ini.

## Objective
Integrasikan `EmailDrawer` ke dashboard dan update UI dashboard untuk
menampilkan info login user + tombol logout.

## Files

### 1. UPDATE BESAR: `src/app/dashboard/page.tsx`

**A. Integrasi EmailDrawer:**
- Import `EmailDrawer` dari `./components/EmailDrawer`
- Tambah state:
  ```ts
  const [emailDrawer, setEmailDrawer] = useState<{
    open: boolean;
    lead: BusinessListing | null;
    subject: string;
    body: string;
    defaultTo: string;
  }>({ open: false, lead: null, subject: '', body: '', defaultTo: '' });
  ```
- Tambah fungsi `openEmailDrawer(lead: BusinessListing)`:
  - Set `emailDrawer.open = true`
  - Pre-fill subject, body dari `lead.outreach`
  - Pre-fill defaultTo dari `lead.deepEnrichment?.emails?.[0]?.value`
- Di dalam `OutreachModal` footer — ganti `<SendEmailButton .../>` jadi:
  ```tsx
  <SendEmailButton
    onOpenDrawer={() => {
      onClose(); // tutup modal dulu
      openEmailDrawer(lead);
    }}
    hasSent={!!lead.sent_at}
  />
  ```
- Render `<EmailDrawer />` di root level (setelah OutreachModal):
  ```tsx
  <EmailDrawer
    open={emailDrawer.open}
    onClose={() => setEmailDrawer(p => ({ ...p, open: false }))}
    leadId={emailDrawer.lead?.id!}
    leadName={emailDrawer.lead?.name ?? ''}
    subject={emailDrawer.subject}
    body={emailDrawer.body}
    defaultTo={emailDrawer.defaultTo}
    onSent={(sentAt) => {
      setLeads(p => p.map(l => l.id === emailDrawer.lead?.id ? { ...l, sent_at: sentAt } : l));
      setEmailDrawer(p => ({ ...p, open: false }));
    }}
  />
  ```

**B. Badge "Sent" di lead card:**
- Jika `lead.sent_at` ada, tampilkan badge kecil:
  ```tsx
  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
    ✉ Sent
  </span>
  ```
  (letakkan di dekat tombol aksi lead card)

**C. Auth UI di header dashboard:**
- Import `useSession` dan `signOut` dari `next-auth/react`
- Di header dashboard, tambahkan:
  ```tsx
  // pojok kanan header
  <div className="flex items-center gap-3">
    <span className="text-xs text-gray-500">{session?.user?.email}</span>
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1 rounded border border-white/5 hover:border-red-500/20"
    >
      Logout
    </button>
  </div>
  ```
- Wrap dalam `SessionProvider` di `layout.tsx` atau gunakan `useSession` dari komponen client

### 2. UPDATE: `src/app/layout.tsx`
- Tambah `SessionProvider` dari `next-auth/react` untuk wrap children
  (diperlukan agar `useSession` bekerja di client components)

## Done When
- Klik "Send Email" di OutreachModal buka drawer (bukan expand inline)
- Drawer bisa diedit dan kirim email
- Badge "Sent" muncul di lead card setelah email terkirim
- Header dashboard tampilkan email user + tombol logout
- Tidak ada TypeScript errors
