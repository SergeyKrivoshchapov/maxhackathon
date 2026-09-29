'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMax } from '@/components/providers/MaxProvider';
import { useBackButton } from '@/hooks/useBackButton';
import { useHaptic } from '@/hooks/useHaptic';
import { useDialog } from '@/hooks/useDialog';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/TextArea';
import { PhotoGrid } from '@/components/ui/PhotoGrid';

const STATUS_OPTIONS = [
  { value: 'accepted', label: 'Принята' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'done', label: 'Выполнена' },
  { value: 'rejected', label: 'Отклонена' },
  { value: 'escalated', label: 'Эскалирована' },
];

export default function UKTicketPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { ready, inMax, profile } = useMax();
  const haptic = useHaptic();
  const dialog = useDialog();

  const [data, setData] = useState<any>(null);
  const [assignees, setAssignees] = useState<any[]>([]);
  const [newStatus, setNewStatus] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  useBackButton(() => router.push('/uk'));

  const load = useCallback(async () => {
    const r = await fetch(`/api/tickets/${id}`, { credentials: 'include' });
    if (r.ok) {
      const d = await r.json();
      setData(d);
      setNewStatus(d.ticket.status);
    }
  }, [id]);

  useEffect(() => {
    if (!ready) return;
    load();
    fetch('/api/uk/assignees', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setAssignees(d));
  }, [ready, load]);

  const changeStatus = async () => {
    if (busy) return;
    setBusy(true);
    haptic.press();

    try {
      const res = await fetch(`/api/uk/tickets/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, comment: comment.trim() || undefined }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      haptic.success();
      await dialog.alert('Статус обновлён');
      setComment('');
      await load();
    } catch (e: any) {
      haptic.error();
      await dialog.alert(`Ошибка: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const assign = async (assigneeId: string) => {
    if (busy) return;
    setBusy(true);
    haptic.tap();
    try {
      await fetch(`/api/uk/tickets/${id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeId: assigneeId || null }),
        credentials: 'include',
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (!ready || !data) return <Spinner />;

  if (!inMax || !['uk', 'admin', 'contractor'].includes(profile?.role ?? '')) {
    return <div style={{ padding: 60, textAlign: 'center' }}>Доступ запрещён</div>;
  }

  const { ticket, messages } = data;

  return (
    <main className="screen" style={{ padding: '8px 16px' }}>
      <h1 style={{ fontSize: 20, margin: '12px 0' }}>{ticket.title}</h1>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <StatusBadge status={ticket.status} />
        <span style={{ fontSize: 12, color: 'var(--hint)' }}>
          {ticket.categoryName} · {new Date(ticket.createdAt).toLocaleString('ru-RU')}
        </span>
      </div>

      {ticket.description && <Card>{ticket.description}</Card>}

      {ticket.houseAddress && (
        <div
            style={{
            background: 'var(--bg-secondary)',
            padding: 12,
            borderRadius: 10,
            marginBottom: 12,
            fontSize: 15,
            fontWeight: 500,
            }}
        >
            📍 {ticket.houseAddress}
            {ticket.premiseNumber && `, кв. ${ticket.premiseNumber}`}
        </div>
      )}
      
      <PhotoGrid urls={ticket.photos ?? []} columns={3} />

      <div className="section-title">Назначить исполнителя</div>
      <Select
        value={ticket.assigneeId ?? ''}
        onChange={(e) => assign(e.target.value)}
      >
        <option value="">— не назначен —</option>
        {assignees.map((a) => (
          <option key={a.id} value={a.id}>
            {a.firstName} {a.lastName} ({a.role})
          </option>
        ))}
      </Select>

      <div className="section-title">Изменить статус</div>
      <Select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
        {STATUS_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </Select>

      <Textarea
        rows={3}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Комментарий (опционально)"
      />

      <button
        onClick={changeStatus}
        disabled={busy || newStatus === ticket.status}
        style={{
          width: '100%', padding: 14, borderRadius: 12,
          border: 'none', background: 'var(--button, #2481cc)',
          color: '#fff', fontSize: 15, fontWeight: 600,
          opacity: (busy || newStatus === ticket.status) ? 0.5 : 1,
          cursor: busy ? 'wait' : 'pointer',
        }}
      >
        {busy ? 'Сохранение…' : 'Применить'}
      </button>

      <div className="section-title">Переписка</div>
      {messages.map((m: any) => (
        <Card key={m.id}>
          <div style={{ fontSize: 12, color: 'var(--hint)', marginBottom: 4 }}>
            {m.authorName ?? 'Система'} · {new Date(m.createdAt).toLocaleString('ru-RU')}
          </div>
          <PhotoGrid urls={m.attachments ?? []} columns={3} />
          <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
        </Card>
      ))}
    </main>
  );
}