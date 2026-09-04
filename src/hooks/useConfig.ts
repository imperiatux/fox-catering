import { useState, useEffect } from 'react';

export interface AppConfig {
  cutoffHour: number;
  cutoffMinute: number;
  cutoffEnabled: boolean;
}

const DEFAULT_CONFIG: AppConfig = { cutoffHour: 10, cutoffMinute: 30, cutoffEnabled: true };

export function useConfig(): AppConfig {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((data: AppConfig) => {
        if (typeof data.cutoffHour === 'number' && typeof data.cutoffMinute === 'number') {
          setConfig(data);
        }
      })
      .catch(() => { /* fall back to default */ });
  }, []);

  return config;
}
