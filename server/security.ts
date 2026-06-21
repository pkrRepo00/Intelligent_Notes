// server/security.ts
/**
 * Validates a URL to prevent SSRF attacks.
 * Permits loopback addresses for local AI integrations.
 * Blocks cloud metadata endpoints.
 */
export function validateSafeUrl(urlString: string): void {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch (err) {
    throw new Error('Invalid URL format');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Invalid protocol: strictly http and https are allowed');
  }

  const hostname = url.hostname;

  // Block AWS/GCP/Azure metadata endpoints (169.254.x.x)
  if (hostname.startsWith('169.254.') || hostname === 'fd00:ec2::254') {
    throw new Error('Access to internal metadata endpoints is blocked');
  }
}
