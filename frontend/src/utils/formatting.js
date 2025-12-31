export function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toFixed(0);
}

export function formatQPS(qps) {
  if (qps >= 1000) {
    return (qps / 1000).toFixed(1) + 'K';
  }
  return qps.toFixed(0);
}

export function formatLatency(ms) {
  if (ms >= 1000) {
    return (ms / 1000).toFixed(2) + 's';
  }
  return ms.toFixed(1) + 'ms';
}

export function formatPercent(rate) {
  return (rate * 100).toFixed(3) + '%';
}
