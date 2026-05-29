## 2024-05-29 - Critical SSRF Credential Leak in AI Gateway
**Vulnerability:** The `/api/test-provider` and AI pipeline routes leaked the server's `process.env.GEMINI_API_KEY` to any arbitrary URL. If a user provided a custom `baseUrl` and left the `apiKey` field blank (or as 'dummy'), the server would attach the highly sensitive Gemini API key as the `Authorization` header to the outbound request to the user-controlled `baseUrl`.
**Learning:** Hardcoding fallbacks (`apiKey || process.env.GEMINI_API_KEY`) without verifying the destination `providerId` allows users to exfiltrate secrets via Server-Side Request Forgery (SSRF).
**Prevention:** Only inject server secrets when the `providerId` is explicitly verified as the trusted provider (e.g., `providerId === 'gemini'`).
