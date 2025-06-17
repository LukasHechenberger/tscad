import { cube, sphere } from '@tscad/modeling/primitives';

self.onmessage = async (event) => {
  const { code } = event.data;

  try {
    // Build the function with injected API
    const fn = new Function(
      'cube',
      'sphere',

      `
      let result;
      ${code}
      if (typeof main === 'function') result = main();
      return result;
    `,
    );

    const result = fn(cube, sphere);
    self.postMessage({ result });
  } catch (err) {
    self.postMessage({ error: err.message });
  }
};
