'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMax } from '@/components/providers/MaxProvider';
import { useHaptic } from '@/hooks/useHaptic';
import { useBackButton } from '@/hooks/useBackButton';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { usePolling } from '@/hooks/usePolling';
import { UKStats } from '@/components/ui/UKStats';
import { Select } from '@/components/ui/Select';
import { useDialog } from '@/hooks/useDialog';

type Ticket = {
  id: string;
  title: string;
  status: string;
  priority: string;
  categoryName: string | null;
  houseAddress: string | null;
  premiseNumber: string | null;
  createdAt: string;
  slaDeadline: string | null;
  authorFirstName: string | null;
};

const FILTERS = [
  { key: '', label: 'Все' },
  { key: 'new', label: 'Новые' },
  { key: 'accepted', label: 'Принятые' },
  { key: 'in_progress', label: 'В работе' },
  { key: 'done', label: 'Выполненные' },
];

export default function UKPage() {
  const router = useRouter();
  const { ready, inMax, profile } = useMax();
  const haptic = useHaptic();

  const [sort, setSort] = useState<'new' | 'sla' | 'priority'>('new');
  const [items, setItems] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  useBackButton(() => router.push('/'));

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter) params.set('status', filter);
    if (overdueOnly) params.set('overdue', '1');
    if (sort) params.set('sort', sort);

    const r = await fetch(`/api/uk/tickets?${params}`, {
      credentials: 'include',
    });
    const d = await r.json();
    setItems(Array.isArray(d) ? d : []);
    setLoading(false);
  }, [filter, overdueOnly]);

  usePolling(load, 10000, ready && inMax);
  
  useEffect(() => {
    if (!ready) return;
    load();
  }, [ready, load]);

  const quickAction = async (ticketId: string, status: string) => {
    try {
      await fetch(`/api/uk/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
        credentials: 'include',
      });
      haptic.success();
      load();
    } catch (e) {
      haptic.error();
    }
  };
  const dialog = useDialog();
  const acceptTicket = (id: string) => quickAction(id, 'accepted');
  const startTicket = (id: string) => quickAction(id, 'in_progress');
  const closeTicket = (id: string) => quickAction(id, 'done');

  if (!ready) return <Spinner />;

  if (!inMax || !['uk', 'admin', 'contractor'].includes(profile?.role ?? '')) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 48 }}>🚫</div>
        <h2>Доступ только для УК</h2>
      </div>
    );
  }

  return (
    <main className="screen" style={{ padding: '8px 16px' }}>
      <h1 style={{ fontSize: 20, margin: '12px 0' }}>Очередь обращений</h1>
      <button
        onClick={async () => {
          haptic.tap();
          const res = await fetch('/api/uk/tickets/export', { credentials: 'include' });
          if (!res.ok) {
            await dialog.alert('Не удалось скачать файл');
            return;
          }
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `tickets-${new Date().toISOString().slice(0, 10)}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }}
        style={{
          width: '100%',
          padding: 12,
          marginBottom: 12,
          borderRadius: 10,
          border: '1px solid var(--separator)',
          background: 'transparent',
          color: 'var(--text)',
          fontSize: 14,
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
        }}
      >
        📥 Скачать CSV
      </button>

      <button
        onClick={() => router.push('/uk/meters')}
        style={{
          width: '100%',
          padding: 12,
          marginBottom: 12,
          borderRadius: 10,
          border: '1px solid var(--link, #2481cc)',
          background: 'rgba(36,129,204,0.08)',
          color: 'var(--link, #2481cc)',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        📊 Счётчики по домам
      </button>

      <button
        onClick={() => router.push('/uk/map')}
        style={{
          width: '100%',
          padding: 12,
          marginBottom: 12,
          borderRadius: 10,
          border: '1px solid var(--link, #2481cc)',
          background: 'rgba(36,129,204,0.08)',
          color: 'var(--link, #2481cc)',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
        }}
      >
        🗺 Открыть карту заявок
      </button>
      
      <UKStats />

      {/* Фильтры */}
      <div style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        paddingBottom: 8,
        marginBottom: 12,
      }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => { haptic.tap(); setFilter(f.key); }}
            style={{
              padding: '8px 14px',
              borderRadius: 20,
              border: 'none',
              background: filter === f.key
                ? 'var(--button, #2481cc)'
                : 'var(--bg-secondary)',
              color: filter === f.key ? '#fff' : 'var(--text)',
              fontSize: 14,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
      <Select value={sort} onChange={(e) => setSort(e.target.value as any)}>
        <option value="new">Сначала новые</option>
        <option value="sla">Сначала по SLA</option>
        <option value="priority">Сначала важные</option>
      </Select>

      <label style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 14, marginBottom: 12,
      }}>
        <input
          type="checkbox"
          checked={overdueOnly}
          onChange={(e) => setOverdueOnly(e.target.checked)}
        />
        Только просроченные по SLA
      </label>

      {loading && <Spinner />}

      {!loading && items.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--hint)' }}>
          <div style={{ fontSize: 44 }}>✅</div>
          <p>Обращений нет</p>
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
              router.push(`/uk/ticket/${t.id}`);
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <strong style={{ fontSize: 15, flex: 1 }}>{t.title}</strong>
              <StatusBadge status={t.status} />
            </div>
            {/* Быстрые действия */}
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              {t.status === 'new' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    acceptTicket(t.id);
                  }}
                  style={{
                    flex: 1, padding: 8,
                    borderRadius: 8, border: 'none',
                    background: 'var(--button)',
                    color: '#fff', fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Принять
                </button>
              )}

              {t.status === 'accepted' && (
                <button onClick={(e) => { e.stopPropagation(); startTicket(t.id); }}>
                  В работу
                </button>
              )}

              {t.status === 'in_progress' && (
                <button onClick={(e) => { e.stopPropagation(); closeTicket(t.id); }}>
                  Выполнено
                </button>
              )}

              <button
                onClick={(e) => { e.stopPropagation(); router.push(`/uk/ticket/${t.id}`); }}
                style={{ padding: 8, borderRadius: 8, border: '1px solid var(--separator)', background: 'transparent' }}
              >
                Открыть
              </button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--hint)', marginTop: 6 }}>
              {t.houseAddress ?? '—'}, кв. {t.premiseNumber ?? '—'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--hint)', marginTop: 2 }}>
              {t.categoryName ?? 'Без категории'} · {t.authorFirstName ?? '—'} ·{' '}
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