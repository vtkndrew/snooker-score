import { useState } from 'react';

import { usePwa, isIOS, installApp, applyUpdate } from '../model/pwa';

export function PwaPanel({ beforeUpdate }: { beforeUpdate: () => Promise<void> }) {
  const pwa = usePwa();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const update = async () => {
    setSaving(true);
    setError('');

    try {
      await beforeUpdate();
      applyUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить данные.');
    } finally {
      setSaving(false);
    }
  };

  let offline = 'Подготовка офлайн-доступа…';

  if (pwa.offline === 'ready') {
    offline = 'Готово к работе без интернета';
  }

  if (pwa.offline === 'unavailable') {
    offline = 'Офлайн-кеш пока недоступен. Откройте приложение с интернетом и повторите позже.';
  }

  if (pwa.offline === 'development') {
    offline = 'Офлайн-доступ включён только в опубликованной версии.';
  }

  return (
    <section>
      <p role="status">{offline}</p>
      {pwa.installed ? (
        <p>Приложение установлено</p>
      ) : (
        <>
          <h3>На главный экран</h3>
          {pwa.canInstall ? (
            <button
              className="primary"
              disabled={pwa.installBusy}
              onClick={() => void installApp()}
            >
              Установить
            </button>
          ) : (
            <p>
              {isIOS()
                ? 'Откройте сайт в Safari → «Поделиться» → «На экран “Домой”». Оставьте «Открывать как веб-приложение» включённым.'
                : 'В меню браузера выберите «Установить приложение» или «Добавить на главный экран». Если пункта нет, попробуйте другой поддерживаемый браузер.'}
            </p>
          )}
        </>
      )}
      {pwa.installMessage && <p role="status">{pwa.installMessage}</p>}
      {pwa.needRefresh && (
        <>
          <h3>Доступно обновление</h3>
          {confirm ? (
            <>
              <p>Приложение перезапустится. Локальные данные останутся на устройстве.</p>
              <div className="actions">
                <button
                  className="primary"
                  disabled={saving || pwa.updateBusy}
                  onClick={() => void update()}
                >
                  Обновить и перезапустить
                </button>
                <button disabled={saving || pwa.updateBusy} onClick={() => setConfirm(false)}>
                  Позже
                </button>
              </div>
            </>
          ) : (
            <button onClick={() => setConfirm(true)}>Обновить</button>
          )}
        </>
      )}
      {(error || pwa.updateError) && <p role="alert">{error || pwa.updateError}</p>}
      <h3>Ваши данные</h3>
      <p>
        Хранятся только в этом браузере или установленном приложении, без шифрования и
        синхронизации. Очистка данных браузера удаляет записи. Предусмотрите резервную копию важных
        данных.
      </p>
      <p>
        Safari и приложение на iPhone могут использовать разные хранилища. Для переноса используйте
        экспорт и импорт. После аварийного закрытия восстанавливается последнее успешно сохранённое
        состояние.
      </p>
    </section>
  );
}
