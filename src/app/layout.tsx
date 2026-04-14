import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { SessionProvider } from 'next-auth/react';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Lead Engine — Local Business Lead Generation',
  description: 'AI-powered local business lead generation: source, enrich, score, and reach out to potential clients automatically.',
  keywords: ['lead generation', 'local business', 'AI outreach', 'sales prospecting'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0d0f1a] text-white`}
      >
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
