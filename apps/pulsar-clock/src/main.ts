import './style.css';
import { mountPulsarClock } from '@space/clock';

// Приложение — тонкая оболочка: звёздный фон + компонент часов из @space/clock
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<canvas id="stars"></canvas><div id="clock" class="clock-host"></div>`;

// ---------- Звёздный фон (рисуется один раз на canvas) ----------

const stars = document.querySelector<HTMLCanvasElement>('#stars')!;
function paintStars(): void {
  stars.width = window.innerWidth * devicePixelRatio;
  stars.height = window.innerHeight * devicePixelRatio;
  const g = stars.getContext('2d')!;
  g.clearRect(0, 0, stars.width, stars.height);
  for (let i = 0; i < 220; i++) {
    const r = (Math.random() * 1.1 + 0.2) * devicePixelRatio;
    g.globalAlpha = Math.random() * 0.7 + 0.1;
    g.fillStyle = '#cdd6ff';
    g.beginPath();
    g.arc(Math.random() * stars.width, Math.random() * stars.height, r, 0, Math.PI * 2);
    g.fill();
  }
}
paintStars();
window.addEventListener('resize', paintStars);

mountPulsarClock(document.querySelector<HTMLElement>('#clock')!);
