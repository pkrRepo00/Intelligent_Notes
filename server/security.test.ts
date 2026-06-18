import { describe, it, expect } from 'vitest';
import { validateSafeUrl } from './security';

describe('validateSafeUrl SSRF Mitigation', () => {
  it('should allow normal external domains', async () => {
    const url = 'https://google.com';
    const result = await validateSafeUrl(url);
    expect(result).toBe(url);
  });

  it('should allow loopback address 127.0.0.1 for local tools', async () => {
    const url = 'http://127.0.0.1:11434';
    const result = await validateSafeUrl(url);
    expect(result).toBe(url);
  });

  it('should allow loopback hostname localhost', async () => {
    const url = 'http://localhost:8080/api';
    const result = await validateSafeUrl(url);
    expect(result).toBe(url);
  });

  it('should block link-local IP (e.g. AWS metadata 169.254.169.254)', async () => {
    const url = 'http://169.254.169.254/latest/meta-data/';
    await expect(validateSafeUrl(url)).rejects.toThrow('Access to linkLocal IP range is forbidden.');
  });

  it('should block private network IP (e.g. 192.168.1.1)', async () => {
    const url = 'http://192.168.1.1/admin';
    await expect(validateSafeUrl(url)).rejects.toThrow('Access to private IP range is forbidden.');
  });

  it('should block private network IP (e.g. 10.0.0.1)', async () => {
    const url = 'http://10.0.0.1';
    await expect(validateSafeUrl(url)).rejects.toThrow('Access to private IP range is forbidden.');
  });

  it('should block private network IP (e.g. 172.16.0.1)', async () => {
    const url = 'http://172.16.0.1';
    await expect(validateSafeUrl(url)).rejects.toThrow('Access to private IP range is forbidden.');
  });

  it('should throw on invalid URL', async () => {
    await expect(validateSafeUrl('not-a-url')).rejects.toThrow('Invalid URL provided');
  });

  it('should block non-HTTP/HTTPS protocols', async () => {
    await expect(validateSafeUrl('ftp://example.com')).rejects.toThrow('Invalid protocol. Only HTTP and HTTPS are allowed.');
    await expect(validateSafeUrl('file:///etc/passwd')).rejects.toThrow('Invalid protocol. Only HTTP and HTTPS are allowed.');
  });
});
