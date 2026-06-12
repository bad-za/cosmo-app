import { mountDashboard } from 'dashboard/app';
import './style.css';

// ---------- Интеграция с Telegram ----------

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand(); // сразу на всю высоту
  // Свайп вниз сворачивает мини-апп — конфликтует с вращением камеры
  tg.disableVerticalSwipes?.();
  tg.setHeaderColor?.('#05060c');
  tg.setBackgroundColor?.('#05060c');
}

// ---------- Дашборд + мобильная шторка панели ----------

mountDashboard(document.querySelector<HTMLDivElement>('#app')!);

// Панель на телефоне — выдвижная шторка снизу; ручка поверх сцены
const layout = document.querySelector<HTMLElement>('.layout')!;
const handle = document.createElement('button');
handle.className = 'sheet-handle';
layout.classList.add('sheet-collapsed');

function updateHandle(): void {
  const collapsed = layout.classList.contains('sheet-collapsed');
  handle.textContent = collapsed ? '☰ панель' : '✕ свернуть';
}

handle.addEventListener('click', () => {
  layout.classList.toggle('sheet-collapsed');
  updateHandle();
});
updateHandle();
document.querySelector<HTMLElement>('.viewport')!.appendChild(handle);
