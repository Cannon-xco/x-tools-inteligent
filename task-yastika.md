# Task Assignment: YASTIKA (Branch: `yastika`)

## ⚙️ RULES — BACA SEBELUM MULAI

1. **Gunakan Plan Mode** di Windsurf untuk setiap task
2. **Pilih model: Kimi** sebagai AI assistant
3. ⛔ **STRICT: JANGAN mengubah, menghapus, atau memodifikasi file/logic yang sudah ada.** Semua existing code di `src/lib/`, `src/app/`, `src/types/` adalah production code. **Hanya TAMBAHKAN file baru.** Jika perlu extend types, buat file baru, jangan edit file existing.
4. File API route baru dibuat di `src/app/api/deep-enrich/`
5. File UI baru dibuat di `src/app/dashboard/components/`
6. Setiap function harus punya JSDoc comment
7. Gunakan TypeScript strict mode
8. Jangan install package baru tanpa konfirmasi tim

---

## 📋 OVERVIEW

Kamu bertanggung jawab atas **API endpoint dan UI** dari Deep Enrichment Engine (DEE):
- API Route `POST /api/deep-enrich`
- UI: Deep Enrich button + loading states
- UI: Confidence badges + enrichment detail panel

Fokus kamu adalah membuat **user-facing layer** yang menghubungkan backend DEE dengan dashboard.

---

## 🔥 TASK 1: API Route — Deep Enrich Endpoint

### Goal
Buat API endpoint baru yang menerima request deep enrichment dan mengembalikan hasil.

### File yang harus dibuat
```
src/app/api/deep-enrich/route.ts
```

### Yang harus diimplementasi

#### A. POST Handler
Menerima lead ID, menjalankan deep enrichment pipeline, dan return hasil.

```typescript
// Request Body
{
  "id": 123,                    // lead ID (required)
  "options": {
    "sources": ["website", "serp", "directory", "social", "dns", "whois"],  // optional, default: all
    "timeout": 30000,            // optional, default: 30s
    "force": false               // optional, force re-enrich even if already enriched
  }
}

// Response (Success)
{
  "success": true,
  "data": {
    "leadId": 123,
    "emails": [
      { "value": "info@example.com", "confidence": 0.92, "status": "VERIFIED", "sources": ["website", "serp"] }
    ],
    "phones": [
      { "value": "+628123456789", "confidence": 0.78, "status": "VERIFIED", "sources": ["website"] }
    ],
    "socials": {
      "linkedin": "https://linkedin.com/company/example",
      "instagram": "https://instagram.com/example"
    },
    "people": [
      { "name": "John Doe", "title": "Owner", "confidence": 0.6 }
    ],
    "overallConfidence": 0.82,
    "sources_used": ["website", "serp", "dns"],
    "duration_ms": 8500,
    "enriched_at": "2025-04-10T14:30:00.000Z"
  }
}

// Response (Error)
{
  "success": false,
  "error": "Lead 123 not found"
}
```

#### B. Input Validation
- `id` harus ada dan berupa number
- Cek lead exists di database menggunakan `getLeadById` dari `@/lib/db/client`
- Jika lead sudah punya `deep_enriched_at` dan `force` bukan true → return cached data

#### C. Pipeline Orchestration (Placeholder)
Karena pipeline modules dibuat oleh tim lain, buat **placeholder functions** yang akan di-integrate nanti:

```typescript
// Placeholder — akan diganti dengan actual implementation setelah merge
async function runDeepEnrichPipeline(lead: DbLead): Promise<DeepEnrichResult> {
  // TODO: Integrate with actual DEE pipeline after team merge
  // For now, return mock structure
  return {
    leadId: lead.id,
    emails: [],
    phones: [],
    socials: {},
    people: [],
    overallConfidence: 0,
    sources_used: [],
    duration_ms: 0,
    enriched_at: new Date().toISOString(),
  };
}
```

#### D. GET Handler
Return deep enrichment status untuk sebuah lead:

```typescript
// GET /api/deep-enrich?id=123
// Response
{
  "success": true,
  "data": {
    "leadId": 123,
    "status": "enriched",      // "pending" | "enriched" | "failed" | "not_started"
    "enriched_at": "...",
    "overallConfidence": 0.82,
    "summary": {
      "emails_found": 2,
      "phones_found": 1,
      "socials_found": 3,
      "people_found": 1
    }
  }
}
```

### Runtime Config

```typescript
export const runtime = 'nodejs';
export const maxDuration = 60;   // 1 menit timeout
```

### Test
Buat file `src/enrichment/__tests__/deep-enrich-route.test.ts` — test request/response shapes.

---

## 🔥 TASK 2: UI — Deep Enrich Button + Loading States

### Goal
Buat React component untuk tombol "Deep Enrich" yang bisa diklik per-lead di dashboard.

### File yang harus dibuat
```
src/app/dashboard/components/DeepEnrichButton.tsx
```

### Yang harus diimplementasi

#### A. Button Component

```tsx
interface DeepEnrichButtonProps {
  leadId: number;
  leadName: string;
  isEnriched: boolean;         // sudah pernah deep enrich?
  onComplete: (result: any) => void;  // callback setelah selesai
}
```

**Visual States:**

| State | Tampilan |
|-------|----------|
| **idle** | Button biru: "🔍 Deep Enrich" |
| **loading** | Button disabled + spinner: "Enriching..." |
| **success** | Button hijau: "✅ Enriched" (selama 3 detik, lalu kembali ke idle) |
| **error** | Button merah: "❌ Failed" (selama 3 detik, lalu kembali ke idle) |
| **already_enriched** | Button outline: "🔄 Re-Enrich" |

#### B. API Call
- Panggil `POST /api/deep-enrich` dengan `{ id: leadId }`
- Handle loading state
- Handle error (show error message)
- On success → call `onComplete` callback

#### C. Styling
Gunakan TailwindCSS (sudah ada di project). Sesuaikan dengan dark theme existing:
- Background: gunakan `bg-violet-600` / `bg-violet-700` untuk primary
- Text: `text-white`
- Hover: `hover:bg-violet-500`
- Disabled: `opacity-50 cursor-not-allowed`
- Success: `bg-emerald-600`
- Error: `bg-red-600`

```tsx
// Contoh styling
<button
  onClick={handleClick}
  disabled={isLoading}
  className={`
    px-3 py-1.5 rounded-lg text-xs font-medium transition-all
    ${isLoading ? 'bg-violet-800 opacity-50 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-500'}
    text-white
  `}
>
  {isLoading ? (
    <span className="flex items-center gap-1.5">
      <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
      Enriching...
    </span>
  ) : (
    '🔍 Deep Enrich'
  )}
</button>
```

### Test
Tidak perlu automated test — test manual di browser.

---

## 🔥 TASK 3: UI — Confidence Display Components

### Goal
Buat React components untuk menampilkan hasil deep enrichment dengan confidence scores.

### Files yang harus dibuat
```
src/app/dashboard/components/ConfidenceBadge.tsx
src/app/dashboard/components/DeepEnrichPanel.tsx
```

### A. ConfidenceBadge Component (`ConfidenceBadge.tsx`)

Menampilkan confidence score dengan visual yang jelas:

```tsx
interface ConfidenceBadgeProps {
  value: number;   // 0.0 - 1.0
  label?: string;  // optional text label
}
```

**Visual Rules:**

| Score Range | Color | Icon | Label |
|-------------|-------|------|-------|
| ≥ 0.75 | Hijau (`text-emerald-400`) | ✅ | "High" |
| 0.50 – 0.74 | Kuning (`text-amber-400`) | ⚠️ | "Low" |
| < 0.50 | Merah (`text-red-400`) | ❌ | "Unreliable" |

Display: `✅ 92%` atau `⚠️ 63%`

```tsx
// Contoh output
<span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
  ✅ 92%
</span>
```

### B. DeepEnrichPanel Component (`DeepEnrichPanel.tsx`)

Panel expandable yang menampilkan semua hasil deep enrichment untuk 1 lead.

```tsx
interface DeepEnrichPanelProps {
  leadId: number;
  data: {
    emails: Array<{ value: string; confidence: number; status: string; sources: string[] }>;
    phones: Array<{ value: string; confidence: number; status: string; sources: string[] }>;
    socials: Record<string, string>;
    people: Array<{ name: string; title: string; confidence: number }>;
    overallConfidence: number;
    sources_used: string[];
    enriched_at: string;
  } | null;
}
```

**Layout:**

```
┌──────────────────────────────────────────────────┐
│ Deep Enrichment Results          Overall: ✅ 82% │
├──────────────────────────────────────────────────┤
│                                                  │
│ 📧 Emails                                       │
│   info@example.com            ✅ 92%  [web,serp]│
│   contact@example.com         ⚠️ 63%  [serp]   │
│                                                  │
│ 📞 Phones                                       │
│   +628123456789               ✅ 78%  [web]     │
│                                                  │
│ 🌐 Social Profiles                              │
│   LinkedIn  → linkedin.com/company/example      │
│   Instagram → instagram.com/example             │
│                                                  │
│ 👤 People                                       │
│   John Doe — Owner            ⚠️ 60%            │
│                                                  │
│ Sources: website, serp, dns                      │
│ Enriched: 2025-04-10 14:30                      │
└──────────────────────────────────────────────────┘
```

**Sections:**
1. **Header** — "Deep Enrichment Results" + overall confidence badge
2. **Emails** — List dengan value, confidence badge, source tags
3. **Phones** — List dengan value, confidence badge, source tags
4. **Social Profiles** — Platform icon + URL (clickable link, `target="_blank"`)
5. **People** — Name + title + confidence badge
6. **Footer** — Sources used + enrichment timestamp

**Styling Guidelines:**
- Gunakan border `border-white/10` untuk sections
- Background: `bg-white/5` untuk panel
- Text: sesuaikan dengan existing dashboard (gray-300 untuk body, white untuk headers)
- Links: `text-violet-400 hover:text-violet-300 underline`
- Collapsible: default collapsed, klik untuk expand

```tsx
// Collapsible pattern
const [isOpen, setIsOpen] = useState(false);

<div className="border border-white/10 rounded-lg overflow-hidden">
  <button
    onClick={() => setIsOpen(!isOpen)}
    className="w-full px-4 py-2 flex items-center justify-between bg-white/5 hover:bg-white/10"
  >
    <span>Deep Enrichment Results</span>
    <span>{isOpen ? '▾' : '▸'}</span>
  </button>
  {isOpen && (
    <div className="px-4 py-3 space-y-4">
      {/* content */}
    </div>
  )}
</div>
```

### Handling Empty State
Jika `data` adalah null (belum di-enrich):
```
┌──────────────────────────────────────┐
│ Deep Enrichment                      │
│                                      │
│ No deep enrichment data yet.         │
│ Click "Deep Enrich" to start.        │
└──────────────────────────────────────┘
```

### Test
Tidak perlu automated test — test manual di browser.

---

## 📦 DEPENDENCY ORDER

```
Task 1 (API Route) → bisa mulai langsung
Task 2 (Deep Enrich Button) → bisa mulai langsung (parallel, pakai mock API)
Task 3 (Confidence Display) → bisa mulai langsung (parallel, pakai mock data)
```

## 📁 FINAL STRUCTURE

```
src/
├── app/
│   ├── api/
│   │   └── deep-enrich/
│   │       └── route.ts              ← Task 1
│   └── dashboard/
│       └── components/
│           ├── DeepEnrichButton.tsx   ← Task 2
│           ├── ConfidenceBadge.tsx    ← Task 3
│           └── DeepEnrichPanel.tsx    ← Task 3
```

## 💡 CATATAN INTEGRASI

Setelah semua anggota tim selesai dan branches di-merge:
- `DeepEnrichButton` akan memanggil `POST /api/deep-enrich`
- `route.ts` akan memanggil pipeline dari Widi (adapters) + Dekres (normalization) + Prayoga (fallback)
- `DeepEnrichPanel` akan menampilkan data dari `verified_emails`, `verified_phones`, dll. (kolom baru dari Dekres)
- `ConfidenceBadge` akan menampilkan score dari confidence engine (Widi)

Untuk development sekarang, **gunakan mock data** agar bisa develop UI tanpa tunggu backend selesai.
