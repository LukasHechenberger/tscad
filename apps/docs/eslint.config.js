import { nextJsConfig } from '@repo/eslint-config/next-js';

export default [
  ...nextJsConfig,
  {
    rules: {
      'unicorn/prevent-abbreviations': [
        'error',
        {
          allowList: {
            utils: true,
            docs: true,
            Docs: true,
            props: true,
            generateStaticParams: true,
            dynamicParams: true,
          },
        },
      ],
    },
  },
];
