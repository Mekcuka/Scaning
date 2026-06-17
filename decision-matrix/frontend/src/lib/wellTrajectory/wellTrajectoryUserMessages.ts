/** Пользовательские сообщения траекторий / забоев (API + legacy EN). */

import { GS_HEEL_LABEL, GS_TOE_LABEL } from '../wellBottomholeProperties';

const EN_TO_RU: Record<string, string> = {
  'No trajectories; run generate-from-layout first':
    'Нет заготовок траекторий; сначала выполните «Из схемы куста»',
  'No trajectories stored': 'Нет сохранённых траекторий',
  'No trajectories stored; run generate-from-layout first':
    'Нет траекторий; сначала выполните «Из схемы куста»',
  'No clearance pairs to compute': 'Нет пар для расчёта антиколлизии',
  'Pad not found': 'Куст не найден',
  'Well has no survey stations to design from':
    'У скважины нет станций инклинометрии для расчёта',
  'target requires plan or lon/lat': 'Цель забоя: укажите координаты на карте или в плане',
  'Need at least 2 wells with survey ≥ 2 stations for clearance':
    'Для расчёта SF нужны минимум 2 скважины с инклинометрией (≥ 2 станций)',
};

const EN_PATTERNS: { re: RegExp; repl: (m: RegExpMatchArray) => string }[] = [
  {
    re: /^Duplicate NNB bottomhole for well_index (\d+)$/,
    repl: (m) => `Скв.${Number(m[1]) + 1}: дубликат забоя ННБ`,
  },
  {
    re: /^Duplicate GS heel for well_index (\d+)$/,
    repl: (m) => `Скв.${Number(m[1]) + 1}: дубликат ${GS_HEEL_LABEL} ГС`,
  },
  {
    re: /^GS toe (.+) has no gs_heel_id$/,
    repl: () => `${GS_TOE_LABEL} ГС без привязки к ${GS_HEEL_LABEL}`,
  },
  {
    re: /^Duplicate toe for heel (.+)$/,
    repl: () => `Дубликат ${GS_TOE_LABEL} для одного ${GS_HEEL_LABEL} ГС`,
  },
  {
    re: /^well_index (\d+): more than expected bottomhole objects$/,
    repl: (m) => `Скв.${Number(m[1]) + 1}: слишком много объектов-забоев`,
  },
  {
    re: /^well_index (\d+): GS heel without paired toe$/,
    repl: (m) => `Скв.${Number(m[1]) + 1}: ${GS_HEEL_LABEL} ГС без парного ${GS_TOE_LABEL}`,
  },
  {
    re: /^well_index (\d+): design failed$/,
    repl: (m) => `Скв.${Number(m[1]) + 1}: не удалось спроектировать траекторию`,
  },
  {
    re: /^Well (\d+) has no survey stations$/,
    repl: (m) => `Скв.${Number(m[1]) + 1}: нет станций инклинометрии`,
  },
  {
    re: /^well_index (\d+) out of range$/,
    repl: (m) => `Индекс скважины ${m[1]} вне диапазона`,
  },
  {
    re: /^well_index (\d+) out of range \(have (\d+) wells\)$/,
    repl: (m) => `Индекс скважины ${m[1]} вне диапазона (всего ${m[2]} скважин)`,
  },
  {
    re: /^(\d+) of (\d+) wells have no bottomhole target$/,
    repl: (m) => `${m[1]} из ${m[2]} скважин без цели (забоя)`,
  },
  {
    re: /^Anti-collision \(SF\) not computed; run clearance after design$/,
    repl: () =>
      'Антиколлизия (SF) не рассчитана; выполните «Рассчитать SF» после проектирования',
  },
  {
    re: /^(.+): min SF ([\d.]+) < ([\d.]+)$/,
    repl: (m) => `${m[1]}: мин. SF ${m[2]} < порога ${m[3]}`,
  },
  {
    re: /^pad_well_count \((\d+)\) != len\(pad_wells_local_json\) \((\d+)\)$/,
    repl: (m) =>
      `Число скважин на кусте (${m[1]}) не совпадает с раскладкой устьев (${m[2]})`,
  },
  {
    re: /^Well trajectory is only available for subtypes: \[(.+)\]$/,
    repl: (m) => `Траектории доступны только для кустов: ${m[1]}`,
  },
];

/** Переводит предупреждение или текст ошибки API на русский (если ещё на EN). */
export function translateWellTrajectoryUserMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return trimmed;
  const exact = EN_TO_RU[trimmed];
  if (exact) return exact;
  for (const { re, repl } of EN_PATTERNS) {
    const match = trimmed.match(re);
    if (match) return repl(match);
  }
  return trimmed;
}
