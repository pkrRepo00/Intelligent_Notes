## SSRF Vulnerability Fix Plan

1. **Create `server/security.ts`**:
   - Centralize security utilities like `isInternalIP`, `safeAgent` (using `undici` to block SSRF via DNS rebinding), and `validateSafeUrl`.

2. **Patch `server/orchestrator.ts`**:
   - Import `validateSafeUrl` and `safeAgent` from `security.ts`.
   - Import `fetch` from `undici`.
   - Add URL validation for `req.baseUrl` where applicable.
   - Use `dispatcher: safeAgent` and `redirect: 'manual'` in custom API `fetch` requests (OpenAI-compatible and Anthropic adapters) to prevent SSRF vulnerabilities and unauthorized access to local/internal network resources.

3. **Patch `server/modelsFetcher.ts`**:
   - Use `fetch` from `undici` and `safeAgent`.
   - Validate URLs using `validateSafeUrl`.

4. **Patch `server.ts`**:
   - Use `fetch` from `undici` and `safeAgent` for the `pull-model` proxy endpoint.
   - Validate `baseUrl` inputs with `validateSafeUrl`.

5. **Fix Package Dependencies**:
   - Add `undici` as a dependency.
   - `pnpm add undici` has already been run.

6. **Pre Commit Steps**:
   - Ensure proper testing, verification, review, and reflection are done.

7. **Submit Changes**:
   - Commit and push changes.
