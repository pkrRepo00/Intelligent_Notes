import { test, expect } from 'vitest';
import { isInternalIP, validateSafeUrl } from './security';

test('isInternalIP correctly identifies private IPs', () => {
  expect(isInternalIP('169.254.169.254')).toBe(true);
  expect(isInternalIP('10.0.0.1')).toBe(true);
  expect(isInternalIP('192.168.1.1')).toBe(true);
  expect(isInternalIP('172.16.0.1')).toBe(true);
  expect(isInternalIP('172.31.255.255')).toBe(true);
  expect(isInternalIP('127.0.0.1')).toBe(true);
  expect(isInternalIP('::1')).toBe(true);
  expect(isInternalIP('fc00::')).toBe(true);

  expect(isInternalIP('8.8.8.8')).toBe(false);
  expect(isInternalIP('1.1.1.1')).toBe(false);
  expect(isInternalIP('172.15.0.1')).toBe(false);
  expect(isInternalIP('172.32.0.1')).toBe(false);
});

test('validateSafeUrl throws on invalid protocol or internal IP', () => {
  expect(() => validateSafeUrl('ftp://example.com')).toThrow();
  expect(() => validateSafeUrl('http://169.254.169.254')).toThrow(/SSRF attempt blocked/);
  expect(() => validateSafeUrl('https://10.0.0.5')).toThrow(/SSRF attempt blocked/);
  expect(() => validateSafeUrl('http://127.0.0.1')).toThrow(/SSRF attempt blocked/);
  expect(() => validateSafeUrl('http://[::1]')).toThrow(/SSRF attempt blocked/);
  expect(() => validateSafeUrl('http://8.8.8.8')).not.toThrow();
  expect(() => validateSafeUrl('https://api.openai.com')).not.toThrow();
});
