'use client';
import { useMax } from '@/components/providers/MaxProvider';
import { useEffect } from 'react';

type Options = {
  text: string;
  onClick: () => void;
  enabled?: boolean;
  visible?: boolean;
  progress?: boolean;   // показать спиннер на кнопке
};

export function useMainButton({
  text, onClick, enabled = true, visible = true, progress = false,
}: Options) {
  const { wa } = useMax();

  useEffect(() => {
    if (!wa?.MainButton) return;
    const mb = wa.MainButton;

    mb.setText(text);
    visible ? mb.show() : mb.hide();
    enabled && visible && !progress ? mb.enable() : mb.disable();
    progress ? mb.showProgress?.() : mb.hideProgress?.();

    const handler = () => onClick();
    mb.onClick(handler);

    return () => {
      mb.offClick(handler);
      mb.hide();
    };
  }, [wa, text, enabled, visible, progress, onClick]);
}