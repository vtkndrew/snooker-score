import { StorageConflict } from '@/shared/lib';

import { emptyLibrary, validLibrary, type Library } from '../model/validation';

export const DB_NAME = 'snooker-score:library';
export class MatchRepository {
  private connection?: Promise<IDBDatabase>;
  private open() {
    this.connection ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = () => {
        request.result.createObjectStore('matches', { keyPath: 'id' });
        request.result.createObjectStore('meta');
      };

      request.onsuccess = () => {
        const db = request.result;

        db.onversionchange = () => {
          db.close();
          this.connection = undefined;
        };

        resolve(db);
      };

      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Закройте другие окна приложения.'));
    }).catch((error) => {
      this.connection = undefined;
      throw error;
    });

    return this.connection;
  }
  async read(): Promise<{ revision: number; value: Library }> {
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['matches', 'meta']);
      const matches = tx.objectStore('matches').getAll();
      const meta = tx.objectStore('meta').get('library');

      tx.oncomplete = () => {
        try {
          const revision = meta.result?.revision ?? 0;
          const value = {
            matches: matches.result,
            draft: meta.result?.draft ?? emptyLibrary().draft,
          };

          if (
            (meta.result && meta.result.version !== 1) ||
            (!meta.result && matches.result.length > 0) ||
            !Number.isSafeInteger(revision) ||
            revision < 0 ||
            !validLibrary(value)
          ) {
            throw new Error('Неизвестная версия или повреждённые данные. Хранилище не изменено.');
          }

          resolve({ revision, value });
        } catch (error) {
          reject(error);
        }
      };

      tx.onabort = () => reject(tx.error);

      tx.onerror = () => {};
    });
  }
  async write(revision: number, value: Library): Promise<number> {
    if (!validLibrary(value)) {
      throw new Error('Некорректные данные.');
    }

    const db = await this.open();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['matches', 'meta'], 'readwrite');
      const meta = tx.objectStore('meta');
      const records = tx.objectStore('matches');
      const head = meta.get('library');
      let failure: unknown;

      head.onsuccess = () => {
        if ((head.result?.revision ?? 0) !== revision) {
          failure = new StorageConflict();
          tx.abort();

          return;
        }

        const all = records.getAll();

        all.onsuccess = () => {
          const previous = new Map(all.result.map((m) => [m.id, JSON.stringify(m)]));

          for (const m of value.matches) {
            if (previous.get(m.id) !== JSON.stringify(m)) {
              records.put(m);
            }

            previous.delete(m.id);
          }

          for (const id of previous.keys()) {
            records.delete(id);
          }

          meta.put({ version: 1, revision: revision + 1, draft: value.draft }, 'library');
        };
      };

      tx.oncomplete = () => resolve(revision + 1);
      tx.onabort = () => reject(failure ?? tx.error ?? new Error('Не удалось сохранить данные.'));

      tx.onerror = () => {};
    });
  }
}
