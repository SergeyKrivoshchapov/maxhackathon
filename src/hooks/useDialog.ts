'use client';

import { useMax } from "@/components/providers/MaxProvider";

export function useDialog() {
  const { wa } = useMax();
  return {
    alert:   (msg: string) => wa?.showAlert?.(msg) ?? alert(msg),
    confirm: (msg: string) => new Promise<boolean>((res) =>
      wa?.showConfirm?.(msg, (ok: boolean) => res(ok)) ?? res(confirm(msg))
    ),
    close:   () => wa?.close?.(),
  };
}