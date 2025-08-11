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
                      '@insert': {
                        after: 'changesets',
                        data: {
                          name: 'Publish to VSCode Marketplace',
                          run: `if git tag --points-at HEAD | grep tscad-vscode; then
  pnpm --prefix=packages/vscode-extension vscode:publish
else
  echo "No new tscad-vscode release found (tags: '$(git tag --points-at HEAD)')"
fi
`,
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
