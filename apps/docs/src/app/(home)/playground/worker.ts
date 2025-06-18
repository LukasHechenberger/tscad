self.onmessage = async (event) => {
  const { code } = event.data;

  try {
    // Build the function with injected API
    const loadModule = new Function(
      `
      const module = {}

      ${code}

      return module.exports;
    `,
    );

    const exports = loadModule();
    const result = exports.main();

    console.log({ result });
    self.postMessage({ result });
  } catch (err) {
    console.error(err);
    self.postMessage({ error: err.message });
  }
};
