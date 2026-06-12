// Сценарии «сломай мир»: модификации поверх текущего снимка Солнечной системы.

import type { Vec3 } from '@space/core';
import { loadSolarSystem, type SolarBodyInfo } from './solarSystem';
import noJupiter from '../scenarios/no-jupiter.json';
import secondMoon from '../scenarios/second-moon.json';
import starFlyby from '../scenarios/star-flyby.json';
import earthX2 from '../scenarios/earth-x2.json';

interface RemoveMod {
  op: 'remove';
  body: string;
}

interface ScaleMassMod {
  op: 'scaleMass';
  body: string;
  factor: number;
}

interface AddMod {
  op: 'add';
  body: {
    name: string;
    mass: number;
    position: number[];
    velocity: number[];
    radiusKm: number;
    color: string;
  };
}

/** Добавление тела относительно существующего (позиции зависят от даты снимка) */
interface AddRelativeMod {
  op: 'addRelative';
  relativeTo: string;
  body: {
    name: string;
    mass: number;
    offset: number[];
    velocityOffset: number[];
    radiusKm: number;
    color: string;
  };
}

type Modification = RemoveMod | ScaleMassMod | AddMod | AddRelativeMod;

export interface Scenario {
  id: string;
  name: string;
  description: string;
  modifications: Modification[];
}

const BASE: Scenario = {
  id: 'base',
  name: 'Солнечная система',
  description: 'Реальная система на дату снимка, без изменений.',
  modifications: [],
};

export const SCENARIOS: Scenario[] = [
  BASE,
  noJupiter as Scenario,
  secondMoon as Scenario,
  starFlyby as Scenario,
  earthX2 as Scenario,
];

/** Собрать список тел сценария: свежий снимок + модификации */
export function applyScenario(scenario: Scenario): SolarBodyInfo[] {
  let bodies = loadSolarSystem();
  for (const mod of scenario.modifications) {
    switch (mod.op) {
      case 'remove':
        bodies = bodies.filter((b) => b.name !== mod.body);
        break;
      case 'scaleMass': {
        const b = bodies.find((x) => x.name === mod.body);
        if (b) b.mass *= mod.factor;
        break;
      }
      case 'add':
        bodies.push({
          name: mod.body.name,
          mass: mod.body.mass,
          position: [...mod.body.position] as Vec3,
          velocity: [...mod.body.velocity] as Vec3,
          radiusKm: mod.body.radiusKm,
          color: mod.body.color,
        });
        break;
      case 'addRelative': {
        const parent = bodies.find((x) => x.name === mod.relativeTo);
        if (!parent) break;
        bodies.push({
          name: mod.body.name,
          mass: mod.body.mass,
          position: parent.position.map((v, i) => v + mod.body.offset[i]!) as Vec3,
          velocity: parent.velocity.map((v, i) => v + mod.body.velocityOffset[i]!) as Vec3,
          radiusKm: mod.body.radiusKm,
          color: mod.body.color,
        });
        break;
      }
    }
  }
  return bodies;
}
