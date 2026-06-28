import { Agent } from "undici";
import * as dns from "dns";
import * as ipaddr from "ipaddr.js";

const isSSRFBlockedIP = (ipString: string): boolean => {
  try {
    const ip = ipaddr.parse(ipString);
    if (ip.kind() === "ipv4") {
      const range = ip.range();
      if (range === "loopback") return false; // Allow loopback for Ollama
      return range === "private" || range === "carrierGradeNat" || range === "linkLocal" || range === "unspecified";
    } else if (ip.kind() === "ipv6") {
      const range = ip.range();
      if (range === "loopback") return false;
      return range === "uniqueLocal" || range === "linkLocal" || range === "ipv4Mapped" || range === "unspecified";
    }
  } catch (e) {
    // If it can't be parsed, fail closed
    return true;
  }
  return false;
};

// Custom undici Agent that validates resolved IPs before connecting
export const ssrfSafeAgent = new Agent({
  connect: {
    lookup: (hostname, options, callback) => {
      dns.lookup(hostname, options, (err, addresses, family) => {
        if (err) return callback(err, addresses as any, family);

        const addrList = Array.isArray(addresses) ? addresses : [{ address: addresses as string, family }];

        for (const addr of addrList) {
          if (typeof addr.address === 'string' && isSSRFBlockedIP(addr.address)) {
            return callback(new Error(`SSRF Blocked: Resolving to internal/metadata IP (${addr.address}) is not allowed.`), addresses as any, family);
          }
        }
        callback(null, addresses as any, family);
      });
    }
  }
});
