const http = require('http');
const https = require('https');
const { assertHostnameAllowed, safeLookup } = require('../security/ssrf');

const TIMEOUT_MS = 30000;
const MAX_REDIRECTS = 5;

// Ek request bhejo aur har step ka time note karo
function requestOnce(urlString, method) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);

    try {
      assertHostnameAllowed(url.hostname); // IP ya localhost jaisa naam ho to yahin ruk jao
    } catch (err) {
      return reject(err);
    }

    const lib = url.protocol === 'https:' ? https : http;

    const start = process.hrtime.bigint();
    const now = () => Number(process.hrtime.bigint() - start) / 1e6; // ms
    const marks = {};

    const req = lib.request(
      url,
      {
        method,
        agent: false, // har baar nayi connection, taaki DNS/TCP/TLS sab measure ho
        lookup: safeLookup, // DNS ka jawab private nikle to connect hi nahi hota
        headers: { 'User-Agent': 'RadarBot/1.0', Accept: '*/*' },
      },
      (res) => {
        marks.firstByte = now();
        res.on('data', () => {}); // body padh ke phenk do
        res.on('end', () => {
          marks.end = now();
          resolve({ statusCode: res.statusCode, headers: res.headers, marks });
        });
        res.on('error', reject);
      }
    );

    req.on('socket', (socket) => {
      socket.on('lookup', () => (marks.lookup = now()));
      socket.on('connect', () => (marks.connect = now()));
      socket.on('secureConnect', () => (marks.secure = now()));
    });

    req.setTimeout(TIMEOUT_MS, () => {
      const err = new Error('Timeout');
      err.code = 'ETIMEDOUT';
      req.destroy(err);
    });

    req.on('error', reject);
    req.end();
  });
}

function buildTimings(m) {
  const lookupAt = m.lookup ?? 0;
  const connectAt = m.connect ?? lookupAt;
  const readyAt = m.secure ?? connectAt; // HTTPS mein TLS ke baad, HTTP mein connect ke baad

  return {
    dns: Math.round(lookupAt),
    tcp: Math.round(connectAt - lookupAt),
    tls: Math.round(m.secure ? m.secure - connectAt : 0),
    ttfb: Math.round((m.firstByte ?? readyAt) - readyAt),
    download: Math.round((m.end ?? m.firstByte ?? readyAt) - (m.firstByte ?? readyAt)),
  };
}

function describeError(err) {
  const code = err.code;
  if (code === 'ESSRF') return 'Blocked: private or internal address';
  if (code === 'ETIMEDOUT') return 'Timeout (30s)';
  if (code === 'ENOTFOUND') return 'DNS error: domain not found';
  if (code === 'ECONNREFUSED') return 'Connection refused';
  if (code === 'ECONNRESET') return 'Connection reset by server';
  if (code && (code.startsWith('CERT_') || code.includes('SELF_SIGNED') || code.includes('CERTIFICATE'))) {
    return `SSL error: ${code}`;
  }
  return err.message || 'Unknown error';
}

async function runCheck(monitor) {
  const startedAt = Date.now();
  const method = monitor.method || 'GET';
  let current = monitor.url;

  try {
    let response;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      response = await requestOnce(current, method);
      const location = response.headers.location;
      const isRedirect = response.statusCode >= 300 && response.statusCode < 400;
      if (isRedirect && location && hop < MAX_REDIRECTS) {
        current = new URL(location, current).toString(); // har redirect pe upar wali jaanch dobara chalti hai
        continue;
      }
      break;
    }

    const responseTime = Date.now() - startedAt;
    const isUp = response.statusCode === monitor.expectedStatus;

    return {
      status: isUp ? 'UP' : 'DOWN',
      statusCode: response.statusCode,
      responseTime,
      timings: buildTimings(response.marks), // aakhri server ka breakdown
      error: isUp ? null : `Expected ${monitor.expectedStatus}, got ${response.statusCode}`,
    };
  } catch (err) {
    return {
      status: 'DOWN',
      statusCode: null,
      responseTime: Date.now() - startedAt,
      timings: null,
      error: describeError(err),
    };
  }
}

module.exports = { runCheck };