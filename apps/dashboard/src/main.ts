import './style.css';
import { mountPulsarClock, type PulsarClock } from '@space/clock';
import { PULSARS, type PulsarInfo } from '@space/data';
import { SpaceScene } from '@space/render';
import { mountSimulator } from 'simulator/app';
import { GalaxyView } from './galaxy';

// Пороги переключения масштабов (расстояние камеры до центра)
const TO_GALAXY_DISTANCE = 900; // а.е.: отдалились — система сжимается в точку
const TO_SYSTEM_DISTANCE = 22; // юниты галактики: приблизились к Солнцу — вернулись
const TRANSITION_SEC = 0.9;
// Дистанции камеры после перехода
const GALAXY_CAMERA_DISTANCE = 320;
const SYSTEM_CAMERA_DISTANCE = 18;

// ---------- Разметка ----------

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <main class="layout">
    <section id="viewport" class="viewport">
      <div id="mode-badge" class="mode-badge"></div>
    </section>
    <aside class="panel-host">
      <div id="sim-panel" class="panel"></div>
      <div id="galaxy-panel" class="panel hidden">
        <header class="panel-head"><h1>Галактика</h1></header>
        <p class="galaxy-hint">
          Вокруг — пульсары каталога ATNF на реальных координатах
          (1 деление = 50 св. лет). Каждый мигает в своём ритме,
          замедленном до видимой частоты.
        </p>
        <p class="galaxy-hint">Кликните по пульсару, чтобы открыть его часы.
          Приблизьтесь к Солнцу, чтобы вернуться в систему.</p>
        <nav id="galaxy-list" class="galaxy-list"></nav>
      </div>
    </aside>
  </main>
  <div id="clock-overlay" class="clock-overlay hidden">
    <button id="clock-close" class="clock-close">✕ закрыть</button>
    <div id="clock-host" class="clock-host"></div>
  </div>
`;

const viewport = document.querySelector<HTMLElement>('#viewport')!;
const space = new SpaceScene(viewport);
const simApp = mountSimulator(space, viewport, document.querySelector<HTMLElement>('#sim-panel')!);
const galaxy = new GalaxyView(space.scene);

// ---------- Режимы и плавный переход ----------

type Mode = 'system' | 'galaxy';
let mode: Mode = 'system';
let transition: { to: Mode; t: number } | null = null;

const modeBadge = document.querySelector<HTMLElement>('#mode-badge')!;
const simPanel = document.querySelector<HTMLElement>('#sim-panel')!;
const galaxyPanel = document.querySelector<HTMLElement>('#galaxy-panel')!;

function updateBadge(): void {
  modeBadge.textContent =
    mode === 'system' ? 'Система · отдалитесь, чтобы увидеть галактику' : 'Галактика · кликните по пульсару';
}

function startTransition(to: Mode): void {
  transition = { to, t: 0 };
  galaxy.root.visible = true;
  simApp.view.root.visible = true;
  space.controls.enabled = false;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

function transitionFrame(dtSec: number): void {
  if (!transition) return;
  transition.t = Math.min(1, transition.t + dtSec / TRANSITION_SEC);
  const k = smooth(transition.t);
  const toGalaxy = transition.to === 'galaxy';
  // Система сжимается в точку (или раскрывается из неё), галактика — наоборот
  const sysScale = toGalaxy ? 1 - 0.999 * k : 0.001 + 0.999 * k;
  const galScale = toGalaxy ? 0.05 + 0.95 * k : 1 - 0.95 * k;
  simApp.view.root.scale.setScalar(sysScale);
  galaxy.root.scale.setScalar(galScale);
  // Камера подъезжает к целевой дистанции нового масштаба
  const targetDist = toGalaxy ? GALAXY_CAMERA_DISTANCE : SYSTEM_CAMERA_DISTANCE;
  const dist = space.controls.getDistance();
  const newDist = dist + (targetDist - dist) * Math.min(1, dtSec * 4);
  space.camera.position.setLength(Math.max(newDist, 1e-3));

  if (transition.t >= 1) {
    mode = transition.to;
    transition = null;
    space.controls.enabled = true;
    simApp.setActive(mode === 'system');
    simApp.view.root.scale.setScalar(1);
    galaxy.root.visible = mode === 'galaxy';
    simPanel.classList.toggle('hidden', mode !== 'system');
    galaxyPanel.classList.toggle('hidden', mode !== 'galaxy');
    updateBadge();
  }
}

space.onFrame((dtSec) => {
  if (transition) {
    transitionFrame(dtSec);
    return;
  }
  if (mode === 'galaxy') galaxy.update();
  const dist = space.controls.getDistance();
  if (mode === 'system' && dist > TO_GALAXY_DISTANCE) startTransition('galaxy');
  else if (mode === 'galaxy' && dist < TO_SYSTEM_DISTANCE) startTransition('system');
});

updateBadge();

// ---------- Часы пульсара (оверлей из P2) ----------

const clockOverlay = document.querySelector<HTMLElement>('#clock-overlay')!;
const clockHost = document.querySelector<HTMLElement>('#clock-host')!;
let clock: PulsarClock | null = null;

function openClock(p: PulsarInfo): void {
  clock?.destroy();
  clockOverlay.classList.remove('hidden');
  clock = mountPulsarClock(clockHost, p);
}

document.querySelector<HTMLButtonElement>('#clock-close')!.addEventListener('click', () => {
  clock?.destroy();
  clock = null;
  clockOverlay.classList.add('hidden');
});

// Клик по пульсару в галактике
let downAt: [number, number] | null = null;
space.renderer.domElement.addEventListener('pointerdown', (e) => {
  downAt = [e.clientX, e.clientY];
});
space.renderer.domElement.addEventListener('pointerup', (e) => {
  if (mode !== 'galaxy' || transition || !downAt) return;
  const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
  downAt = null;
  if (moved > 5) return;
  const p = galaxy.pick(e, space.camera, space.renderer.domElement);
  if (p) openClock(p);
});

// Список пульсаров в панели галактики — дублирует клики по сцене
const galaxyList = document.querySelector<HTMLElement>('#galaxy-list')!;
galaxyList.innerHTML = PULSARS.map(
  (p, i) => `
    <button class="pulsar-btn" data-index="${i}">
      <span class="pulsar-btn-name">${p.label}</span>
      <span class="pulsar-btn-period">${(p.distanceKpc * 3261.56).toFixed(0)} св. лет</span>
    </button>`,
).join('');
galaxyList.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.pulsar-btn');
  if (btn) openClock(PULSARS[Number(btn.dataset.index)]!);
});
