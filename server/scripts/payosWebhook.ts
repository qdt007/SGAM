/**
 * Registers this server's webhook URL with payOS.
 *
 * payOS will not deliver anything until a URL has been registered, and registering is not a
 * matter of saving a string: payOS immediately posts a sample transaction to the URL and
 * refuses unless it answers 2xx. So the server has to be deployed and awake before this runs —
 * against Render's free tier, hit /health first and wait for it to wake up.
 *
 * Run: npm run payos:webhook -- https://your-api.onrender.com/api/billing/payos/webhook
 */
import 'dotenv/config';
import { payosStatus, registerWebhook } from '../src/config/payos';

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: npm run payos:webhook -- <https url to /api/billing/payos/webhook>');
    process.exit(1);
  }

  const status = payosStatus();
  if (!status.configured) {
    console.error(`Missing in .env: ${status.missing.join(', ')}`);
    process.exit(1);
  }

  // payOS only accepts a public HTTPS URL, so a localhost mistake is worth catching here rather
  // than reading it back out of payOS's error.
  if (!url.startsWith('https://')) {
    console.error('payOS only accepts an https URL that it can reach from the internet.');
    console.error('For a local server, put ngrok (or similar) in front of it first.');
    process.exit(1);
  }

  console.log(`Registering ${url} ...`);
  console.log('payOS is now posting a test transaction to it; this fails unless the server answers.\n');

  try {
    const result = await registerWebhook(url);
    console.log('Registered.\n');
    console.log(`  Account : ${result.accountName} (${result.accountNumber})`);
    console.log(`  Bank    : ${result.name}`);
    console.log(`  Webhook : ${result.webhookUrl}`);
  } catch (err) {
    const e = err as { message?: string; status?: number; code?: string; desc?: string };
    console.error(`Rejected${e.status ? ` (HTTP ${e.status})` : ''}: ${e.desc ?? e.message ?? err}`);
    console.error('\nUsually one of:');
    console.error('  - the server is asleep or not deployed yet (open /health and retry)');
    console.error('  - the URL 404s — check it ends in /api/billing/payos/webhook');
    console.error('  - the three PAYOS_* values belong to different payment channels');
    process.exit(1);
  }
}

main();
