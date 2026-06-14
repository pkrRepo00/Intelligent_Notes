import dns from "node:dns";
import { promisify } from "node:util";

const lookupAsync = promisify(dns.lookup);

/**
 * Validates a URL to prevent Server-Side Request Forgery (SSRF) attacks.
 * It permits HTTP/HTTPS protocols and ensures the hostname does not resolve
 * to a cloud provider metadata IP (e.g., 169.254.169.254).
 * Loopback addresses are allowed to support local AI providers (e.g., Ollama).
 *
 * Returns the original URL if valid. DNS rebinding is a known complex issue
 * to handle without custom dispatchers in native node fetch, but we validate
 * the URL at configuration time to prevent direct metadata endpoint SSRF.
 */
export async function validateSafeUrl(urlString: string | undefined): Promise<string | undefined> {
  if (!urlString) return urlString;

  try {
    const url = new URL(urlString);

    // Only allow HTTP and HTTPS
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Invalid URL protocol. Only HTTP and HTTPS are allowed.");
    }

    // Asynchronous DNS resolution to prevent direct metadata endpoint SSRF
    const lookupResult = await lookupAsync(url.hostname);
    const ip = lookupResult.address || lookupResult; // handle mock differences
    const ipStr = typeof ip === 'string' ? ip : (ip as any).address;

    // Block cloud provider metadata endpoints (e.g., AWS, GCP, Azure 169.254.169.254)
    if (ipStr === "169.254.169.254" || (ipStr && typeof ipStr === 'string' && ipStr.startsWith("169.254."))) {
      throw new Error("Access to internal metadata endpoints is forbidden.");
    }

    // Returning the original URL string. Attempting to return the IP address URL breaks
    // TLS SNI verification for HTTPS endpoints (like api.openai.com). True DNS rebinding
    // protection would require a custom fetch dispatcher to override socket lookups,
    // but preventing direct SSRF to metadata is our main goal.
    return urlString;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Invalid URL provided.");
  }
}
