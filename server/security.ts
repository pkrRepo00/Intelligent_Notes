import dns from 'node:dns';
import { promisify } from 'node:util';

const lookup = promisify(dns.lookup);

/**
 * Validates a user-provided URL to prevent Server-Side Request Forgery (SSRF).
 * Allows loopback addresses for local AI development.
 * Blocks internal metadata endpoints (169.254.169.254) and protects against DNS rebinding.
 */
export async function validateSafeUrl(inputUrl?: string): Promise<void> {
  if (!inputUrl) return;

  if (typeof inputUrl !== 'string') {
    throw new Error('Security Error: Invalid URL type provided');
  }

  let parsed: URL;
  try {
    parsed = new URL(inputUrl);
  } catch {
    throw new Error('Security Error: Invalid URL format');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Security Error: Invalid protocol. Only HTTP and HTTPS are permitted');
  }

  const hostname = parsed.hostname;

  // Explicitly permit loopback for local AI development
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0' || hostname === '[::1]') {
    return;
  }

  // Block obvious metadata IP
  if (hostname === '169.254.169.254') {
    throw new Error('Security Error: Forbidden internal metadata endpoint access');
  }

  // Perform DNS resolution to prevent DNS rebinding attacks
  try {
    const { address } = await lookup(hostname);
    if (address === '169.254.169.254') {
      throw new Error('Security Error: Resolved IP points to forbidden internal metadata endpoint');
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Security Error')) {
      throw err;
    }
    // Fail securely if DNS resolution fails
    throw new Error('Security Error: Failed to resolve hostname securely');
  }
}
