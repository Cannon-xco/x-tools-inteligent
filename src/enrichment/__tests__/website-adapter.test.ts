// ============================================================
// Tests: Enhanced Website Adapter
// Run: npx tsx src/enrichment/__tests__/website-adapter.test.ts
// ============================================================

import { extractFromWebsite } from '../sources/website-adapter';

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ ${testName}`);
      passed++;
    } else {
      console.log(`  ❌ ${testName}`);
      failed++;
    }
  }

  console.log('\n🧪 Website Adapter Tests\n');

  // ── Test 1: Standard email + mailto link ────────────────

  console.log('Test 1: Standard email + mailto link');
  {
    const html = `
      <html><body>
        <a href="mailto:info@example-biz.com">Email us</a>
        <p>Contact us at support@example-biz.com for inquiries.</p>
        <p>Image file: banner@2x.png should be filtered</p>
      </body></html>
    `;

    const result = await extractFromWebsite('https://example-biz.com', html);
    assert(result.emails.length >= 2, 'Found at least 2 emails');
    assert(
      result.emails.some((e) => e.value === 'info@example-biz.com' && e.confidence >= 0.9),
      'mailto email has high confidence'
    );
    assert(
      result.emails.some((e) => e.value === 'support@example-biz.com'),
      'Regex email found'
    );
    assert(
      !result.emails.some((e) => e.value.includes('banner@2x')),
      'Filtered out image filename false positive'
    );
  }

  // ── Test 2: Obfuscated emails ───────────────────────────

  console.log('\nTest 2: Obfuscated email patterns');
  {
    const html = `
      <html><body>
        <p>Email: contact [at] mybusiness [dot] com</p>
        <p>Also: sales&#64;mybusiness&#46;com</p>
      </body></html>
    `;

    const result = await extractFromWebsite('https://mybusiness.com', html);
    assert(result.emails.length >= 1, 'Found at least 1 obfuscated email');
    assert(
      result.emails.some((e) => e.value.includes('mybusiness')),
      'Decoded obfuscated email correctly'
    );
    assert(
      result.emails.some((e) => e.source.includes('obfuscated')),
      'Source marked as obfuscated'
    );
  }

  // ── Test 3: Phone extraction (tel + WhatsApp) ──────────

  console.log('\nTest 3: Phone extraction');
  {
    const html = `
      <html><body>
        <a href="tel:+628123456789">Call us</a>
        <a href="https://wa.me/628987654321">WhatsApp</a>
        <p>Or call (021) 555-1234 for local inquiries.</p>
      </body></html>
    `;

    const result = await extractFromWebsite('https://example.com', html);
    assert(result.phones.length >= 2, 'Found at least 2 phone numbers');
    assert(
      result.phones.some((p) => p.value.includes('628123456789')),
      'Extracted tel: phone'
    );
    assert(
      result.phones.some((p) => p.source.includes('whatsapp')),
      'Extracted WhatsApp phone'
    );
  }

  // ── Test 4: Social links with filtering ────────────────

  console.log('\nTest 4: Social links extraction + filtering');
  {
    const html = `
      <html><body>
        <a href="https://instagram.com/mybusiness">Follow us</a>
        <a href="https://instagram.com/p/ABC123/">Latest post</a>
        <a href="https://facebook.com/mybusiness">Like us</a>
        <a href="https://linkedin.com/company/mybusiness">Connect</a>
        <a href="https://twitter.com/login">Login page</a>
        <a href="https://tiktok.com/@mybusiness?ref=homepage">TikTok</a>
      </body></html>
    `;

    const result = await extractFromWebsite('https://example.com', html);
    assert(result.socials.instagram === 'https://instagram.com/mybusiness', 'Instagram profile found');
    assert(result.socials.facebook === 'https://facebook.com/mybusiness', 'Facebook page found');
    assert(result.socials.linkedin === 'https://linkedin.com/company/mybusiness', 'LinkedIn found');
    assert(result.socials.tiktok !== undefined, 'TikTok found');
    assert(
      !result.socials.tiktok?.includes('ref='),
      'TikTok URL tracking params removed'
    );
  }

  // ── Test 5: Decision-maker detection ───────────────────

  console.log('\nTest 5: Decision-maker detection');
  {
    const html = `
      <html><body>
        <section>
          <h2>Our Team</h2>
          <div>
            <h3>John Doe</h3>
            <p>CEO & Founder</p>
          </div>
          <div>
            <h3>Jane Smith</h3>
            <p>Head of Marketing</p>
          </div>
          <div>
            <h3>Not A Person Title</h3>
            <p>Some random text about services</p>
          </div>
        </section>
      </body></html>
    `;

    const result = await extractFromWebsite('https://example.com', html);
    assert(result.people.length >= 2, 'Found at least 2 people');
    assert(
      result.people.some((p) => p.name === 'John Doe' && p.title.includes('CEO')),
      'Found CEO'
    );
    assert(
      result.people.some((p) => p.name === 'Jane Smith'),
      'Found Head of Marketing'
    );
  }

  // ── Summary ────────────────────────────────────────────

  console.log(`\n${'═'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'═'.repeat(40)}\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
