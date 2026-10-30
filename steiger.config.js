import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  { ignores: ['./src/main.tsx'] }, // HTML entry delegates to app bootstrap.
  { files: ['./src/**'], rules: { 'fsd/insignificant-slice': 'off' } }, // One page composes independently testable scenarios.
]);
