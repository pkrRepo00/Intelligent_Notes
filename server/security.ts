export function validateSafeUrl(urlString: string | undefined): boolean {
  if (!urlString) return true;

  if (typeof urlString !== 'string') {
    throw new Error('Invalid URL type');
  }

  try {
    const url = new URL(urlString);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`Invalid protocol: ${url.protocol}`);
    }

    const hostname = url.hostname.toLowerCase();

    if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
      throw new Error('Access to internal metadata endpoints is forbidden');
    }

    // We allow loopback addresses for local AI providers (e.g. Ollama, LM Studio, LocalAI)
    // but block known internal metadata endpoints.

    return true;
  } catch (err: unknown) {
    if (err instanceof Error) {
        throw err;
    }
    throw new Error('Invalid URL');
  }
}
