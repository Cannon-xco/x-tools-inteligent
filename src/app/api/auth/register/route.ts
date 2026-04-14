import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createUser, getUserByEmail } from '@/lib/db/client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, name, password } = body;

    // Validate input
    if (!email || !name || !password) {
      return NextResponse.json(
        { success: false, error: 'Email, nama, dan password diperlukan' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Format email tidak valid' },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password minimal 8 karakter' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Email sudah terdaftar' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    await createUser(email, name, passwordHash);

    return NextResponse.json(
      { success: true, message: 'Akun berhasil dibuat' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan saat membuat akun' },
      { status: 500 }
    );
  }
}
