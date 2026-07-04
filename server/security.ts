import { Agent } from 'undici';
import dns from 'dns';
import net from 'net';

export function isInternalIP(address: string): boolean {
  if (
    address.startsWith('127.') ||     // Localhost (IPv4)
    address.startsWith('169.254.') || // AWS metadata, etc
    address.startsWith('10.') ||      // Private network
    address.startsWith('192.168.') || // Private network
    address.startsWith('0.') ||       // Current network (0.0.0.0/8)
    address === '::1'                 // Localhost (IPv6)
  ) {
    return true;
  }

  if (address.startsWith('172.')) {   // Private network 172.16.0.0/12
    const secondOctet = parseInt(address.split('.')[1] || '0', 10);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  // Basic IPv6 ULA check
  if (address.toLowerCase().startsWith('fc') || address.toLowerCase().startsWith('fd')) {
    return true;
  }

  return false;
}

const customLookup = (hostname: string, options: any, callback: any) => {
  dns.lookup(hostname, { all: true }, (err, addresses) => {
    if (err) return callback(err);

    let hasInternal = false;
    for (const { address } of addresses) {
      if (isInternalIP(address)) {
        hasInternal = true;
        break;
      }
    }

    if (hasInternal) {
      return callback(new Error('SSRF attempt blocked: Internal IP address detected via DNS resolution'));
    }

    callback(null, addresses);
  });
};

export const secureFetchAgent = new Agent({
  connect: { lookup: customLookup }
});

export function validateSafeUrl(urlStr: string): void {
  try {
    const url = new URL(urlStr);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Invalid protocol. Only HTTP and HTTPS are allowed.');
    }

    // Strip brackets from IPv6 literals for accurate net.isIP check
    const hostnameForIPCheck = url.hostname.replace(/^\[|\]$/g, '');

    if (net.isIP(hostnameForIPCheck)) {
      if (isInternalIP(hostnameForIPCheck)) {
        throw new Error('SSRF attempt blocked: Internal IP address detected in URL');
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('SSRF')) {
      throw err;
    }
    throw new Error('Invalid URL provided');
  }
}
