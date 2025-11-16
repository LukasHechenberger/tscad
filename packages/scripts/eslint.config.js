import { config as base } from '@repo/eslint-config/base';

export default [
  ...base,
  {
    rules: {
      'unicorn/prevent-abbreviations': [
        'error',
        {
          allowList: {
            docs: true,
            Docs: true,
          },
        },
      ],
    },
  },
];
