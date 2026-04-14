import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createUser, getUserByEmail } from '@/lib/db/client';

export async function POST(req: NextRequest) {
  try {
    const { email, name, password } = await req.json();

    if (!email || !name || !password) {
      return NextResponse.json(
        { success: false, error: 'Email, nama, dan password wajib diisi' },
        { status: 400 },
      );
    }

    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password minimal 8 karakter' },
        { status: 400 },
      );
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Email sudah terdaftar' },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await createUser(email, name, passwordHash);

    return NextResponse.json({ success: true, message: 'Akun berhasil dibuat' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
