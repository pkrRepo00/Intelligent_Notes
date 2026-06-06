export function validateProviderUrl(url?: string) {
  if (!url) return;

  try {
    const parsed = new URL(url);

    // Only allow HTTP and HTTPS
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Invalid URL protocol. Only HTTP and HTTPS are allowed.');
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block metadata endpoints and internal AWS/GCP IPs
    if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
      throw new Error('Access to internal metadata endpoints is forbidden.');
    }

    // Restrict loopback addresses to only Ollama's default port
    const isLoopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
    if (isLoopback && parsed.port !== '11434') {
      throw new Error('Loopback access is only allowed for port 11434 (Ollama).');
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw new Error(`Invalid provider URL: ${err.message}`);
    }
    throw new Error('Invalid provider URL.');
  }
}
