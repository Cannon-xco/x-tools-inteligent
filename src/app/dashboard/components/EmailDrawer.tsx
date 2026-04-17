'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/lib/i18n/context';

export interface EmailDrawerProps {
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
  const { t } = useLanguage();
  const [toEmail, setToEmail]     = useState(defaultTo);
  const [subject, setSubject]     = useState(initialSubject);
  const [body, setBody]           = useState(initialBody);
  const [sendState, setSendState] = useState<SendState>('idle');
  const [errorMsg, setErrorMsg]   = useState('');

  useEffect(() => {
    if (open) {
      setToEmail(defaultTo);
      setSubject(initialSubject);
      setBody(initialBody);
      setSendState('idle');
      setErrorMsg('');
    }
  }, [open, defaultTo, initialSubject, initialBody]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleSend = useCallback(async () => {
    if (!toEmail.trim()) { setErrorMsg(t('email.errEmpty')); return; }
    if (!subject.trim()) { setErrorMsg(t('email.errSubject')); return; }
    if (!body.trim())    { setErrorMsg(t('email.errBody')); return; }

    setSendState('sending');
    setErrorMsg('');

    try {
      const res = await fetch('/api/outreach/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, to: toEmail.trim(), subject: subject.trim(), body: body.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? t('email.errFailed'));

      setSendState('sent');
      onSent?.(data.data?.sent_at ?? new Date().toISOString());
      setTimeout(() => onClose(), 2000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setSendState('error');
    }
  }, [leadId, toEmail, subject, body, onSent, onClose, t]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-[440px] bg-[#131620] border-l border-white/10 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 shrink-0">
          <div>
            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold mb-0.5">
              {t('email.header')}
            </p>
            <h2 className="text-white font-semibold text-sm truncate max-w-[300px]">{leadName}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5"
            aria-label={t('email.header')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Success */}
        {sendState === 'sent' ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-3xl">
              ✅
            </div>
            <div className="text-center">
              <p className="text-white font-semibold mb-1">{t('email.sent')}</p>
              <p className="text-gray-500 text-sm">
                {t('email.deliveredTo')}{' '}
                <span className="text-gray-300 font-mono">{toEmail}</span>
              </p>
            </div>
            <p className="text-xs text-gray-600">{t('email.closing')}</p>
          </div>
        ) : (
          /* Form */
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* To */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold">
                {t('email.to')}
              </label>
              <input
                type="email"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                placeholder="recipient@example.com"
                disabled={sendState === 'sending'}
                className="w-full bg-black/40 border border-white/10 focus:border-blue-500/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors font-mono"
              />
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold">
                {t('email.subject')}
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject email..."
                disabled={sendState === 'sending'}
                className="w-full bg-black/40 border border-white/10 focus:border-blue-500/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
              />
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold">
                {t('email.body')}
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                placeholder="Email body..."
                disabled={sendState === 'sending'}
                className="w-full bg-black/40 border border-white/10 focus:border-blue-500/60 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none transition-colors resize-none leading-relaxed"
              />
              <p className="text-[10px] text-gray-700 text-right">{body.length} {t('email.chars')}</p>
            </div>

            {/* Error */}
            {sendState === 'error' && errorMsg && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/5 border border-red-500/20">
                <span className="text-red-400 text-sm shrink-0">❌</span>
                <p className="text-xs text-red-400">{errorMsg}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {sendState !== 'sent' && (
          <div className="px-6 py-5 border-t border-white/5 shrink-0 space-y-2">
            <button
              onClick={handleSend}
              disabled={sendState === 'sending'}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10"
            >
              {sendState === 'sending' ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{t('email.sending')}</span>
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>{t('email.send')}</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={sendState === 'sending'}
              className="w-full py-2.5 rounded-xl text-gray-500 hover:text-gray-300 hover:bg-white/5 text-sm transition-all"
            >
              {t('email.cancel')}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default EmailDrawer;
