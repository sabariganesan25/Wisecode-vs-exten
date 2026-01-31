import * as vscode from 'vscode';
import { CodeFunction } from '../utilities/pythonParser';
export declare class DashboardPanel {
    static currentPanel: DashboardPanel | undefined;
    static readonly viewType = "sentinelDashboard";
    private readonly _panel;
    private readonly _extensionUri;
    private _disposables;
    private _currentFilePath;
    private _currentFileContent;
    private _currentLanguage;
    private constructor();
    private _handleQuickFix;
    private _handleExplainError;
    private _handleSummarize;
    private _handleGenerateGuide;
    private _handleGenerateEdgeCases;
    private _handleAuditCode;
    private _handleApplyFix;
    private _handleChatQuery;
    private _goToLine;
    private _executeFunction;
    private _processArgs;
    private _executePython;
    private _executeJava;
    private _executeJavaScript;
    private _executeC;
    private _executeCpp;
    private _executeGo;
    private _extractFunctionSignature;
    private _generateCCall;
    private _runCommand;
    static createOrShow(extensionUri: vscode.Uri): DashboardPanel;
    updateFunctions(fileName: string, filePath: string, functions: CodeFunction[], fileContent: string, language?: string): void;
    dispose(): void;
    private _getHtmlForWebview;
    private _getNonce;
}
//# sourceMappingURL=DashboardPanel.d.ts.map