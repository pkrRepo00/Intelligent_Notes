import { Agent } from "undici";
import * as dns from "dns";
import * as net from "net";
import { URL } from "url";

export function isInternalIP(ip: string, allowLocal: boolean = false): boolean {
  // Always block cloud metadata endpoints (e.g. AWS, GCP)
  if (ip.startsWith("169.254.")) return true;
  // Always block 0.0.0.0 mapping
  if (ip === "0.0.0.0" || ip === "::") return true;

  if (!allowLocal) {
    // Check IPv4 loopback
    if (ip.startsWith("127.")) return true;
    // Check IPv6 loopback
    if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return true;
    // Additional private network blocks
    if (ip.startsWith("10.")) return true;
    if (ip.startsWith("192.168.")) return true;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
  }

  return false;
}

export function createSafeAgent(allowLocal: boolean = false) {
  return new Agent({
    connect: {
      lookup: (hostname, options, callback) => {
        dns.lookup(hostname, { all: true, ...options }, (err, addresses) => {
          if (err) return callback(err, []);
          for (const addr of addresses) {
            if (typeof addr === 'string') {
               if (isInternalIP(addr, allowLocal)) {
                  return callback(new Error('SSRF blocked: internal IP resolved'), []);
               }
            } else if (addr && typeof addr === 'object' && addr.address) {
               if (isInternalIP(addr.address, allowLocal)) {
                  return callback(new Error('SSRF blocked: internal IP resolved'), []);
               }
            }
          }
          callback(null, addresses as any);
        });
      }
    }
  });
}

export const safeAgent = createSafeAgent(false);
export const localSafeAgent = createSafeAgent(true);

export function validateSafeUrl(urlString: string, allowLocal: boolean = false): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    // Check if the hostname itself is directly an IP that should be blocked
    if (net.isIP(parsed.hostname) && isInternalIP(parsed.hostname, allowLocal)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
