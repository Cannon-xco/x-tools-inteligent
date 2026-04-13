'use client';

import { useState } from 'react';

interface SendEmailButtonProps {
  leadId: number;
  subject: string;
  body: string;
  defaultTo: string;
  onSent: (sentAt: string) => void;
}

/**
 * Button component that sends an outreach email for a lead.
 *
 * Flow:
 * 1. If a recipient email is known (`defaultTo`), show Send button directly.
 * 2. Otherwise show an email input first.
 * 3. POSTs to `/api/leads/{leadId}/send-email`.
 * 4. Falls back to opening a `mailto:` link if the API is unavailable.
 * 5. Calls `onSent(sentAt)` on success so the parent can update state.
 */
export function SendEmailButton({
  leadId,
  subject,
  body,
  defaultTo,
  onSent,
}: SendEmailButtonProps) {
  const [to, setTo] = useState(defaultTo);
  const [showInput, setShowInput] = useState(!defaultTo);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    const recipient = to.trim();
    if (!recipient) {
      setError('Masukkan alamat email penerima terlebih dahulu.');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/leads/${leadId}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: recipient, subject, body }),
      });

      if (res.ok) {
        const json = (await res.json()) as { data?: { sent_at?: string } };
        const sentAt = json.data?.sent_at ?? new Date().toISOString();
        onSent(sentAt);
        return;
      }
    } catch {
      // API not available — fallthrough to mailto
    }

    // Fallback: open system email client via mailto
    const mailto =
      `mailto:${encodeURIComponent(recipient)}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;
    window.open(mailto, '_blank');
    onSent(new Date().toISOString());
  }

  return (
    <div className="space-y-2">
      {showInput && (
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="recipient@example.com"
          className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
        />
      )}

      {!showInput && to && (
        <p className="text-xs text-gray-500 truncate">
          To: <span className="text-gray-300">{to}</span>
          <button
            onClick={() => setShowInput(true)}
            className="ml-2 text-gray-600 hover:text-gray-400 underline text-[11px]"
          >
            change
          </button>
        </p>
      )}

      <button
        onClick={to.trim() ? handleSend : () => setShowInput(true)}
        disabled={sending}
        className="w-full py-2.5 rounded-xl font-medium text-sm transition-all bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white flex items-center justify-center gap-2"
      >
        {sending
          ? '⏳ Sending…'
          : !to.trim()
          ? '📬 Set Recipient & Send'
          : '📨 Send Email'}
      </button>

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
