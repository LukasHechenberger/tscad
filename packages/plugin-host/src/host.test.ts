import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadKernel } from '@tscad/kernel';
import { cube, plugin, sphere, translate, union } from '@tscad/modeling';
import { PluginHost, pluginFromDirectory, type PluginSource } from './bun';

const pluginsDirectory = path.join(import.meta.dir, '../../../plugins');
const built = ['grid', 'export-3mf', 'printability'].every((name) =>
  existsSync(path.join(pluginsDirectory, name, 'dist/plugin.js')),
);

async function host() {
  const host = new PluginHost(await loadKernel());
  for (const name of ['grid', 'export-3mf', 'printability'])
    await host.add(await pluginFromDirectory(path.join(pluginsDirectory, name)));
  return host;
}

// Needs the plugins built: `bun run build --filter=@tscad/plugins`.
describe.if(built)('built plugins', () => {
  test('loads plugins with their kind and info', async () => {
    const loaded = await host();
    const plugins = loaded.list();
    expect(plugins.map((p) => [p.info.name, p.kind])).toEqual([
      ['grid', 'operation'],
      ['export-3mf', 'exporter'],
      ['printability', 'analysis'],
    ]);
    expect(plugins[1]!.fileExtension).toBe('3mf');
    expect(plugins[2]!.info.optionsSchema).toMatchObject({
      properties: { overhangAngle: { default: 45 } },
    });
  });

  test('operation plugins expand into the same tree as TS helpers would build', async () => {
    const h = await host();
    const lowered = await h.lower(
      union(cube(1), plugin('grid', { nx: 2, ny: 1, dx: 5, dy: 0 }, cube(2))).node,
    );
    expect(lowered).toEqual(
      union(cube(1), union(translate({}, cube(2)), translate({ x: 5 }, cube(2)))).node,
    );
    const plain = cube(3).node;
    expect(await h.lower(plain)).toBe(plain); // no plugin nodes: untouched
  });

  test('plugin errors name the plugin', async () => {
    const h = await host();
    expect(h.lower(plugin('grid', { nx: 1, ny: 1, dx: 1, dy: 1 }).node)).rejects.toThrow(
      'plugin grid: needs at least one child',
    );
    expect(h.lower(plugin('grid', { nx: 1 }, cube(1)).node)).rejects.toThrow(
      'plugin grid: invalid arguments',
    );
    expect(h.lower(plugin('nope', {}, cube(1)).node)).rejects.toThrow(
      'no operation plugin "nope" (loaded: grid)',
    );
  });

  test('exporter plugins write files', async () => {
    const loaded = await host();
    const file = await loaded.export(cube(10).color('red').node, '3mf');
    expect(new TextDecoder().decode(file.slice(0, 2))).toBe('PK'); // zip
    expect(new TextDecoder().decode(file)).toContain('<base name="#FF0000"');
  });

  test('printability: overhangs, bed contact and fit', async () => {
    const h = await host();
    const onBed = await h.analyze(cube(10).node, 'printability');
    expect(onBed).toMatchObject({
      fitsBed: true,
      needsSupport: false,
      overhangArea: 0,
      warnings: [],
    });
    expect(onBed.bedContactArea).toBeCloseTo(100, 6);

    // A T: a 4×4 pillar under a 20×20 plate; the plate's underside overhangs, minus the pillar.
    const t = union(
      cube({ x: 4, y: 4, z: 10 }),
      translate({ x: -8, y: -8, z: 10 }, cube({ x: 20, y: 20, z: 2 })),
    );
    const report = await h.analyze(t.node, 'printability');
    expect(report.overhangArea).toBeCloseTo(400 - 16, 6);
    expect(report.bedContactArea).toBeCloseTo(16, 6);

    const ball = await h.analyze(sphere({ r: 10 }).node, 'printability', { bed: [15, 15, 15] });
    expect(ball).toMatchObject({ needsSupport: true, fitsBed: false, bedContactArea: 0 });
    expect(ball.warnings).toHaveLength(3);
  });

  test('kernel errors reach the plugin and come back named', async () => {
    const h = await host();
    expect(h.analyze(cube(1).color('nope').node, 'printability')).rejects.toThrow(
      'plugin printability: color: ',
    );
  });
});

test('a plugin that traps is re-instantiated', async () => {
  let instances = 0;
  const source: PluginSource = {
    getCoreModule: async () => new WebAssembly.Module(new Uint8Array()),
    instantiate: async () => {
      const n = ++instances;
      return {
        info: () => ({ name: 'flaky', version: '0', description: '', optionsSchema: '' }),
        evaluate: () => {
          if (n === 1) throw new WebAssembly.RuntimeError('unreachable');
          return { node: cube(1).node };
        },
      };
    },
  };
  const h = new PluginHost(await loadKernel());
  await h.add(source);
  expect(h.lower(plugin('flaky', {}, cube(1)).node)).rejects.toThrow(
    'plugin flaky crashed: unreachable',
  );
  await Bun.sleep(0);
  expect(await h.lower(plugin('flaky', {}, cube(1)).node)).toEqual(cube(1).node);
  expect(instances).toBe(2);
});

const fake = (exports: object): PluginSource => ({
  getCoreModule: async () => new WebAssembly.Module(new Uint8Array()),
  instantiate: async () => ({
    info: () => ({ name: 'x', version: '0', description: '', optionsSchema: '' }),
    ...exports,
  }),
});

test('rejects components that are not tscad plugins, and duplicate names', async () => {
  const h = new PluginHost(await loadKernel());
  expect(h.add(fake({}))).rejects.toThrow('not a tscad plugin');
  await h.add(fake({ analyze: () => '{}' }));
  expect(h.add(fake({ analyze: () => '{}' }))).rejects.toThrow('plugin x is loaded twice');
});
