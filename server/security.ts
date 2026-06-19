export function validateSafeUrl(urlString: string | undefined): void {
  if (!urlString) return;

  let url: URL;
  try {
    url = new URL(urlString);
  } catch (err) {
    throw new Error("Invalid URL format");
  }

  // Allow only http and https protocols
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Invalid protocol. Only HTTP and HTTPS are allowed.");
  }

  // Block known cloud metadata IP addresses and domains
  const blockedHosts = [
    "169.254.169.254",     // AWS / GCP / Azure metadata IP
    "metadata.google.internal", // GCP metadata domain
    "169.254.169.253",     // Rare alternative metadata IP
    "fd00:ec2::254"        // AWS IPv6 metadata
  ];

  if (blockedHosts.includes(url.hostname)) {
    throw new Error("Access to internal metadata endpoints is not allowed.");
  }

  // Note: we permit localhost/127.0.0.1 to allow local AI provider integrations
  // (like Ollama, LM Studio) as per the requirements.
}
