  # Task: QIUQIU — Dashboard UI Integration (Email + Badges)

**Branch:** `feat/dashboard-email-ui`
**Estimasi:** 4–6 jam
**Reviewer:** Widi
**Depends on:** Task Prayoga selesai (`SendEmailButton.tsx` sudah ada)

---

## 🎯 Tujuan

Integrasikan `SendEmailButton` ke dalam dashboard dan tambahkan dua badge baru di tabel lead: "Enriched" (hasil DEE) dan "Sent" (email sudah terkirim). Tambah stats card "Sent" di bagian atas.

---

## 📁 File yang Diubah

```
src/app/dashboard/page.tsx   ← MODIFIKASI (hati-hati, file besar)
```

---

## ✅ TASK 1 — Import `SendEmailButton`

Di bagian paling atas `src/app/dashboard/page.tsx`, tambahkan import:

```typescript
import { SendEmailButton } from './components/SendEmailButton';
```

Taruh setelah baris import `DeepEnrichPanel`:
```typescript
import { DeepEnrichPanel } from './components/DeepEnrichPanel';
import { SendEmailButton } from './components/SendEmailButton';   // ← tambahkan
```

---

## ✅ TASK 2 — Update `OutreachModal` — Tambah Send Button

Cari function `OutreachModal` di `page.tsx`. Di bagian **Footer** modal (setelah tombol copy), tambahkan `SendEmailButton`:

**Sebelum:**
```tsx
{/* Footer */}
<div className="px-6 pb-5">
  <button
    onClick={copy}
    className={`w-full py-2.5 rounded-xl font-medium text-sm transition-all ${
      copied ? 'bg-emerald-600 text-white' : 'bg-violet-600 hover:bg-violet-500 text-white'
    }`}
  >
    {copied ? '✓ Copied!' : '📋 Copy Subject + Body'}
  </button>
</div>
```

**Sesudah:**
```tsx
{/* Footer */}
<div className="px-6 pb-5 space-y-2">
  <button
    onClick={copy}
    className={`w-full py-2.5 rounded-xl font-medium text-sm transition-all ${
      copied ? 'bg-emerald-600 text-white' : 'bg-violet-600 hover:bg-violet-500 text-white'
    }`}
  >
    {copied ? '✓ Copied!' : '📋 Copy Subject + Body'}
  </button>

  {lead.id && (
    <SendEmailButton
      leadId={lead.id}
      subject={outreach.subject}
      body={outreach.body}
      defaultTo={
        lead.deepEnrichment?.emails?.[0]?.value ??
        lead.enrichment?.website?.emails?.value?.[0] ??
        ''
      }
      onSent={(sentAt) => {
        onSent?.(sentAt);
        onClose();
      }}
    />
  )}
</div>
```

Karena `OutreachModal` sekarang menerima prop `onSent`, ubah juga **signature function**-nya:

```tsx
// Sebelum:
function OutreachModal({ lead, outreach, onClose }: {
  lead: BusinessListing;
  outreach: OutreachDraft;
  onClose: () => void;
})

// Sesudah:
function OutreachModal({ lead, outreach, onClose, onSent }: {
  lead: BusinessListing;
  outreach: OutreachDraft;
  onClose: () => void;
  onSent?: (sentAt: string) => void;
})
```

---

## ✅ TASK 3 — Update `OutreachModal` Usage

Cari tempat `OutreachModal` dipanggil di `return` utama halaman (bagian bawah file):

```tsx
{/* ── OUTREACH MODAL ── */}
{selectedOutreach && (
  <OutreachModal
    lead={selectedOutreach.lead}
    outreach={selectedOutreach.outreach}
    onClose={() => setSelectedOutreach(null)}
  />
)}
```

Ubah menjadi:

```tsx
{/* ── OUTREACH MODAL ── */}
{selectedOutreach && (
  <OutreachModal
    lead={selectedOutreach.lead}
    outreach={selectedOutreach.outreach}
    onClose={() => setSelectedOutreach(null)}
    onSent={(sentAt) => {
      setLeads((prev) =>
        prev.map((l) =>
          l.id === selectedOutreach.lead.id ? { ...l, sent_at: sentAt } : l
        )
      );
      setSelectedOutreach(null);
    }}
  />
)}
```

---

## ✅ TASK 4 — Tambah Stats Counter `withSent`

Cari bagian `// ── Stats ──` di `page.tsx`:

```typescript
const hot = leads.filter((l) => (l.score ?? 0) >= 60).length;
const warm = leads.filter((l) => (l.score ?? 0) >= 30 && (l.score ?? 0) < 60).length;
const cold = leads.filter((l) => l.score !== undefined && (l.score ?? 0) < 30).length;
const enriched = leads.filter((l) => l.enrichment?.final_url).length;
const withOutreach = leads.filter((l) => l.outreach).length;
const noWebsite = leads.filter((l) => !l.website).length;
```

Tambahkan **dua baris baru** di bawah `noWebsite`:

```typescript
const withSent = leads.filter((l) => l.sent_at).length;
const deepEnriched = leads.filter((l) => l.deepEnrichment).length;
```

---

## ✅ TASK 5 — Tambah Stats Cards Baru

Cari bagian stats cards di JSX:

```tsx
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
  <StatCard icon="📋" label="Total Leads" value={leads.length} color="border-white/[0.07]" />
  <StatCard icon="🔥" label="Hot Leads" value={hot} sub="Score ≥ 60" color="border-red-900/30" />
  <StatCard icon="🌡" label="Warm Leads" value={warm} sub="Score 30–59" color="border-amber-900/30" />
  <StatCard icon="🌐" label="Enriched" value={enriched} sub={`${leads.length - enriched - noWebsite} pending`} color="border-cyan-900/30" />
  <StatCard icon="✉️" label="Outreach" value={withOutreach} sub="drafts ready" color="border-violet-900/30" />
  <StatCard icon="⚠️" label="No Website" value={noWebsite} sub="direct contact" color="border-orange-900/30" />
</div>
```

Ubah grid menjadi 8 kolom dan tambahkan 2 card baru:

```tsx
<div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
  <StatCard icon="📋" label="Total Leads" value={leads.length} color="border-white/[0.07]" />
  <StatCard icon="🔥" label="Hot Leads" value={hot} sub="Score ≥ 60" color="border-red-900/30" />
  <StatCard icon="🌡" label="Warm Leads" value={warm} sub="Score 30–59" color="border-amber-900/30" />
  <StatCard icon="🌐" label="Enriched" value={enriched} sub={`${leads.length - enriched - noWebsite} pending`} color="border-cyan-900/30" />
  <StatCard icon="🔬" label="Deep Enriched" value={deepEnriched} sub="DEE completed" color="border-violet-900/30" />
  <StatCard icon="✉️" label="Outreach" value={withOutreach} sub="drafts ready" color="border-blue-900/30" />
  <StatCard icon="📨" label="Sent" value={withSent} sub="emails sent" color="border-emerald-900/30" />
  <StatCard icon="⚠️" label="No Website" value={noWebsite} sub="direct contact" color="border-orange-900/30" />
</div>
```

---

## ✅ TASK 6 — Tambah Badges di Kolom Signals Lead Table

Cari bagian kolom "Signals" di tabel lead (`{/* Signals */}`):

```tsx
{/* Signals */}
<td className="px-4 py-3">
  {e ? (
    <div className="flex flex-wrap gap-1">
      <SignalBadge ok={e.website?.has_ssl?.value ?? false} label="SSL" tooltip="HTTPS / SSL certificate" />
      ...
    </div>
  ) : (
    <span className="text-gray-800 text-[10px]">
      {lead.website ? '─ not enriched' : '─'}
    </span>
  )}
</td>
```

Di dalam `<div className="flex flex-wrap gap-1">`, tambahkan dua badge **di akhir** list:

```tsx
{/* Badge: Deep Enriched */}
{lead.deepEnrichment && (
  <span
    className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20"
    title={`DEE: ${lead.deepEnrichment.emails.length} emails, ${lead.deepEnrichment.phones.length} phones`}
  >
    🔬 DEE
  </span>
)}

{/* Badge: Email Sent */}
{lead.sent_at && (
  <span
    className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20"
    title={`Email terkirim: ${new Date(lead.sent_at).toLocaleString()}`}
  >
    📨 Sent
  </span>
)}
```

---

## ✅ TASK 7 — Verifikasi TypeScript

```bash
npx tsc --noEmit
```

Harus: **0 errors**.

---

## 📋 Checklist Sebelum PR

- [ ] `SendEmailButton` sudah diimport di `page.tsx`
- [ ] `OutreachModal` sudah punya prop `onSent` dan menampilkan `SendEmailButton`
- [ ] `OutreachModal` usage sudah diupdate dengan `onSent` callback
- [ ] Stats `withSent` dan `deepEnriched` sudah ada
- [ ] Stats cards grid sudah diupdate (8 kolom)
- [ ] Badges "🔬 DEE" dan "📨 Sent" sudah ada di Signals column
- [ ] `npx tsc --noEmit` → 0 errors

---

## 🚀 Cara Submit

```bash
git checkout -b feat/dashboard-email-ui
git add src/app/dashboard/page.tsx
git commit -m "feat(email): integrate SendEmailButton and email status badges in dashboard"
git push origin feat/dashboard-email-ui
```

Buat Pull Request ke `main`, tag reviewer: **Widi**.

> ⚠️ **Hati-hati:** `page.tsx` adalah file besar (1100+ baris). Gunakan Ctrl+F/Cmd+F untuk menemukan bagian yang tepat. Jangan hapus kode lain yang tidak ada di task ini.
