import './style.css';
import { G } from '@space/core';

// Этап 0: пустая страница-заглушка. Импорт из @space/core
// заодно проверяет, что связка пакетов монорепозитория работает.
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <main>
    <h1>Пульсар-часы</h1>
    <p>Этап 0 — каркас готов (G = ${G.toFixed(3)})</p>
  </main>
`;
