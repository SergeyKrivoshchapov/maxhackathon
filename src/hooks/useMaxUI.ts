'use client';
import { useEffect, useState } from 'react';

export function useMaxUI() {
  const [wa, setWa] = useState<any>(null);

  useEffect(() => {
    const tryInit = () => {
      const w = (window as any).WebApp;
      if (!w) return setTimeout(tryInit, 100);

      w.ready?.();
      w.expand?.();
      w.disableVerticalSwipes?.();

      setWa(w);
    };
    tryInit();
  }, []);

  return wa;
}