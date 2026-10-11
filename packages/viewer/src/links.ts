import { editorUrl, type Editor } from './protocol';

export const escape = (text: string) =>
  text.replaceAll(/[&<>"']/g, (character) => `&#${character.codePointAt(0)};`);

/** Absolute source locations as they appear in stack traces and build errors: `/a/b.ts:12:5`, `C:\a\b.ts:12`. */
const LOCATION = /((?:[A-Za-z]:)?[\\/][^\s()'"]*?\.(?:[cm]?[jt]sx?|json)):(\d+)(?::(\d+))?/g;

/** Escapes `text` for HTML and turns its source locations into links that open the editor at that line. */
export function linkLocations(text: string, editor?: Editor): string {
  if (!editor) return escape(text);
  let html = '';
  let last = 0;
  for (const match of text.matchAll(LOCATION)) {
    const [location, path, line, column] = match;
    const url = editorUrl(
      editor,
      path!,
      Number(line),
      column === undefined ? undefined : Number(column),
    );
    html += `${escape(text.slice(last, match.index))}<a href="${escape(url)}" title="Open in ${escape(editor.name)}">${escape(location)}</a>`;
    last = match.index + location.length;
  }
  return html + escape(text.slice(last));
}
