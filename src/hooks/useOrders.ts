import { useState, useEffect, useCallback } from 'react';
import type { DailyOrders } from '../types';
import { getTodayBucharest } from '../utils/date';

interface UseOrdersResult {
  orders: DailyOrders | null;
  loading: boolean;
  refresh: () => void;
}

export function useOrders(): UseOrdersResult {
  const [orders, setOrders] = useState<DailyOrders | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const date = getTodayBucharest();
    setLoading(true);

    fetch(`/api/orders?date=${date}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data: DailyOrders = await res.json();
        setOrders(data);
      })
      .catch(() => {
        // silently ignore — orders list is non-critical
      })
      .finally(() => {
        setLoading(false);
      });
  }, [tick]);

  return { orders, loading, refresh };
}
