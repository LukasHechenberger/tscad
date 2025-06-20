import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import onlyWarn from 'eslint-plugin-only-warn';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import turboPlugin from 'eslint-plugin-turbo';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = [
  js.configs.recommended,
  eslintConfigPrettier,
  {
    rules: { 'object-shorthand': 'error', 'prefer-template': 'error' },
  },
  {
    ...eslintPluginUnicorn.configs.recommended,
    rules: {
      ...eslintPluginUnicorn.configs.recommended.rules,
      'unicorn/expiring-todo-comments': [
        'error',
        {
          allowWarningComments: false,
        },
      ],
    },
  },
  ...tseslint.configs.recommended,
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      'turbo/no-undeclared-env-vars': 'warn',
    },
  },
  {
    plugins: {
      onlyWarn,
    },
  },
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': [
        'error',
        { groups: [['^node:', String.raw`^@?\w`, '^', String.raw`^\.`, String.raw`^\u0000`]] },
      ],
      'simple-import-sort/exports': 'error',
    },
  },
  {
    ignores: ['dist/**', 'out/**', 'coverage/**', 'tsup.config.bundled*.mjs'],
  },
];
