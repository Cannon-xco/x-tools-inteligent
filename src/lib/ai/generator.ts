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

  return `You are a professional digital marketing consultant writing a cold outreach email to a local business.

Business: ${req.business_name}
Industry: ${req.niche}
Location: ${req.location ?? 'local area'}
${ratingNote}

Identified opportunities for improvement:
${issueList}

Write a SHORT, HELPFUL outreach email with subject line and body.
Requirements:
- Maximum 120 words total
- Professional but friendly tone
- Value-focused (what they gain, not what they lack)
- Mention 1-2 specific improvements from the list above
- No fake promises or price mentions
- End with a soft call to action (reply to chat, free audit, etc.)

Format your response EXACTLY as:
SUBJECT: [subject line here]
BODY: [email body here]`;
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
  const topIssue = req.reasons[0] ?? 'digital presence improvements';
  const secondIssue = req.reasons[1];

  const subject = `Quick tip for ${req.business_name} — grow your ${req.niche} business`;

  const bodyParts = [
    `Hi ${req.business_name} team,`,
    '',
    `I came across your ${req.niche} business and noticed an opportunity that could help you attract more clients.`,
  ];

  if (topIssue) {
    bodyParts.push('', `Specifically: ${topIssue.toLowerCase()}.`);
  }
  if (secondIssue) {
    bodyParts.push(`Also: ${secondIssue.toLowerCase()}.`);
  }

  bodyParts.push(
    '',
    'These are quick wins that could meaningfully improve your online visibility and bookings.',
    '',
    'I\'d love to share a free 5-minute audit with you. Would you be open to a quick chat?',
    '',
    'Best regards'
  );

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

  return `You are a friendly local business consultant writing to ${req.businessName} in ${req.location}.

CONTEXT:
- Industry: ${req.niche}
- Google Rating: ${req.rating ?? 'N/A'}/5 (${req.review_count ?? 0} reviews)
- Data Confidence: ${(confidence * 100).toFixed(0)}%

DISCOVERED INSIGHTS:
${insightsText}

IMPORTANT RULES:
1. Reference 1-2 specific things you noticed from the insights above
2. Be genuinely helpful, NOT salesy
3. Keep it SHORT - under 100 words total
4. Use casual-professional tone (like a helpful peer, not a consultant)
5. End naturally - no "Best regards" (use "Salam" or just your name)
6. NEVER use bullet points or numbered lists
7. Make 1 specific, actionable suggestion

Format EXACTLY as:
SUBJECT: [catchy but relevant subject line]
BODY: [1-2 short paragraphs, no lists]`;
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
