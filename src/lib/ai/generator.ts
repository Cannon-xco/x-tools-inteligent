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

  return `You are a professional B2B sales consultant writing a cold outreach email to a local business owner in Indonesia.

Business: ${req.business_name}
Industry: ${req.niche}
Location: ${req.location ?? 'local area'}
${ratingNote}

Observed opportunities:
${issueList}

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
BODY: [3 paragraphs here]`;
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
  const topIssue = req.reasons[0] ?? 'memperkuat presence digital';
  const businessName = req.business_name;
  const location = req.location ?? 'di area Anda';

  const subject = `Ide pertumbuhan untuk ${businessName}`;

  const body = `Halo tim ${businessName},

Saya menemukan profil bisnis Anda di ${location} dan melihat potensi besar untuk menarik lebih banyak pelanggan. ${topIssue ? `Secara spesifik: ${topIssue.toLowerCase()}.` : 'Dengan sedikit penyesuaian strategi digital, Anda bisa menjangkau lebih banyak pelanggan potensial.'}

Saya membantu bisnis lokal seperti Anda untuk tumbuh melalui strategi marketing yang tepat. Dalam waktu singkat, kita bisa diskusi bagaimana meningkatkan visibilitas online dan konversi pelanggan.

Jika Anda tertarik diskusi singkat 15 menit minggu ini — via telepon atau WhatsApp — silakan balas email ini.

Salam,
[Nama] | Digital Marketing Consultant`;

  return { subject, body };
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
  const hasWhatsApp = req.deepEnrichment.phones.some(p => p.value.includes('wa.me') || p.value.includes('+62'));
  const hasInstagram = req.deepEnrichment.socials?.instagram;
  const hasFacebook = req.deepEnrichment.socials?.facebook;
  const hasBooking = req.enrichment?.website?.has_booking?.value;
  const hasSSL = req.enrichment?.website?.has_ssl?.value;
  const hasContactForm = req.enrichment?.website?.has_contact_form?.value;
  
  // Build discovered insights
  const insights: string[] = [];
  if (tech !== 'unknown') insights.push(`Menggunakan ${tech} untuk website`);
  if (hasSSL === true) insights.push('Website memiliki SSL (aman)');
  if (hasSSL !== true) insights.push('Website belum memiliki SSL');
  if (hasWhatsApp) insights.push('Menggunakan WhatsApp untuk bisnis');
  if (hasBooking) insights.push('Memiliki sistem booking online');
  if (!hasBooking) insights.push('Belum memiliki booking online');
  if (hasContactForm) insights.push('Memiliki form kontak di website');
  if (hasInstagram) insights.push(`Aktif di Instagram`);
  if (hasFacebook) insights.push('Memiliki Facebook page');
  
  const insightsText = insights.length > 0 
    ? insights.map(i => `- ${i}`).join('\n')
    : '- Tidak ada data spesifik ditemukan';

  return `Anda adalah konsultan bisnis lokal yang menulis email ke pemilik ${req.businessName} di ${req.location}.

KONTEKS:
- Industri: ${req.niche}
- Rating Google: ${req.rating ?? 'N/A'}/5 (${req.review_count ?? 0} ulasan)

INSIGHT YANG DITEMUKAN:
${insightsText}

ATURAN PENTING (Bahasa Indonesia):
1. Sebutkan 1-2 hal spesifik dari insight di atas
2. Bersikap membantu dan tulus, BUKAN salesy
3. Singkat dan padat - maksimal 100 kata
4. Gunakan tone profesional-tapi-santai (seperti rekan, bukan konsultan)
5. AKHIRI dengan: "Salam, [Nama] | Digital Marketing Consultant"
6. JANGAN gunakan bullet points atau angka
7. Berikan 1 saran spesifik yang actionable
8. JANGAN sebut persentase, angka teknis, atau statistik

Format PERSIS seperti:
SUBJECT: [subject line yang relevan]
BODY: [1-2 paragraf singkat, tanpa list]`;
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
    const subject = `Ide pertumbuhan untuk ${req.businessName}`;
    const body = `Halo tim ${req.businessName},\n\nSaya menemukan bisnis Anda dan melihat potensi untuk meningkatkan presence digital. Ada beberapa hal sederhana yang bisa membantu menarik lebih banyak pelanggan.\n\nJika Anda tertarik diskusi singkat 15 menit minggu ini, silakan balas email ini.\n\nSalam,\n[Nama] | Digital Marketing Consultant`;
    
    return {
      subject,
      body,
      generated_at: now,
      source: 'template',
    };
  }
}
