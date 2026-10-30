import { expect, it } from 'vitest';

import { validateStored } from './storage';

const isString = (v: unknown): v is string => typeof v === 'string';

it('rejects unknown schemas, revisions and invalid data', () => {
  expect(validateStored({ version: 1, revision: 1, value: 'ok' }, isString).value).toBe('ok');

  for (const bad of [
    null,
    { version: 2, revision: 1, value: 'ok' },
    { version: 1, revision: -1, value: 'ok' },
    { version: 1, revision: 1, value: 42 },
  ]) {
    expect(() => validateStored(bad, isString)).toThrow();
  }
});
