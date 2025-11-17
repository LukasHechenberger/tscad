import * as esbuild from 'esbuild-wasm';

let initialized = false;
const downloadCache = new Map<string, Promise<string>>();

function cachedFetch(url: string): Promise<string> {
  if (downloadCache.has(url)) {
    console.debug('Already downloaded', url);
  } else {
    console.info('Downloading', url);
    downloadCache.set(
      url,
      fetch(url).then((response) => {
        if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);

        return response.text();
      }),
    );
  }

  return downloadCache.get(url)!;
}

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
    console.error('Esbuild bundling error:', error);
    return error as esbuild.BuildFailure;
  }
}

const resolveImports: esbuild.Plugin = {
  name: 'resolve-imports',
  setup(build) {
    build.onResolve({ filter: /^@tscad\/.*$/ }, ({ path }) => {
      // console.log('resolving:', path);

      return {
        path: new URL(
          path.replace('@tscad/', ''),
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

    build.onResolve({ filter: /./ }, ({ path, importer }) => {
      // Allow imports from @tscad modules
      if (importer.startsWith(location.href)) {
        return {
          path: new URL(path, importer.endsWith('.js') ? importer : `${importer}/`).toString(),
          namespace: 'http-url',
        };
      }

      throw new Error(
        `Cannot import ${path} in the playground. Only @tscad modules are supported.`,
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
      const contents = await cachedFetch(path);

      return { contents, loader: 'js' };
    });
  },
};
