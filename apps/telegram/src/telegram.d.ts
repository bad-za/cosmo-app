// Минимальные типы SDK Telegram Mini Apps (telegram-web-app.js)
// Только то, что реально используем; полный SDK не тащим.

interface TelegramWebApp {
  ready(): void;
  expand(): void;
  /** Bot API 7.7+: запрет сворачивания мини-аппа свайпом вниз */
  disableVerticalSwipes?(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  viewportStableHeight?: number;
  platform?: string;
}

interface Window {
  Telegram?: { WebApp: TelegramWebApp };
}
