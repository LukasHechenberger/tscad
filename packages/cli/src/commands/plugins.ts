import { Command } from '@tscad/commander';
import { loadKernel } from '@tscad/kernel';
import { loadPlugins } from '@/lib/plugins';

export const pluginsCommand = new Command('plugins')
  .description(
    'List the plugins available to models in a directory (plugin dependencies and tscad.json)',
  )
  .argument('[directory]', 'Where to look for package.json and tscad.json', '.')
  .action(async (directory: string) => {
    const host = await loadPlugins(await loadKernel(), directory);
    const plugins = host.list();
    if (plugins.length === 0)
      // eslint-disable-next-line no-console
      console.log('No plugins (no plugin dependencies, none listed in a tscad.json)');
    for (const { kind, info, fileExtension } of plugins) {
      // eslint-disable-next-line no-console
      console.log(
        `${info.name.padEnd(14)} ${kind.padEnd(9)} ${info.version.padEnd(7)} ${fileExtension ? `.${fileExtension}  ` : ''}${info.description}`,
      );
    }
  });
