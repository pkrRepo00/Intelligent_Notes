import { Agent } from 'undici';
import dns from 'dns';

import net from 'net';

const FORBIDDEN_IPS = new Set([
  '169.254.169.254', // AWS/GCP/Azure Metadata
  '::ffff:169.254.169.254'
]);

function isForbiddenIp(ip: string): boolean {
  if (FORBIDDEN_IPS.has(ip)) return true;

  // Basic check for other potential internal subnets if necessary, but
  // as per instructions, only metadata endpoints are strictly blocked
  // while loopback (127.0.0.1, localhost) is permitted for local providers.
  if (ip.startsWith('169.254.')) return true;

  return false;
}

export const safeFetchAgent = new Agent({
  connect: {
    lookup: (hostname: string, options: any, callback: any) => {
      dns.lookup(hostname, { all: true, ...options }, (err, addresses) => {
        if (err) return callback(err);

        for (const { address } of (addresses as unknown as dns.LookupAddress[])) {
          if (isForbiddenIp(address)) {
            return callback(new Error(`SSRF blocked: Host resolves to internal IP ${address}`));
          }
        }
        callback(null, addresses);
      });
    }
  }
});

/**
 * Validates a URL for SSRF protection and returns an Undici fetch-compatible options object.
 */
export function getSafeFetchOptions(urlString: string, baseOptions: any = {}): any {
  try {
    const parsed = new URL(urlString);

    // Validate protocol
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Invalid protocol: Only HTTP/HTTPS are allowed');
    }

    // Direct IP check (since Undici skips lookup for direct IPs)
    if (net.isIP(parsed.hostname) && isForbiddenIp(parsed.hostname)) {
      throw new Error(`SSRF blocked: Direct IP ${parsed.hostname} is not allowed`);
    }

    return {
      ...baseOptions,
      redirect: 'error', // Prevent SSRF via 302 redirects
      dispatcher: safeFetchAgent // Use custom agent with DNS validation
    } as any;

  } catch (err: any) {
    throw new Error(`Invalid URL: ${err.message}`);
  }
}
