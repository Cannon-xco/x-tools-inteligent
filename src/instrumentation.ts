export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getPool } = await import('@/lib/db/client');
    getPool();
    console.log('✅ DB schema migration triggered on server start');
  }
}
