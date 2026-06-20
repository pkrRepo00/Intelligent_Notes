## 2024-10-27 - SSRF Vulnerability in AI Gateway
**Vulnerability:** Server-Side Request Forgery (SSRF) allowing unauthenticated attackers to fetch internal resources or cloud metadata via the `baseUrl` configuration in AI provider requests.
**Learning:** `fetch` requests automatically follow 302 HTTP redirects (up to 20). If `baseUrl` input validation only checks the initial URL, an attacker can provide an external domain they control which redirects to `http://169.254.169.254`. This bypasses the initial check and exploits the SSRF.
**Prevention:**
1. Use a URL parser (like `new URL()`) to validate that the protocol is only HTTP/HTTPS and that the hostname explicitly blocks cloud metadata IPs (`169.254.169.254`).
2. Always apply `redirect: 'error'` or `redirect: 'manual'` in Node.js/fetch requests to prevent attackers from bypassing validation using HTTP 302 redirects.
3. Apply validations universally on all user-supplied URLs (e.g. `baseUrl` overrides).
