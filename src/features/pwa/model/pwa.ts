import { useSyncExternalStore } from 'react';

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};
export type PwaState = {
  installed: boolean;
  canInstall: boolean;
  installBusy: boolean;
  installMessage: string | null;
  offline: 'preparing' | 'ready' | 'unavailable' | 'development';
  needRefresh: boolean;
  updateBusy: boolean;
  updateError: string | null;
};

let state: PwaState = {
  installed: false,
  canInstall: false,
  installBusy: false,
  installMessage: null,
  offline: import.meta.env.PROD ? 'preparing' : 'development',
  needRefresh: false,
  updateBusy: false,
  updateError: null,
};
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

const patch = (next: Partial<PwaState>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => {
    listener();
  });
};

export const usePwa = () => useSyncExternalStore(subscribe, () => state);

let started = false;
let installPrompt: InstallPrompt | null = null;
let registration: ServiceWorkerRegistration | undefined;
let lastUpdateCheck = 0;
let reloadRequested = false;
let updateTimeout: number | undefined;
const base = import.meta.env.BASE_URL;
const HOUR = 60 * 60 * 1000;

export function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

async function checkOfflineCache() {
  if (!registration?.active || registration.active.state !== 'activated') {
    return;
  }

  const { scope } = registration;

  try {
    // The active worker proves installation completed. Check our cached shell
    // as well, so an unavailable/cleared cache is never advertised as ready.
    const names = (await caches.keys()).filter(
      (name) => name.startsWith('snooker-score-precache-') && name.endsWith(scope),
    );
    const resources = [
      `${base}index.html`,
      `${base}favicon.svg`,
      `${base}icons/icon-192.png`,
      `${base}icons/icon-512.png`,
      `${base}icons/maskable-512.png`,
      `${base}icons/apple-touch-icon.png`,
      ...[...document.querySelectorAll<HTMLScriptElement>('script[src]')].map((el) => el.src),
      ...[...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map(
        (el) => el.href,
      ),
    ];

    for (const name of names) {
      const cache = await caches.open(name);
      const cached = await Promise.all(
        resources.map((url) =>
          cache.match(new URL(url, location.href).href, { ignoreSearch: true }),
        ),
      );

      if (cached.every(Boolean)) {
        patch({ offline: 'ready' });

        return;
      }
    }

    patch({ offline: 'unavailable' });
  } catch {
    patch({ offline: 'unavailable' });
  }
}

async function checkForUpdate() {
  if (
    !registration ||
    !navigator.onLine ||
    registration.installing ||
    document.visibilityState !== 'visible'
  ) {
    return;
  }

  if (Date.now() - lastUpdateCheck < HOUR) {
    return;
  }

  lastUpdateCheck = Date.now();

  try {
    await registration.update();
  } catch {
    /* Cached use remains available when the server is unreachable. */
  }
}

/** Called once before React mounts, including in StrictMode. */
export function initPwa() {
  if (started) {
    return;
  }

  started = true;
  const standalone = window.matchMedia('(display-mode: standalone)');
  const detectInstalled = () =>
    patch({
      installed:
        standalone.matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
    });

  detectInstalled();
  standalone.addEventListener('change', detectInstalled);
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event as InstallPrompt;
    patch({ canInstall: true, installMessage: null });
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    patch({
      installed: true,
      canInstall: false,
      installBusy: false,
      installMessage: null,
    });
  });

  if (!import.meta.env.PROD) {
    return;
  }

  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    patch({ offline: 'unavailable' });

    return;
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadRequested) {
      const controller = navigator.serviceWorker.controller;

      const reloadWhenActivated = () => {
        if (!reloadRequested || controller?.state !== 'activated') {
          return;
        }

        controller.removeEventListener('statechange', reloadWhenActivated);
        reloadRequested = false;
        window.clearTimeout(updateTimeout);
        location.reload();
      };

      // controllerchange can fire during activation. Reloading at that point
      // may interrupt cache cleanup in WebKit; wait for activation to finish.
      controller?.addEventListener('statechange', reloadWhenActivated);
      reloadWhenActivated();
    } else {
      // Another tab can activate an update. Never reload an ongoing application here.
      patch({ needRefresh: Boolean(registration?.waiting) });
      void checkOfflineCache();
    }
  });
  void navigator.serviceWorker
    .register(`${base}sw.js`, { scope: base, updateViaCache: 'none' })
    .then((reg) => {
      registration = reg;
      // Registration itself checks for an update; returning to the app does not
      // initiate another explicit check until an hour has elapsed.
      lastUpdateCheck = navigator.onLine ? Date.now() : 0;
      patch({ needRefresh: Boolean(reg.waiting) });

      const watch = (worker: ServiceWorker | null) => {
        if (!worker) {
          return;
        }

        const changed = () => {
          if (worker.state === 'installed' && reg.active) {
            patch({ needRefresh: Boolean(reg.waiting) });
          }

          if (worker.state === 'activated') {
            void checkOfflineCache();
          }

          if (worker.state === 'redundant' && !reg.active) {
            patch({ offline: 'unavailable' });
          }
        };

        worker.addEventListener('statechange', changed);
        changed();
      };

      reg.addEventListener('updatefound', () => watch(reg.installing));
      watch(reg.installing);
      watch(reg.active); // A reload can attach while the new worker is still activating.
      void checkOfflineCache();
      document.addEventListener('visibilitychange', () => {
        void checkForUpdate();
      });
      window.addEventListener('online', () => {
        void checkForUpdate();
      });
    })
    .catch(() => patch({ offline: 'unavailable' }));
}

export async function installApp() {
  if (!installPrompt || state.installBusy) {
    return;
  }

  const prompt = installPrompt;

  installPrompt = null; // Each browser event can be used exactly once.
  patch({ canInstall: false, installBusy: true, installMessage: null });

  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;

    patch({
      installMessage:
        choice.outcome === 'accepted'
          ? 'Установка подтверждена. Ищите значок приложения на главном экране.'
          : 'Установка отменена. Можно установить приложение позже через меню браузера.',
    });
  } catch {
    patch({
      installMessage: 'Не удалось открыть установку. Попробуйте через меню браузера.',
    });
  } finally {
    patch({ installBusy: false });
  }
}

export function applyUpdate() {
  if (state.updateBusy) {
    return;
  }

  const waiting = registration?.waiting;

  if (!waiting) {
    patch({
      updateError: 'Обновление пока недоступно. Закройте это окно и попробуйте позже.',
      needRefresh: false,
    });

    return;
  }

  reloadRequested = true;
  patch({ updateBusy: true, updateError: null });
  updateTimeout = window.setTimeout(() => {
    reloadRequested = false;
    patch({
      updateBusy: false,
      updateError: 'Не удалось применить обновление. Попробуйте ещё раз.',
    });
  }, 15_000);
  waiting.postMessage({ type: 'SKIP_WAITING' });
}
