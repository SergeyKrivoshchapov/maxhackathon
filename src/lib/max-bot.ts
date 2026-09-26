// Было: const MAX_API = 'https://botapi.max.ru';
const MAX_API = 'https://platform-api2.max.ru';

export async function sendMaxMessage(
  chatId: number,
  text: string,
  buttons?: Array<Array<{ text: string; payload?: string; url?: string }>>,
) {
  const body: any = { text };
  if (buttons) {
    body.attachments = [{
      type: 'inline_keyboard',
      payload: { buttons },
    }];
  }

  // Отправка сообщения в чат
  const res = await fetch(`${MAX_API}/messages?chat_id=${chatId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MAX_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error('MAX send failed:', await res.text());
    return null;
  }
  return res.json();
}

export async function notifyUser(maxUserId: number, text: string) {
  // Отправка сообщения пользователю
  const res = await fetch(`${MAX_API}/messages?user_id=${maxUserId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MAX_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) console.error('MAX notify failed:', await res.text());
  return res.ok;
}
