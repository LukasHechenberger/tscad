// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "tscad-vscode" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand('tscad-vscode.helloWorld', () => {
    // The code you place here will be executed every time your command is executed
    // Display a message box to the user
    vscode.window.showInformationMessage('Hello World from tscad Preview!!!');
  });

  context.subscriptions.push(disposable);

  // Register a URI handler to handle incoming URIs
  const handler: vscode.UriHandler = {
    handleUri(uri) {
      vscode.window.showInformationMessage(`URI received: ${uri.toString()}`);
      vscode.commands.executeCommand(
        'tscad-vscode.open' /* Pass options, like port etc. 'http://localhost:4000' */,
      );
    },
  };
  context.subscriptions.push(vscode.window.registerUriHandler(handler));

  // Custom webview
  context.subscriptions.push(
    vscode.commands.registerCommand('tscad-vscode.open', () => {
      const panel = vscode.window.createWebviewPanel(
        'tscadPreview',
        'tscad preview',
        vscode.ViewColumn.One,
        {
          enableScripts: true, // needed for iframe interactions
        },
      );

      panel.webview.html = getWebviewContent();
    }),
  );

  function getWebviewContent(): string {
    return /* html */ `
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
            <iframe src="http://localhost:4000"></iframe>
        </body>
        </html>
    `;
  }
}

// This method is called when your extension is deactivated
export function deactivate() {}
