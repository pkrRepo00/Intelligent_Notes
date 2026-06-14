import { describe, it, expect, vi } from 'vitest';
import { validateSafeUrl } from './security';
import dns from 'node:dns';

vi.mock('node:dns', () => {
  return {
    default: {
      lookup: vi.fn((hostname, callback) => {
        if (hostname === '169.254.169.254') {
          callback(null, '169.254.169.254', 4);
        } else if (hostname === 'localhost') {
          callback(null, '127.0.0.1', 4);
        } else if (hostname === 'example.com') {
          callback(null, '93.184.216.34', 4);
        } else {
          // If it's an IP string, just return it
          callback(null, hostname, 4);
        }
      })
    }
  };
});

describe('validateSafeUrl', () => {
  it('should allow valid http/https urls', async () => {
    // using mock resolved IP
    const url = await validateSafeUrl('https://example.com');
    expect(url).toBe('https://example.com');
  });

  it('should allow localhost', async () => {
    const url = await validateSafeUrl('http://localhost:11434');
    expect(url).toBe('http://localhost:11434');
  });

  it('should block file:// protocol', async () => {
    await expect(validateSafeUrl('file:///etc/passwd')).rejects.toThrow('Invalid URL protocol. Only HTTP and HTTPS are allowed.');
  });

  it('should block cloud metadata ip', async () => {
    await expect(validateSafeUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow('Access to internal metadata endpoints is forbidden.');
  });
});
