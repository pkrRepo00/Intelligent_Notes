## 2025-06-30 - SSRF Vulnerability in AI Gateway
**Vulnerability:** Server-Side Request Forgery (SSRF) allowed attackers to specify malicious internal URLs (e.g., cloud metadata endpoints `169.254.169.254`) via the custom `baseUrl` parameter when routing LLM requests.
**Learning:** Native `fetch` lacks robust DNS rebinding and IP validation hooks. Relying on simple URL string parsing is vulnerable to TOCTOU DNS rebinding, and `fetch` automatically follows redirects, bypassing initial checks.
**Prevention:** Use a custom DNS `Agent` (via `undici`) to enforce IP validation during the actual connection phase. Explicitly disable automatic redirects (`redirect: 'manual'`) and validate direct IP inputs before DNS resolution to comprehensively mitigate SSRF.
