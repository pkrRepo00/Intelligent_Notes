## 2024-06-14 - Prevent SSRF with Metadata Endpoints Validation
**Vulnerability:** Application allows fetching custom AI provider endpoints without internal metadata checks. An attacker could potentially supply a `baseUrl` such as `http://169.254.169.254/latest/meta-data/` to perform SSRF and retrieve sensitive cloud instance metadata.
**Learning:** `baseUrl` values used in AI provider requests must always be safely validated through DNS resolution before executing HTTP requests. It's not enough to only validate the URL string format since DNS rebinding could bypass text-only checks.
**Prevention:** Ensured the existence of `validateSafeUrl` utility and utilized it strictly before sending requests to external custom URLs, specifically intercepting endpoints resolving to `169.254.*.*`.
