
## 2024-07-05 - [SSRF with Ollama Integration]
**Vulnerability:** Blocking localhost to prevent SSRF broke local integrations like Ollama.
**Learning:** SSRF mitigation needs to account for legitimate local integration requirements while still blocking high-risk cloud endpoints.
**Prevention:** Implement `allowLocal` parameter in SSRF validation to gracefully allow `127.0.0.1` for local workflows while strictly preventing access to `169.254.x.x` (AWS/GCP metadata) and `0.0.0.0`.
