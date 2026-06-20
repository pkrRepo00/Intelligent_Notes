export function validateSafeUrl(urlString: string): string {
  if (!urlString || typeof urlString !== 'string') {
    throw new Error("Invalid URL input type");
  }
  try {
    const url = new URL(urlString);

    // Only allow http and https protocols
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`Forbidden protocol: ${url.protocol}`);
    }

    // Block well-known cloud metadata IP address for SSRF
    if (url.hostname === '169.254.169.254') {
      throw new Error("Access to metadata endpoint is forbidden");
    }

    return url.href;
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error("Failed to parse URL");
  }
}
