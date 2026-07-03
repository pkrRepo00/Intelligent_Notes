## 2024-07-03 - [SSRF vulnerability in fetching user-specified models]
**Vulnerability:** Application passes unvalidated base URLs to the generic Node `fetch` API, allowing arbitrary internal endpoint access via SSRF.
**Learning:** `fetch` automatically handles redirects, meaning an attacker could provide an external URL that redirects to internal endpoints (like 169.254.169.254 or localhost). Using an `undici` agent with a custom DNS lookup helps, but we also must explicitly validate explicit IPs if `undici` bypasses lookup.
**Prevention:** Always validate custom baseUrls using a custom Undici Agent + DNS lookup function, checking the resolved IPs. Also check if the hostname is a direct IP. Disable following redirects to avoid TOCTOU/redirect issues. Use centralized validation utils.
