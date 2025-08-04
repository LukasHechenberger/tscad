// lib/bundler.ts
import * as esbuild from 'esbuild-wasm';

let initialized = false;

export async function bundleCode(
  userCode: string,
): Promise<
  Partial<esbuild.OutputFile> & { warnings: esbuild.Message[]; errors: esbuild.Message[] }
> {
  if (!initialized) {
    await esbuild.initialize({
      wasmURL: '/playground/resources/esbuild.wasm',
      worker: true,
    });
    initialized = true;
  }

  try {
    const result = await esbuild.build({
      bundle: true,
      write: false,
      format: 'cjs',
      platform: 'browser',
      // sourcemap: 'inline', // FIXME [>=1.0.0]: Enable and track error locations
      banner: {
        js: 'const module = {}; // This is where the module exports will be stored',
      },
      footer: {
        js: 'return module.exports;',
      },
      stdin: {
        contents: userCode,
        resolveDir: '/',
        sourcefile: 'input.ts',
        loader: 'ts',
      },
      plugins: [resolveImports],
    });

    return {
      ...result.outputFiles[0],
      warnings: result.warnings,
      errors: result.errors,
    };
  } catch (error) {
    return error as esbuild.BuildFailure;
  }
}

const playgroundImportRoot = new URL('/playground/resources/modules/', location.href);

const resolveImports: esbuild.Plugin = {
  name: 'resolve-imports',
  setup(build) {
    build.onResolve({ filter: /^@[jt]scad\/.*$/ }, ({ path }) => {
      // console.log('resolving:', path);

      return {
        path: new URL(
          path.replace('@', ''),
          new URL('/playground/resources/modules/', location.href),
        ).toString(),
        namespace: 'http-url',
      };
    });

    // Intercept import paths starting with "http:" and "https:" so
    // esbuild doesn't attempt to map them to a file system location.
    // Tag them with the "http-url" namespace to associate them with
    // this plugin.
    build.onResolve({ filter: /^https?:\/\// }, ({ path }) => ({ path, namespace: 'http-url' }));

    build.onResolve({ filter: /./ }, ({ path, importer, namespace, ...rest }) => {
      if (importer.startsWith(playgroundImportRoot.toString())) {
        console.log('Relative import:', { path, importer });

        return {
          path: new URL(path.replace('.js', ''), `${importer}`).toString(),
          namespace: 'http-url',
        };
      }

      throw new Error(
        `Cannot import ${path} in the playground. Only @tscad and @jscad modules are supported.`,
      );
    });

    // We also want to intercept all import paths inside downloaded
    // files and resolve them against the original URL. All of these
    // files will be in the "http-url" namespace. Make sure to keep
    // the newly resolved URL in the "http-url" namespace so imports
    // inside it will also be resolved as URLs recursively.
    build.onResolve({ filter: /.*/, namespace: 'http-url' }, ({ path, importer }) => ({
      path: new URL(path, importer).toString(),
      namespace: 'http-url',
    }));

    // When a URL is loaded, we want to actually download the content
    // from the internet. This has just enough logic to be able to
    // handle the example import from unpkg.com but in reality this
    // would probably need to be more complex.
    build.onLoad({ filter: /.*/, namespace: 'http-url' }, async ({ path }) => {
      console.log('Downloading:', path);
      const response = await fetch(path);

      if (!response.ok) {
        throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
      }

      const contents = await response.text();

      return { contents, loader: 'js' };
    });
  },
};
