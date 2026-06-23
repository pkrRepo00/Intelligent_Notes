import { describe, it, expect } from 'vitest';
import { validateSafeUrl } from './security';

describe('validateSafeUrl', () => {
  it('allows safe http and https urls', () => {
    expect(() => validateSafeUrl('http://example.com')).not.toThrow();
    expect(() => validateSafeUrl('https://example.com')).not.toThrow();
    expect(() => validateSafeUrl('http://127.0.0.1:11434')).not.toThrow();
    expect(() => validateSafeUrl('http://localhost:3000')).not.toThrow();
  });

  it('blocks invalid protocols', () => {
    expect(() => validateSafeUrl('file:///etc/passwd')).toThrow(/Invalid or blocked URL: Invalid protocol: file:/);
    expect(() => validateSafeUrl('ftp://example.com')).toThrow(/Invalid or blocked URL: Invalid protocol: ftp:/);
    expect(() => validateSafeUrl('gopher://example.com')).toThrow(/Invalid or blocked URL: Invalid protocol: gopher:/);
  });

  it('blocks internal metadata endpoints', () => {
    expect(() => validateSafeUrl('http://169.254.169.254/latest/meta-data/')).toThrow(/Invalid or blocked URL: Blocked URL hostname: 169.254.169.254/);
    expect(() => validateSafeUrl('http://metadata.google.internal/computeMetadata/v1/')).toThrow(/Invalid or blocked URL: Blocked URL hostname: metadata.google.internal/);
    expect(() => validateSafeUrl('http://100.100.100.200/')).toThrow(/Invalid or blocked URL: Blocked URL hostname: 100.100.100.200/);
  });

  it('handles invalid url strings', () => {
     expect(() => validateSafeUrl('not a url')).toThrow();
  });
});
