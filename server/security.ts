export function validateSafeUrl(urlString: string): string {
  try {
    const parsed = new URL(urlString);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Invalid protocol: ${parsed.protocol}`);
    }

    // Prevent SSRF to internal metadata endpoint
    if (parsed.hostname === '169.254.169.254') {
      throw new Error('Access to internal metadata endpoint is forbidden');
    }

    return parsed.toString();
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw new Error(`Invalid URL: ${err.message}`);
    }
    throw new Error('Invalid URL');
  }
}
