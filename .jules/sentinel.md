## 2024-06-08 - SSRF Vulnerability in AI Orchestrator
**Vulnerability:** The `req.baseUrl` parameter in `fetchOpenAICompatible` allowed arbitrary URLs, posing an SSRF risk where attackers could reach local loopback addresses or cloud metadata endpoints.
**Learning:** External user inputs mapping directly to internal URLs without validation can bypass intended network boundaries, allowing malicious requests to internal resources.
**Prevention:** Implement strict URL validation (`validateBaseUrl`) enforcing allowed protocols (HTTP/HTTPS) and blocking loopback/metadata hostnames before making outbound requests.
