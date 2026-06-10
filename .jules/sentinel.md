## 2025-02-28 - SSRF Vulnerability in AI Gateway
**Vulnerability:** The AI gateway allowed fetching arbitrary URLs (SSRF) when using a custom provider with user-supplied `baseUrl` parameter, opening access to internal metadata endpoints.
**Learning:** `baseUrl` passed to Node `fetch()` without validation can traverse to sensitive cloud metadata (e.g. 169.254.169.254) and unauthorized loopback addresses.
**Prevention:** Always validate user-supplied URLs via native `URL` parsing logic and check protocol, hostname, and port to ensure external connectivity logic cannot target internal resources.
