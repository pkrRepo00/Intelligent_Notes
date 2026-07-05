## Fix SSRF Bug Blocking Ollama

1. **Update `server/security.ts`**:
   - `validateSafeUrl` and `isInternalIP` are currently blocking the legitimate Ollama integration running on `127.0.0.1`.
   - Modify `isInternalIP` or add an `allowlist` parameter/function to allow `127.0.0.1` when it's expected (e.g. for Ollama).
   - Alternatively, only enforce `safeAgent` and `validateSafeUrl` for non-local providers or user-supplied generic URLs.
   - Wait, `validateSafeUrl` blocks `127.0.0.1`.
   - Let's look at `server/orchestrator.ts`. The user specifies the `baseUrl` for their own providers. We shouldn't block local testing if the provider is `ollama` or local type. The system relies on users giving local URLs for local endpoints.

Let's rethink: SSRF is specifically dangerous when the server fetches arbitrary attacker-controlled URLs, potentially accessing internal AWS metadata or unintended local services. If a user sets up a "Custom" provider, they could enter `http://169.254.169.254`.
So we DO want to block AWS metadata. Do we want to block `localhost` or `127.0.0.1`?
Wait! In `server.ts` and `AIGateway.tsx`, `ollama` uses `http://127.0.0.1:11434`.
Let's add an exception for localhost/127.0.0.1 on port 11434, or perhaps only block 169.254.169.254 and maybe 10.x/172.x/192.x, but ALLOW `127.0.0.1`?
Wait, if we allow `127.0.0.1`, could an attacker access other local services?
Maybe we can check `providerId`. If `providerId === 'ollama'`, or if the user intends to use a local provider, they might need to access local ports. But this is a gateway.
What if we pass an option `allowLocalhost?: boolean` to `validateSafeUrl` and `safeAgent`?

Let's define a factory: `createSafeAgent(allowLocalhost = false)`
And `validateSafeUrl(urlString: string, allowLocalhost = false)`

If `allowLocalhost` is true, we skip blocking `127.0.0.1` and `::1`. We still block `169.254.x.x` (AWS metadata is never legitimate for AI providers) and perhaps other private IPs? Wait, a user might run Ollama on another machine on their LAN (e.g. `192.168.1.50`). So maybe we shouldn't block private LAN IPs either for AI gateways, unless we have to.

Let's read `AIGateway.tsx` to understand the use cases.
