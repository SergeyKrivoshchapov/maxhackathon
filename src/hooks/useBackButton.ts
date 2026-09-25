'use client';
import { useMax } from '@/components/providers/MaxProvider';
import { useEffect } from 'react';

export function useBackButton(onBack?: () => void, visible = true) {
  const { wa } = useMax();

  useEffect(() => {
    if (!wa?.BackButton) return;
    const bb = wa.BackButton;
    visible ? bb.show() : bb.hide();

    const handler = () => (onBack ? onBack() : history.back());
    bb.onClick(handler);
    return () => bb.offClick(handler);
  }, [wa, onBack, visible]);
}