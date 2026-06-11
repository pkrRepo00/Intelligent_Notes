export function validateSafeUrl(urlString?: string): void {
  if (!urlString) return;

  let url: URL;
  try {
    url = new URL(urlString);
  } catch (err) {
    throw new Error("Invalid URL format");
  }

  // Only allow HTTP(S)
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("URL must use HTTP or HTTPS protocol");
  }

  const hostname = url.hostname.toLowerCase();

  // Block AWS/GCP/Azure metadata endpoints
  if (hostname === "169.254.169.254" || hostname === "metadata.google.internal") {
    throw new Error("Access to internal metadata endpoints is forbidden");
  }

  // Prevent SSRF via loopback addressing, except for Ollama on port 11434
  const isLoopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
  if (isLoopback) {
    if (url.port !== "11434") {
      throw new Error("Loopback addresses are only permitted for port 11434 (Ollama)");
    }
  }
}
