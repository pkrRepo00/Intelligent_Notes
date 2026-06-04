export function validateSafeUrl(urlString: string | undefined, providerId?: string): void {
  if (!urlString) return;

  let url: URL;
  try {
    url = new URL(urlString);
  } catch (e) {
    throw new Error("Invalid URL format.");
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Invalid protocol. Only HTTP and HTTPS are allowed.');
  }

  const hostname = url.hostname.toLowerCase();

  // Block AWS/GCP/Azure metadata IP
  if (
    hostname === '169.254.169.254' ||
    hostname === '169.254.169.253' ||
    hostname === 'metadata.google.internal' ||
    hostname === 'fd00:ec2::254'
  ) {
    throw new Error('Access to internal metadata endpoints is forbidden.');
  }

  // Block unauthorized loopback addresses
  // Allow loopback only for local providers like 'ollama'
  const isLocalProvider = providerId === 'ollama' || providerId === 'local';
  const isLoopback =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '[::1]' ||
    hostname.startsWith('127.');

  if (isLoopback && !isLocalProvider) {
    throw new Error('Loopback addresses are not authorized for this provider.');
  }
}
