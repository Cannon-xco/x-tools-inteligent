// ============================================================
// API ROUTE: GET /api/export
// Exports all leads as a CSV file
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getLeads, insertLog } from '@/lib/db/client';
import type { EnrichmentData, OutreachDraft } from '@/types';

export const runtime = 'nodejs';

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""').replace(/\n|\r/g, ' ')}"`;
  }
  return str;
}

function row(fields: Array<string | number | null | undefined>): string {
  return fields.map(escapeCsv).join(',');
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '10000'), 10000);

    const rows = await getLeads(limit, 0);

      const headers = [
      'ID', 'Name', 'Address', 'Phone', 'Maps URL', 'Website',
      'Rating', 'Reviews', 'Score', 'Reasons',
      'Has SSL', 'Has Booking', 'Has Social', 'Emails',
      'Detected Tech', 'CMS',
      'Meta Title', 'Meta Description',
      'Outreach Subject', 'Outreach Body', 'Outreach Source',
      'Created At',
    ];

    const csvLines = [headers.join(',')];

    for (const r of rows) {
      const enrichment: EnrichmentData | null = r.enrichment_json
        ? JSON.parse(r.enrichment_json)
        : null;
      const outreach: OutreachDraft | null = r.outreach_json
        ? JSON.parse(r.outreach_json)
        : null;
      const reasons: string[] = r.reasons ? JSON.parse(r.reasons) : [];

      csvLines.push(row([
        r.id,
        r.name,
        r.address,
        r.phone,
        r.maps_url,
        r.website,
        r.rating,
        r.review_count,
        r.score,
        reasons.join(' | '),
        enrichment?.website?.has_ssl?.value ? 'Yes' : 'No',
        enrichment?.website?.has_booking?.value ? 'Yes' : 'No',
        enrichment?.website?.has_social?.value ? 'Yes' : 'No',
        enrichment?.website?.emails?.value?.join('; ') ?? '',
        enrichment?.tech?.detected_tech?.value?.join('; ') ?? '',
        enrichment?.tech?.cms?.value ?? '',
        enrichment?.seo?.title?.value ?? '',
        enrichment?.seo?.meta_description?.value ?? '',
        outreach?.subject ?? '',
        outreach?.body ?? '',
        outreach?.source ?? '',
        r.created_at,
      ]));
    }

    const csv = csvLines.join('\r\n');
    const filename = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;

    await insertLog('info', `CSV export: ${rows.length} leads`);

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await insertLog('error', `CSV export failed: ${msg}`);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
