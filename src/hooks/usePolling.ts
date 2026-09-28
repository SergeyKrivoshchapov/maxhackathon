'use client';
import { useEffect, useRef } from 'react';

export function usePolling(
  callback: () => void | Promise<void>,
  intervalMs: number = 10000,
  enabled: boolean = true
) {
  const cbRef = useRef(callback);

  useEffect(() => {
    cbRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    // первый вызов сразу (не ждём интервал)
    cbRef.current();

    const id = setInterval(() => {
      // не поллим, если вкладка невидима — экономим ресурсы
      if (typeof document !== 'undefined' && document.hidden) return;
      cbRef.current();
    }, intervalMs);

    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}