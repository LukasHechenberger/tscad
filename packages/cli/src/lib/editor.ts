import type { Editor } from '@tscad/viewer/protocol';

/** VS Code-family editors and the URL scheme each registers (`<scheme>://file/<path>:<line>:<col>`). */
const EDITORS = [
  // Most specific first: Cursor/Windsurf/VSCodium/Insiders paths also contain "Code".
  { name: 'Cursor', scheme: 'cursor', hint: /cursor/i, cli: 'cursor' },
  { name: 'Windsurf', scheme: 'windsurf', hint: /windsurf/i, cli: 'windsurf' },
  { name: 'VSCodium', scheme: 'vscodium', hint: /vscodium/i, cli: 'codium' },
  { name: 'VS Code Insiders', scheme: 'vscode-insiders', hint: /insiders/i, cli: 'code-insiders' },
  {
    name: 'VS Code',
    scheme: 'vscode',
    hint: /visual studio code|com\.microsoft\.vscode|[\\/]code[\\/]/i,
    cli: 'code',
  },
] as const;

/**
 * Picks the editor that model files should open in, or `undefined` for none:
 * 1. `TSCAD_EDITOR` (a scheme from the list above, or `none`)
 * 2. the editor whose integrated terminal runs us, recognized by its app paths in the environment
 * 3. the first editor whose CLI is on the PATH
 */
export function detectEditor(environment = process.env): Editor | undefined {
  const forced = environment.TSCAD_EDITOR;
  if (forced) {
    const editor = EDITORS.find((candidate) => candidate.scheme === forced);
    return editor && pick(editor);
  }

  const inEditor =
    environment.TERM_PROGRAM === 'vscode' ||
    Object.keys(environment).some((key) => key.startsWith('VSCODE_'));
  if (inEditor) {
    const hints = [
      environment.__CFBundleIdentifier,
      environment.VSCODE_GIT_ASKPASS_NODE,
      environment.VSCODE_IPC_HOOK,
      environment.VSCODE_CODE_CACHE_PATH,
    ].join('\n');
    const editor = EDITORS.find((candidate) => candidate.hint.test(hints));
    if (editor) return pick(editor);
  }
  const installed = EDITORS.find((candidate) => Bun.which(candidate.cli));
  return installed && pick(installed);
}

const pick = ({ name, scheme }: (typeof EDITORS)[number]): Editor => ({ name, scheme });
