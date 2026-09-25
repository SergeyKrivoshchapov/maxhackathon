'use client';

import { useMax } from "@/components/providers/MaxProvider";

export function useHaptic() {
  const { wa } = useMax();
  return {
    tap:     () => wa?.HapticFeedback?.impactOccurred?.('light'),
    press:   () => wa?.HapticFeedback?.impactOccurred?.('medium'),
    success: () => wa?.HapticFeedback?.notificationOccurred?.('success'),
    error:   () => wa?.HapticFeedback?.notificationOccurred?.('error'),
  };
}