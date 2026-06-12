// Звук пульсара через Web Audio.
// Медленные пульсары (< 20 Гц) — дискретные «тики» (короткий шумовой импульс,
// как в записях радиотелескопов). Быстрые — непрерывный тон с частотой вращения:
// Краб жужжит на ~30 Гц, миллисекундный B1937+21 поёт на ~642 Гц.

import { frequencyAt, secondsSinceEpoch, unixMsToMjd, type PulsarParams } from '@space/core';

const FAST_PULSAR_HZ = 20; // граница между «тиками» и «тоном»
const LOOKAHEAD_SEC = 0.2; // на сколько вперёд планируем тики
const SCHEDULER_INTERVAL_MS = 60;

export class PulsarAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private osc: OscillatorNode | null = null;
  private oscGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private schedulerId: number | null = null;
  private nextTickTime = 0; // в координатах ctx.currentTime
  private pulsar: PulsarParams | null = null;
  private _muted = true;

  get muted(): boolean {
    return this._muted;
  }

  /** Включение/выключение звука. Первый вызов создаёт AudioContext (нужен жест пользователя). */
  setMuted(muted: boolean): void {
    this._muted = muted;
    if (!muted && !this.ctx) this.initContext();
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.03);
      if (!muted && this.ctx.state !== 'running') {
        // Пока контекст suspended, ctx.currentTime стоит на месте — планировать
        // тики бесполезно. Запускаем звук только после фактического resume.
        this.ctx.resume().then(() => {
          if (!this._muted) this.restart();
        }).catch(() => {});
        return;
      }
    }
    this.restart();
  }

  setPulsar(p: PulsarParams): void {
    this.pulsar = p;
    this.restart();
  }

  private initContext(): void {
    try {
      this.ctx = new AudioContext();
    } catch {
      // Браузер ограничивает число одновременных AudioContext
      this.ctx = null;
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
    // Буфер белого шума для тиков
    const len = Math.floor(this.ctx.sampleRate * 0.05);
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len / 6));
  }

  /** Останавливает текущий звук и запускает режим, подходящий выбранному пульсару */
  private restart(): void {
    this.stopAll();
    if (!this.ctx || !this.master || !this.pulsar || this._muted) return;
    const freq = frequencyAt(this.pulsar, secondsSinceEpoch(this.pulsar, unixMsToMjd(Date.now())));
    if (freq >= FAST_PULSAR_HZ) this.startTone(freq);
    else this.startTicks();
  }

  private startTone(freq: number): void {
    const ctx = this.ctx!;
    this.osc = ctx.createOscillator();
    this.osc.type = 'sawtooth';
    this.osc.frequency.value = freq;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = Math.max(400, freq * 3);
    this.oscGain = ctx.createGain();
    this.oscGain.gain.value = 0;
    this.oscGain.gain.setTargetAtTime(0.25, ctx.currentTime, 0.1);
    this.osc.connect(lowpass).connect(this.oscGain).connect(this.master!);
    this.osc.start();
  }

  private startTicks(): void {
    const ctx = this.ctx!;
    const p = this.pulsar!;
    // Выравниваем первый тик по абсолютной фазе пульсара: тик — момент целой фазы
    const dt = secondsSinceEpoch(p, unixMsToMjd(Date.now()));
    const phase = dt / p.periodSec - (0.5 * p.periodDot * dt * dt) / (p.periodSec * p.periodSec);
    const period = 1 / frequencyAt(p, dt);
    this.nextTickTime = ctx.currentTime + (1 - (phase % 1)) * period;
    this.schedulerId = window.setInterval(() => {
      while (this.nextTickTime < ctx.currentTime + LOOKAHEAD_SEC) {
        this.scheduleTick(this.nextTickTime);
        this.nextTickTime += period;
      }
    }, SCHEDULER_INTERVAL_MS);
  }

  private scheduleTick(time: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 900;
    band.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.value = 0.9;
    src.connect(band).connect(g).connect(this.master!);
    src.start(Math.max(time, ctx.currentTime));
  }

  /** Полное освобождение: закрыть AudioContext — их число в браузере ограничено,
   *  без close() звук перестаёт включаться после нескольких открытий часов. */
  dispose(): void {
    this._muted = true;
    this.stopAll();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.master = null;
      this.noiseBuffer = null;
    }
  }

  private stopAll(): void {
    if (this.schedulerId !== null) {
      clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
    if (this.osc && this.oscGain && this.ctx) {
      const osc = this.osc;
      this.oscGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      // try: к этому моменту контекст может быть уже закрыт через dispose()
      setTimeout(() => {
        try {
          osc.stop();
        } catch {
          /* контекст закрыт */
        }
      }, 300);
      this.osc = null;
      this.oscGain = null;
    }
  }
}
