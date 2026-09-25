import Link from 'next/link';
import { StatusBadge } from './ui/StatusBadge';

type Props = {
  t: {
    id: string;
    title: string;
    status: string;
    priority: string;
    categoryName: string | null;
    createdAt: string;
    slaDeadline: string | null;
  };
};

export function TicketCard({ t }: Props) {
  const overdue =
    t.slaDeadline &&
    !['done', 'rejected'].includes(t.status) &&
    new Date(t.slaDeadline) < new Date();

  return (
    <Link href={`/ticket/${t.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{
        background: 'var(--tg-bg, #fff)',
        border: '1px solid var(--tg-hint, #e5e7eb)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: 15 }}>{t.title}</strong>
          <StatusBadge status={t.status} />
        </div>
        <div style={{ fontSize: 13, opacity: 0.7 }}>
          {t.categoryName ?? 'Без категории'} · {new Date(t.createdAt).toLocaleString('ru-RU')}
        </div>
        {overdue && (
          <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
            ⚠ Просрочено SLA
          </div>
        )}
      </div>
    </Link>
  );
}