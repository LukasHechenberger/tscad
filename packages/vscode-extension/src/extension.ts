// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

const openPreviewCommandId = 'tscad-vscode.open-preview';

function openPreview(port: number = 4000) {
  const preserveFocus = true;
  const viewColumn = vscode.window.activeTextEditor?.viewColumn
    ? vscode.window.activeTextEditor.viewColumn + 1
    : vscode.ViewColumn.One;

  console.log(`Opening preview for port ${port} in column ${viewColumn}`);

  const panel = vscode.window.createWebviewPanel(
    'tscadPreview',
    `tscad preview (${port})`,
    { viewColumn, preserveFocus },
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

  panel.reveal(viewColumn, preserveFocus);
}

const uriHandler = {
  handleUri(uri) {
    console.log(`URI received: ${uri.toString()}`);

    const port = new URLSearchParams(uri.query).get('port');
    openPreview(port ? Number(port) : undefined);
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
      const portNumber = Number(value);

      try {
        const response = await fetch(`http://localhost:${portNumber}`);

        if (!response.ok) {
          return `No server responding at port ${portNumber}`;
        }

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

  if (port) openPreview(Number(port));
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
