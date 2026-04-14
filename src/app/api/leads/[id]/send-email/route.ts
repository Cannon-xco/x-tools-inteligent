// ============================================================
// API ROUTE: POST /api/leads/[id]/send-email
// Sends an outreach email via Resend and records sent_at in DB.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getLeadById, updateLeadSentAt, insertLog } from '@/lib/db/client';
import { getSessionUserId } from '@/lib/auth/session';
import type { ApiResponse } from '@/types';

export const runtime = 'nodejs';

interface SendEmailBody {
  to: string;
  subject: string;
  body: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);

  if (!id || isNaN(id)) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Invalid lead id' },
      { status: 400 },
    );
  }

  let body: SendEmailBody;
  try {
    body = (await req.json()) as SendEmailBody;
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const { to, subject, body: emailBody } = body;

  if (!to || !subject || !emailBody) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'to, subject, and body are required' },
      { status: 400 },
    );
  }

  // Verify lead exists and belongs to current user
  const [lead, userId] = await Promise.all([
    getLeadById(id).catch(() => null),
    getSessionUserId(),
  ]);
  if (!lead) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: `Lead ${id} not found` },
      { status: 404 },
    );
  }
  if (userId != null && lead.user_id != null && lead.user_id !== userId) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Forbidden' },
      { status: 403 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';
  const fromName = process.env.RESEND_FROM_NAME ?? 'XTools Outreach';

  if (!apiKey) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'RESEND_API_KEY is not configured' },
      { status: 503 },
    );
  }

  // Send via Resend
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      text: emailBody,
    }),
  });

  if (!resendRes.ok) {
    const errText = await resendRes.text().catch(() => resendRes.statusText);
    console.error(`❌ Resend error for lead ${id}:`, errText);
    await insertLog('error', `Email send failed for lead ${id}: ${errText}`).catch(() => {});
    return NextResponse.json<ApiResponse>(
      { success: false, error: `Email delivery failed: ${errText}` },
      { status: 502 },
    );
  }

  const sentAt = new Date().toISOString();

  // Persist sent_at to DB
  await updateLeadSentAt(id, sentAt).catch((err) => {
    console.error(`⚠️ Could not persist sent_at for lead ${id}:`, err);
  });

  await insertLog('info', `📨 Email sent to ${to} for lead ${id} (${lead.name})`).catch(() => {});

  return NextResponse.json<ApiResponse<{ sent_at: string }>>({
    success: true,
    data: { sent_at: sentAt },
    message: `Email sent to ${to}`,
  });
}
