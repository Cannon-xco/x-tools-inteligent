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
  subject: initialSubject,
  body: initialBody,
  defaultTo = '',
  onSent,
}: EmailDrawerProps) {
  const [toEmail, setToEmail] = useState(defaultTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [sendState, setSendState] = useState<SendState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (open) {
      setToEmail(defaultTo);
      setSubject(initialSubject);
      setBody(initialBody);
      setSendState('idle');
      setErrorMsg('');
    }
  }, [open, defaultTo, initialSubject, initialBody]);

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
      setTimeout(() => {
        onSent?.(data.data.sent_at);
        onClose();
      }, 1800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setSendState('error');
    }
  }, [leadId, toEmail, subject, body, onSent, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-[420px] bg-[#131620] border-l border-white/10 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] shrink-0">
          <div>
            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold mb-0.5">Send Email</p>
            <h3 className="text-white font-semibold text-sm leading-snug truncate max-w-[300px]">{leadName}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-white transition-colors text-xl leading-none p-1 rounded-lg hover:bg-white/5"
          >
            ✕
          </button>
        </div>

        {/* Sent success state */}
        {sendState === 'sent' ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-3xl">
              ✅
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-base">Email Terkirim!</p>
              <p className="text-gray-500 text-sm mt-1">
                Dikirim ke <span className="font-mono text-gray-400">{toEmail}</span>
              </p>
            </div>
          </div>
        ) : (
          /* Form */
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

            {/* To field */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold">Kirim ke</label>
              <input
                type="email"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                placeholder="recipient@example.com"
                className="w-full bg-black/40 border border-white/10 focus:border-blue-500 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-700 focus:outline-none transition-colors font-mono"
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                autoFocus={open}
              />
            </div>

            {/* Subject field */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-black/40 border border-white/10 focus:border-violet-500 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-700 focus:outline-none transition-colors"
              />
            </div>

            {/* Body field */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold">Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="w-full bg-black/40 border border-white/10 focus:border-violet-500 rounded-xl px-3 py-2.5 text-sm text-gray-300 placeholder-gray-700 focus:outline-none transition-colors resize-none leading-relaxed"
              />
            </div>

            {/* Error */}
            {sendState === 'error' && errorMsg && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                <span>❌</span>
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {sendState !== 'sent' && (
          <div className="px-5 py-4 border-t border-white/[0.07] shrink-0 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-300 bg-white/5 hover:bg-white/10 border border-white/[0.07] transition-all"
            >
              Batal
            </button>
            <button
              onClick={handleSend}
              disabled={sendState === 'sending'}
              className="flex-[2] py-2.5 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
            >
              {sendState === 'sending' ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Mengirim...</span>
                </>
              ) : (
                <>
                  <span>✉️</span>
                  <span>Kirim Email</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default EmailDrawer;
