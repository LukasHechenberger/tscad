import type { Model } from '@tscad/modeling';

declare module '@tscad-viewer/model' {
  const model: Model;

  export default model;
}
