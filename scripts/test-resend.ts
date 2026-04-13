// scripts/test-resend.ts
// Jalankan: npx ts-node scripts/test-resend.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function main() {
  const { data, error } = await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: 'kadekwidi@deltaxs.co',
    subject: 'Test from XTools',
    html: '<p>Email test berhasil! 🎉</p>',
  });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ Email terkirim! ID:', data?.id);
}

main();
