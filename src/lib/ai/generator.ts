// ============================================================
// AI OUTREACH GENERATOR
// Generates personalized outreach emails using OpenRouter
// Falls back to template-based generation when API unavailable
// ============================================================

import type { OutreachDraft, OutreachRequest, AutoOutreachInput } from '@/types';
import { insertLog } from '@/lib/db/client';

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL ?? 'z-ai/glm-4.5-air:free'; // Free model for testing
const MAX_TOKENS = 800; // Optimize for free tier

function log(level: 'info' | 'warn' | 'error', msg: string, data?: unknown) {
  insertLog(level, `[ai] ${msg}`, data);
}

// ── Prompt builder ────────────────────────────────────────────

function buildPrompt(req: OutreachRequest): string {
  const issueList = req.reasons.length > 0
    ? req.reasons.map((r, i) => `${i + 1}. ${r}`).join('\n')
    : '1. No specific digital issues detected (general outreach)';

  const ratingNote = req.rating
    ? `Current Google rating: ${req.rating}/5 (${req.review_count ?? '?'} reviews).`
    : '';

  return `Anda adalah konsultan pemasaran digital B2B yang berpengalaman, menulis email cold outreach kepada pemilik bisnis lokal di Indonesia.

Bisnis: ${req.business_name}
Industri: ${req.niche}
Lokasi: ${req.location ?? 'area lokal'}
${ratingNote}

Peluang yang teridentifikasi:
${issueList}

Tulis email outreach profesional DALAM BAHASA INDONESIA yang singkat dan berdampak.
Persyaratan:
- Tepat 3 paragraf, tanpa poin-poin bullet
- Paragraf 1: Perkenalan singkat + 1 observasi spesifik tentang bisnis mereka
- Paragraf 2: 1 solusi konkret yang bisa Anda bantu + manfaat bisnis yang jelas (lebih banyak pelanggan, lebih banyak pendapatan)
- Paragraf 3: CTA ringan — ajak meeting 15 menit atau chat WhatsApp minggu ini
- Tone profesional namun hangat (setara sesama profesional, bukan konsultan ke klien)
- JANGAN gunakan frasa generik seperti "audit gratis", "5 menit audit", atau "quick chat"
- Subject: spesifik untuk bisnis mereka, maksimal 8 kata, tanpa emoji
- Akhiri dengan: "Salam, [Nama] | Digital Marketing Consultant"

Format EXACTLY:
SUBJECT: [subject di sini]
BODY: [3 paragraf di sini]`;
}

// ── OpenRouter API call ───────────────────────────────────────

async function callOpenRouter(prompt: string): Promise<{ subject: string; body: string; model: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

  const res = await fetch(OPENROUTER_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://x-tools-inteligent.local',
      'X-OpenRouter-Title': 'x-tools-inteligent',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: MAX_TOKENS,
      temperature: 0.7,
      reasoning: { enabled: true }
    }),
    signal: AbortSignal.timeout(30_000),
  });

  log('info', `OpenRouter request sent, model: ${DEFAULT_MODEL}`);

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter API error ${res.status}: ${err}`);
  }

  const json = await res.json() as {
    choices: Array<{ message: { content: string } }>;
    model: string;
  };

  const content = json.choices?.[0]?.message?.content ?? '';
  return { ...parseAiResponse(content), model: json.model };
}

function parseAiResponse(content: string): { subject: string; body: string } {
  const subjectMatch = content.match(/SUBJECT:\s*(.+?)(?:\n|$)/i);
  const bodyMatch = content.match(/BODY:\s*([\s\S]+?)$/i);

  const subject = subjectMatch?.[1]?.trim() || 'Quick note about your online presence';
  const body = bodyMatch?.[1]?.trim() || content.trim();

  return { subject, body };
}

// ── Template fallback ─────────────────────────────────────────

function generateTemplate(req: OutreachRequest): { subject: string; body: string } {
  const topIssue = req.reasons[0] ?? 'peningkatan kehadiran digital';
  const secondIssue = req.reasons[1];

  const subject = `Ide pertumbuhan untuk ${req.business_name}`;

  const bodyParts = [
    `Halo Tim ${req.business_name},`,
    '',
    `Saya melihat bisnis ${req.niche} Anda di ${req.location ?? 'area lokal'} dan memperhatikan beberapa hal menarik tentang cara Anda beroperasi secara online.`,
    '',
    `Secara spesifik, ${topIssue.toLowerCase()} adalah area yang bisa memberikan dampak signifikan bagi pertumbuhan pelanggan Anda.${secondIssue ? ` Selain itu, ${secondIssue.toLowerCase()} juga bisa dioptimalkan untuk hasil yang lebih baik.` : ''}`,
    '',
    `Saya ingin berbagi beberapa insight yang relevan untuk bisnis Anda. Apakah Anda terbuka untuk diskusi singkat 15 menit minggu ini?`,
    '',
    'Salam,\n[Nama] | Digital Marketing Consultant',
  ];

  return { subject, body: bodyParts.join('\n') };
}

// ── Main export ───────────────────────────────────────────────

export async function generateOutreach(req: OutreachRequest): Promise<OutreachDraft> {
  const now = new Date().toISOString();

  try {
    const prompt = buildPrompt(req);
    log('info', `Generating AI outreach for ${req.business_name}`);

    const { subject, body, model } = await callOpenRouter(prompt);

    log('info', `AI outreach generated successfully via ${model}`);

    return {
      subject,
      body,
      generated_at: now,
      source: 'ai',
      model,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log('warn', `AI generation failed, using template fallback: ${msg}`);

    const { subject, body } = generateTemplate(req);

    return {
      subject,
      body,
      generated_at: now,
      source: 'template',
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Auto Outreach with Deep Enrichment (Human Feel)
// ─────────────────────────────────────────────────────────────

function buildHumanPrompt(req: AutoOutreachInput): string {
  const tech = req.enrichment?.tech?.cms?.value ?? 'unknown';
  const detectedTech = req.enrichment?.tech?.detected_tech?.value ?? [];
  const hasWhatsApp = req.deepEnrichment.phones.some(p => p.value.includes('wa.me') || p.value.includes('+62'));
  const hasInstagram = req.deepEnrichment.socials?.instagram;
  const hasFacebook = req.deepEnrichment.socials?.facebook;
  const hasLinkedIn = req.deepEnrichment.socials?.linkedin;
  const hasBooking = req.enrichment?.website?.has_booking?.value;
  const hasSSL = req.enrichment?.website?.has_ssl?.value;
  const hasContactForm = req.enrichment?.website?.has_contact_form?.value;
  const confidence = req.deepEnrichment.overallConfidence;
  
  // Build discovered insights
  const insights: string[] = [];
  if (tech !== 'unknown') insights.push(`Using ${tech} for website`);
  if (hasSSL === true) insights.push('Has SSL (secure)');
  if (hasSSL !== true) insights.push('No SSL detected');
  if (hasWhatsApp) insights.push('Uses WhatsApp for business');
  if (hasBooking) insights.push('Has booking system');
  if (!hasBooking) insights.push('No online booking');
  if (hasContactForm) insights.push('Has contact form');
  if (hasInstagram) insights.push(`Active on Instagram`);
  if (hasFacebook) insights.push('On Facebook');
  
  const insightsText = insights.length > 0 
    ? insights.map(i => `- ${i}`).join('\n')
    : '- No specific tech or social data found';

  return `Anda adalah konsultan bisnis lokal yang menulis kepada ${req.businessName} di ${req.location}.

KONTEKS:
- Industri: ${req.niche}
- Rating Google: ${req.rating ?? 'N/A'}/5 (${req.review_count ?? 0} ulasan)

INSIGHT YANG DITEMUKAN:
${insightsText}

ATURAN PENTING:
1. Referensikan 1-2 hal spesifik yang Anda temukan dari insight di atas
2. Tulis dalam BAHASA INDONESIA yang natural dan profesional
3. Singkat — maksimal 3 paragraf pendek
4. Tone hangat dan setara (seperti rekan profesional, bukan konsultan ke klien)
5. Akhiri dengan tanda tangan: "Salam,\n[Nama] | Digital Marketing Consultant"
6. JANGAN gunakan poin-poin bullet atau daftar bernomor
7. JANGAN sebutkan persentase atau angka teknis
8. Berikan 1 saran spesifik yang actionable

Format EXACTLY:
SUBJECT: [subject yang relevan dan spesifik, tanpa emoji]
BODY: [2-3 paragraf pendek, tanpa daftar]`;
}

// ── Main Auto Outreach Export ───────────────────────────

export async function generateAutoOutreach(req: AutoOutreachInput): Promise<OutreachDraft> {
  const now = new Date().toISOString();
  
  // Skip if confidence too low
  if (req.deepEnrichment.overallConfidence < 0.5) {
    log('warn', `Skipping auto-outreach for ${req.businessName} - confidence too low`);
    return {
      subject: '',
      body: '',
      generated_at: now,
      source: 'template',
    };
  }

  try {
    const prompt = buildHumanPrompt(req);
    log('info', `Generating auto-outreach for ${req.businessName} with deep-enrich data`);

    const { subject, body, model } = await callOpenRouter(prompt);

    log('info', `Auto-outreach generated via ${model}`);

    return {
      subject,
      body,
      generated_at: now,
      source: 'ai',
      model,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log('warn', `Auto-outreach failed: ${msg}`);
    
    // Simple fallback template
    const subject = `Quick tip for ${req.businessName}`;
    const body = `Hi ${req.businessName} team,\n\nI came across your business and wanted to share some thoughts on growing your online presence.\n\nWould you be open to a free quick audit?\n\nSalam`;
    
    return {
      subject,
      body,
      generated_at: now,
      source: 'template',
    };
  }
}
