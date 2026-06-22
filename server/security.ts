import dns from "node:dns/promises";

/**
 * SSRF Protection: Validates URLs to prevent access to cloud metadata.
 * Allows localhost/127.0.0.1 for local AI tools (Ollama, LM Studio).
 */
export async function validateSafeUrl(urlString: string | undefined): Promise<string | undefined> {
  if (!urlString) return urlString;

  const url = new URL(urlString); // throws on invalid URL
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Invalid protocol. Only HTTP/HTTPS allowed.");
  }

  const host = url.hostname.toLowerCase();
  if (host.includes("169.254.") || host === "metadata.google.internal") {
    throw new Error("SSRF Protection: Access to metadata endpoints is blocked.");
  }

  try {
    const records = await dns.lookup(host, { all: true });
    if (records.some(r => r.address.startsWith("169.254."))) {
      throw new Error("SSRF Protection: Resolves to blocked metadata IP.");
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("SSRF")) throw e;
  }

  return urlString;
}