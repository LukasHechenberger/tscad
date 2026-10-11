import type { ParametersJsonSchema } from '@tscad/modeling';
import type { Reports } from './report';

/** Messages the preview server sends to the viewer over `/ws`. */
export type ServerMessage =
  /** `/model.glb` changed (fetch it with `?v=version` to bypass caches). */
  | {
      type: 'model';
      version: number;
      name: string;
      file: string;
      editor?: Editor;
      backend: string;
      renderMs: number;
    }
  /** The model failed to load or render; the viewer keeps showing the last good one. */
  | { type: 'error'; message: string; editor?: Editor }
  /** The model's parameters and the values of the latest evaluation (defaults applied). */
  | { type: 'parameters'; schema: ParametersJsonSchema; values: Record<string, unknown> }
  /** Reports of the analysis plugins for the latest model, by plugin name. */
  | { type: 'analysis'; reports: Reports };

/** Messages the viewer sends to the preview server. */
export type ClientMessage =
  /** Re-render with these parameter values (a complete set; omitted ones take their defaults). */
  { type: 'params'; values: Record<string, unknown> };

/** An editor that can open files via a URL scheme, e.g. VS Code's `vscode://file/…`. */
export type Editor = { name: string; scheme: string };

/** `vscode://file/abs/path:line:column` (Windows paths get a leading slash: `/C:/…`). */
export function editorUrl(
  { scheme }: Editor,
  path: string,
  line?: number,
  column?: number,
): string {
  const normalized = path.replaceAll('\\', '/');
  const location = [line, column]
    .filter((n) => n !== undefined)
    .map((n) => `:${n}`)
    .join('');
  return `${scheme}://file${normalized.startsWith('/') ? '' : '/'}${encodeURI(normalized)}${location}`;
}
