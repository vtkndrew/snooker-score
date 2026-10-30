import { project, validSetup, type Match, type Setup } from './game';

export type Draft = Setup;
export type Library = { matches: Match[]; draft: Draft };
export const defaultDraft: Draft = {
  names: ['Игрок 1', 'Игрок 2'],
  reds: 15,
  target: 2,
  starter: 0,
};
export const emptyLibrary = (): Library => ({ matches: [], draft: structuredClone(defaultDraft) });

export function validMatch(input: unknown): input is Match {
  if (!input || typeof input !== 'object') {
    return false;
  }

  const m = input as Match;

  if (
    m.version !== 1 ||
    typeof m.id !== 'string' ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(m.id) ||
    typeof m.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(m.createdAt)) ||
    !validSetup(m.setup) ||
    !Array.isArray(m.events) ||
    m.events.length > 50000
  ) {
    return false;
  }

  try {
    for (const event of m.events) {
      if (!event || typeof event.at !== 'string' || !Number.isFinite(Date.parse(event.at))) {
        return false;
      }
    }

    project(m);

    return true;
  } catch {
    return false;
  }
}

export function validLibrary(value: unknown): value is Library {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const lib = value as Library;

  return (
    Boolean(lib.draft) &&
    Array.isArray(lib.draft.names) &&
    lib.draft.names.every((n) => typeof n === 'string' && n.length <= 40) &&
    validSetup({ ...lib.draft, names: lib.draft.names.map((n) => n || 'Игрок') }) &&
    Array.isArray(lib.matches) &&
    lib.matches.every(validMatch) &&
    new Set(lib.matches.map((m) => m.id)).size === lib.matches.length &&
    lib.matches.filter((m) => project(m).winner === null).length <= 1
  );
}

export function exportBackup(library: Library) {
  return JSON.stringify(
    {
      application: 'snooker-score',
      version: 1,
      exportedAt: new Date().toISOString(),
      matches: library.matches,
    },
    null,
    2,
  );
}

export function mergeBackup(library: Library, text: string): Library {
  if (text.length > 20000000) {
    throw new Error('Файл больше 20 МБ.');
  }

  const input = JSON.parse(text);

  if (
    !input ||
    input.application !== 'snooker-score' ||
    input.version !== 1 ||
    !validLibrary({ matches: input.matches, draft: defaultDraft })
  ) {
    throw new Error('Неизвестная версия или повреждённая копия. Данные не изменены.');
  }

  const matches = [...library.matches];

  for (const match of input.matches as Match[]) {
    const existing = matches.find((m) => m.id === match.id);

    if (existing && canonical(existing) !== canonical(match)) {
      throw new Error(
        `Конфликт матча ${match.setup.names.join(' — ')}. Импорт отменён; текущие данные сохранены.`,
      );
    }

    if (!existing) {
      matches.push(match);
    }
  }

  const merged = { ...library, matches };

  if (!validLibrary(merged)) {
    throw new Error(
      'В копии есть другой незавершённый матч. Завершите или удалите текущий и повторите импорт.',
    );
  }

  return merged;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}
