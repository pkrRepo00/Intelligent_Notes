import * as dns from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

/**
 * Validates a URL to prevent SSRF (Server-Side Request Forgery) attacks.
 * It resolves the hostname and checks if the IP address belongs to a private,
 * loopback, or link-local range.
 * Note: loopback addresses (like 127.0.0.1, localhost, [::1]) are permitted
 * to allow local AI provider integrations (Ollama, LM Studio, etc.).
 *
 * @param urlString The URL to validate
 * @returns The resolved IP address to use for the fetch, or throws an error if unsafe.
 */
export async function validateSafeUrl(urlString: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch (err) {
    throw new Error('Invalid URL provided');
  }

  // Only allow HTTP/HTTPS
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Invalid protocol. Only HTTP and HTTPS are allowed.');
  }

  try {
    // Resolve the hostname
    const { address } = await dns.lookup(url.hostname);

    // Parse the IP address
    const ip = ipaddr.parse(address);
    const range = ip.range();

    // Block private, link-local, broadcast, etc., but ALLOW loopback for local AI
    const blockedRanges = [
      'private',
      'uniqueLocal',
      'linkLocal',
      'broadcast',
      'cluster',
      'multicast',
      'carrierGradeNat',
      'reserved',
      'test-net'
    ];

    if (blockedRanges.includes(range)) {
      throw new Error(`Access to ${range} IP range is forbidden.`);
    }

    // Returning the original urlString rather than reconstructing with IP
    // to avoid TLS/SNI issues. Note: Real robust SSRF protection against
    // DNS rebinding requires a custom fetch dispatcher, but this is a
    // good first layer.
    return urlString;
  } catch (err) {
    if (err instanceof Error && err.message.includes('forbidden')) {
        throw err;
    }
    // DNS lookup failure or invalid IP
    throw new Error('Failed to resolve hostname or invalid IP address');
  }
}
