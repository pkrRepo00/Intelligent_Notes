import { Agent } from 'undici';
import dns from 'dns';
import net from 'net';

export function isBlockedIp(ip: string): boolean {
  // Block AWS/GCP/Azure metadata endpoints
  // Specifically block 169.254.x.x
  return ip.startsWith('169.254.');
}

// Custom agent for SSRF protection during DNS resolution
export const safeAgent = new Agent({
  connect: {
    lookup: (hostname, options, callback) => {
      // First check if it's already an IP address
      if (net.isIP(hostname)) {
         if (isBlockedIp(hostname)) {
             return callback(new Error(`SSRF blocked: Direct internal IP ${hostname}`), []);
         }
      }

      // Resolve DNS and validate the IP
      // @ts-ignore
      dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
        if (err) return callback(err, []);

        for (const addr of addresses) {
          if (isBlockedIp(addr.address)) {
            return callback(new Error(`SSRF blocked: Resolved to internal IP ${addr.address}`), []);
          }
        }
        // @ts-ignore
        callback(null, addresses);
      });
    }
  }
});

// Initial validation before request starts
export function validateSafeUrl(urlString: string): URL {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error('Invalid URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Invalid URL protocol');
  }

  // Node's URL constructor normalizes IP representations
  if (net.isIP(url.hostname)) {
    if (isBlockedIp(url.hostname)) {
      throw new Error('SSRF blocked: Target URL is an internal metadata endpoint');
    }
  }

  return url;
}
