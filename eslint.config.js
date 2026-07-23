import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    ignores: ['**/dist/**'],
  },
  {
    files: ['**/*.{cjs,js,mjs,ts,tsx}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
  ...tseslint.configs.recommended.map(config => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    files: ['apps/api/migrations/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    ...reactHooks.configs.flat['recommended-latest'],
    files: ['apps/frontend/**/*.{ts,tsx}'],
  },
  {
    files: ['apps/frontend/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: [
      '*.{cjs,js}',
      'apps/api/**/*.{cjs,ts}',
      'packages/**/*.ts',
      'apps/frontend/vite.config.ts',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
]);
