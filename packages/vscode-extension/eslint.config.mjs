import { config as baseConfig } from '@repo/eslint-config/base';

export default [
  ...baseConfig,
  {
    ignores: ['.vscode-test/**'],
  },
];
