'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMainButton } from '@/hooks/useMainButton';
import { useHaptic } from '@/hooks/useHaptic';
import { useMax } from '@/components/providers/MaxProvider';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { OpenInMax } from '@/components/OpenInMax';

type Ticket = {
  id: string;
  title: string;
  status: string;
  categoryName: string | null;
  createdAt: string;
  slaDeadline: string | null;
};

export default function HomePage() {
  const router = useRouter();
  const { wa, profile, ready, inMax } = useMax();
  const haptic = useHaptic();

  const [items, setItems] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const r = await fetch('/api/tickets', { credentials: 'include' });
    const d = await r.json();
    setItems(Array.isArray(d) ? d : []);
  }, []);

  useEffect(() => {
    if (!ready) return;
    load().finally(() => setLoading(false));
  }, [ready, load]);

  useMainButton({
    text: 'Новое обращение',
    visible: !!wa?.initData,
    onClick: () => {
      haptic.tap();
      router.push('/new');
    },
  });

  if (!ready) return <Spinner />;

  if (!inMax) return <OpenInMax />;

  if (!wa?.initData) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 48 }}>📱</div>
        <h2>Откройте через MAX</h2>
        <p style={{ color: 'var(--hint)' }}>
          Это приложение работает внутри мессенджера MAX.
        </p>
      </div>
    );
  }

  return (
    <main className="screen" style={{ padding: '8px 16px' }}>
      {profile && (
        <div style={{ fontSize: 14, color: 'var(--hint)', padding: '12px 0 8px' }}>
          Привет, {profile.firstName ?? 'житель'}
        </div>
      )}

      {loading && <Spinner />}

      {!loading && items.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--hint)' }}>
          <div style={{ fontSize: 44 }}>📋</div>
          <p>Пока нет обращений</p>
          <p style={{ fontSize: 13 }}>Нажмите «Новое обращение» внизу</p>
        </div>
      )}

      {items.map((t) => {
        const overdue =
          t.slaDeadline &&
          !['done', 'rejected'].includes(t.status) &&
          new Date(t.slaDeadline) < new Date();

        return (
          <Card
            key={t.id}
            onClick={() => {
              haptic.tap();
              router.push(`/ticket/${t.id}`);
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <strong style={{ fontSize: 15, flex: 1 }}>{t.title}</strong>
              <StatusBadge status={t.status} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--hint)', marginTop: 6 }}>
              {t.categoryName ?? 'Без категории'} ·{' '}
              {new Date(t.createdAt).toLocaleString('ru-RU')}
            </div>
            {overdue && (
              <div style={{ fontSize: 12, color: '#dc2626', marginTop: 6, fontWeight: 600 }}>
                ⚠ Просрочено SLA
              </div>
            )}
          </Card>
        );
      })}
    </main>
  );
}