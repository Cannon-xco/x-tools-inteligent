'use client';

interface SendEmailButtonProps {
  /** Callback untuk membuka EmailDrawer */
  onOpenDrawer: () => void;
  /** Tampilkan badge "Sent" jika email sudah pernah dikirim */
  hasSent?: boolean;
}

/**
 * SendEmailButton Component
 *
 * Tombol trigger untuk membuka EmailDrawer.
 * Jika hasSent=true, tampilkan badge "✓ Sent" sebagai gantinya.
 */
export function SendEmailButton({ onOpenDrawer, hasSent }: SendEmailButtonProps) {
  if (hasSent) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
        <span>✅</span>
        <span>Email Terkirim</span>
      </div>
    );
  }

  return (
    <button
      onClick={onOpenDrawer}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all shadow-lg shadow-blue-500/20"
    >
      <span>✉️</span>
      <span>Send Email</span>
    </button>
  );
}

export default SendEmailButton;
