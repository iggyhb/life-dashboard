export function today() {
  return new Date().toISOString().split('T')[0];
}

export function now() {
  return new Date().toISOString();
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const t = new Date();
  const diff = Math.floor((t - d) / 86400000);

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff}d ago`;

  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== t.getFullYear() ? 'numeric' : undefined
  });
}

export function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatCurrency(amount, currency = 'EUR') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency
  }).format(amount);
}

export function isToday(dateStr) {
  return dateStr === today();
}

export function isThisWeek(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const t = new Date();
  const startOfWeek = new Date(t);
  startOfWeek.setDate(t.getDate() - t.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  return d >= startOfWeek;
}

export function isThisMonth(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const t = new Date();
  return d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
}

export function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

export function getLast7Days() {
  return Array.from({ length: 7 }, (_, i) => daysAgo(6 - i));
}

export function getLast30Days() {
  return Array.from({ length: 30 }, (_, i) => daysAgo(29 - i));
}
