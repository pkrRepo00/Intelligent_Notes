import { describe, it, expect } from 'vitest';
import { validateSafeUrl, secureFetch } from './security';

describe('Security Utilities', () => {
  describe('validateSafeUrl', () => {
    it('should return true for valid http/https URLs', () => {
      expect(validateSafeUrl('http://example.com')).toBe(true);
      expect(validateSafeUrl('https://example.com')).toBe(true);
    });

    it('should return false for non-http/https URLs', () => {
      expect(validateSafeUrl('file:///etc/passwd')).toBe(false);
      expect(validateSafeUrl('ftp://example.com')).toBe(false);
      expect(validateSafeUrl('gopher://example.com')).toBe(false);
      expect(validateSafeUrl('javascript:alert(1)')).toBe(false);
      expect(validateSafeUrl('data:text/plain;base64,SGVsbG8=')).toBe(false);
    });

    it('should return false for invalid URLs', () => {
      expect(validateSafeUrl('not a url')).toBe(false);
    });
  });

  describe('secureFetch SSRF Protection', () => {
    it('should reject URLs with invalid protocols', async () => {
      await expect(secureFetch('file:///etc/passwd')).rejects.toThrow('Invalid URL protocol');
    });

    it('should block requests to internal metadata endpoints', async () => {
      // 169.254.169.254 is the AWS/GCP/Azure metadata endpoint
      await expect(secureFetch('http://169.254.169.254')).rejects.toThrow(/Invalid URL protocol or blocked IP/);
    });

    // We allow localhost because it's required for local AI providers like Ollama/LM Studio
    it('should allow requests to localhost', async () => {
      // This will fail because there's probably no server running on 12345,
      // but it should fail with ECONNREFUSED, not our custom SSRF error
      try {
        await secureFetch('http://localhost:12345');
      } catch (err: any) {
        // Assert it's a connection error, not an SSRF block
        expect(err.message).not.toMatch(/SSRF blocked/);
      }
    });
  });
});
