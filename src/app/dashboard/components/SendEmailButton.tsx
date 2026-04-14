'use client';

import { useState, useCallback } from 'react';

interface SendEmailButtonProps {
  /** Lead ID untuk update sent_at di DB */
  leadId: number;
  /** Subject email dari outreach draft */
  subject: string;
  /** Body email dari outreach draft */
  body: string;
  /** Email tujuan — auto-fill dari DEE atau enrichment jika ada */
  defaultTo?: string;
  /** Callback setelah email berhasil terkirim */
  onSent?: (sentAt: string) => void;
}

type SendState = 'idle' | 'sending' | 'sent' | 'error';

/**
 * SendEmailButton Component
 *
 * Tombol kirim email outreach via Resend API.
 * States: idle → expanded (input email) → sending → sent ✅ | error ❌
 */
export function SendEmailButton({
  leadId,
  subject,
  body,
  defaultTo = '',
  onSent,
}: SendEmailButtonProps) {
  const [sendState, setSendState] = useState<SendState>('idle');
  const [toEmail, setToEmail] = useState(defaultTo);
  const [errorMsg, setErrorMsg] = useState('');
  const [expanded, setExpanded] = useState(false);

  const handleSend = useCallback(async () => {
    if (!toEmail.trim()) {
      setErrorMsg('Masukkan alamat email tujuan');
      return;
    }

    setSendState('sending');
    setErrorMsg('');

    try {
      const res = await fetch('/api/outreach/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, to: toEmail.trim(), subject, body }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Gagal mengirim email');
      }

      setSendState('sent');
      onSent?.(data.data.sent_at);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setSendState('error');
    }
  }, [leadId, toEmail, subject, body, onSent]);

  // State: sudah terkirim
  if (sendState === 'sent') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
        <span>✅</span>
        <span>Terkirim ke <span className="font-mono">{toEmail}</span></span>
      </div>
    );
  }

  // State: collapsed (belum klik)
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all shadow-lg shadow-blue-500/20"
      >
        <span>✉️</span>
        <span>Send Email</span>
      </button>
    );
  }

  // State: expanded — tampilkan input email
  return (
    <div className="space-y-2 p-3 rounded-xl bg-black/30 border border-white/10">
      <p className="text-xs text-gray-400 font-medium">Kirim ke:</p>

      <div className="flex gap-2">
        <input
          type="email"
          value={toEmail}
          onChange={(e) => setToEmail(e.target.value)}
          placeholder="recipient@example.com"
          className="flex-1 bg-black/40 border border-white/10 focus:border-blue-500 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none transition-colors font-mono"
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          autoFocus
        />

        <button
          onClick={handleSend}
          disabled={sendState === 'sending'}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-all flex items-center gap-1.5"
        >
          {sendState === 'sending' ? (
            <>
              <span className="inline-block w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
              <span>Sending...</span>
            </>
          ) : (
            <>
              <span>✉️</span>
              <span>Send</span>
            </>
          )}
        </button>

        <button
          onClick={() => { setExpanded(false); setSendState('idle'); setErrorMsg(''); }}
          className="px-2 py-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 text-xs transition-all"
          title="Batal"
        >
          ✕
        </button>
      </div>

      {sendState === 'error' && errorMsg && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <span>❌</span>
          <span>{errorMsg}</span>
        </p>
      )}

      <p className="text-[10px] text-gray-600 truncate">
        Subject: <span className="text-gray-500">{subject}</span>
      </p>
    </div>
  );
}

export default SendEmailButton;
