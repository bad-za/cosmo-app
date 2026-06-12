// Бэкенд бота @pocket_cosmos_bot: Cloudflare Worker, принимает webhook Telegram
// и отвечает на сообщения приветствием с кнопкой мини-аппа.
// Секреты (задаются через `wrangler secret put`): BOT_TOKEN, WEBHOOK_SECRET.

const APP_URL = 'https://bad-za.github.io/cosmo-app/';

const START_TEXT = [
  'Привет! Это «Карманный космос» 🌌',
  '',
  'Внутри — живая Солнечная система на реальных данных NASA: можно ускорять время, менять массы планет, удалять Юпитер и смотреть, как всё разлетается. А если отдалиться от Солнца — окажешься в галактике, где тикают семь настоящих пульсаров.',
  '',
  'Жми кнопку 👇',
].join('\n');

const FALLBACK_TEXT = 'Я не разговорчивый — вся вселенная за кнопкой 👇';

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('pocket-cosmos bot');
    // Проверка, что запрос действительно от Telegram
    if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) {
      return new Response('forbidden', { status: 403 });
    }

    const update = await request.json();
    const msg = update.message ?? update.edited_message;
    const chatId = msg?.chat?.id;
    if (chatId) {
      const isStart = typeof msg.text === 'string' && msg.text.startsWith('/start');
      await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: isStart ? START_TEXT : FALLBACK_TEXT,
          reply_markup: {
            inline_keyboard: [[{ text: '🌌 Открыть космос', web_app: { url: APP_URL } }]],
          },
        }),
      });
    }
    // Telegram важен только статус 200, иначе он будет ретраить
    return new Response('ok');
  },
};
