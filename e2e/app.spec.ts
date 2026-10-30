import { expect, test, type Page } from '@playwright/test';

async function start(page: Page, target = '2') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Начать матч' }).click();
  await page.getByLabel('Первый игрок', { exact: true }).fill('Анна');
  await page.getByLabel('Второй игрок', { exact: true }).fill('Борис');
  await page.getByLabel('До скольких побед').fill(target);
  await page.getByRole('button', { name: 'К столу' }).click();
  await expect(page.getByRole('heading', { name: 'Фрейм 1', exact: true })).toBeVisible();
}

async function saved(page: Page) {
  await expect(page.getByText('Сохранено на устройстве', { exact: true })).toBeVisible();
}

test('one-tap scoring, undo, foul, reload and responsive layout', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Красный', exact: true }).click();
  await page.getByRole('button', { name: 'Чёрный', exact: true }).click();
  await expect(page.getByTestId('score-0')).toHaveText('8');
  await expect(page.getByTestId('break')).toHaveText('8');
  await page.getByRole('button', { name: 'Отменить' }).click();
  await expect(page.getByTestId('score-0')).toHaveText('1');
  await page.getByRole('button', { name: 'Фол', exact: true }).click();
  await page.getByRole('combobox', { name: 'Штраф', exact: true }).selectOption('5');
  await page.getByRole('button', { name: 'Записать фол' }).click();
  await expect(page.getByTestId('score-1')).toHaveText('5');
  await saved(page);
  await page.reload();
  await expect(page.getByTestId('score-0')).toHaveText('1');
  await expect(page.getByTestId('score-1')).toHaveText('5');

  for (const [width, height] of [
    [320, 720],
    [844, 390],
    [1280, 900],
  ]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }

  await page.getByRole('button', { name: 'Приложение', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Приложение', exact: true })).toBeFocused();
});

test('draft, completion, history and backup roundtrip', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Начать матч' }).click();
  await page.getByLabel('Первый игрок', { exact: true }).fill('Тестовый игрок');
  await saved(page);
  await page.reload();
  await page.getByRole('button', { name: 'Начать матч' }).click();
  await expect(page.getByLabel('Первый игрок', { exact: true })).toHaveValue('Тестовый игрок');
  await page.getByLabel('До скольких побед').fill('1');
  await page.getByRole('button', { name: 'К столу' }).click();
  await page.getByRole('button', { name: 'Красный', exact: true }).click();
  await page.getByRole('button', { name: 'Ещё' }).click();
  await page.getByRole('button', { name: 'Сдача / завершение фрейма' }).click();
  await page.getByRole('button', { name: 'Подтвердить результат' }).click();
  await expect(page.getByRole('heading', { name: 'Хорошая игра.' })).toBeVisible();
  await saved(page);
  await page.getByRole('button', { name: 'Приложение', exact: true }).click();
  const download = page.waitForEvent('download');

  await page.getByRole('button', { name: 'Скачать копию', exact: true }).click();
  const file = await download;
  const path = await file.path();

  if (!path) {
    throw new Error('No backup');
  }

  await page.locator('input[type=file]').setInputFiles(path);
  await expect(page.getByText('Резервная копия объединена с историей.').first()).toBeVisible();
  await page.getByRole('button', { name: 'Закрыть окно' }).click();
  await page.getByRole('link', { name: 'История' }).click();
  await expect(page.getByText('Тестовый игрок / Игрок 2')).toHaveCount(1);
});

test('last black tie, respot and winning foul', async ({ page }) => {
  await start(page, '1');
  await page.getByRole('button', { name: 'Ещё' }).click();
  await page.getByRole('button', { name: 'Исправить счёт и стол' }).click();
  await page.getByLabel('Анна', { exact: true }).fill('20');
  await page.getByLabel('Борис', { exact: true }).fill('27');
  await page.getByLabel('Осталось красных').fill('0');
  await page.getByLabel('Очередной шар').selectOption('7');
  await page.getByRole('button', { name: 'Сохранить исправление' }).click();
  await page.getByRole('button', { name: 'Чёрный', exact: true }).click();
  await page.getByRole('button', { name: 'Разыграть чёрный' }).click();
  await page.getByRole('combobox', { name: 'Начинает', exact: true }).selectOption('1');
  await page.getByRole('dialog').getByRole('button', { name: 'Разыграть чёрный' }).click();
  await page.getByRole('button', { name: 'Фол', exact: true }).click();
  await page.getByRole('combobox', { name: 'Штраф', exact: true }).selectOption('7');
  await page.getByRole('button', { name: 'Записать фол' }).click();
  await expect(page.getByTestId('score-0')).toHaveText('34');
  await page.getByRole('button', { name: 'Подтвердить результат' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Подтвердить результат' }).click();
  await expect(page.getByText('Победитель — Анна')).toBeVisible();
});

test('stale tabs cannot overwrite the current score', async ({ page, context }) => {
  await start(page);
  await saved(page);
  const second = await context.newPage();

  await second.goto('/');
  await saved(second);
  await page.getByRole('button', { name: 'Красный', exact: true }).click();
  await saved(page);
  await second.getByRole('button', { name: 'Красный', exact: true }).click();
  await expect(second.getByRole('alert')).toContainText('другом окне');
  await second.reload();
  await expect(second.getByTestId('score-0')).toHaveText('1');
});

test('failed write stays visibly unsaved and retry saves the actual input', async ({ page }) => {
  await start(page);
  await saved(page);
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;

    IDBDatabase.prototype.transaction = function (...args: Parameters<typeof original>) {
      if (this.name === 'snooker-score:library' && args[1] === 'readwrite') {
        throw new DOMException('Синтетическая ошибка записи', 'QuotaExceededError');
      }

      return original.apply(this, args);
    };

    Object.assign(window, {
      restoreStorage: () => {
        IDBDatabase.prototype.transaction = original;
      },
    });
  });
  await page.getByRole('button', { name: 'Красный', exact: true }).click();
  await expect(page.getByTestId('score-0')).toHaveText('1');
  await expect(page.getByRole('alert')).toContainText('Синтетическая ошибка записи');
  await expect(page.getByText('Сохранено на устройстве', { exact: true })).not.toBeVisible();
  await page.evaluate(() => (window as unknown as { restoreStorage: () => void }).restoreStorage());
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  await saved(page);
  await page.reload();
  await expect(page.getByTestId('score-0')).toHaveText('1');
});

test('corrupt storage is retained, not silently reset', async ({ page }) => {
  await start(page);
  await saved(page);
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open('snooker-score:library');

      r.onsuccess = () => {
        const db = r.result;
        const tx = db.transaction('meta', 'readwrite');

        tx.objectStore('meta').put({ version: 99, revision: 4 }, 'library');

        tx.oncomplete = () => {
          db.close();
          resolve();
        };

        tx.onabort = () => reject(tx.error);
      };
    });
  });
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('повреждённые данные');
  expect(
    await page.evaluate(
      async () =>
        new Promise((resolve) => {
          const r = indexedDB.open('snooker-score:library');

          r.onsuccess = () => {
            const db = r.result;
            const get = db.transaction('meta').objectStore('meta').get('library');

            get.onsuccess = () => {
              db.close();
              resolve(get.result.version);
            };
          };
        }),
    ),
  ).toBe(99);
});
