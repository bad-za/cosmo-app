# Telegram Mini App: текущее состояние и эксплуатация

## Что где живёт

| Что | Где | Примечание |
|---|---|---|
| Бот | [@pocket_cosmos_bot](https://t.me/pocket_cosmos_bot) «Карманный космос» | имя/описания заданы через Bot API |
| Мини-апп (прод) | https://bad-za.github.io/cosmo-app/ | GitHub Pages, ветка `gh-pages` |
| Зеркало | https://pocket-cosmos.bigbadnoob.workers.dev | Cloudflare Worker со статикой |
| Бэкенд бота | https://pocket-cosmos-bot.bigbadnoob.workers.dev | Cloudflare Worker, `apps/bot/` |
| Репозиторий | https://github.com/bad-za/cosmo-app | публичный (нужно для бесплатного GH Pages) |

Кнопка меню бота («🌌 Космос»), ответы бота и описания указывают на GitHub Pages.

## Секреты (НЕ коммитить — оба файла в .gitignore)

- `secrets.md` — токен бота (формат RTF, токен достаётся grep-ом).
- `secrets-notes.txt` — секрет вебхука Telegram.
- В Cloudflare у воркера `pocket-cosmos-bot` заданы секреты `BOT_TOKEN`
  и `WEBHOOK_SECRET` (`wrangler secret put`).

При перевыпуске токена (`/revoke` в BotFather): обновить `secrets.md`,
затем `wrangler secret put BOT_TOKEN` и заново `setWebhook` (см. ниже).

## Инструменты деплоя

- GitHub: `gh` CLI (аккаунт bad-za).
- Cloudflare: wrangler 4 требует Node 22 — он стоит локально в `~/.local/node22`,
  системный Node 18 не трогаем. Перед командами wrangler:
  `export PATH="$HOME/.local/node22/bin:$PATH"`. Аккаунт Cloudflare —
  bigbadnoob@gmail.com (OAuth-логин wrangler уже выполнен).

## Обновить мини-апп (прод, GitHub Pages)

```bash
npm run build -w apps/telegram
cd apps/telegram/dist && git init -b gh-pages && git add -A \
  && git commit -m deploy && git push -f https://github.com/bad-za/cosmo-app.git gh-pages \
  && cd ../../.. && rm -rf apps/telegram/dist/.git
```

Страница обновляется через ~1 минуту после пуша.

## Обновить зеркало на Cloudflare

```bash
export PATH="$HOME/.local/node22/bin:$PATH"
cd apps/telegram && npx wrangler@4 deploy --assets ./dist \
  --name pocket-cosmos --compatibility-date 2025-01-01
```

## Бэкенд бота (`apps/bot/`)

Worker отвечает на `/start` и любые сообщения кнопкой мини-аппа;
запросы без секретного заголовка Telegram отклоняет (403).

Деплой после правок `worker.js`:

```bash
export PATH="$HOME/.local/node22/bin:$PATH"
cd apps/bot && npx wrangler@4 deploy
```

Перепривязать webhook (нужно после смены токена или URL воркера):

```bash
TOKEN=$(grep -oE '[0-9]{8,12}:[A-Za-z0-9_-]{30,}' secrets.md)
SECRET=$(grep -oE '[0-9a-f]{32}' secrets-notes.txt)
curl -s "https://api.telegram.org/bot$TOKEN/setWebhook" \
  -d "url=https://pocket-cosmos-bot.bigbadnoob.workers.dev" \
  -d "secret_token=$SECRET" -d "drop_pending_updates=true" \
  -d 'allowed_updates=["message"]'
```

Диагностика: `curl -s "https://api.telegram.org/bot$TOKEN/getWebhookInfo"` —
поле `last_error_message` должно отсутствовать.

## Что настроено через Bot API (повторять не нужно)

- `setChatMenuButton`: кнопка «🌌 Космос» → мини-апп.
- `setMyName` / `setMyShortDescription` / `setMyDescription` (ru + default).

## Что делается только руками в BotFather

- Аватар: `/setuserpic` → файл `docs/assets/bot-avatar-512.png`.
- Мини-апп с прямой ссылкой `t.me/pocket_cosmos_bot/<имя>`: `/newapp`,
  обложка `docs/assets/miniapp-cover-640x360.png` (есть вариант без текста).
- Перевыпуск токена: `/revoke`.

## Что уже учтено в приложении (apps/telegram)

- `tg.ready()` + `tg.expand()`, `disableVerticalSwipes()` — свайпы камеры
  не сворачивают мини-апп.
- Высота из `--tg-viewport-stable-height` (без прыжков при показе шапки).
- Панель — выдвижная шторка снизу («☰ панель»), крупные контролы.
- Потолок шагов физики на кадр адаптивный (250–4000 по фактическому FPS).
- Звук включается по жесту — требование мобильных WebView соблюдено;
  AudioContext закрывается при закрытии часов (их число в WebView ограничено,
  без `close()` звук переставал включаться после нескольких открытий).
- Скролл панелей не «утекает» в жесты Telegram и на canvas сцены:
  `overscroll-behavior: contain` + `touch-action: pan-y` на всех
  прокручиваемых блоках; часы на телефоне — фиксированная высота,
  панель скроллится внутри себя.

## Визуальная проверка без телефона

Headless Chrome умеет рендерить сцену (WebGL через SwiftShader) — удобно
проверять вёрстку и рендер до деплоя:

```bash
npm run dev:dashboard   # или dev:telegram
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --use-angle=swiftshader --hide-scrollbars \
  --window-size=390,844 --virtual-time-budget=12000 \
  --screenshot=/tmp/shot.png http://localhost:5185/
```

`--window-size=390,844` — телефонная раскладка, `1280,800` — десктопная.
Старый `--headless` (без `=new`) WebGL не рендерит — будет пустой фон.
