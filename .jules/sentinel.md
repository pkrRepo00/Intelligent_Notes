## 2024-06-24 - SSRF in AI Gateway
**Vulnerability:** Unrestricted server-side request forgery (SSRF) allowing requests to arbitrary endpoints via user-controlled `baseUrl`.
**Learning:** `fetch` requests inside dynamic provider integrations naturally assume user input is well-formed, allowing requests to metadata endpoints (`169.254.169.254`). Moreover, missing `redirect: "error"` means SSRF blocks could be bypassed via redirects.
**Prevention:** Always validate `fetch` URLs with a utility that explicitly blocks known internal endpoints while retaining loopback functionality for local integrations, and enforce `redirect: "error"`.
