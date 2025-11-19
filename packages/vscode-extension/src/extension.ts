/* eslint-disable no-console */

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// Constants
const openPreviewCommandId = 'tscad-vscode.open-preview';

/** Manages the preview panels */
class PreviewPanel {
  private static readonly viewType = 'tscadPreview';
  private static readonly panels = new Map<number, PreviewPanel>();

  constructor(private readonly panel: vscode.WebviewPanel) {
    panel.onDidDispose(() => this.dispose());
  }

  private dispose() {
    for (const [port, panel] of PreviewPanel.panels.entries()) {
      if (panel === this) {
        console.debug(`Disposing preview panel for port ${port}`);

        PreviewPanel.panels.delete(port);
        return;
      }
    }

    console.warn('Panel not found in registry during dispose');
  }

  public static createOrShow(port: number = 4000) {
    const viewColumn = vscode.window.activeTextEditor?.viewColumn
      ? vscode.window.activeTextEditor.viewColumn + 1
      : vscode.ViewColumn.One;

    // Reveal existing panel if it exists
    const existingPanel = this.panels.get(port);
    if (existingPanel) {
      console.log('Got existing panel for port', port);
      existingPanel.panel.reveal(undefined, true);
      return;
    }

    // Otherwise create new panel
    const panel = vscode.window.createWebviewPanel(
      PreviewPanel.viewType,
      `tscad preview (${port})`,
      { viewColumn, preserveFocus: Boolean(vscode.window.activeTextEditor) },
      {
        enableScripts: true, // needed for iframe interactions
      },
    );

    panel.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <!-- <meta http-equiv="Content-Security-Policy" content="default-src 'none';"> -->
        <title>tscad preview (${port})</title>
        <style>
          html, body, iframe {
            margin: 0;
            padding: 0;
            height: 100%;
            width: 100%;
            border: none;
            overflow: hidden;
          }
        </style>
      </head>
      <body>
        <iframe src="http://localhost:${port}"></iframe>
      </body>
      </html>
    `;

    this.panels.set(port, new PreviewPanel(panel));
  }
}

/** Parses port from string input, returns undefined if invalid */
function getPort(input: string | undefined | null): number | undefined {
  if (!input) return undefined;

  const port = Number(input);
  if (Number.isNaN(port)) return undefined;

  return port;
}

const uriHandler = {
  handleUri(uri) {
    console.log(`URI received: ${uri.toString()}`);

    const port = getPort(new URLSearchParams(uri.query).get('port'));
    PreviewPanel.createOrShow(port);
  },
} satisfies vscode.UriHandler;

/** Called when a user manually runs "open tscad preview" */
async function handleOpenCommand() {
  // FIXME [>=1.0.0]: Does not validate initial value (4000 at the moment) - Use vscode.window.createInputBox() instead
  const port = await vscode.window.showInputBox({
    title: 'Enter preview port',
    value: '4000',
    placeHolder: 'The port tscad dev server is running on',
    async validateInput(value) {
      const portNumber = getPort(value);
      if (!portNumber) return 'Please enter a valid port number';

      try {
        const response = await fetch(`http://localhost:${portNumber}`);

        if (!response.ok) {
          return `No server responding at port ${portNumber}`;
        }

        // FIXME [>=1.0.0]: Validate this is a tscad server
        return {
          message: `Server is responding at port ${portNumber}`,
          severity: vscode.InputBoxValidationSeverity.Info,
        };
      } catch {
        return {
          message: `No server responding at port ${portNumber}`,
          severity: vscode.InputBoxValidationSeverity.Warning,
        };
      }
    },
  });

  if (port) PreviewPanel.createOrShow(getPort(port));
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('"tscad-vscode" is now active!');

  context.subscriptions.push(
    // Register a URI handler to handle incoming URIs
    vscode.window.registerUriHandler(uriHandler),
    // Command for custom webview
    vscode.commands.registerCommand(openPreviewCommandId, handleOpenCommand),
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
