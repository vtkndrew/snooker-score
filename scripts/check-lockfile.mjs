import { readFile } from 'node:fs/promises';

// Uses only Node built-ins so CI can run this before installing dependencies.
const lockfile = process.argv[2] ?? new URL('../package-lock.json', import.meta.url);

try {
  const lock = JSON.parse(await readFile(lockfile, 'utf8'));

  if (
    lock.lockfileVersion !== 3 ||
    !lock.packages ||
    typeof lock.packages !== 'object' ||
    Array.isArray(lock.packages)
  ) {
    throw new Error('Ожидается package-lock.json версии 3 с разделом packages.');
  }

  const invalid = [];
  let count = 0;

  for (const [location, pkg] of Object.entries(lock.packages)) {
    if (location === '') {
      continue;
    } // The root project is not downloaded.

    count++;

    try {
      const url = new URL(pkg.resolved);

      if (
        url.protocol !== 'https:' ||
        url.host !== 'registry.npmjs.org' ||
        url.username ||
        url.password
      ) {
        throw new Error('unexpected registry');
      }
    } catch {
      // Do not print untrusted URLs, which could contain credentials.
      invalid.push(location);
    }
  }

  if (invalid.length) {
    throw new Error(
      `Разрешены только HTTPS-адреса registry.npmjs.org. Исправьте resolved у пакетов:\n${invalid.map((name) => `  - ${name}`).join('\n')}`,
    );
  }

  console.info(`Lock-файл проверен: ${count} пакетов используют публичный npm registry.`);
} catch (error) {
  console.error(`Проверка lock-файла не пройдена: ${error.message}`);
  process.exitCode = 1;
}
