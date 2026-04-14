# Task Yastika — Auth Setup (NextAuth + DB Users)

## Branch
```
git checkout -b feature/auth-setup-yastika
```

## Objective
Install NextAuth.js v5, buat tabel `users` + `user_preferences` di PostgreSQL,
buat DB query functions, dan setup NextAuth configuration.

## Steps

### 1. Install packages
```bash
npm install next-auth@beta bcryptjs
npm install -D @types/bcryptjs
```

### 2. Tambah env vars ke `.env.local`
```
NEXTAUTH_SECRET=generate-random-32-char-string-here
NEXTAUTH_URL=http://localhost:3000
```
Generate secret dengan: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### 3. UPDATE: `src/lib/db/client.ts`
Tambah di bagian bawah file (setelah fungsi existing), schema migration untuk users, dan query functions:

```ts
// ── Users table schema (run once) ─────────────────────────────
export async function initUsersSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      default_niche TEXT DEFAULT 'local',
      from_name TEXT DEFAULT 'XTools Outreach',
      from_email TEXT DEFAULT 'onboarding@resend.dev',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

// ── User query functions ───────────────────────────────────────
export interface DbUser {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
}

export async function createUser(email: string, name: string, passwordHash: string): Promise<DbUser> {
  const pool = getPool();
  const res = await pool.query(
    `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING *`,
    [email.toLowerCase().trim(), name.trim(), passwordHash]
  );
  await pool.query(
    `INSERT INTO user_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
    [res.rows[0].id]
  );
  return res.rows[0];
}

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const pool = getPool();
  const res = await pool.query(`SELECT * FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
  return res.rows[0] ?? null;
}

export async function getUserById(id: number): Promise<DbUser | null> {
  const pool = getPool();
  const res = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
  return res.rows[0] ?? null;
}
```

Juga panggil `initUsersSchema` di `initSchema` function yang sudah ada:
```ts
// Di dalam initSchema function, tambah baris:
await initUsersSchema(pool);
```

### 4. BUAT BARU: `src/auth.ts` (di root src/)
```ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getUserByEmail } from '@/lib/db/client';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string;
        const password = credentials?.password as string;
        if (!email || !password) return null;
        const user = await getUserByEmail(email);
        if (!user) return null;
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return null;
        return { id: String(user.id), email: user.email, name: user.name };
      },
    }),
  ],
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    jwt({ token, user }) {
      if (user) { token.id = user.id; }
      return token;
    },
    session({ session, token }) {
      if (session.user) { session.user.id = token.id as string; }
      return session;
    },
  },
});
```

### 5. BUAT BARU: `src/app/api/auth/[...nextauth]/route.ts`
```ts
import { handlers } from '@/auth';
export const { GET, POST } = handlers;
```

### 6. BUAT BARU: `src/app/api/auth/register/route.ts`
Endpoint POST untuk register user baru:
- Validasi email (format valid, belum terdaftar)
- Validasi password (min 8 karakter)
- Hash password dengan bcrypt (cost factor 12)
- Simpan ke DB
- Return: `{ success: true, message: "Akun berhasil dibuat" }`
- Error 409 jika email sudah ada

## Done When
- `npm install` berhasil tanpa error
- DB auto-create tabel `users` dan `user_preferences` saat server start
- `POST /api/auth/register` bisa register user baru
- `POST /api/auth/signin` (NextAuth) bisa login dengan kredensial yang benar
- Tidak ada TypeScript errors
