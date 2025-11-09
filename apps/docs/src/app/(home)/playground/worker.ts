// eslint-disable-next-line unicorn/prefer-add-event-listener
globalThis.onmessage = async (event) => {
  const { code } = event.data;

  try {
    // Build the function with injected API
    const loadModule = new Function(`${code}\n//# sourceURL=user-script.js`);

    const exports = loadModule();

    if (typeof exports.main !== 'function') {
      throw new TypeError('No main function found in the module');
    }

    const result = exports.main();

    console.log({ result });
    self.postMessage({ result });
  } catch (error) {
    const error_ = error as Error;
    self.postMessage({ error: { message: error_.message, stack: error_.stack } });
  }
};

// Stop nextjs from nagging about CommonJS syntax...
export {};
