import { Command } from '@tscad/commander';
import { loadKernel } from '@tscad/kernel';
import { loadPlugins } from '@/lib/plugins';

export const pluginsCommand = new Command('plugins')
  .description('List the plugins the nearest tscad.json loads')
  .argument('[directory]', 'Where to look for tscad.json', '.')
  .action(async (directory: string) => {
    const host = await loadPlugins(await loadKernel(), directory);
    const plugins = host.list();
    // eslint-disable-next-line no-console
    if (plugins.length === 0) console.log('No plugins (none listed in a tscad.json)');
    for (const { kind, info, fileExtension } of plugins) {
      // eslint-disable-next-line no-console
      console.log(
        `${info.name.padEnd(14)} ${kind.padEnd(9)} ${info.version.padEnd(7)} ${fileExtension ? `.${fileExtension}  ` : ''}${info.description}`,
      );
    }
  });
