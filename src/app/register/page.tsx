'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/context';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError(t('reg.errShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('reg.errMismatch'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? t('reg.errFailed'));

      router.push('/login?registered=1');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0f1a] flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-sm">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-white text-xl font-bold tracking-tight">XTools</h1>
          <p className="text-gray-500 text-sm mt-1">{t('reg.subtitle')}</p>
        </div>

        {/* Card */}
        <div className="bg-[#131620] border border-white/10 rounded-2xl p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
                {t('reg.fullName')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('reg.namePlaceholder')}
                required
                className="w-full bg-black/40 border border-white/10 focus:border-blue-500/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
                autoComplete="email"
                className="w-full bg-black/40 border border-white/10 focus:border-blue-500/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('reg.passPlaceholder')}
                required
                autoComplete="new-password"
                className="w-full bg-black/40 border border-white/10 focus:border-blue-500/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
                {t('reg.confirmPass')}
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={t('reg.confirmPlaceholder')}
                required
                autoComplete="new-password"
                className="w-full bg-black/40 border border-white/10 focus:border-blue-500/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/5 border border-red-500/20">
                <span className="text-red-400 text-xs">❌</span>
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{t('reg.loading')}</span>
                </>
              ) : (
                t('reg.btn')
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-600 mt-5">
            {t('reg.hasAccount')}{' '}
            <Link href="/login" className="text-blue-400 hover:text-blue-300 transition-colors font-medium">
              {t('reg.signInLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
