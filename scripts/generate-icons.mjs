import { readFile, mkdir, writeFile } from 'node:fs/promises';

import { chromium } from '@playwright/test';

// Re-render the existing vector logo; no external artwork or image service.
const svg = await readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const output = new URL('../public/icons/', import.meta.url);

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });

try {
  const page = await browser.newPage();

  for (const [name, size, inset] of [
    ['icon-192.png', 192, 0],
    ['icon-512.png', 512, 0],
    ['maskable-512.png', 512, 0.1],
    ['apple-touch-icon.png', 180, 0],
  ]) {
    const png = await page.evaluate(
      async ({ svg, size, inset }) => {
        const canvas = document.createElement('canvas');

        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#101b19';
        ctx.fillRect(0, 0, size, size);
        const logo = new Image();

        logo.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        await logo.decode();
        ctx.drawImage(
          logo,
          size * inset,
          size * inset,
          size * (1 - 2 * inset),
          size * (1 - 2 * inset),
        );

        return canvas.toDataURL('image/png').split(',')[1];
      },
      { svg, size, inset },
    );

    await writeFile(new URL(name, output), Buffer.from(png, 'base64'));
  }
} finally {
  await browser.close();
}
