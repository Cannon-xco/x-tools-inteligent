'use client';

import { useState, useEffect, useCallback } from 'react';

interface EmailDrawerProps {
  open: boolean;
  onClose: () => void;
  leadId: number;
  leadName: string;
  subject: string;
  body: string;
  defaultTo?: string;
  onSent?: (sentAt: string) => void;
}

type SendState = 'idle' | 'sending' | 'sent' | 'error';

export function EmailDrawer({
  open,
  onClose,
  leadId,
  leadName,
  subject,
  body,
  defaultTo = '',
  onSent,
}: EmailDrawerProps) {
  const [sendState, setSendState] = useState<SendState>('idle');
  const [toEmail, setToEmail] = useState(defaultTo);
  const [editedSubject, setEditedSubject] = useState(subject);
  const [editedBody, setEditedBody] = useState(body);
  const [errorMsg, setErrorMsg] = useState('');

  // Reset state when drawer opens
  useEffect(() => {
    if (open) {
      setSendState('idle');
      setToEmail(defaultTo);
      setEditedSubject(subject);
      setEditedBody(body);
      setErrorMsg('');
    }
  }, [open, defaultTo, subject, body]);

  // Auto-close after success
  useEffect(() => {
    if (sendState === 'sent') {
      const timer = setTimeout(() => {
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [sendState, onClose]);

  const handleSend = useCallback(async () => {
    if (!toEmail.trim()) {
      setErrorMsg('Masukkan alamat email tujuan');
      setSendState('error');
      return;
    }

    setSendState('sending');
    setErrorMsg('');

    try {
      const res = await fetch('/api/outreach/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          to: toEmail.trim(),
          subject: editedSubject,
          body: editedBody,
        }),
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
  }, [leadId, toEmail, editedSubject, editedBody, onSent]);

  const handleBackdropClick = () => {
    if (sendState !== 'sending') {
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleBackdropClick}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-[420px] bg-[#131620] border-l border-white/10 z-50 transform transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h3 className="text-white font-semibold text-sm">{leadName}</h3>
            <p className="text-gray-500 text-xs">Kirim Email Outreach</p>
          </div>
          <button
            onClick={onClose}
            disabled={sendState === 'sending'}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all disabled:opacity-50"
            title="Tutup"
          >
            <span className="text-lg">×</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Success State */}
          {sendState === 'sent' && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
              <span>✅</span>
              <span>Email berhasil terkirim!</span>
            </div>
          )}

          {/* Error State */}
          {sendState === 'error' && errorMsg && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <span>❌</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Kirim ke */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400">Kirim ke</label>
            <input
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="recipient@example.com"
              disabled={sendState === 'sending' || sendState === 'sent'}
              className="w-full bg-black/40 border border-white/10 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors font-mono disabled:opacity-50"
            />
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400">Subject</label>
            <input
              type="text"
              value={editedSubject}
              onChange={(e) => setEditedSubject(e.target.value)}
              placeholder="Email subject..."
              disabled={sendState === 'sending' || sendState === 'sent'}
              className="w-full bg-black/40 border border-white/10 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors disabled:opacity-50"
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400">Body</label>
            <textarea
              value={editedBody}
              onChange={(e) => setEditedBody(e.target.value)}
              placeholder="Email body..."
              disabled={sendState === 'sending' || sendState === 'sent'}
              rows={12}
              className="w-full bg-black/40 border border-white/10 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors resize-none disabled:opacity-50 leading-relaxed"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-5 border-t border-white/10 bg-[#131620]">
          <button
            onClick={handleSend}
            disabled={sendState === 'sending' || sendState === 'sent'}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-all"
          >
            {sendState === 'sending' ? (
              <>
                <span className="inline-block w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
                <span>Mengirim...</span>
              </>
            ) : sendState === 'sent' ? (
              <>
                <span>✅</span>
                <span>Terkirim</span>
              </>
            ) : (
              <>
                <span>✉️</span>
                <span>Send Email</span>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

export default EmailDrawer;
