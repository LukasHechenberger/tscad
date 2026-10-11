import path from 'node:path';
import { Model, type ModelExport, Shape } from '@tscad/modeling';

/** Imports a model file (TypeScript runs as is in Bun) and checks its default export. */
export async function importModel(modelPath: string): Promise<ModelExport> {
  const { default: exported } = await import(path.resolve(modelPath));
  if (exported instanceof Shape || exported instanceof Model || typeof exported === 'function')
    return exported;
  throw new Error(
    `${modelPath}: the default export must be a Shape, a function returning one, or a defineModel(...) model`,
  );
}
