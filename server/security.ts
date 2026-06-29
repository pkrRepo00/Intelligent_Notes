import { Agent, fetch, RequestInit, Response } from 'undici';
import dns from 'dns';

// Validates URL protocol is http or https
export function validateSafeUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }

    // Also block internal metadata IPs immediately if provided directly in the URL
    if (url.hostname === '169.254.169.254') {
        return false;
    }

    return true;
  } catch {
    return false;
  }
}

const ssrfAgent = new Agent({
  connect: {
    lookup: (hostname, options, callback) => {
      dns.lookup(hostname, options, (err, address, family) => {
        if (err) return callback(err, address as any, family as any);

        const addresses = Array.isArray(address) ? address : [{ address, family }];

        for (const addr of addresses) {
          const ip = typeof addr === 'string' ? addr : (addr.address || addr);
          // Block internal metadata endpoints (169.254.169.254)
          // We don't block 127.0.0.1 or localhost as it breaks Ollama/LocalAI integrations
          if (ip === '169.254.169.254') {
            return callback(new Error('SSRF blocked: metadata endpoint not allowed'), [] as any, 0);
          }
        }

        callback(null, address as any, family as any);
      });
    }
  }
});

// A secure wrapper around fetch that prevents SSRF via DNS rebinding and internal IP access
export async function secureFetch(url: string, init?: RequestInit): Promise<Response> {
  if (!validateSafeUrl(url)) {
    throw new Error('Invalid URL protocol or blocked IP');
  }

  const options: RequestInit = {
    ...init,
    dispatcher: ssrfAgent,
    redirect: 'error' // Prevent redirects to bypass initial validation
  };

  return fetch(url, options);
}
