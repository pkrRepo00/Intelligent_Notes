import dns from "dns/promises";

/**
 * Validates a given URL to prevent Server-Side Request Forgery (SSRF) attacks.
 * It ensures the protocol is HTTP/HTTPS and that the hostname does not resolve
 * to internal/private metadata endpoints (like 169.254.169.254 or fd00:ec2::254).
 * Loopback addresses are permitted to allow connections to local providers (e.g. Ollama).
 */
export async function validateSafeUrl(urlString: string | undefined): Promise<void> {
  if (!urlString) return;
  if (typeof urlString !== "string") throw new Error("Invalid URL type");

  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error("Invalid URL format");
  }

  // Only allow HTTP/HTTPS to prevent accessing file://, ftp://, gopher:// etc
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Invalid URL protocol. Only HTTP and HTTPS are allowed.");
  }

  let ips;
  try {
    ips = await dns.lookup(parsed.hostname, { all: true });
  } catch {
    throw new Error("Failed to resolve hostname");
  }

  // Denylist for internal metadata endpoints
  for (const { address } of ips) {
    if (address.startsWith("169.254.") || address === "fd00:ec2::254") {
      throw new Error("Access to internal endpoints is forbidden");
    }
  }
}
