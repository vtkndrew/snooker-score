import { expect, test } from '@playwright/test';

const base = '/snooker-score/';

test('offline shell and consented update preserve local storage', async ({
  page,
  context,
  browserName,
}) => {
  await page.goto(base);
  await page.getByRole('button', { name: 'Начать матч' }).click();
  await page.getByRole('button', { name: 'К столу' }).click();
  await page.getByRole('button', { name: 'Красный', exact: true }).click();
  await page.getByRole('button', { name: 'Чёрный', exact: true }).click();
  await expect(page.getByText('Сохранено на устройстве', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Приложение', exact: true }).click();
  await expect(page.getByText('Готово к работе без интернета', { exact: true })).toBeVisible({
    timeout: 20000,
  });
  expect(
    await page.evaluate(async () => new URL((await navigator.serviceWorker.ready).scope).pathname),
  ).toBe(base);
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('snooker-score:fixture');

      request.onupgradeneeded = () => request.result.createObjectStore('data');

      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('data', 'readwrite');

        tx.objectStore('data').put('synthetic', 'value');

        tx.oncomplete = () => {
          db.close();
          resolve();
        };

        tx.onabort = () => reject(tx.error);
      };

      request.onerror = () => reject(request.error);
    });
    const cache = await caches.open('other-app-fixture');

    await cache.put('/other-app/sentinel', new Response('keep'));
  });
  await context.addCookies([
    { name: 'pwa_test_version', value: 'two', url: 'http://127.0.0.1:4175' },
  ]);
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.ready).update();
  });
  await page.getByRole('button', { name: 'Обновить', exact: true }).click();
  await page.getByRole('button', { name: 'Позже' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-pwa-test-build', 'one');
  await page.getByRole('button', { name: 'Обновить', exact: true }).click();
  await page.getByRole('button', { name: 'Обновить и перезапустить' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-pwa-test-build', 'two');

  if (browserName === 'webkit') {
    await context.addCookies([
      { name: 'pwa_test_offline', value: '1', url: 'http://127.0.0.1:4175' },
    ]);
  } else {
    await context.setOffline(true);
  }

  await page.reload();
  await expect(page.getByTestId('score-0')).toHaveText('8');
  await page.getByRole('button', { name: 'Красный', exact: true }).click();
  await expect(page.getByText('Сохранено на устройстве', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('score-0')).toHaveText('9');
  expect(
    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const r = indexedDB.open('snooker-score:fixture');

        r.onsuccess = () => resolve(r.result);
      });

      return new Promise((resolve) => {
        const r = db.transaction('data').objectStore('data').get('value');

        r.onsuccess = () => {
          db.close();
          resolve(r.result);
        };
      });
    }),
  ).toBe('synthetic');
  expect(
    await page.evaluate(async () =>
      Boolean(await (await caches.open('other-app-fixture')).match('/other-app/sentinel')),
    ),
  ).toBe(true);
});
