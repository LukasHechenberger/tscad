import path from 'node:path';
import { loadKernel } from '@tscad/kernel';
import { buildModel, type ModelOptions } from '@/lib/build';
import { ModelCommand } from '@/lib/commander';
import { loadPlugins } from '@/lib/plugins';

export const analyzeCommand = new ModelCommand('analyze')
  .description('Run the analysis plugins on the model')
  .option('--plugin <name>', 'Only run this analysis plugin')
  .option('--options <json>', "Options for the plugin, as JSON (see the plugin's schema)", '{}')
  .action(async function runAnalyzeCommand({
    model,
    modelProcessingError,
    plugin,
    options: pluginOptions,
    ...options
  }) {
    if (modelProcessingError)
      this.error(String((modelProcessingError as Error).message ?? modelProcessingError));

    const host = await loadPlugins(await loadKernel(), path.dirname(model));
    const names = plugin
      ? [plugin]
      : host
          .list()
          .filter((loaded) => loaded.kind === 'analysis')
          .map((loaded) => loaded.info.name);
    if (names.length === 0)
      this.error('No analysis plugins loaded (add a plugin package or list one in tscad.json)');

    try {
      const shape = await buildModel(options as ModelOptions);
      for (const name of names) {
        const report = await host.analyze(shape.node, name, JSON.parse(pluginOptions));
        // eslint-disable-next-line no-console
        console.log(`${name}: ${JSON.stringify(report, undefined, 2)}`);
      }
    } catch (error) {
      this.error(`Analysis failed: ${(error as Error).message}`);
    }
  });
