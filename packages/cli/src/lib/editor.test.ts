import { expect, test } from 'bun:test';
import { detectEditor } from './editor';

test('TSCAD_EDITOR overrides detection', () => {
  expect(detectEditor({ TSCAD_EDITOR: 'cursor', TERM_PROGRAM: 'vscode' })).toEqual({
    name: 'Cursor',
    scheme: 'cursor',
  });
  expect(detectEditor({ TSCAD_EDITOR: 'none', TERM_PROGRAM: 'vscode' })).toBeUndefined();
});

test('recognizes the editor whose terminal we run in', () => {
  expect(
    detectEditor({ TERM_PROGRAM: 'vscode', __CFBundleIdentifier: 'com.microsoft.VSCode' })?.scheme,
  ).toBe('vscode');
  expect(
    detectEditor({
      TERM_PROGRAM: 'vscode',
      VSCODE_GIT_ASKPASS_NODE:
        '/Applications/Cursor.app/Contents/Frameworks/Cursor Helper (Plugin).app',
    })?.scheme,
  ).toBe('cursor');
  expect(
    detectEditor({
      TERM_PROGRAM: 'vscode',
      VSCODE_IPC_HOOK: '/home/me/.config/Code - Insiders/1.10-main.sock',
    })?.scheme,
  ).toBe('vscode-insiders');
  expect(
    detectEditor({
      TERM_PROGRAM: 'vscode',
      VSCODE_IPC_HOOK: 'C:\\Users\\me\\AppData\\Roaming\\Code\\1.10-main.sock',
    })?.scheme,
  ).toBe('vscode');
});
