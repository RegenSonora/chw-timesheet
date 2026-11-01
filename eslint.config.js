import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist/', 'coverage/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['src/**'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['scripts/**', 'tests/**', 'e2e/**', '*.config.*'],
    languageOptions: { globals: globals.node },
  },
  {
    // CLAUDE.md rule 4: src/core is plain functions with no DOM or storage imports.
    files: ['src/core/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['preact', 'preact/*'], message: 'src/core must not import UI code.' },
            {
              group: [
                '**/storage',
                '**/storage/**',
                '**/ui',
                '**/ui/**',
                '**/files',
                '**/files/**',
              ],
              message: 'src/core must not import storage, UI or file code.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...['window', 'document', 'indexedDB', 'localStorage', 'sessionStorage', 'navigator'].map(
          (name) => ({ name, message: 'src/core must not touch the DOM or storage.' }),
        ),
      ],
    },
  },
  {
    // File writers are pure too: an invoice in, bytes out (src/files/README.md).
    files: ['src/files/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['preact', 'preact/*'], message: 'src/files must not import UI code.' },
            {
              group: ['**/storage', '**/storage/**', '**/ui', '**/ui/**'],
              message: 'src/files must not import storage or UI code.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...['window', 'document', 'indexedDB', 'localStorage', 'sessionStorage', 'navigator'].map(
          (name) => ({ name, message: 'src/files must not touch the DOM or storage.' }),
        ),
      ],
    },
  },
  prettier,
);
