'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMax } from '@/components/providers/MaxProvider';
import { useBackButton } from '@/hooks/useBackButton';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';

const TYPE_LABELS: Record<string, string> = {
  water_cold: '💧 ХВС',
  water_hot: '🔥 ГВС',
  electricity: '⚡ Электро',
  gas: '🔥 Газ',
  heating: '♨️ Отопление',
};

export default function UKMetersPage() {
  const router = useRouter();
  const { ready, inMax, profile } = useMax();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useBackButton(() => router.push('/uk'));

  useEffect(() => {
    if (!ready || !inMax) return;
    fetch('/api/uk/meters', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setGroups(d))
      .finally(() => setLoading(false));
  }, [ready, inMax]);

  if (!ready || loading) return <Spinner />;
  if (!inMax || !['uk', 'admin'].includes(profile?.role ?? '')) {
    return <div style={{ padding: 60, textAlign: 'center' }}>Доступ запрещён</div>;
  }

  return (
    <main className="screen" style={{ padding: '8px 16px' }}>
      <h1 style={{ fontSize: 20, margin: '12px 0' }}>Счётчики по домам</h1>

      {groups.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--hint)' }}>
          <div style={{ fontSize: 44 }}>📊</div>
          <p>Счётчиков нет</p>
        </div>
      )}

      {groups.map((g, i) => (
        <Card key={i}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            🏢 {g.houseAddress}, кв. {g.premiseNumber}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {g.meters.map((m: any) => (
              <span
                key={m.id}
                style={{
                  fontSize: 12,
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: 'var(--bg-secondary)',
                  color: 'var(--text)',
                }}
              >
                {TYPE_LABELS[m.type] ?? m.type}
              </span>
            ))}
          </div>
        </Card>
      ))}
    </main>
  );
}