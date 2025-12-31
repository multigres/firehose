import { useState, useCallback } from 'react';

const MAX_HISTORY_SIZE = 600; // 60 seconds at 100ms intervals

export function useMetricsHistory() {
  const [history, setHistory] = useState([]);

  const addMetric = useCallback((metric) => {
    setHistory((prev) => {
      const newHistory = [...prev, metric];
      // Keep only the last MAX_HISTORY_SIZE entries
      if (newHistory.length > MAX_HISTORY_SIZE) {
        return newHistory.slice(-MAX_HISTORY_SIZE);
      }
      return newHistory;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return { history, addMetric, clearHistory };
}
