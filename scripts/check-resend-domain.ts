#!/usr/bin/env tsx
/**
 * MARCALL — Resend domain verification check
 *
 * Usage:
 *   npx tsx scripts/check-resend-domain.ts
 *
 * Connects to Resend using RESEND_API_KEY from .env.local and lists all
 * domains on the account with their verification status.
 * Run this after adding DNS records to confirm careofaddress.com is verified.
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local' });
dotenvConfig(); // also load .env as fallback
import { Resend } from 'resend';

async function main() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('ERROR: RESEND_API_KEY not found in environment.');
    console.error('Make sure .env.local contains RESEND_API_KEY=re_...');
    process.exit(1);
  }

  console.log('Checking Resend domain verification status...\n');

  const resend = new Resend(apiKey);

  let domains: Awaited<ReturnType<typeof resend.domains.list>>;
  try {
    domains = await resend.domains.list();
  } catch (err: any) {
    console.error('Failed to fetch domains:', err.message);
    process.exit(1);
  }

  if (domains.error) {
    console.error('Resend API error:', domains.error.message);
    process.exit(1);
  }

  const list = domains.data?.data ?? [];

  if (list.length === 0) {
    console.log('No domains found on this Resend account.\n');
    console.log('Next step: Add careofaddress.com in the Resend dashboard.');
    console.log('  https://resend.com/domains');
  } else {
    console.log(`Found ${list.length} domain(s):\n`);
    for (const domain of list) {
      const status = (domain as any).status || 'unknown';
      const icon =
        status === 'verified' ? '✓' : status === 'pending' ? '⏳' : '✗';
      console.log(`  ${icon}  ${(domain as any).name}`);
      console.log(`       Status : ${status}`);
      console.log(`       Region : ${(domain as any).region || 'us-east-1'}`);
      console.log(`       ID     : ${(domain as any).id}`);
      console.log('');
    }

    const careofVerified = list.some(
      (d: any) => d.name?.includes('careofaddress.com') && d.status === 'verified',
    );
    const careofDomain = list.find((d: any) => d.name?.includes('careofaddress.com'));

    console.log('─'.repeat(60));
    if (careofVerified) {
      console.log('✓  careofaddress.com is VERIFIED');
      console.log('   You can now set EMAIL_FROM=MARCALL <no-reply@careofaddress.com>');
      console.log('   in your .env.local and emails will deliver to all recipients.');
    } else if (careofDomain) {
      console.log('⏳  careofaddress.com exists but is NOT YET verified.');
      console.log('   DNS propagation can take 1-2 hours after adding records.');
      console.log('   Until verified: emails only deliver to vamsy@qbridge.ai (Resend test mode).');
    } else {
      console.log('✗  careofaddress.com NOT found on this account.');
      console.log('   Add the domain at https://resend.com/domains');
      console.log('   Then add the SPF / DKIM / DMARC records to your DNS.');
      console.log('   Until verified: emails only deliver to vamsy@qbridge.ai (Resend test mode).');
    }
    console.log('─'.repeat(60));
  }

  console.log('\nFor setup instructions, see /home/user/workspace/marcall/RESEND_SETUP.md');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
