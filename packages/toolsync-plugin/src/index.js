import { definePlugin } from '@toolsync/core/plugins';

/// <reference path="./context.d.ts" />

const repoPlugin = definePlugin({
  name: '@repo/toolsync-plugin',
  loadConfig() {
    return {
      config: {
        '@repo/toolsync-plugin': {},
        '@toolsync/builtin/github-actions': {
          workflows: {
            ci: {
              jobs: {
                build: {
                  steps: [
                    {
                      '@update': {
                        id: 'changesets',
                        data: {
                          env: {
                            VSCE_PAT: '${{ secrets.VSCE_PAT }}',
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    };
  },
});

export default repoPlugin;
