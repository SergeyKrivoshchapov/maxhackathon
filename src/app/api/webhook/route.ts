import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const secret = req.headers.get('x-max-bot-api-secret');
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { update_type, ...rest } = body;

  switch (update_type) {
    case 'bot_started':
      // TODO: отправить приветствие с кнопкой открытия Mini App
      break;
    case 'message_callback':
      // TODO: обработать нажатие inline-кнопки
      break;
    case 'message_created':
      // TODO: обработать текстовое сообщение
      break;
  }

  return NextResponse.json({ ok: true });
}
