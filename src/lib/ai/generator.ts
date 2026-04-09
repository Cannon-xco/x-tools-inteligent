// ============================================================
// AI OUTREACH GENERATOR
// Generates personalized outreach emails using OpenRouter
// Falls back to template-based generation when API unavailable
// ============================================================

import type { OutreachDraft, OutreachRequest } from '@/types';
import { insertLog } from '@/lib/db/client';

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL ?? 'z-ai/glm-5.1'; // Using Elite Reasoning Model from your example
const MAX_TOKENS = 1200; // Increased for reasoning overhead

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
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://leadengine.local',
      'X-Title': 'LocalBizLeadEngine',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: MAX_TOKENS,
      temperature: 0.7,
      reasoning: { enabled: true }
    }),
    signal: AbortSignal.timeout(20_000),
  });

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
