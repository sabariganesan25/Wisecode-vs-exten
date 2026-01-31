import * as vscode from 'vscode';
import { PythonFunction } from '../utilities/pythonParser';
/**
 * Manages the Sentinel Dashboard webview panel as a Singleton
 */
export declare class DashboardPanel {
    static currentPanel: DashboardPanel | undefined;
    static readonly viewType = "sentinelDashboard";
    private readonly _panel;
    private readonly _extensionUri;
    private _disposables;
    private _currentFilePath;
    private constructor();
    /**
     * Navigate to a specific line in the active Python file
     */
    private _goToLine;
    /**
     * Execute a Python function and return the result
     */
    private _executeFunction;
    /**
     * Run Python script file and return stdout
     */
    private _runPython;
    /**
     * Create or show the singleton panel
     */
    static createOrShow(extensionUri: vscode.Uri): DashboardPanel;
    /**
     * Send updated function data to the webview
     */
    updateFunctions(fileName: string, filePath: string, functions: PythonFunction[]): void;
    /**
     * Dispose of the panel and clean up resources
     */
    dispose(): void;
    /**
     * Generate the HTML content for the webview
     */
    private _getHtmlForWebview;
    /**
     * Generate a cryptographic nonce for CSP
     */
    private _getNonce;
}
//# sourceMappingURL=DashboardPanel.d.ts.map