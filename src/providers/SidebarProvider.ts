import * as vscode from 'vscode';
import { DashboardPanel } from '../panels/DashboardPanel';

export class SidebarProvider implements vscode.WebviewViewProvider {
    _view?: vscode.WebviewView;
    _doc?: vscode.TextDocument;

    constructor(private readonly _extensionUri: vscode.Uri) { }

    public resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'images'),
                vscode.Uri.joinPath(this._extensionUri, 'out')
            ],
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'openDashboard':
                    vscode.commands.executeCommand('wisecode.openDashboard');
                    break;
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'images', 'icon.png'));

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 20px 10px;
                    text-align: center;
                    color: var(--vscode-foreground);
                }
                .logo {
                    width: 64px;
                    height: 64px;
                    margin-bottom: 20px;
                    filter: drop-shadow(0 0 10px rgba(123, 44, 191, 0.5));
                }
                h2 {
                    margin-bottom: 10px;
                    font-size: 16px;
                }
                p {
                    font-size: 13px;
                    opacity: 0.8;
                    margin-bottom: 20px;
                    line-height: 1.5;
                }
                button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 10px 16px;
                    width: 100%;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 600;
                    margin-bottom: 10px;
                }
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                .secondary-btn {
                    background: transparent;
                    border: 1px solid var(--vscode-button-secondaryBackground);
                    color: var(--vscode-foreground);
                }
            </style>
        </head>
        <body>
            <img src="${logoUri}" class="logo" alt="Wisecode AI" />
            <h2>Wisecode AI</h2>
            <p>Your premium agent for Code Compliance & Security.</p>
            
            <button onclick="openDashboard()">Open Full Dashboard</button>
            
            <script>
                const vscode = acquireVsCodeApi();
                function openDashboard() {
                    vscode.postMessage({ type: 'openDashboard' });
                }
            </script>
        </body>
        </html>`;
    }
}
