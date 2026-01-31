import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { PythonFunction } from '../utilities/pythonParser';

/**
 * Manages the Sentinel Dashboard webview panel as a Singleton
 */
export class DashboardPanel {
    public static currentPanel: DashboardPanel | undefined;
    public static readonly viewType = 'sentinelDashboard';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _currentFilePath: string = '';

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Set the webview's initial html content
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'scanRisk':
                        vscode.window.showInformationMessage(
                            `Scan Risk requested for: ${message.payload.functionName}`
                        );
                        break;

                    case 'goToLine':
                        this._goToLine(message.payload.lineNumber);
                        break;

                    case 'executeFunction':
                        await this._executeFunction(
                            message.payload.requestId,
                            message.payload.functionName,
                            message.payload.args,
                            message.payload.filePath
                        );
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    /**
     * Navigate to a specific line in the active Python file
     */
    private _goToLine(lineNumber: number): void {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'python') {
            const position = new vscode.Position(lineNumber - 1, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(
                new vscode.Range(position, position),
                vscode.TextEditorRevealType.InCenter
            );
            // Focus the editor
            vscode.window.showTextDocument(editor.document, editor.viewColumn);
        }
    }

    /**
     * Execute a Python function and return the result
     */
    private async _executeFunction(
        requestId: string,
        functionName: string,
        args: string[],
        filePath: string
    ): Promise<void> {
        try {
            // Validate inputs
            if (!filePath || !fs.existsSync(filePath)) {
                throw new Error('Python file not found');
            }

            // Build the Python code to execute
            const argsStr = args.join(', ');
            const dirPath = path.dirname(filePath).replace(/\\/g, '/');
            const moduleName = path.basename(filePath, '.py');

            const pythonCode = `
import sys
import json

sys.path.insert(0, r'${dirPath}')

try:
    from ${moduleName} import ${functionName}
    result = ${functionName}(${argsStr})
    output = {"success": True, "result": repr(result)}
    print(json.dumps(output))
except SyntaxError as e:
    print(json.dumps({"success": False, "error": f"Syntax Error: {e}"}))
except TypeError as e:
    print(json.dumps({"success": False, "error": f"Type Error: {e}"}))
except ValueError as e:
    print(json.dumps({"success": False, "error": f"Value Error: {e}"}))
except NameError as e:
    print(json.dumps({"success": False, "error": f"Name Error: {e}"}))
except Exception as e:
    print(json.dumps({"success": False, "error": f"{type(e).__name__}: {e}"}))
`;

            // Write to temp file (more reliable on Windows)
            const tempFile = path.join(os.tmpdir(), `sentinel_exec_${Date.now()}.py`);
            fs.writeFileSync(tempFile, pythonCode, 'utf8');

            try {
                // Execute Python with temp file
                const result = await this._runPython(tempFile);

                try {
                    const parsed = JSON.parse(result.trim());
                    this._panel.webview.postMessage({
                        type: 'executeResult',
                        payload: {
                            requestId,
                            success: parsed.success,
                            result: parsed.result,
                            error: parsed.error
                        }
                    });
                } catch {
                    // If JSON parsing fails, show raw output
                    this._panel.webview.postMessage({
                        type: 'executeResult',
                        payload: {
                            requestId,
                            success: false,
                            error: result || 'Failed to parse Python output'
                        }
                    });
                }
            } finally {
                // Clean up temp file
                try {
                    fs.unlinkSync(tempFile);
                } catch {
                    // Ignore cleanup errors
                }
            }
        } catch (error) {
            this._panel.webview.postMessage({
                type: 'executeResult',
                payload: {
                    requestId,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
    }

    /**
     * Run Python script file and return stdout
     */
    private _runPython(scriptPath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

            const proc = cp.spawn(pythonCmd, [scriptPath], {
                cwd: path.dirname(scriptPath)
            });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            proc.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            proc.on('close', (exitCode) => {
                if (exitCode === 0) {
                    resolve(stdout);
                } else {
                    reject(new Error(stderr || stdout || `Python exited with code ${exitCode}`));
                }
            });

            proc.on('error', (err) => {
                reject(new Error(`Failed to run Python: ${err.message}`));
            });

            // Timeout after 25 seconds
            setTimeout(() => {
                proc.kill();
                reject(new Error('Python execution timed out (25s)'));
            }, 25000);
        });
    }

    /**
     * Create or show the singleton panel
     */
    public static createOrShow(extensionUri: vscode.Uri): DashboardPanel {
        const column = vscode.ViewColumn.Beside;

        // If we already have a panel, show it
        if (DashboardPanel.currentPanel) {
            DashboardPanel.currentPanel._panel.reveal(column);
            return DashboardPanel.currentPanel;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            DashboardPanel.viewType,
            'Sentinel Dashboard',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'out')]
            }
        );

        DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri);
        return DashboardPanel.currentPanel;
    }

    /**
     * Send updated function data to the webview
     */
    public updateFunctions(fileName: string, filePath: string, functions: PythonFunction[]): void {
        this._currentFilePath = filePath;
        this._panel.webview.postMessage({
            type: 'updateFunctions',
            payload: {
                fileName,
                filePath,
                functions
            }
        });
    }

    /**
     * Dispose of the panel and clean up resources
     */
    public dispose(): void {
        DashboardPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    /**
     * Generate the HTML content for the webview
     */
    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Get the local path to the bundled webview script
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'out', 'webview.js')
        );

        // Generate a nonce for CSP
        const nonce = this._getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Sentinel Dashboard</title>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }

    /**
     * Generate a cryptographic nonce for CSP
     */
    private _getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
