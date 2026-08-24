export function shortAddr(addr) {
  if (!addr) return '—';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

export function parseError(e) {
  if (!e) return 'Unknown error';
  if (e.reason) return e.reason;
  const m = e.message || '';
  if (m.includes('user rejected')) return 'Transaction rejected.';
  if (m.includes('insufficient funds')) return 'Insufficient funds for gas.';
  const match = m.match(/execution reverted: "?([^"]+)"?/);
  if (match) return 'Reverted: ' + match[1];
  return m.slice(0, 120);
}

export function formatTime(seconds) {
  const s = Number(seconds);
  if (isNaN(s) || s <= 0) return '00:00:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map(v => String(v).padStart(2, '0')).join(':');
}

export function formatDate(unixTs) {
  if (!unixTs || unixTs === 0n) return '—';
  return new Date(Number(unixTs) * 1000).toLocaleString();
}

export const STATUS_LABELS = ['Active', 'Expired', 'Claimed'];
