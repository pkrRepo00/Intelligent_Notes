## 2025-02-28 - SSRF in Custom Provider URL
**Vulnerability:** Found a Server-Side Request Forgery (SSRF) vulnerability in the AI gateway where `req.baseUrl` for custom providers was passed directly to the `fetch` API without validation.
**Learning:** This allowed an attacker to supply internal loopback addresses (like `http://127.0.0.1`) or cloud metadata endpoints (`http://169.254.169.254`), exposing internal networks to arbitrary requests originating from the orchestrator.
**Prevention:** Always parse and validate custom URLs by explicitly checking protocols (allow only `http` and `https`), blocking known sensitive IPs/hostnames, and strictly restricting loopback/localhost access to only specifically allowed ports (e.g., `11434` for Ollama).
