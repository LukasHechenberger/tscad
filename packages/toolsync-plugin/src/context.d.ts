declare global {
  namespace Toolsync {
    interface ConfigMap {
      '@repo/toolsync-plugin': Record<string, never>;
    }
  }
}

export {};
