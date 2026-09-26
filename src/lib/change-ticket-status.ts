import { db } from '@/db';
import { tickets, ticketEvents, ticketMessages } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notifyUser } from './max-bot';

type Status = 'new' | 'accepted' | 'in_progress' | 'done' | 'rejected' | 'escalated';

const STATUS_LABELS: Record<Status, string> = {
  new: 'Новая',
  accepted: 'Принята',
  in_progress: 'В работе',
  done: 'Выполнена',
  rejected: 'Отклонена',
  escalated: 'Эскалирована',
};

export async function changeTicketStatus(
  ticketId: string,
  newStatus: Status,
  actorId: string,
  comment?: string,
) {
  return db.transaction(async (tx) => {
    const ticket = await tx.query.tickets.findFirst({
      where: eq(tickets.id, ticketId),
      with: { author: true },
    });
    if (!ticket) throw new Error('Ticket not found');

    const closedAt = ['done', 'rejected'].includes(newStatus) ? new Date() : null;

    const [updated] = await tx
      .update(tickets)
      .set({ status: newStatus, updatedAt: new Date(), closedAt })
      .where(eq(tickets.id, ticketId))
      .returning();

    await tx.insert(ticketEvents).values({
      ticketId,
      actorId,
      fromStatus: ticket.status,
      toStatus: newStatus,
      comment: comment ?? null,
    });

    // Системное сообщение в чат заявки
    await tx.insert(ticketMessages).values({
      ticketId,
      body: `Статус изменён: ${STATUS_LABELS[newStatus]}`,
      isSystem: true,
    });

    // Уведомление автору
    if (ticket.author?.maxUserId) {
      await notifyUser(
        ticket.author.maxUserId,
        `Заявка «${ticket.title}»: ${STATUS_LABELS[newStatus]}`,
      );
    }

    return updated;
  });
}
