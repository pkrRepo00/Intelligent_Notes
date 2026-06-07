import dns from "dns/promises";

export async function validateSafeUrl(urlString: unknown): Promise<string | undefined> {
  if (!urlString) return undefined;
  if (typeof urlString !== "string") {
    throw new Error("SSRF Prevention: Invalid URL type");
  }

  let url: URL;
  try {
    url = new URL(urlString);
  } catch (err) {
    throw new Error("SSRF Prevention: Invalid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("SSRF Prevention: Invalid protocol");
  }

  let ip = url.hostname;
  try {
    const lookup = await dns.lookup(url.hostname);
    ip = lookup.address;
  } catch (err) {
    // DNS resolution failed or it's already an IP
  }

  if (ip === "169.254.169.254" || ip === "0.0.0.0") {
    throw new Error("SSRF Prevention: Forbidden IP address");
  }

  // Clean IPv6 brackets if present
  if (ip.startsWith("[") && ip.endsWith("]")) {
    ip = ip.slice(1, -1);
  }

  // Allow standard local ports for AI models, block others
  const isLoopback = ip === "localhost" || ip === "::1" || ip.startsWith("127.");
  const allowedPorts = ["11434", "1234", "8000"]; // Ollama, LM Studio, vLLM

  // If loopback is accessed, explicitly check the port to block port 80/443 bypasses
  if (isLoopback) {
    const port = url.port || (url.protocol === "https:" ? "443" : "80");
    if (!allowedPorts.includes(port)) {
      throw new Error("SSRF Prevention: Unauthorized loopback port");
    }
  }

  return urlString;
}
