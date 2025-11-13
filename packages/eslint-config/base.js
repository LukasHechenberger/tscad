import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import jsdocPlugin from 'eslint-plugin-jsdoc';
import onlyWarn from 'eslint-plugin-only-warn';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tsdocPlugin from 'eslint-plugin-tsdoc';
import turboPlugin from 'eslint-plugin-turbo';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

/** A shared ESLint configuration for the repository. */
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
    plugins: {
      tsdoc: tsdocPlugin,
      jsdoc: jsdocPlugin,
    },
    rules: {
      'tsdoc/syntax': 'error',
      ...jsdocPlugin.configs['flat/recommended-typescript'].rules,
      'jsdoc/require-returns': 'off',
      'jsdoc/check-examples': 'error',
      'jsdoc/require-params': [
        'error',
        {
          checkDestructured: false,
        },
      ],
    },
    settings: {
      jsdoc: {
        tagNamePreference: {
          default: 'defaultValue',
        },
      },
    },
  },
  {
    ignores: ['dist/**', 'out/**', 'coverage/**', 'tsup.config.bundled*.mjs'],
  },
];
