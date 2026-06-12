import './style.css';
import { SpaceScene } from '@space/render';
import { mountSimulator } from './sim-app';

// Приложение — тонкая оболочка: раскладка + SpaceScene + сцена «Система»
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <main class="layout">
    <section id="viewport" class="viewport"></section>
    <aside id="panel" class="panel"></aside>
  </main>
`;

const viewport = document.querySelector<HTMLElement>('#viewport')!;
const panel = document.querySelector<HTMLElement>('#panel')!;
mountSimulator(new SpaceScene(viewport), viewport, panel);
