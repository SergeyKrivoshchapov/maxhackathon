'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMainButton } from '@/hooks/useMainButton';
import { useHaptic } from '@/hooks/useHaptic';
import { useMax } from '@/components/providers/MaxProvider';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';

type Ticket = {
  id: string; title: string; status: string;
  categoryName: string | null; createdAt: string; slaDeadline: string | null;
};

export default function Home() {
  const router = useRouter();
  const { profile, ready } = useMax();
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

  // Нативная главная кнопка = «Новое обращение»
  useMainButton({
    text: 'Новое обращение',
    visible: true,
    enabled: true,
    onClick: () => {
      haptic.tap();
      router.push('/new');
    },
  });

  if (loading) return <Spinner />;

  return (
    <main className="screen">
      {profile && (
        <div className="section-title">
          Привет, {profile.firstName ?? 'житель'}
        </div>
      )}

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--hint)' }}>
          <div style={{ fontSize: 44 }}>📋</div>
          <p>Пока нет обращений</p>
        </div>
      ) : (
        <div style={{ padding: '0 16px' }}>
          {items.map((t) => (
            <Card key={t.id} onClick={() => { haptic.tap(); router.push(`/ticket/${t.id}`); }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 15, flex: 1 }}>{t.title}</div>
                <StatusBadge status={t.status} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--hint)', marginTop: 6 }}>
                {t.categoryName ?? 'Без категории'} · {new Date(t.createdAt).toLocaleString('ru-RU')}
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}