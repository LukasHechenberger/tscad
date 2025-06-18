// lib/bundler.ts
import * as esbuild from 'esbuild-wasm';

let initialized = false;

export async function bundleCode(userCode: string): Promise<string> {
  if (!initialized) {
    await esbuild.initialize({
      wasmURL: '/playground/resources/esbuild.wasm',
      worker: true,
    });
    initialized = true;
  }

  const result = await esbuild.build({
    // entryPoints: ['input.ts'],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'browser',
    stdin: {
      contents: userCode,
      resolveDir: '/',
      sourcefile: 'input.ts',
      loader: 'ts',
    },
    plugins: [/* injectApi(), */ httpPlugin],
  });

  return result.outputFiles[0].text;
}

function injectApi(): esbuild.Plugin {
  return {
    name: 'tscad-api-plugin',
    setup(build) {
      build.onResolve({ filter: /^@tscad\/*$/ }, ({ path }) => ({
        path: new URL(
          path.slice(1),
          'http://localhost:3000/playground/resources/modules/',
        ).toString(),
        namespace: 'virtual',
      }));

      build.onLoad({ filter: /.*/, namespace: 'virtual' }, async () => ({
        contents: `export function cube() {}`,
        loader: 'ts',
      }));
    },
  };
}

let httpPlugin = {
  name: 'http',
  setup(build) {
    build.onResolve({ filter: /^@tscad\/.*$/ }, ({ path }) => {
      console.log('resolving:', path);

      return {
        path: new URL(path, 'http://localhost:3000/playground/resources/modules/').toString(),
        namespace: 'http-url',
      };
    });

    // Intercept import paths starting with "http:" and "https:" so
    // esbuild doesn't attempt to map them to a file system location.
    // Tag them with the "http-url" namespace to associate them with
    // this plugin.
    build.onResolve({ filter: /^https?:\/\// }, (args) => ({
      path: args.path,
      namespace: 'http-url',
    }));

    // We also want to intercept all import paths inside downloaded
    // files and resolve them against the original URL. All of these
    // files will be in the "http-url" namespace. Make sure to keep
    // the newly resolved URL in the "http-url" namespace so imports
    // inside it will also be resolved as URLs recursively.
    build.onResolve({ filter: /.*/, namespace: 'http-url' }, (args) => ({
      path: new URL(args.path, args.importer).toString(),
      namespace: 'http-url',
    }));

    // When a URL is loaded, we want to actually download the content
    // from the internet. This has just enough logic to be able to
    // handle the example import from unpkg.com but in reality this
    // would probably need to be more complex.
    build.onLoad({ filter: /.*/, namespace: 'http-url' }, async (args) => {
      console.log('Downloading:', args.path);
      const response = await fetch(args.path);

      if (!response.ok) {
        throw new Error(`Failed to fetch ${args.path}: ${response.statusText}`);
      }

      const contents = await response.text();

      // let contents = await new Promise((resolve, reject) => {
      //   async function fetch(url) {
      //     console.log(`Downloading: ${url}`);
      //     const response = await fetch(url);
      //     const text = await response.text();

      //     resolve(text)
      //     let lib = url.startsWith('https') ? https : http;
      //     let req = lib
      //       .get(url, (res) => {
      //         if ([301, 302, 307].includes(res.statusCode)) {
      //           fetch(new URL(res.headers.location, url).toString());
      //           req.abort();
      //         } else if (res.statusCode === 200) {
      //           let chunks = [];
      //           res.on('data', (chunk) => chunks.push(chunk));
      //           res.on('end', () => resolve(Buffer.concat(chunks)));
      //         } else {
      //           reject(new Error(`GET ${url} failed: status ${res.statusCode}`));
      //         }
      //       })
      //       .on('error', reject);
      //   }
      //   fetch(args.path);
      // });
      return { contents, loader: 'js' };
    });
  },
};
