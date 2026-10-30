import { useCallback, useEffect, useRef, useState } from 'react';

import {
  append,
  createMatch,
  emptyLibrary,
  exportBackup,
  MatchRepository,
  mergeBackup,
  project,
  validSetup,
  type Action,
  type Library,
  type Match,
  type Setup,
} from '@/entities/match';

export type Modal =
  | 'new'
  | 'foul'
  | 'more'
  | 'multiple'
  | 'free'
  | 'correct'
  | 'finish'
  | 'respot'
  | 'delete'
  | 'reload'
  | 'settings'
  | null;
const message = (e: unknown) =>
  e instanceof Error
    ? e.message
    : 'Не удалось сохранить данные. Проверьте доступ к хранилищу и повторите.';

export function download(text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = `snooker-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function useScore() {
  const [library, setLibrary] = useState<Library>(emptyLibrary);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('Загрузка…');
  const [storageError, setStorageError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState<Modal>(null);
  const [route, setRoute] = useState(location.hash.slice(1) || 'game');
  const store = useRef(new MatchRepository());
  const current = useRef(library);
  const revision = useRef(0);
  const generation = useRef(0);
  const savedGeneration = useRef(0);
  const failed = useRef('');
  const loaded = useRef(false);
  const running = useRef<Promise<void> | null>(null);
  const persist = useCallback((): Promise<void> => {
    if (running.current) {
      return running.current;
    }

    if (!loaded.current || failed.current) {
      return Promise.resolve();
    }

    const work = async () => {
      while (savedGeneration.current < generation.current && !failed.current) {
        const value = current.current;
        const at = generation.current;

        setStatus('Сохранение…');

        try {
          revision.current = await store.current.write(revision.current, value);
          savedGeneration.current = at;
        } catch (e) {
          failed.current = message(e);
          setStorageError(failed.current);
          setStatus('Не сохранено');
        }
      }

      if (!failed.current) {
        setStatus('Сохранено на устройстве');
      }
    };

    running.current = work().finally(() => {
      running.current = null;
    });

    return running.current;
  }, []);
  const flush = useCallback(async () => {
    await persist();

    if (!loaded.current || failed.current || savedGeneration.current !== generation.current) {
      throw new Error(failed.current || 'Данные ещё не сохранены.');
    }
  }, [persist]);
  const load = useCallback(async () => {
    try {
      await running.current;
      const result = await store.current.read();

      revision.current = result.revision;
      current.current = result.value;
      generation.current = 0;
      savedGeneration.current = 0;
      failed.current = '';
      loaded.current = true;
      setLibrary(result.value);
      setStorageError('');
      setReady(true);
      setStatus('Сохранено на устройстве');
      setModal(null);
    } catch (e) {
      failed.current = message(e);
      setStorageError(failed.current);
      setStatus('Хранилище недоступно');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const foreground = () => {
      if (document.visibilityState === 'hidden') {
        void persist();
      }
    };

    const pagehide = () => {
      void persist();
    };

    const hash = () => {
      setRoute(location.hash.slice(1) || 'game');
      setError('');
    };

    const unload = (e: BeforeUnloadEvent) => {
      if (generation.current !== savedGeneration.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    document.addEventListener('visibilitychange', foreground);
    window.addEventListener('pagehide', pagehide);
    window.addEventListener('hashchange', hash);
    window.addEventListener('beforeunload', unload);

    return () => {
      document.removeEventListener('visibilitychange', foreground);
      window.removeEventListener('pagehide', pagehide);
      window.removeEventListener('hashchange', hash);
      window.removeEventListener('beforeunload', unload);
    };
  }, [persist]);
  const mutate = useCallback(
    (update: (value: Library) => Library) => {
      if (!loaded.current) {
        throw new Error('Сначала загрузите сохранённые данные.');
      }

      const next = update(current.current);

      current.current = next;
      generation.current += 1;
      setLibrary(next);
      setStatus('Сохранение…');
      void persist();
    },
    [persist],
  );
  const attempt = useCallback((operation: () => void) => {
    setError('');
    setNotice('');

    try {
      operation();
    } catch (e) {
      setError(message(e));
    }
  }, []);
  const active = library.matches.find((m) => project(m).winner === null);
  const selected = route.startsWith('match/')
    ? library.matches.find((m) => m.id === route.slice(6))
    : active;
  const game = selected ? project(selected) : null;
  const show = useCallback((next: Modal) => {
    setError('');
    setModal(next);
  }, []);
  const close = useCallback(() => {
    setError('');
    setModal(null);
  }, []);
  const action = useCallback(
    (next: Action) =>
      attempt(() => {
        let updated: Match | undefined;

        mutate((value) => {
          const match = value.matches.find((m) => project(m).winner === null);

          if (!match) {
            throw new Error('Нет текущего матча.');
          }

          updated = append(match, next);

          return {
            ...value,
            matches: value.matches.map((m) => (m.id === match.id ? (updated as Match) : m)),
          };
        });
        setModal(null);

        if (updated && project(updated).winner !== null) {
          location.hash = `match/${updated.id}`;
        }
      }),
    [attempt, mutate],
  );
  const start = useCallback(
    (setup: Setup) =>
      attempt(() => {
        if (!validSetup(setup)) {
          throw new Error('Введите имена и число побед от 1 до 99.');
        }

        mutate((value) => {
          if (value.matches.some((m) => project(m).winner === null)) {
            throw new Error('Сначала завершите или удалите текущий матч.');
          }

          return { draft: setup, matches: [...value.matches, createMatch(setup)] };
        });
        location.hash = 'game';
        setModal(null);
      }),
    [attempt, mutate],
  );
  const draft = useCallback(
    (setup: Setup) => {
      if (validSetup({ ...setup, names: setup.names.map((n) => n || 'Игрок') })) {
        mutate((value) => ({ ...value, draft: setup }));
      }
    },
    [mutate],
  );
  const undo = useCallback(
    () =>
      attempt(() => {
        if (!selected) {
          return;
        }

        mutate((value) => ({
          ...value,
          matches: value.matches.map((m) =>
            m.id === selected.id ? { ...m, events: m.events.slice(0, -1) } : m,
          ),
        }));
      }),
    [attempt, mutate, selected],
  );
  const remove = useCallback(
    () =>
      attempt(() => {
        if (!selected) {
          return;
        }

        mutate((value) => ({
          ...value,
          matches: value.matches.filter((m) => m.id !== selected.id),
        }));
        setModal(null);
        location.hash = 'history';
        setNotice('Матч удалён.');
      }),
    [attempt, mutate, selected],
  );
  const backup = useCallback(() => {
    if (!loaded.current) {
      setError(
        'Не удалось прочитать хранилище. Исходные данные остаются на устройстве; пустая копия не создана.',
      );

      return;
    }

    download(exportBackup(current.current));
  }, []);
  const importFile = useCallback(
    async (file?: File) => {
      if (!file) {
        return;
      }

      setError('');
      setNotice('');

      try {
        if (file.size > 20000000) {
          throw new Error('Файл больше 20 МБ.');
        }

        const text = await file.text();

        mutate((value) => mergeBackup(value, text));
        await flush();
        setNotice('Резервная копия объединена с историей.');
      } catch (e) {
        setError(message(e));
      }
    },
    [flush, mutate],
  );
  const retry = useCallback(() => {
    if (!loaded.current) {
      void load();

      return;
    }

    failed.current = '';
    setStorageError('');
    void persist();
  }, [load, persist]);

  return {
    library,
    ready,
    status,
    storageError,
    error,
    notice,
    modal,
    route,
    active,
    selected,
    game,
    show,
    close,
    action,
    start,
    draft,
    undo,
    remove,
    backup,
    importFile,
    retry,
    load,
    flush,
  };
}

export type ScoreController = ReturnType<typeof useScore>;
