'use client';
import { useRouter } from 'next/navigation';
import { useMax } from '@/components/providers/MaxProvider';
import { useHaptic } from '@/hooks/useHaptic';

export function HomeActions() {
  const router = useRouter();
  const { profile } = useMax();
  const haptic = useHaptic();

  const isUK = ['uk', 'admin', 'contractor'].includes(profile?.role ?? '');

  const go = (path: string) => {
    haptic.tap();
    router.push(path);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
      {/* Кнопка счётчиков */}
      <button
        onClick={() => go('/meters')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          width: '100%',
          padding: 16,
          borderRadius: 14,
          border: 'none',
          background: 'linear-gradient(135deg, #2481cc 0%, #1f6fb0 100%)',
          color: '#fff',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
          textAlign: 'left',
          boxShadow: '0 4px 12px rgba(36,129,204,0.25)',
        }}
      >
        <div style={{
          width: 44, height: 44,
          borderRadius: 12,
          background: 'rgba(255,255,255,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          flexShrink: 0,
        }}>
          📊
        </div>
        <div style={{ flex: 1 }}>
          <div>Показания счётчиков</div>
          <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 400, marginTop: 2 }}>
            Передать воду и электричество
          </div>
        </div>
        <div style={{ fontSize: 20, opacity: 0.8 }}>→</div>
      </button>

      {/* Кнопка кабинета УК — только для УК */}
      {isUK && (
        <button
          onClick={() => go('/uk')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            width: '100%',
            padding: 16,
            borderRadius: 14,
            border: 'none',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'left',
            boxShadow: '0 4px 12px rgba(16,185,129,0.25)',
          }}
        >
          <div style={{
            width: 44, height: 44,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            flexShrink: 0,
          }}>
            🏢
          </div>
          <div style={{ flex: 1 }}>
            <div>Кабинет УК</div>
            <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 400, marginTop: 2 }}>
              Очередь, карта, счётчики
            </div>
          </div>
          <div style={{ fontSize: 20, opacity: 0.8 }}>→</div>
        </button>
      )}
    </div>
  );
}