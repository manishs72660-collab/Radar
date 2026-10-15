const dns = require('dns');
const net = require('net');

const ALLOW_PRIVATE = process.env.ALLOW_PRIVATE_TARGETS === 'true';

// Ye saare address internet ke nahi hain, inpe check bhejna allowed nahi
const blocked = new net.BlockList();
[
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
].forEach(([addr, prefix]) => blocked.addSubnet(addr, prefix, 'ipv4'));

[
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
].forEach(([addr, prefix]) => blocked.addSubnet(addr, prefix, 'ipv6'));

function blockedError(message = 'Blocked: private or internal address') {
  const err = new Error(message);
  err.code = 'ESSRF';
  return err;
}

function isPrivateIp(ip) {
  let address = String(ip).replace(/^\[|\]$/g, '');
  address = address.split('%')[0]; // IPv6 zone hatao

  // ::ffff:127.0.0.1 jaisa IPv4 jo IPv6 mein chhupa ho
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) address = mapped[1];

  const family = net.isIPv4(address) ? 'ipv4' : net.isIPv6(address) ? 'ipv6' : null;
  if (!family) return true; // samajh na aaye to safe side pe block
  return blocked.check(address, family);
}

function isBlockedHostname(hostname) {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  return h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal');
}

// Hostname seedha IP ho ya blocked naam ho to turant pakdo (dns lookup ki zaroorat nahi)
function assertHostnameAllowed(hostname) {
  if (ALLOW_PRIVATE) return;
  const bare = hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(bare)) {
    if (isPrivateIp(bare)) throw blockedError();
    return;
  }
  if (isBlockedHostname(bare)) throw blockedError();
}

// http.request ke `lookup` option ke liye: DNS ka jawab check hota hai, phir hi connect hota hai
function safeLookup(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);

    if (!ALLOW_PRIVATE && addresses.some((a) => isPrivateIp(a.address))) {
      return callback(blockedError());
    }

    if (options && options.all) return callback(null, addresses);
    return callback(null, addresses[0].address, addresses[0].family);
  });
}

// Monitor banate waqt: URL theek hai aur public hai ya nahi
async function validateTargetUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, message: 'Enter a valid http/https URL' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, message: 'Enter a valid http/https URL' };
  }
  if (url.username || url.password) {
    return { ok: false, message: 'URLs with a username or password are not allowed' };
  }

  try {
    assertHostnameAllowed(url.hostname);
  } catch {
    return { ok: false, message: 'This address points to a private or internal network and cannot be monitored' };
  }

  if (ALLOW_PRIVATE || net.isIP(url.hostname.replace(/^\[|\]$/g, ''))) return { ok: true };

  // Domain ka IP dekho (resolve na ho to bhi monitor banne do, site abhi down ho sakti hai)
  try {
    const addresses = await dns.promises.lookup(url.hostname, { all: true });
    if (addresses.some((a) => isPrivateIp(a.address))) {
      return { ok: false, message: 'This address points to a private or internal network and cannot be monitored' };
    }
  } catch {
    // DNS fail: allowed, check ke waqt DOWN dikhega
  }

  return { ok: true };
}

module.exports = { isPrivateIp, assertHostnameAllowed, safeLookup, validateTargetUrl };