// ============================================================
// API ROUTE: POST /api/outreach/send
// Kirim outreach email via Resend SDK
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { updateLeadSentAt, insertLog } from '@/lib/db/client';
import type { ApiResponse } from '@/types';

export const runtime = 'nodejs';

interface SendEmailBody {
  leadId: number;
  to: string;
  subject: string;
  body: string;
}

/**
 * Validasi format email sederhana.
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * POST /api/outreach/send
 *
 * Request body:
 * {
 *   "leadId": 123,
 *   "to": "target@example.com",
 *   "subject": "Quick tip for Acme Corp",
 *   "body": "Hi Acme Corp, ..."
 * }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';
  const fromName = process.env.RESEND_FROM_NAME ?? 'XTools Outreach';

  if (!apiKey || apiKey.startsWith('re_xxx')) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'RESEND_API_KEY belum dikonfigurasi. Tambahkan ke .env.local',
    }, { status: 503 });
  }

  let body: SendEmailBody;
  try {
    body = (await req.json()) as SendEmailBody;
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { leadId, to, subject, body: emailBody } = body;

  if (!leadId || typeof leadId !== 'number') {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'leadId harus berupa number' },
      { status: 400 }
    );
  }
  if (!to || !isValidEmail(to)) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Format email tujuan tidak valid' },
      { status: 400 }
    );
  }
  if (!subject?.trim()) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'subject tidak boleh kosong' },
      { status: 400 }
    );
  }
  if (!emailBody?.trim()) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'body email tidak boleh kosong' },
      { status: 400 }
    );
  }

  try {
    const resend = new Resend(apiKey);

    await insertLog('info', `📧 Mengirim email ke ${to} untuk lead #${leadId}`);

    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to.trim()],
      subject: subject.trim(),
      text: emailBody.trim(),
    });

    if (error) {
      await insertLog('error', `❌ Resend error untuk lead #${leadId}: ${error.message}`);
      return NextResponse.json<ApiResponse>(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    const sentAt = new Date().toISOString();
    await updateLeadSentAt(leadId, sentAt);
    await insertLog('info', `✅ Email terkirim ke ${to} untuk lead #${leadId} (id: ${data?.id})`);

    return NextResponse.json<ApiResponse<{ messageId: string; sent_at: string }>>({
      success: true,
      data: {
        messageId: data?.id ?? '',
        sent_at: sentAt,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await insertLog('error', `❌ outreach/send error untuk lead #${leadId}: ${msg}`);
    return NextResponse.json<ApiResponse>(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
