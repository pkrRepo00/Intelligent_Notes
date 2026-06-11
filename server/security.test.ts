import { describe, it, expect } from 'vitest';
import { validateSafeUrl } from './security';

describe('validateSafeUrl', () => {
  it('allows normal https URLs', () => {
    expect(() => validateSafeUrl('https://api.openai.com/v1')).not.toThrow();
  });

  it('allows normal http URLs', () => {
    expect(() => validateSafeUrl('http://api.example.com/v1')).not.toThrow();
  });

  it('throws on invalid URL format', () => {
    expect(() => validateSafeUrl('not a url')).toThrow('Invalid URL format');
  });

  it('throws on non-http/https protocols', () => {
    expect(() => validateSafeUrl('file:///etc/passwd')).toThrow('URL must use HTTP or HTTPS protocol');
    expect(() => validateSafeUrl('gopher://example.com')).toThrow('URL must use HTTP or HTTPS protocol');
  });

  it('blocks AWS/GCP/Azure metadata endpoints', () => {
    expect(() => validateSafeUrl('http://169.254.169.254/latest/meta-data/')).toThrow('Access to internal metadata endpoints is forbidden');
    expect(() => validateSafeUrl('http://metadata.google.internal/computeMetadata/v1/')).toThrow('Access to internal metadata endpoints is forbidden');
  });

  it('blocks loopback addresses on ports other than 11434', () => {
    expect(() => validateSafeUrl('http://localhost:8080')).toThrow('Loopback addresses are only permitted for port 11434 (Ollama)');
    expect(() => validateSafeUrl('http://127.0.0.1:3000')).toThrow('Loopback addresses are only permitted for port 11434 (Ollama)');
    expect(() => validateSafeUrl('http://[::1]:9090')).toThrow('Loopback addresses are only permitted for port 11434 (Ollama)');
  });

  it('allows loopback addresses on port 11434 (Ollama)', () => {
    expect(() => validateSafeUrl('http://localhost:11434')).not.toThrow();
    expect(() => validateSafeUrl('http://127.0.0.1:11434')).not.toThrow();
    expect(() => validateSafeUrl('http://[::1]:11434')).not.toThrow();
  });

  it('allows undefined or empty string', () => {
    expect(() => validateSafeUrl(undefined)).not.toThrow();
    expect(() => validateSafeUrl('')).not.toThrow();
  });
});
