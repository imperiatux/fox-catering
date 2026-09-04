import { useState, useEffect } from 'react';
import type { DailyMenu } from '../types';
import { getTodayBucharest } from '../utils/date';

interface UseMenuResult {
  menu: DailyMenu | null;
  loading: boolean;
  error: string | null;
}

export function useMenu(): UseMenuResult {
  const [menu, setMenu] = useState<DailyMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const date = getTodayBucharest();
    setLoading(true);
    setError(null);

    fetch(`/api/menu?date=${date}`)
      .then(async (res) => {
        if (res.status === 404) {
          setMenu(null);
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        const data: DailyMenu = await res.json();
        setMenu(data);
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return { menu, loading, error };
}
