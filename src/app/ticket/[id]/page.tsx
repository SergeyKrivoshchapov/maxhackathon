'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMainButton } from '@/hooks/useMainButton';
import { useBackButton } from '@/hooks/useBackButton';
import { useHaptic } from '@/hooks/useHaptic';
import { Spinner } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Card } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/TextArea';

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const haptic = useHaptic();

  const [data, setData] = useState<any>(null);
  const [text, setText] = useState('');

  const load = useCallback(async () => {
    const r = await fetch(`/api/tickets/${id}`, { credentials: 'include' });
    if (r.ok) setData(await r.json());
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useBackButton(() => router.back());

  const send = useCallback(async () => {
    if (!text.trim()) return;
    haptic.press();
    await fetch(`/api/tickets/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text }),
      credentials: 'include',
    });
    setText('');
    haptic.success();
    await load();
  }, [text, id, haptic, load]);

  // MainButton видна только когда есть текст
  useMainButton({
    text: 'Отправить сообщение',
    visible: !!text.trim(),
    enabled: !!text.trim(),
    onClick: send,
  });

  if (!data) return <Spinner />;
  const { ticket, messages } = data;

  return (
    <main className="screen" style={{ padding: '8px 16px' }}>
      <h2 style={{ margin: '8px 0' }}>{ticket.title}</h2>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <StatusBadge status={ticket.status} />
        <span style={{ fontSize: 12, color: 'var(--hint)' }}>
          {ticket.categoryName} · {new Date(ticket.createdAt).toLocaleString('ru-RU')}
        </span>
      </div>

      {ticket.description && <Card>{ticket.description}</Card>}

      {ticket.photos?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {ticket.photos.map((u: string) => (
            <img key={u} src={u} alt="" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 8 }} />
          ))}
        </div>
      )}

      <div className="section-title">Сообщения</div>
      {messages.length === 0 && <div style={{ padding: 16, color: 'var(--hint)' }}>Пока пусто</div>}

      {messages.map((m: any) => (
        <Card key={m.id}>
          <div style={{ fontSize: 12, color: 'var(--hint)', marginBottom: 4 }}>
            {m.authorName ?? 'Система'} · {new Date(m.createdAt).toLocaleString('ru-RU')}
          </div>
          <div>{m.body}</div>
        </Card>
      ))}

      <div className="section-title">Написать</div>
      <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Сообщение…" />
    </main>
  );
}