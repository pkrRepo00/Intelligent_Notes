## 2024-05-30 - Fix SSRF API Key Leakage
**Vulnerability:** Server-Side Request Forgery (SSRF) allowed attackers to leak the server's private `GEMINI_API_KEY`. If a user sent a request to the API with a custom, attacker-controlled `baseUrl` and no `apiKey`, the backend would fallback to injecting the environment's `process.env.GEMINI_API_KEY` into the request and sending it to the attacker's server.
**Learning:** Fallback mechanisms that inject sensitive secrets must be strictly context-aware. They should never be applied when the destination of the outgoing request is user-controlled.
**Prevention:** Only inject backend API keys if the `baseUrl` corresponds to a trusted, known-good provider endpoint. If `baseUrl` is dynamically user-supplied, never append server credentials.
