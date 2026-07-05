## Fix SSRF Bug Blocking Ollama

1. **Update `server/security.ts`**:
   - Add `allowLocal` parameter to `isInternalIP` and `validateSafeUrl`.
   - Add `createSafeAgent(allowLocal: boolean = false)` which returns an undici Agent.
   - Export `safeAgent = createSafeAgent(false)` and `localSafeAgent = createSafeAgent(true)`.

2. **Patch `server/orchestrator.ts`**:
   - Import `localSafeAgent`.
   - `const allowLocal = req.providerId === 'ollama' || req.providerId === 'custom' || req.providerId === 'local';`
   - Use `validateSafeUrl(req.baseUrl, allowLocal)`
   - Use `dispatcher: allowLocal ? localSafeAgent : safeAgent`

3. **Patch `server/modelsFetcher.ts`**:
   - Import `localSafeAgent`.
   - Check `allowLocal` via `providerId` (like `'ollama'`).
   - For `ollama`, use `localSafeAgent` and `validateSafeUrl(baseUrl, true)`.
   - For OpenAI-compatible, use `allowLocal = providerId === 'custom'` or similar, maybe just `providerId === 'custom'`? Let's just pass `allowLocal = providerId === 'ollama' || providerId === 'custom';`

4. **Patch `server.ts`**:
   - `/api/pull-model` is implicitly local because it defaults to `127.0.0.1`.
   - Use `localSafeAgent` and `validateSafeUrl(baseUrl, true)` for Ollama pull endpoint.

5. **Re-Test**:
   - Ensure the build passes and tests pass.
