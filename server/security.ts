import { Agent, fetch as undiciFetch } from "undici";
import * as dns from "dns";
import * as net from "net";

// Blocklist of internal/private IP ranges
const BLOCKED_IP_RANGES = [
  /^127\./, // Loopback IPv4
  /^10\./,  // Private Class A
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private Class B
  /^192\.168\./, // Private Class C
  /^169\.254\./, // Link-local
  /^0\./, // "This network" / 0.0.0.0
  /^::1$/, // Loopback IPv6
  /^0:0:0:0:0:0:0:1$/, // Uncompressed IPv6 loopback
  /^::$/, // Unspecified IPv6
  /^0:0:0:0:0:0:0:0$/, // Uncompressed IPv6 unspecified
  /^fd/, // Unique Local IPv6
  /^fe80/ // Link-local IPv6
];

function isIpBlocked(ip: string): boolean {
  return BLOCKED_IP_RANGES.some((regex) => regex.test(ip));
}

function createSecureAgent(allowLocal: boolean = false): Agent {
  return new Agent({
    connect: {
      lookup: (hostname, options, callback) => {
        // Handle direct IP addresses
        if (net.isIP(hostname)) {
          if (!allowLocal && isIpBlocked(hostname)) {
            return callback(new Error(`SSRF Prevention: Blocked access to internal IP ${hostname}`), []);
          }
          return dns.lookup(hostname, options, (err, address, family) => {
             callback(err as NodeJS.ErrnoException | null, address as any, family as any);
          });
        }

        // Perform DNS resolution
        dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
          if (err) {
            return callback(err, []);
          }

          if (!addresses || addresses.length === 0) {
            return callback(new Error(`Could not resolve hostname ${hostname}`), []);
          }

          // Validate all resolved IPs
          for (const addr of addresses) {
            if (!allowLocal && isIpBlocked(addr.address)) {
              return callback(new Error(`SSRF Prevention: Resolved IP ${addr.address} for ${hostname} is blocked`), []);
            }
          }

          // Return the resolved addresses
          callback(null, addresses as any);
        });
      }
    }
  });
}

const secureAgent = createSecureAgent(false);
const localAgent = createSecureAgent(true);

export interface SafeFetchOptions extends RequestInit {
  allowLocal?: boolean;
}

export async function safeFetch(url: string | URL, options?: SafeFetchOptions): Promise<Response> {
  const urlObj = typeof url === 'string' ? new URL(url) : url;

  // Basic protocol check
  if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
    throw new Error(`SSRF Prevention: Unsupported protocol ${urlObj.protocol}`);
  }

  const { allowLocal, ...fetchOptions } = options || {};

  // Always prevent automatic redirect following to avoid redirect-based SSRF
  const finalOptions: any = {
    ...fetchOptions,
    redirect: fetchOptions.redirect || 'error',
    dispatcher: allowLocal ? localAgent : secureAgent
  };

  return await undiciFetch(urlObj, finalOptions) as unknown as Response;
}
