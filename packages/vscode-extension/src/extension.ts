// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

const openPreviewCommandId = 'tscad-vscode.open-preview';

type PreviewOptions = {
  port?: string | number;
};

function openPreview(options: PreviewOptions) {
  console.log(`Opening preview on port: ${options.port}`);
  const panel = vscode.window.createWebviewPanel(
    'tscadPreview',
    `tscad preview (${options.port})`,
    vscode.ViewColumn.Two,
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
      <title>tscad preview</title>
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
      <iframe src="http://localhost:${options.port}"></iframe>
    </body>
    </html>
  `;
}

const uriHandler = {
  handleUri(uri) {
    console.log(`URI received: ${uri.toString()}`);
    const searchParameters = new URLSearchParams(uri.query);

    const options: PreviewOptions = {
      port: searchParameters.get('port') ?? undefined,
    };

    vscode.commands.executeCommand(openPreviewCommandId, options);
  },
} satisfies vscode.UriHandler;

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
    vscode.commands.registerCommand(openPreviewCommandId, openPreview),
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
