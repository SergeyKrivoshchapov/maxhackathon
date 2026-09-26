'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMainButton } from '@/hooks/useMainButton';
import { useBackButton } from '@/hooks/useBackButton';
import { useHaptic } from '@/hooks/useHaptic';
import { useMax } from '@/components/providers/MaxProvider';
import { Spinner } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Card } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/TextArea';

type Data = {
  ticket: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    categoryName: string | null;
    photos: string[] | null;
    createdAt: string;
    slaDeadline: string | null;
  };
  messages: Array<{
    id: string;
    body: string;
    authorName: string | null;
    createdAt: string;
    isSystem: boolean | null;
  }>;
};

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { wa, ready } = useMax();
  const haptic = useHaptic();

  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/tickets/${id}`, { credentials: 'include' });
    if (r.ok) setData(await r.json());
    else if (r.status === 404) router.replace('/');
  }, [id, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!ready) return;
      load().finally(() => setLoading(false));
    });
    return () => clearTimeout(timer);
  }, [ready, load]);

  useBackButton(() => router.back());

  const send = useCallback(async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    haptic.press();
    try {
      const res = await fetch(`/api/tickets/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      setText('');
      haptic.success();
      await load();
    } catch (e: any) {
      haptic.error();
      wa?.showAlert?.(`Ошибка: ${e.message}`);
    } finally {
      setSending(false);
    }
  }, [text, sending, id, haptic, load, wa]);

  useMainButton({
    text: 'Отправить сообщение',
    visible: !!wa?.initData && !!text.trim(),
    enabled: !!text.trim() && !sending,
    progress: sending,
    onClick: send,
  });

  if (!ready || loading) return <Spinner />;

  if (!wa?.initData) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 48 }}>📱</div>
        <h2>Откройте через MAX</h2>
        <p style={{ color: 'var(--hint)' }}>Приложение работает внутри MAX.</p>
      </div>
    );
  }

  if (!data) return <Spinner />;

  const { ticket, messages } = data;
  const overdue =
    ticket.slaDeadline &&
    !['done', 'rejected'].includes(ticket.status) &&
    new Date(ticket.slaDeadline) < new Date();

  return (
    <main className="screen" style={{ padding: '8px 16px' }}>
      <h2 style={{ margin: '8px 0 12px', fontSize: 20 }}>{ticket.title}</h2>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <StatusBadge status={ticket.status} />
        <span style={{ fontSize: 12, color: 'var(--hint)' }}>
          {ticket.categoryName ?? 'Без категории'} ·{' '}
          {new Date(ticket.createdAt).toLocaleString('ru-RU')}
        </span>
      </div>

      {overdue && (
        <div style={{
          background: '#fee2e2', color: '#991b1b',
          padding: 10, borderRadius: 10, fontSize: 13,
          fontWeight: 600, marginBottom: 12,
        }}>
          ⚠ Просрочено SLA
        </div>
      )}

      {ticket.description && <Card>{ticket.description}</Card>}

      {!!ticket.photos?.length && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {ticket.photos.map((u) => (
            <img
              key={u}
              src={u}
              alt=""
              style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 8 }}
            />
          ))}
        </div>
      )}

      <div className="section-title">Сообщения</div>

      {messages.length === 0 && (
        <div style={{ padding: '8px 0', color: 'var(--hint)', fontSize: 14 }}>
          Пока пусто
        </div>
      )}

      {messages.map((m) => (
        <Card key={m.id}>
          <div style={{ fontSize: 12, color: 'var(--hint)', marginBottom: 4 }}>
            {m.authorName ?? 'Система'} · {new Date(m.createdAt).toLocaleString('ru-RU')}
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
        </Card>
      ))}

      <div className="section-title">Написать</div>
      <Textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Сообщение…"
      />
    </main>
  );
}