import path from 'node:path';
import { definePlugin } from '@toolsync/core/plugins';
import { MarkdownTemplate } from '@toolsync/template';

/// <reference path="./context.d.ts" />

/** What the Vercel CLI needs to build and deploy the docs; VERCEL_ENVIRONMENT is empty without a token. */
const vercelEnvironment = {
  VERCEL_ENVIRONMENT:
    "${{ secrets.VERCEL_TOKEN && (github.event_name == 'push' && 'production' || 'preview') || '' }}",
  VERCEL_TOKEN: '${{ secrets.VERCEL_TOKEN }}',
  VERCEL_ORG_ID: 'team_CUsc4inFdPEFgUVOoE2fJVlY',
  VERCEL_PROJECT_ID: 'prj_vdXfXOVwGfgYZpfR7kpcbnMay6oA',
};

const repoPlugin = definePlugin({
  name: '@repo/toolsync-plugin',
  loadConfig() {
    return {
      config: {
        '@repo/toolsync-plugin': {},
        // oxfmt and oxlint replace prettier and eslint (`.oxfmtrc.json`, `.oxlintrc.json`); this
        // keeps the format check the prettier builtin used to set up.
        '@toolsync/builtin/turbo': {
          tasks: {
            '//#check:format': {},
            check: {
              dependsOn: ['//#check:format'],
            },
          },
        },
        '@toolsync/builtin/vscode': {
          extensions: {
            recommendations: ['oxc.oxc-vscode'],
          },
        },
        '@toolsync/builtin/github-actions': {
          workflows: {
            ci: {
              // Also pull requests stacked on other branches, not only those into main.
              on: {
                pull_request: { branches: ['**'] },
              },
              jobs: {
                build: {
                  // The kernel's release build (Rust + OCCT) takes a few minutes.
                  'timeout-minutes': 30,
                  // statuses and deployments: the docs deployment's report (deploy-docs)
                  permissions: {
                    contents: 'read',
                    deployments: 'write',
                    statuses: 'write',
                  },
                  steps: [
                    {
                      '@insert': {
                        after: 'install',
                        data: {
                          name: 'Cache Rust builds',
                          uses: 'Swatinem/rust-cache@v2',
                        },
                      },
                    },
                    {
                      '@insert': {
                        after: 'install',
                        data: {
                          name: 'Add the Rust target for plugins',
                          run: 'rustup target add wasm32-unknown-unknown',
                        },
                      },
                    },
                    {
                      '@update': {
                        id: 'checks',
                        data: {
                          run: 'bun --bun turbo check lint test build --continue --summarize',
                          // The docs build runs `vercel build` when VERCEL_ENVIRONMENT is set
                          // (apps/docs/scripts/build.ts), and deploy-docs deploys its output.
                          env: vercelEnvironment,
                        },
                      },
                    },
                    {
                      '@insert': {
                        after: 'checks',
                        data: {
                          name: 'Report Turbo Summary',
                          if: 'always()',
                          uses: 'charpeni/turborepo-summary-action@v1',
                        },
                      },
                    },
                    {
                      // Vercel can't build the docs (the kernel needs Rust, and Docker for the
                      // wasm build), so its git deployments are off (apps/docs/vercel.json): the
                      // checks build them with `vercel build`, this step deploys the output and
                      // reports to the commit what Vercel's GitHub app would: a commit status and
                      // a GitHub deployment with the URL.
                      '@insert': {
                        after: 'ensure-clean',
                        data: {
                          id: 'deploy-docs',
                          name: 'Deploy the docs to Vercel',
                          run: `if [ -z "$VERCEL_ENVIRONMENT" ]; then
  echo "No VERCEL_TOKEN secret, skipping the docs deployment"
  exit 0
fi
if [ "$VERCEL_ENVIRONMENT" = production ]; then
  prod=--prod; name=Production; production=true
else
  prod=; name=Preview; production=false
fi
repo=repos/$GITHUB_REPOSITORY
run_url=$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID
# Previews of other branches stay active; a production deployment replaces the previous one.
deployment=$(printf '{"ref":"%s","environment":"%s","production_environment":%s,"auto_merge":false,"required_contexts":[]}' "$SHA" "$name" "$production" | gh api $repo/deployments --input - --jq .id)
report() { # commit state, description, URL, deployment state
  gh api $repo/statuses/$SHA -f state=$1 -f context="Vercel – tscad" -f description="$2" -f target_url="\${3:-$run_url}" > /dev/null
  gh api $repo/deployments/$deployment/statuses -f state=$4 -f log_url=$run_url \${3:+-f environment_url=$3} -F auto_inactive=$production > /dev/null
}
report pending "Deploying the docs" "" in_progress
trap '[ -n "$url" ] || report failure "The deployment failed" "" failure' EXIT
url=$(bunx vercel@62.1.0 deploy --prebuilt $prod --token=$VERCEL_TOKEN)
report success "Deployed the docs" "$url" success
echo "Docs deployed to $url" >> "$GITHUB_STEP_SUMMARY"
`,
                          env: {
                            ...vercelEnvironment,
                            GH_TOKEN: '${{ github.token }}',
                            // The pushed commit; on pull requests, GITHUB_SHA is a merge commit.
                            SHA: '${{ github.event.pull_request.head.sha || github.sha }}',
                          },
                        },
                      },
                    },
                    {
                      '@insert': {
                        after: 'changesets',
                        data: {
                          name: 'Publish to VSCode Marketplace',
                          run: `if git tag --points-at HEAD | grep tscad-vscode; then
  bun --cwd=packages/vscode-extension vscode:publish
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
  async setupPackage(package_) {
    if (!package_.isRoot) {
      const { homepage } = package_.packageJson;

      const readme = await MarkdownTemplate.load(path.join(package_.dir, 'README.md'), {
        notice: `Generated by @repo/toolsync-plugin. Do not edit manually, instead run \`toolsync prepare\`.`,
      });

      readme.update({
        section: 'footer',
        insert: 'bottom',
        content: `---

Developed as part of the [tscad](${homepage}) project.
`,
      });

      await readme.save();
    }
  },
});

export default repoPlugin;
