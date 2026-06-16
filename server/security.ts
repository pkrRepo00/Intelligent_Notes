import dns from 'node:dns';
import { promisify } from 'node:util';

const lookupAsync = promisify(dns.lookup);

function isPrivateIP(ip: string): boolean {
  // Check for IPv6 localhost
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') return false;

  // Convert IP string to byte array (IPv4 only for simplicity in this check)
  const parts = ip.split('.');
  if (parts.length !== 4) return false;

  const b = parts.map(Number);

  // Allow loopback (127.0.0.0/8)
  if (b[0] === 127) return false;

  // Block AWS Metadata / Link-Local (169.254.0.0/16)
  if (b[0] === 169 && b[1] === 254) return true;

  // Block Private Networks (RFC 1918)
  if (b[0] === 10) return true; // 10.0.0.0/8
  if (b[0] === 172 && b[1] >= 16 && b[1] <= 31) return true; // 172.16.0.0/12
  if (b[0] === 192 && b[1] === 168) return true; // 192.168.0.0/16

  return false;
}

/**
 * Validates a URL to prevent Server-Side Request Forgery (SSRF) vulnerabilities.
 * Ensures the URL uses HTTP/HTTPS protocols and does not resolve to internal or private IP addresses.
 *
 * @param urlString The URL to validate.
 * @returns The validated URL string.
 * @throws Error if the URL is invalid or points to a blocked address.
 */
export async function validateSafeUrl(urlString: string): Promise<string> {
  try {
    const url = new URL(urlString);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`Invalid protocol: ${url.protocol}`);
    }

    // Perform asynchronous DNS resolution to prevent basic DNS rebinding bypasses
    const { address } = await lookupAsync(url.hostname);

    if (isPrivateIP(address)) {
      throw new Error('Access to private/internal IP ranges is blocked.');
    }

    return urlString;
  } catch (e: unknown) {
    if (e instanceof Error) {
      throw new Error(`Invalid URL: ${e.message}`);
    }
    throw new Error('Invalid URL');
  }
}
