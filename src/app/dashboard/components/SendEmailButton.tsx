'use client';

interface SendEmailButtonProps {
  /** Callback untuk membuka EmailDrawer */
  onOpenDrawer: () => void;
  /** Tampilkan badge "Terkirim" jika email sudah pernah dikirim */
  hasSent?: boolean;
}

/**
 * SendEmailButton Component
 *
 * Simple trigger that opens the EmailDrawer slide-out panel.
 */
export function SendEmailButton({ onOpenDrawer, hasSent = false }: SendEmailButtonProps) {
  if (hasSent) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Sent</span>
        </div>
        <button
          onClick={onOpenDrawer}
          className="px-2 py-2 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/5 text-xs transition-all"
          title="Resend"
        >
          ↺
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onOpenDrawer}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all shadow-lg shadow-blue-500/20"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span>Send Email</span>
    </button>
  );
}

export default SendEmailButton;
