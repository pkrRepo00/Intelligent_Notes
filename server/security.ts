import dns from "node:dns";
import { promisify } from "node:util";

const resolveDns = promisify(dns.lookup);

export async function validateSafeUrl(urlStr: string | undefined): Promise<void> {
  if (!urlStr) return;
  try {
    const parsed = new URL(urlStr);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Invalid URL protocol. Only HTTP and HTTPS are allowed.');
    }

    const hostname = parsed.hostname;

    // Allow loopback for local AI providers (e.g., Ollama, LM Studio)
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]'
    ) {
      return;
    }

    // Block internal metadata endpoints
    const blockedIPs = [
      '169.254.169.254', // Standard metadata IP
      '0xA9.0xFE.0xA9.0xFE', // Hex IP
      '0251.0376.0251.0376', // Octal IP
      '2852039166', // Decimal IP
      '[::ffff:169.254.169.254]', // IPv4-mapped IPv6
      '[::ffff:a9fe:a9fe]', // IPv4-mapped IPv6 hex
      'metadata.google.internal', // GCP
      '100.100.100.200' // Alibaba Cloud
    ];

    if (blockedIPs.includes(hostname)) {
      throw new Error('Access to internal metadata endpoints is blocked.');
    }

    // Perform DNS resolution to prevent DNS Rebinding / DNS based SSRF
    const lookupResult = await resolveDns(hostname);
    if (lookupResult && lookupResult.address) {
      if (blockedIPs.includes(lookupResult.address)) {
        throw new Error('Access to internal metadata endpoints is blocked.');
      }
    }

  } catch (err: any) {
    if (err.message && err.message.includes('metadata endpoints is blocked')) {
        throw err;
    }
    if (err.message && err.message.includes('Invalid URL protocol')) {
        throw err;
    }
    // General parsing error for malicious/invalid formats
    if (err.code === 'ERR_INVALID_URL' || err instanceof TypeError) {
      throw new Error('Invalid URL provided.');
    }
    throw err;
  }
}
