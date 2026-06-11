
## 2024-06-11 - AI Gateway SSRF Vulnerability
**Vulnerability:** Server-Side Request Forgery (SSRF) risk found in AI Gateway (`/api/pull-model`, `fetchOpenAICompatible`, `fetchProviderModels`) where `baseUrl` and `ollamaUrl` parameters were unvalidated.
**Learning:** In AI Gateways acting as reverse proxies/orchestrators, allowing user-defined `baseUrl` objects allows attackers to send local or internal server requests, accessing metadata APIs (e.g. `169.254.169.254`) or scanning local ports.
**Prevention:** Always validate and sanitize dynamically constructed URLs that the server fetches. Specifically, restrict the `baseUrl` to valid HTTP(S), explicitly deny metadata IPs, and tightly scope loopback accesses (e.g. `localhost` / `127.0.0.1` / `[::1]`) to expected ports only.
