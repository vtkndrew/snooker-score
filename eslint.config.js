import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import ascii from 'eslint-plugin-ascii';
import importPlugin from 'eslint-plugin-import';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const blocks = ['block-like', 'function', 'if', 'for', 'while', 'do', 'switch', 'try'];

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    'dist/**',
    'coverage/**',
    'test-results/**',
    'test-results-pwa/**',
    'playwright-report/**',
  ]),
  js.configs.recommended,
  { files: ['**/*.{ts,tsx}'], extends: [tseslint.configs.recommended] },
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    plugins: { ascii, import: importPlugin, '@stylistic': stylistic },
    settings: {
      'import/resolver': { typescript: { project: './tsconfig.json' }, node: true },
      'import/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx'] },
    },
    rules: {
      'ascii/valid-name': 'error',
      'array-callback-return': ['error', { allowImplicit: false, checkForEach: true }],
      'block-scoped-var': 'error',
      camelcase: [
        'error',
        {
          ignoreDestructuring: false,
          ignoreGlobals: false,
          ignoreImports: false,
          properties: 'never',
        },
      ],
      complexity: 'off',
      'dot-notation': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'max-depth': ['warn', 4],
      'max-params': ['error', 5],
      'newline-after-var': 'off',
      'no-caller': 'error',
      'no-cond-assign': ['error', 'except-parens'],
      'no-console': ['error', { allow: ['warn', 'error', 'debug', 'info'] }],
      'no-const-assign': 'error',
      'no-constant-condition': 'error',
      'no-debugger': 'error',
      'no-dupe-args': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-else-return': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-eq-null': 'off',
      'no-extra-bind': 'error',
      'no-extra-boolean-cast': 'error',
      'no-func-assign': 'error',
      'no-implicit-coercion': 'error',
      'no-lonely-if': 'error',
      'no-nested-ternary': 'error',
      'no-new': 'error',
      'no-param-reassign': 'error',
      'no-restricted-globals': ['error', 'fdescribe', 'fit'],
      'no-return-assign': 'off',
      'no-sequences': 'error',
      'no-sparse-arrays': 'error',
      'no-undef': 'off',
      'no-unneeded-ternary': 'error',
      'no-unreachable': 'error',
      'no-unused-expressions': 'off',
      'no-use-before-define': 'off',
      'no-var': 'warn',
      'no-warning-comments': ['error', { location: 'anywhere', terms: ['FIXME'] }],
      'one-var': ['error', { const: 'never', let: 'never' }],
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
        { blankLine: 'any', prev: ['const', 'let', 'var'], next: ['const', 'let', 'var'] },
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: '*', next: blocks },
        { blankLine: 'always', prev: blocks, next: '*' },
      ],
      'prefer-const': ['error', { destructuring: 'all', ignoreReadBeforeAssign: true }],
      'use-isnan': 'error',
      yoda: 'error',
      'import/no-named-as-default': 'off',
      'import/first': 'warn',
      'import/no-anonymous-default-export': [
        'warn',
        {
          allowAnonymousClass: false,
          allowAnonymousFunction: false,
          allowArray: true,
          allowArrowFunction: false,
          allowCallExpression: true,
          allowLiteral: true,
          allowObject: true,
        },
      ],
      'import/no-cycle': 'error',
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: [
            '**/*.test.ts',
            'e2e/**',
            'pwa-tests/**',
            'scripts/**',
            '*.config.{js,ts}',
          ],
        },
      ],
      'import/no-useless-path-segments': 'error',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
          pathGroups: [{ pattern: '@/**', group: 'internal' }],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
          warnOnUnassignedImports: false,
        },
      ],
      'import/no-duplicates': ['error', { 'prefer-inline': true }],
      'import/newline-after-import': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': false, 'ts-ignore': true, 'ts-nocheck': true, 'ts-check': false },
      ],
      '@typescript-eslint/consistent-type-assertions': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
          vars: 'all',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-use-before-define': [
        'error',
        { functions: false, ignoreTypeReferences: true },
      ],
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        { accessibility: 'no-public', overrides: { parameterProperties: 'explicit' } },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      'react/display-name': 'off',
      'react/jsx-handler-names': 'off',
      'react/jsx-no-literals': 'off',
      'react/jsx-sort-props': 'off',
      'react/no-multi-comp': 'off',
      'react/no-set-state': 'off',
      'react/prop-types': 'off',
      'react/require-optimization': 'off',
      'react/forbid-prop-types': [
        'error',
        {
          checkChildContextTypes: true,
          checkContextTypes: true,
          forbid: ['any', 'array', 'object'],
        },
      ],
      'react/jsx-boolean-value': 'error',
      'react/jsx-curly-brace-presence': ['error', { children: 'never', props: 'never' }],
      'react/jsx-no-bind': ['error', { ignoreDOMComponents: true }],
      'react/self-closing-comp': 'error',
      'react/style-prop-object': 'error',
      'react/void-dom-elements-no-children': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['*.{js,ts}', 'scripts/**/*.mjs', 'e2e/**/*.ts', 'pwa-tests/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // Playwright callbacks execute in the browser, while their harness uses Node.
    files: ['e2e/**/*.ts', 'pwa-tests/**/*.ts', 'scripts/generate-icons.mjs'],
    languageOptions: { globals: globals.browser },
  },
  prettier,
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    // eslint-config-prettier disables curly; the 'all' option is compatible with Prettier.
    rules: { curly: ['error', 'all'] },
  },
]);
