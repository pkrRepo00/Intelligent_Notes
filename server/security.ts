export function validateUrl(url?: string): string | undefined {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);

    // Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Invalid protocol: ${parsed.protocol}`);
    }

    // Block internal metadata endpoints
    if (parsed.hostname === '169.254.169.254' || parsed.hostname === '169.254.169.253' || parsed.hostname === 'metadata.google.internal' || parsed.hostname === '[fd00:ec2::254]') {
      throw new Error('Access to internal metadata endpoints is forbidden');
    }

    // Block unauthorized loopback (allow list specific ports if needed, but for Ollama we usually allow 11434)
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1' || parsed.hostname === '0.0.0.0') {
       if (parsed.port !== '11434' && parsed.port !== '') {
         throw new Error('Access to unauthorized local ports is forbidden');
       }
    }

    return url;
  } catch (err: any) {
    if (err.message.includes('forbidden') || err.message.includes('Invalid protocol')) {
      throw err;
    }
    throw new Error('Invalid URL format');
  }
}
