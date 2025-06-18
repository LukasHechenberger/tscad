self.onmessage = async (event) => {
  const { code } = event.data;

  try {
    // Build the function with injected API
    const loadModule = new Function(code + '\n//# sourceURL=user-script.js');

    const exports = loadModule();

    if (typeof exports.main !== 'function') {
      throw new Error('No main function found in the module');
    }

    const result = exports.main();

    console.log({ result });
    self.postMessage({ result });
  } catch (_err) {
    const err = _err as Error;
    self.postMessage({ error: { message: err.message, stack: err.stack } });
  }
};
