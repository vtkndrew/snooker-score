import { mkdtemp, readFile, rm, cp } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, extname, resolve, sep } from 'node:path';

import { build } from 'vite';

// Two real production builds, served at the same URL in isolated browser
// contexts. A cookie selects the deployed version without changing source files.
const temp = await mkdtemp(join(tmpdir(), 'snooker-score-pwa-'));

for (const version of ['one', 'two']) {
  if (version === 'one' && process.env.PWA_BASELINE_DIR) {
    await cp(resolve(process.env.PWA_BASELINE_DIR), join(temp, version), {
      recursive: true,
    });
    continue;
  }

  await build({
    logLevel: 'warn',
    plugins: [
      {
        name: 'test-build-marker',
        transform(code, id) {
          if (id.endsWith('/src/main.tsx')) {
            return `${code}\ndocument.documentElement.dataset.pwaTestBuild = ${JSON.stringify(version)};`;
          }
        },
      },
    ],
    build: { outDir: join(temp, version), emptyOutDir: true },
  });
}

const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:4175');

  if (url.pathname === '/health') {
    res.end('ready');

    return;
  }

  if (/(?:^|;\s*)pwa_test_offline=1(?:;|$)/.test(req.headers.cookie || '')) {
    res.destroy();

    return;
  }

  if (!url.pathname.startsWith('/snooker-score/')) {
    res.writeHead(404);
    res.end('outside application');

    return;
  }

  const version = /(?:^|;\s*)pwa_test_version=two(?:;|$)/.test(req.headers.cookie || '')
    ? 'two'
    : 'one';
  const root = join(temp, version);
  const relative = decodeURIComponent(url.pathname.slice('/snooker-score/'.length)) || 'index.html';
  const file = resolve(root, relative);

  if (!file.startsWith(root + sep)) {
    res.writeHead(403);
    res.end();

    return;
  }

  try {
    const body = await readFile(file);

    res.writeHead(200, {
      'Content-Type': types[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(4175, '127.0.0.1', () =>
  console.info('PWA test builds ready on http://127.0.0.1:4175/snooker-score/'),
);
let closing = false;

async function close() {
  if (closing) {
    return;
  }

  closing = true;
  server.close();
  server.closeAllConnections();
  await rm(temp, { recursive: true, force: true });
  process.exit(0);
}

process.on('SIGINT', close);
process.on('SIGTERM', close);
