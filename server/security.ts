import { fetch as uFetch, Agent, RequestInit, Response as UndiciResponse } from 'undici';
import * as dns from 'dns';
import * as net from 'net';

// Check if IP is internal/private for SSRF prevention
const check = (ip: string) => ip === '127.0.0.1' || ip === '::1' || ip.startsWith('127.') || ip.startsWith('169.254.') || ip.startsWith('10.') || ip.startsWith('192.168.') || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip);

// Custom agent with DNS lookup override to prevent TOCTOU SSRF
const createAgent = (allowLocal: boolean) => new Agent({
  connect: {
    lookup: (host, opts, cb) => {
      dns.lookup(host, { all: true, ...opts }, (err, addrs) => {
        if (err) return cb(err, '');
        const addrArray = Array.isArray(addrs) ? addrs : [addrs];
        for (const a of addrArray) {
          const ip = typeof a === 'string' ? a : a.address;
          if (ip.startsWith('169.254.') || (!allowLocal && check(ip))) {
              return cb(new Error('SSRF Blocked'), '');
          }
        }

        // Match the callback signature based on opts.all
        if (opts.all) {
            cb(null, addrs as any);
        } else {
            const first = addrArray[0];
            const address = typeof first === 'string' ? first : first.address;
            const family = typeof first === 'string' ? 4 : first.family;
            cb(null, address as any, family as any);
        }
      });
    }
  }
});

const safe = createAgent(false), local = createAgent(true);

export interface SafeFetchOptions extends RequestInit {
  allowLocal?: boolean;
}

export async function safeFetch(url: string | URL, opts?: SafeFetchOptions): Promise<Response> {
  const u = typeof url === 'string' ? new URL(url) : url;
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Bad proto');
  if (net.isIP(u.hostname) && (u.hostname.startsWith('169.254.') || (!opts?.allowLocal && check(u.hostname)))) throw new Error('SSRF Blocked');

  const res = await uFetch(url, { ...opts, dispatcher: opts?.allowLocal ? local : safe, redirect: 'manual' } as any);

  return res as unknown as Response;
}
