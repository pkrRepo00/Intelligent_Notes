export function validateSafeUrl(urlStr: string | undefined | null): void {
  if (!urlStr) return;

  let url;
  try {
    url = new URL(urlStr);
  } catch (e) {
    throw new Error("Invalid URL format");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Invalid protocol. Only HTTP and HTTPS are allowed.");
  }

  const hostname = url.hostname;

  // Prevent SSRF to cloud metadata endpoints and zero address.
  // Note: This relies on string matching and does not prevent DNS rebinding.
  // Full SSRF protection would require network-level blocking or a custom HTTP agent.
  if (
    hostname === "169.254.169.254" ||
    hostname === "metadata.google.internal" ||
    hostname === "0.0.0.0"
  ) {
    throw new Error("Access to restricted internal endpoints is forbidden.");
  }
}
