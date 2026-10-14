export function timeAgo(date) {
  if (!date) return 'never';
  const s = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function formatDuration(seconds) {
  if (seconds == null) return 'ongoing';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ${seconds % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export function formatMs(ms) {
  if (ms == null) return '-';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms}ms`;
}

export function formatPct(p) {
  return p == null ? '-' : `${p}%`;
}

export function formatDateTime(date) {
  return new Date(date).toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

// Same id hamesha same angle deta hai, taaki radar pe blip jagah na badle
export function hashToUnit(str, salt = 0) {
  let h = 2166136261 + salt;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}
