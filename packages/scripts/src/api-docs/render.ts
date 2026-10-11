/** Rendering `@example` values with the kernel (and the plugins that are built). */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadKernel, type Kernel } from '@tscad/kernel';
import { linear_extrude, Shape2D, type Shape } from '@tscad/modeling';
import { PluginHost, pluginFromDirectory } from '@tscad/plugin-host';
import { ROOT } from './extract';

/** Kernel plus the plugins from the repo's tscad.json that are built (examples may use them). */
export async function docsKernel(): Promise<{ kernel: Kernel; host: PluginHost }> {
  const kernel = await loadKernel();
  const host = new PluginHost(kernel);
  const config = (await Bun.file(path.join(ROOT, 'tscad.json')).json()) as { plugins?: string[] };
  for (const plugin of config.plugins ?? []) {
    if (existsSync(path.join(ROOT, plugin, 'dist/plugin.js')))
      await host.add(await pluginFromDirectory(path.join(ROOT, plugin)));
  }
  return { kernel, host };
}

/** An isometric SVG of a shape; 2D shapes are drawn as thin plates. */
export async function renderSvg(
  { kernel, host }: { kernel: Kernel; host: PluginHost },
  value: Shape | Shape2D,
): Promise<Uint8Array> {
  if (value instanceof Shape2D) {
    const probe = kernel.evaluate(linear_extrude({ height: 1 }, value));
    const info = probe.info();
    probe.release();
    const { min, max } = info.kind === 'solids' ? info.boundingBox : { min: [0, 0], max: [1, 1] };
    const span = Math.max(max[0]! - min[0]!, max[1]! - min[1]!);
    value = linear_extrude({ height: span * 0.03 }, value);
  }
  return kernel.render(await host.lower(value.node), 'svg');
}
