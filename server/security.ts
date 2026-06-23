export function validateSafeUrl(urlString: string): void {
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`Invalid protocol: ${url.protocol}`);
    }

    // Block internal metadata endpoints
    if (url.hostname === '169.254.169.254' || url.hostname === 'metadata.google.internal' || url.hostname === '100.100.100.200') {
      throw new Error(`Blocked URL hostname: ${url.hostname}`);
    }
  } catch (error: any) {
    throw new Error(`Invalid or blocked URL: ${error.message}`);
  }
}
