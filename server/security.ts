import dns from 'dns';
import { promisify } from 'util';

const lookup = promisify(dns.lookup);
const BLOCKED_IPS = new Set(['169.254.169.254', 'fd00:ec2::254']);

export async function validateSafeUrl(urlString: string | undefined): Promise<void> {
  if (!urlString) return;

  let url: URL;
  try {
    url = new URL(urlString);
  } catch (err) {
    throw new Error('Invalid URL format');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Invalid protocol. Only HTTP and HTTPS are allowed.');
  }

  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]') {
    return;
  }

  try {
    const { address } = await lookup(url.hostname);
    if (BLOCKED_IPS.has(address)) {
      throw new Error('Access to internal metadata endpoints is blocked for security.');
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('blocked')) {
      throw err;
    }
  }
}
