
## 2025-03-04 - SSRF via AI Provider Custom Base URLs
**Vulnerability:** The AI Gateway proxy accepted user-supplied `baseUrl`s for custom and local models without validation, making it vulnerable to Server-Side Request Forgery (SSRF). Attackers could exploit this by providing malicious URLs (e.g., `http://169.254.169.254/` or `file:///etc/passwd`) to access sensitive internal network resources or cloud metadata.
**Learning:** External API dependencies and proxy features inherently trust user input, creating bypass vectors. Any system performing server-side fetch requests based on user data needs strict validation.
**Prevention:** Created a standard `validateSafeUrl` utility to parse incoming proxy URLs, enforce `http:`/`https:` protocols, and actively block known metadata or internal loopback IP addresses before the request is initiated.
