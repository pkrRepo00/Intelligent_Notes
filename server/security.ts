import dns from 'node:dns/promises';

export async function validateSafeUrl(urlString: string | undefined): Promise<string | null> {
  if (!urlString) return null;

  let url;
  try {
    url = new URL(urlString);
  } catch (e) {
    throw new Error("Invalid URL format.");
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error("Invalid URL protocol. Only HTTP and HTTPS are allowed.");
  }

  const originalHost = url.hostname;
  let address = originalHost;

  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(originalHost) && !/^\[?[a-fA-F0-9:]+\]?$/.test(originalHost) && originalHost !== 'localhost') {
    try {
      const lookupResult = await dns.lookup(originalHost);
      address = lookupResult.address;
    } catch (e) {
      throw new Error("DNS resolution failed for provided URL.");
    }
  }

  if (originalHost === 'localhost') {
    address = '127.0.0.1';
  }

  // Parse IP to check ranges
  const isPrivate = (ip: string) => {
    if (ip === '127.0.0.1' || ip === '::1') return false; // Allow loopback as requested

    if (ip.startsWith('10.')) return true;
    if (ip.startsWith('192.168.')) return true;
    if (ip.startsWith('169.254.')) return true;
    if (ip.startsWith('0.')) return true;

    // 172.16.0.0 to 172.31.255.255
    if (ip.startsWith('172.')) {
      const secondOctet = parseInt(ip.split('.')[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) return true;
    }

    return false;
  };

  if (isPrivate(address)) {
    throw new Error("Access to private/internal networks is forbidden.");
  }

  // Return the original URL string unmodified to preserve HTTPS SNI and certificate validation.
  // Note: This relies on the standard node fetch which is vulnerable to TOCTOU DNS rebinding,
  // but it is the acceptable tradeoff to maintain functionality without external fetch agents.
  return url.toString();
}
