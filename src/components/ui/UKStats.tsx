'use client';
import { useEffect, useState } from 'react';

type Stats = {
  new: number;
  in_progress: number;
  overdue: number;
};

export function UKStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/uk/stats', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => setStats(null));
  }, []);

  if (!stats) return null;

  const cards = [
    { label: 'Новых', value: stats.new, color: '#2563eb' },
    { label: 'В работе', value: stats.in_progress, color: '#f59e0b' },
    { label: 'Просрочено', value: stats.overdue, color: '#dc2626' },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 8,
      marginBottom: 16,
    }}>
      {cards.map((c) => (
        <div key={c.label} style={{
          padding: 12,
          borderRadius: 10,
          background: 'var(--bg-secondary)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: c.color }}>
            {c.value}
          </div>
          <div style={{ fontSize: 11, color: 'var(--hint)', marginTop: 2 }}>
            {c.label}
          </div>
        </div>
      ))}
    </div>
  );
}