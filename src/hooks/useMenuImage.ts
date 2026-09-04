import { useState, useEffect } from 'react';
import { getTodayBucharest } from '../utils/date';

interface UseMenuImageResult {
  dataUrl: string | null;
  loading: boolean;
}

export function useMenuImage(): UseMenuImageResult {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const date = getTodayBucharest();
    setLoading(true);

    fetch(`/api/menu-image?date=${date}`)
      .then(async (res) => {
        if (!res.ok) {
          setDataUrl(null);
          return;
        }
        const data: { dataUrl: string } = await res.json();
        setDataUrl(data.dataUrl);
      })
      .catch(() => {
        setDataUrl(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return { dataUrl, loading };
}
