import { describe, it, expect } from 'vitest';
import { validateBaseUrl } from './orchestrator';

describe('validateBaseUrl', () => {
  it('should allow valid http and https URLs', () => {
    expect(() => validateBaseUrl('http://example.com/api/v1/chat/completions')).not.toThrow();
    expect(() => validateBaseUrl('https://api.openai.com/v1/chat/completions')).not.toThrow();
  });

  it('should block invalid URL formats', () => {
    expect(() => validateBaseUrl('not-a-url')).toThrow('Invalid URL format');
  });

  it('should block non-http/https protocols', () => {
    expect(() => validateBaseUrl('ftp://example.com')).toThrow('Invalid protocol. Only HTTP and HTTPS are allowed.');
    expect(() => validateBaseUrl('file:///etc/passwd')).toThrow('Invalid protocol. Only HTTP and HTTPS are allowed.');
    expect(() => validateBaseUrl('gopher://example.com')).toThrow('Invalid protocol. Only HTTP and HTTPS are allowed.');
  });

  it('should block localhost and IPv4 loopback addresses', () => {
    expect(() => validateBaseUrl('http://localhost:8080')).toThrow('Local loopback addresses are not allowed.');
    expect(() => validateBaseUrl('https://127.0.0.1')).toThrow('Local loopback addresses are not allowed.');
    expect(() => validateBaseUrl('http://127.123.45.67:3000')).toThrow('Local loopback addresses are not allowed.');
  });

  it('should block IPv6 loopback addresses', () => {
    expect(() => validateBaseUrl('http://[::1]:8080')).toThrow('Local loopback addresses are not allowed.');
  });

  it('should block AWS/Cloud metadata endpoints', () => {
    expect(() => validateBaseUrl('http://169.254.169.254/latest/meta-data/')).toThrow('Metadata endpoints are not allowed.');
    expect(() => validateBaseUrl('http://169.254.0.1')).toThrow('Metadata endpoints are not allowed.');
  });
});
