export function validateSafeUrl(urlStr: string | undefined): string | undefined {
  if (!urlStr) return urlStr;
  try {
    const parsed = new URL(urlStr);

    // Only allow HTTP/HTTPS
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Invalid protocol. Only HTTP and HTTPS are allowed.');
    }

    const host = parsed.hostname.toLowerCase();

    // Block cloud provider metadata endpoints (AWS, GCP, Azure, etc.)
    if (host === '169.254.169.254' || host === '169.254.169.253' || host === 'metadata.google.internal' || host === '100.100.100.200') {
      throw new Error('SSRF attempt: Access to metadata endpoints is forbidden.');
    }

    // Protect loopback addresses: only authorize common local AI ports (like Ollama: 11434, LM Studio: 1234)
    const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1';

    if (isLoopback) {
      const port = parsed.port;
      // Allow list of known local AI ports, block others to prevent internal scanning/access
      if (port !== '11434' && port !== '1234' && port !== '8080') {
        throw new Error('SSRF attempt: Unauthorized loopback address access.');
      }
    }

    return urlStr;
  } catch (err: any) {
    throw new Error(`Security URL validation failed: ${err.message}`);
  }
}
