const MAP: Record<string, { label: string; color: string; bg: string }> = {
  new:         { label: 'Новое',      color: '#1e40af', bg: '#dbeafe' },
  accepted:    { label: 'Принято',    color: '#92400e', bg: '#fef3c7' },
  in_progress: { label: 'В работе',   color: '#5b21b6', bg: '#ede9fe' },
  done:        { label: 'Выполнено',  color: '#065f46', bg: '#d1fae5' },
  rejected:    { label: 'Отклонено',  color: '#991b1b', bg: '#fee2e2' },
  escalated:   { label: 'Эскалация',  color: '#7c2d12', bg: '#ffedd5' },
};

export function StatusBadge({ status }: { status: string }) {
  const s = MAP[status] ?? { label: status, color: '#374151', bg: '#e5e7eb' };
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      color: s.color,
      background: s.bg,
    }}>{s.label}</span>
  );
}