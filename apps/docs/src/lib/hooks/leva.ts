import { useControls, useCreateStore } from 'leva';
import type { FolderSettings, Schema } from 'leva/dist/declarations/src/types';
import { useEffect, useMemo } from 'react';

const STORAGE_KEY = 'leva-settings';

export function jsonStorage(key: string) {
  return {
    get<T>(fallback: T): T {
      if (globalThis.window === undefined) return {} as T;
      try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : fallback;
      } catch (error) {
        console.warn('Error reading from localStorage:', error);
        return fallback;
      }
    },
    set(value: any) {
      if (globalThis.window === undefined) return;
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.warn('Error saving to localStorage:', error);
      }
    },
  };
}

export const storage = {
  get<T>(fallback: T): T {
    if (globalThis.window === undefined) return {} as T;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : fallback;
    } catch (error) {
      console.warn('Error reading from localStorage:', error);
      return fallback;
    }
  },
  set(value: any) {
    if (globalThis.window === undefined) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch (error) {
      console.warn('Error saving to localStorage:', error);
    }
  },
};

export function usePersistentControls<
  N extends string,
  S extends Schema,
  F extends FolderSettings,
>({ folderName, schema }: { folderName: N; folderSettings: F; schema: S }) {
  const store = useCreateStore();

  const [values, set] = useControls<S, N, () => S>(folderName, () => schema, {
    store,
  });

  // Load initial settings from localStorage
  useEffect(() => {
    const initial = storage.get();

    set(initial);
  }, [set]);

  return values;
}
