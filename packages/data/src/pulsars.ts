// Каталог пульсаров: параметры из ATNF psrcat (кэш в pulsars/pulsars.json)
// плюс человеческие описания для UI.

import type { PulsarParams } from '@space/core';
import catalog from '../pulsars/pulsars.json';

export interface PulsarInfo extends PulsarParams {
  /** Короткое имя для UI («Краб», «Вела»...) */
  label: string;
  /** Чем знаменит — одна строка для карточки */
  story: string;
}

// Описания — по B/J-имени из каталога
const STORIES: Record<string, { label: string; story: string }> = {
  'B0531+21': { label: 'Краб', story: 'Родился во вспышке сверхновой 1054 года, которую видели китайские астрономы.' },
  'B0833-45': { label: 'Вела', story: 'Самый яркий гамма-источник неба, остаток сверхновой в созвездии Парусов.' },
  'B1919+21': { label: 'LGM-1', story: 'Первый открытый пульсар (1967): сигнал был так регулярен, что его приняли за маяк инопланетян.' },
  'B1937+21': { label: 'Миллисекундный', story: 'Первый миллисекундный пульсар: 642 оборота в секунду, экватор движется на ~13% скорости света.' },
  'B0329+54': { label: 'Северный маяк', story: 'Самый яркий радиопульсар северного неба, классический «тикающий» звук радиоастрономии.' },
  'J0437-4715': { label: 'Сосед', story: 'Ближайший к Земле миллисекундный пульсар, один из самых стабильных «часов» Вселенной.' },
  'B1257+12': { label: 'Лич', story: 'Возле него в 1992 году нашли первые подтверждённые экзопланеты — раньше, чем у обычных звёзд.' },
};

export const PULSARS: PulsarInfo[] = catalog.pulsars.map((p) => ({
  ...p,
  label: STORIES[p.name]?.label ?? p.name,
  story: STORIES[p.name]?.story ?? '',
}));

/** Источник и дата кэширования каталога (для подписи в UI) */
export const PULSAR_CATALOG_SOURCE = catalog.source;
