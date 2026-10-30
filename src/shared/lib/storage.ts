// A small transactional primitive. Define domain schemas, drafts and migrations
// in entities; never accept unvalidated persisted input as application state.
export type Stored<T> = { version: 1; revision: number; value: T };
export class StorageConflict extends Error {
  constructor() {
    super('Данные изменены в другом окне. Загрузите актуальную версию.');
  }
}

export function validateStored<T>(
  input: unknown,
  validate: (value: unknown) => value is T,
): Stored<T> {
  if (!input || typeof input !== 'object') {
    throw new Error('Повреждённое сохранение.');
  }

  const data = input as Partial<Stored<unknown>>;

  if (
    data.version !== 1 ||
    !Number.isSafeInteger(data.revision) ||
    Number(data.revision) < 1 ||
    !validate(data.value)
  ) {
    throw new Error('Неизвестная версия или повреждение данных.');
  }

  return { version: 1, revision: Number(data.revision), value: data.value };
}

export class LocalStore<T> {
  private db?: Promise<IDBDatabase>;
  constructor(
    private name: string,
    private validate: (value: unknown) => value is T,
  ) {}
  private open() {
    this.db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open(this.name, 1);

      r.onupgradeneeded = () => {
        r.result.createObjectStore('state');
      };

      r.onsuccess = () => {
        r.result.onversionchange = () => {
          r.result.close();
          this.db = undefined;
        };

        resolve(r.result);
      };

      r.onerror = () => {
        this.db = undefined;
        reject(r.error);
      };

      r.onblocked = () => {
        this.db = undefined;
        reject(new Error('Закройте другие окна приложения.'));
      };
    }).catch((error) => {
      this.db = undefined;
      throw error;
    });

    return this.db;
  }
  async read(): Promise<Stored<T> | null> {
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('state');
      const r = tx.objectStore('state').get('current');
      let result: Stored<T> | null = null;

      r.onsuccess = () => {
        try {
          result = r.result === undefined ? null : validateStored(r.result, this.validate);
        } catch (e) {
          reject(e);
        }
      };

      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(tx.error);

      tx.onerror = () => {};
    });
  }
  async write(expectedRevision: number, value: T): Promise<number> {
    if (!this.validate(value)) {
      throw new Error('Неверные данные.');
    }

    const db = await this.open();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('state', 'readwrite');
      const store = tx.objectStore('state');
      const r = store.get('current');
      let failure: unknown = null;

      r.onsuccess = () => {
        try {
          const previous = r.result === undefined ? null : validateStored(r.result, this.validate);

          if ((previous?.revision ?? 0) !== expectedRevision) {
            throw new StorageConflict();
          }

          store.put({ version: 1, revision: expectedRevision + 1, value }, 'current');
        } catch (e) {
          failure = e;
          tx.abort();
        }
      };

      tx.oncomplete = () => resolve(expectedRevision + 1);
      tx.onabort = () => reject(failure ?? tx.error);

      tx.onerror = () => {};
    });
  }
}
