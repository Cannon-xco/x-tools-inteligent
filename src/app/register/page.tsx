'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (password.length < 8) {
      setError('Password minimal 8 karakter');
      return;
    }

    if (password !== confirmPassword) {
      setError('Password dan konfirmasi password tidak cocok');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Terjadi kesalahan saat registrasi');
        return;
      }

      // Redirect to login on success
      router.push('/login');
    } catch {
      setError('Terjadi kesalahan saat registrasi');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0f17] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#1a1f2e] border border-white/10 rounded-2xl p-8 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Daftar</h1>
          <p className="text-gray-400 text-sm">Buat akun baru untuk mengakses dashboard</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="name" className="block text-xs font-medium text-gray-400 mb-2">
              Nama
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama lengkap"
              required
              className="w-full bg-[#131624] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-xs font-medium text-gray-400 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              required
              className="w-full bg-[#131624] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-gray-400 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
              required
              minLength={8}
              className="w-full bg-[#131624] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-xs font-medium text-gray-400 mb-2">
              Konfirmasi Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ulangi password"
              required
              className="w-full bg-[#131624] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-all"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Memuat...
              </span>
            ) : (
              'Daftar'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-gray-500 text-xs">
            Sudah punya akun?{' '}
            <Link href="/login" className="text-violet-400 hover:text-violet-300 transition-colors">
              Masuk
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
