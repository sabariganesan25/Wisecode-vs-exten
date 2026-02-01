import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { CodeFunction } from '../utilities/pythonParser';
import { watsonService } from '../services/WatsonAgentService';

export class DashboardPanel {
    public static currentPanel: DashboardPanel | undefined;
    public static readonly viewType = 'wisecodeDashboard';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _currentFilePath: string = '';
    private _currentFileContent: string = '';
    private _currentLanguage: string = 'python';
    private _webviewReady: boolean = false;
    private _pendingUpdate: { fileName: string; filePath: string; functions: CodeFunction[]; fileContent: string; language: string } | null = null;

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                console.log('[Dashboard] Received:', message.type);

                try {
                    switch (message.type) {
                        case 'webviewReady':
                            console.log('[Dashboard] Webview is ready!');
                            this._webviewReady = true;
                            // Send any pending update
                            if (this._pendingUpdate) {
                                console.log('[Dashboard] Sending pending update');
                                this._sendUpdate(this._pendingUpdate.fileName, this._pendingUpdate.filePath, this._pendingUpdate.functions, this._pendingUpdate.fileContent, this._pendingUpdate.language);
                                this._pendingUpdate = null;
                            }
                            break;
                        case 'goToLine':
                            this._goToLine(message.payload.lineNumber);
                            break;
                        case 'executeFunction':
                            await this._executeFunction(message.payload);
                            break;
                        case 'generateGuide':
                            await this._handleGenerateGuide(message.payload.requestId);
                            break;
                        case 'generateEdgeCases':
                            await this._handleGenerateEdgeCases(message.payload);
                            break;
                        case 'auditCode':
                            await this._handleAuditCode(message.payload);
                            break;
                        case 'applyFix':
                            await this._handleApplyFix(message.payload);
                            break;
                        case 'chatQuery':
                            await this._handleChatQuery(message.payload);
                            break;
                        case 'summarizeFunction':
                            await this._handleSummarize(message.payload);
                            break;
                        case 'explainError':
                            await this._handleExplainError(message.payload);
                            break;
                        case 'quickFix':
                            await this._handleQuickFix(message.payload);
                            break;
                        case 'checkCompliance':
                            await this._handleCheckCompliance(message.payload);
                            break;
                        case 'fixCompliance':
                            await this._handleFixCompliance(message.payload);
                            break;
                        case 'checkFullFileCompliance':
                            await this._handleCheckFullFileCompliance(message.payload);
                            break;
                        case 'fixFullFileCompliance':
                            await this._handleFixFullFileCompliance(message.payload);
                            break;
                        case 'applyFullFileFix':
                            await this._handleApplyFullFileFix(message.payload);
                            break;
                    }
                } catch (error: any) {
                    console.error('[Dashboard] Error:', error.message);
                    vscode.window.showErrorMessage(`Error: ${error.message}`);
                }
            },
            null,
            this._disposables
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // QUICK FIX HANDLER - Generates working code from error
    // ═══════════════════════════════════════════════════════════════

    private async _handleQuickFix(payload: any): Promise<void> {
        const { requestId, functionName, functionCode, errorMessage, inputArgs } = payload;
        console.log('[Dashboard] Quick fix for:', functionName);

        try {
            vscode.window.showInformationMessage('Generating fix with IBM Watsonx AI...');

            const fixedCode = await watsonService.generateQuickFix(
                functionCode,
                functionName,
                errorMessage,
                inputArgs,
                this._currentLanguage
            );

            this._panel.webview.postMessage({
                type: 'quickFixResult',
                payload: { requestId, success: true, fixedCode }
            });
        } catch (error: any) {
            console.error('[Dashboard] Quick fix failed:', error);
            this._panel.webview.postMessage({
                type: 'quickFixResult',
                payload: { requestId, success: false, error: error.message }
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // COMPLIANCE CHECK HANDLER - Government Regulation Analysis
    // ═══════════════════════════════════════════════════════════════

    private async _handleCheckCompliance(payload: any): Promise<void> {
        const { requestId, functionName, functionCode } = payload;
        console.log('[Dashboard] Compliance check for:', functionName);

        try {
            vscode.window.showInformationMessage('Checking government regulation compliance...');

            const result = await watsonService.checkCompliance(
                functionCode,
                functionName,
                this._currentLanguage
            );

            this._panel.webview.postMessage({
                type: 'complianceResult',
                payload: { requestId, success: true, ...result }
            });
        } catch (error: any) {
            console.error('[Dashboard] Compliance check failed:', error);
            this._panel.webview.postMessage({
                type: 'complianceResult',
                payload: { requestId, success: false, error: error.message }
            });
        }
    }

    private async _handleFixCompliance(payload: any): Promise<void> {
        const { requestId, functionName, functionCode, violations } = payload;
        console.log('[Dashboard] Fix compliance for:', functionName);

        try {
            vscode.window.showInformationMessage('Generating compliant code with IBM Watsonx AI...');

            const fixedCode = await watsonService.fixCompliance(
                functionCode,
                functionName,
                violations,
                this._currentLanguage
            );

            this._panel.webview.postMessage({
                type: 'fixComplianceResult',
                payload: { requestId, success: true, fixedCode }
            });
        } catch (error: any) {
            console.error('[Dashboard] Fix compliance failed:', error);
            this._panel.webview.postMessage({
                type: 'fixComplianceResult',
                payload: { requestId, success: false, error: error.message }
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // FULL FILE COMPLIANCE HANDLERS - Scans entire code file
    // ═══════════════════════════════════════════════════════════════

    private async _handleCheckFullFileCompliance(payload: any): Promise<void> {
        const { requestId } = payload;
        const fileName = this._currentFilePath.split(/[/\\]/).pop() || 'Unknown';
        console.log('[Dashboard] Full file compliance check for:', fileName);

        try {
            vscode.window.showInformationMessage('🔍 Scanning entire file for government regulation compliance...');

            const result = await watsonService.checkFullFileCompliance(
                this._currentFileContent,
                fileName,
                this._currentLanguage
            );

            this._panel.webview.postMessage({
                type: 'fullFileComplianceResult',
                payload: { requestId, success: true, ...result }
            });

            // If not compliant, show notification
            if (!result.isCompliant) {
                vscode.window.showWarningMessage(
                    `⚠️ Found ${result.violations.length} compliance violation(s) in ${fileName}`
                );
            } else {
                vscode.window.showInformationMessage('✅ File is fully compliant with government regulations!');
            }
        } catch (error: any) {
            console.error('[Dashboard] Full file compliance check failed:', error);
            this._panel.webview.postMessage({
                type: 'fullFileComplianceResult',
                payload: { requestId, success: false, error: error.message }
            });
        }
    }

    private async _handleFixFullFileCompliance(payload: any): Promise<void> {
        const { requestId, violations } = payload;
        const fileName = this._currentFilePath.split(/[/\\]/).pop() || 'Unknown';
        console.log('[Dashboard] Fix full file compliance. Violations:', violations?.length);

        try {
            vscode.window.showInformationMessage('🔧 Generating compliant code for entire file...');

            const fixedCode = await watsonService.fixFullFileCompliance(
                this._currentFileContent,
                fileName,
                violations,
                this._currentLanguage
            );

            this._panel.webview.postMessage({
                type: 'fixFullFileComplianceResult',
                payload: { requestId, success: true, fixedCode }
            });
        } catch (error: any) {
            console.error('[Dashboard] Fix full file compliance failed:', error);
            this._panel.webview.postMessage({
                type: 'fixFullFileComplianceResult',
                payload: { requestId, success: false, error: error.message }
            });
        }
    }

    private async _handleApplyFullFileFix(payload: any): Promise<void> {
        const { fixedCode } = payload;
        console.log('[Dashboard] Applying full file fix to:', this._currentFilePath);

        try {
            if (!this._currentFilePath) {
                throw new Error('No active file path');
            }

            const document = await vscode.workspace.openTextDocument(this._currentFilePath);
            const editor = await vscode.window.showTextDocument(document);

            // Replace entire file content
            const lastLine = document.lineAt(document.lineCount - 1);
            const range = new vscode.Range(0, 0, document.lineCount - 1, lastLine.text.length);

            await editor.edit(editBuilder => {
                editBuilder.replace(range, fixedCode);
            });

            await document.save();
            vscode.window.showInformationMessage('✅ Applied government compliance fixes to the entire file.');

        } catch (error: any) {
            console.error('[Dashboard] Failed to apply full file fix:', error);
            vscode.window.showErrorMessage(`Failed to apply fix: ${error.message}`);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // EXPLAIN ERROR HANDLER - Uses Watson AI
    // ═══════════════════════════════════════════════════════════════

    private async _handleExplainError(payload: any): Promise<void> {
        const { requestId, functionName, functionCode, errorMessage, inputArgs } = payload;
        console.log('[Dashboard] Explain error for:', functionName, 'Error:', errorMessage);

        try {
            vscode.window.showInformationMessage('Analyzing error with IBM Watsonx AI...');

            const explanation = await watsonService.explainError(
                functionCode,
                functionName,
                errorMessage,
                inputArgs,
                this._currentLanguage
            );

            console.log('[Dashboard] Got explanation:', explanation);

            this._panel.webview.postMessage({
                type: 'errorExplanationResult',
                payload: { requestId, success: true, explanation }
            });
        } catch (error: any) {
            console.error('[Dashboard] Explain error failed:', error);
            this._panel.webview.postMessage({
                type: 'errorExplanationResult',
                payload: { requestId, success: false, error: error.message }
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // SUMMARIZE HANDLER
    // ═══════════════════════════════════════════════════════════════

    private async _handleSummarize(payload: any): Promise<void> {
        const { requestId, functionName, functionCode } = payload;
        console.log('[Dashboard] Summarizing:', functionName);

        try {
            const summary = await watsonService.summarizeFunction(functionCode, functionName);
            console.log('[Dashboard] Summary result:', summary);
            this._panel.webview.postMessage({
                type: 'summarizeResult',
                payload: { requestId, success: true, summary }
            });
        } catch (error: any) {
            console.error('[Dashboard] Summarize error:', error.message);
            vscode.window.showWarningMessage(`Summarize failed: ${error.message}`);
            this._panel.webview.postMessage({
                type: 'summarizeResult',
                payload: { requestId, success: false, error: error.message }
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // GUIDE HANDLER
    // ═══════════════════════════════════════════════════════════════

    private async _handleGenerateGuide(requestId: string): Promise<void> {
        console.log('[Dashboard] Generating guide...');
        console.log('[Dashboard] File content length:', this._currentFileContent?.length || 0);

        try {
            const guide = await watsonService.generateGuide(
                this._currentFileContent,
                path.basename(this._currentFilePath)
            );
            console.log('[Dashboard] Guide result:', guide);

            this._panel.webview.postMessage({
                type: 'guideResult',
                payload: { requestId, success: true, guide }
            });
        } catch (error: any) {
            console.error('[Dashboard] Guide error:', error.message);
            vscode.window.showWarningMessage(`Guide generation failed: ${error.message}`);
            this._panel.webview.postMessage({
                type: 'guideResult',
                payload: { requestId, success: false, error: error.message }
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // EDGE CASES HANDLER
    // ═══════════════════════════════════════════════════════════════

    private async _handleGenerateEdgeCases(payload: any): Promise<void> {
        const { requestId, functionName, functionCode } = payload;
        console.log('[Dashboard] Edge cases for:', functionName);

        try {
            const edgeCases = await watsonService.generateEdgeCases(functionCode, functionName);
            this._panel.webview.postMessage({
                type: 'edgeCasesResult',
                payload: { requestId, success: true, edgeCases }
            });
        } catch (error: any) {
            this._panel.webview.postMessage({
                type: 'edgeCasesResult',
                payload: { requestId, success: false, error: error.message }
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // AUDIT HANDLER
    // ═══════════════════════════════════════════════════════════════

    private async _handleAuditCode(payload: any): Promise<void> {
        const { requestId, functionName, functionCode } = payload;
        console.log('[Dashboard] Auditing:', functionName);

        try {
            const auditResult = await watsonService.auditCode(functionCode, functionName);
            this._panel.webview.postMessage({
                type: 'auditResult',
                payload: { requestId, success: true, auditResult }
            });
        } catch (error: any) {
            this._panel.webview.postMessage({
                type: 'auditResult',
                payload: { requestId, success: false, error: error.message }
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // APPLY FIX HANDLER
    // ═══════════════════════════════════════════════════════════════

    private async _handleApplyFix(payload: any): Promise<void> {
        const { functionName, functionCode, issue, lineStart, lineEnd } = payload;
        console.log('[Dashboard] Applying fix for:', functionName);

        if (!this._currentFilePath || !fs.existsSync(this._currentFilePath)) {
            vscode.window.showErrorMessage('No file available');
            return;
        }

        const answer = await vscode.window.showWarningMessage(
            `Apply AI fix for "${functionName}"?\nThis will replace the function code.`,
            { modal: true },
            'Apply Fix',
            'Cancel'
        );

        if (answer !== 'Apply Fix') return;

        try {
            vscode.window.showInformationMessage('Generating fix with IBM Watsonx AI...');
            const fixedCode = await watsonService.generateFix(functionCode, functionName, issue, this._currentLanguage);

            const document = await vscode.workspace.openTextDocument(this._currentFilePath);
            const editor = await vscode.window.showTextDocument(document);

            const startLine = Math.max(0, lineStart - 1);
            const endLine = Math.max(startLine, lineEnd);

            const startPos = new vscode.Position(startLine, 0);
            const endPos = new vscode.Position(endLine, document.lineAt(Math.min(endLine, document.lineCount - 1)).text.length);
            const range = new vscode.Range(startPos, endPos);

            await editor.edit(editBuilder => {
                editBuilder.replace(range, fixedCode);
            });

            console.log('[Dashboard] Code replaced successfully');
            vscode.window.showInformationMessage(`Function "${functionName}" has been fixed!`);

        } catch (error: any) {
            console.error('[Dashboard] Fix error:', error);
            vscode.window.showErrorMessage(`Failed to apply fix: ${error.message}`);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // CHAT HANDLER
    // ═══════════════════════════════════════════════════════════════

    private async _handleChatQuery(payload: any): Promise<void> {
        const { requestId, functionName, functionCode, question } = payload;
        console.log('[Dashboard] Chat:', functionName);

        try {
            const response = await watsonService.chatAboutCode(functionCode, functionName, question);
            this._panel.webview.postMessage({
                type: 'chatResult',
                payload: { requestId, success: true, response }
            });
        } catch (error: any) {
            this._panel.webview.postMessage({
                type: 'chatResult',
                payload: { requestId, success: false, error: error.message }
            });
        }
    }

    private _goToLine(lineNumber: number): void {
        if (this._currentFilePath && fs.existsSync(this._currentFilePath)) {
            vscode.workspace.openTextDocument(this._currentFilePath).then(doc => {
                vscode.window.showTextDocument(doc).then(editor => {
                    const position = new vscode.Position(lineNumber - 1, 0);
                    editor.selection = new vscode.Selection(position, position);
                    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
                });
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // EXECUTE FUNCTION - Multi-Language Support
    // ═══════════════════════════════════════════════════════════════

    private async _executeFunction(payload: any): Promise<void> {
        const { requestId, functionName, args, filePath } = payload;
        console.log('[Dashboard] Execute:', functionName, 'args:', args, 'lang:', this._currentLanguage);

        const actualPath = filePath || this._currentFilePath;

        if (!actualPath || !fs.existsSync(actualPath)) {
            this._panel.webview.postMessage({
                type: 'executeResult',
                payload: { requestId, success: false, error: `File not found: ${actualPath}` }
            });
            return;
        }

        try {
            let result: { success: boolean; result?: string; error?: string };

            switch (this._currentLanguage) {
                case 'python':
                    result = await this._executePython(functionName, args, actualPath);
                    break;
                case 'java':
                    result = await this._executeJava(functionName, args, actualPath);
                    break;
                case 'javascript':
                case 'typescript':
                    result = await this._executeJavaScript(functionName, args, actualPath);
                    break;
                case 'c':
                    result = await this._executeC(functionName, args, actualPath);
                    break;
                case 'cpp':
                    result = await this._executeCpp(functionName, args, actualPath);
                    break;
                case 'go':
                    result = await this._executeGo(functionName, args, actualPath);
                    break;
                default:
                    result = { success: false, error: `Execution not yet supported for ${this._currentLanguage}` };
            }

            this._panel.webview.postMessage({
                type: 'executeResult',
                payload: { requestId, ...result }
            });

        } catch (error: any) {
            this._panel.webview.postMessage({
                type: 'executeResult',
                payload: { requestId, success: false, error: error.message }
            });
        }
    }

    // Auto-quote strings for any language - filter out empty args
    private _processArgs(args: string[]): string[] {
        return args
            .filter((arg: string) => arg !== undefined && arg !== null && arg.trim() !== '')
            .map((arg: string) => {
                const trimmed = arg.trim();
                if (!trimmed) return trimmed;
                if (!isNaN(Number(trimmed))) return trimmed;
                if (trimmed.startsWith('"') || trimmed.startsWith("'")) return trimmed;
                if (trimmed.startsWith('[') || trimmed.startsWith('{')) return trimmed;
                if (trimmed === 'null' || trimmed === 'None' || trimmed === 'nil' || trimmed === 'true' || trimmed === 'false') return trimmed;
                return `"${trimmed}"`;
            });
    }

    private async _executePython(functionName: string, args: string[], filePath: string): Promise<{ success: boolean; result?: string; error?: string }> {
        const processedArgs = this._processArgs(args);
        const argsStr = processedArgs.join(', ');
        const dirPath = path.dirname(filePath).replace(/\\/g, '/');
        const moduleName = path.basename(filePath, '.py');

        const isClassMethod = this._currentFileContent.includes(`def ${functionName}(self`);

        let pythonCode: string;

        if (isClassMethod) {
            const classMatch = this._currentFileContent.match(new RegExp(`class\\s+(\\w+)[^:]*:[\\s\\S]*?def\\s+${functionName}\\s*\\(`));
            const className = classMatch ? classMatch[1] : null;

            if (className) {
                pythonCode = `
import sys, json
sys.path.insert(0, r'${dirPath}')
try:
    from ${moduleName} import ${className}
    obj = ${className}()
    result = obj.${functionName}(${argsStr})
    print(json.dumps({"success": True, "result": repr(result)}))
except Exception as e:
    print(json.dumps({"success": False, "error": f"{type(e).__name__}: {e}"}))
`;
            } else {
                throw new Error(`Could not find class for method: ${functionName}`);
            }
        } else {
            pythonCode = `
import sys, json
sys.path.insert(0, r'${dirPath}')
try:
    from ${moduleName} import ${functionName}
    result = ${functionName}(${argsStr})
    print(json.dumps({"success": True, "result": repr(result)}))
except Exception as e:
    print(json.dumps({"success": False, "error": f"{type(e).__name__}: {e}"}))
`;
        }

        const tempFile = path.join(os.tmpdir(), `sentinel_exec_${Date.now()}.py`);
        fs.writeFileSync(tempFile, pythonCode, 'utf8');

        try {
            const output = await this._runCommand('python', [tempFile], os.tmpdir());
            fs.unlinkSync(tempFile);
            return JSON.parse(output.trim());
        } catch (error: any) {
            try { fs.unlinkSync(tempFile); } catch { }
            return { success: false, error: error.message };
        }
    }

    private async _executeJava(functionName: string, args: string[], filePath: string): Promise<{ success: boolean; result?: string; error?: string }> {
        const processedArgs = this._processArgs(args);
        const argsStr = processedArgs.join(', ');
        const dirPath = path.dirname(filePath);
        const className = path.basename(filePath, '.java');

        const javaCode = `
public class SentinelRunner {
    public static void main(String[] args) {
        try {
            Object result = ${className}.${functionName}(${argsStr});
            System.out.println("{\\"success\\": true, \\"result\\": \\"" + String.valueOf(result).replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"") + "\\"}");
        } catch (Exception e) {
            System.out.println("{\\"success\\": false, \\"error\\": \\"" + e.getClass().getSimpleName() + ": " + e.getMessage().replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"") + "\\"}");
        }
    }
}
`;

        const runnerFile = path.join(dirPath, 'SentinelRunner.java');
        fs.writeFileSync(runnerFile, javaCode, 'utf8');

        try {
            await this._runCommand('javac', [className + '.java', 'SentinelRunner.java'], dirPath);
            const output = await this._runCommand('java', ['SentinelRunner'], dirPath);

            try {
                fs.unlinkSync(runnerFile);
                fs.unlinkSync(path.join(dirPath, 'SentinelRunner.class'));
                fs.unlinkSync(path.join(dirPath, className + '.class'));
            } catch { }

            return JSON.parse(output.trim());
        } catch (error: any) {
            try { fs.unlinkSync(runnerFile); } catch { }
            return { success: false, error: error.message };
        }
    }

    private async _executeJavaScript(functionName: string, args: string[], filePath: string): Promise<{ success: boolean; result?: string; error?: string }> {
        const processedArgs = this._processArgs(args);
        const argsStr = processedArgs.join(', ');
        const dirPath = path.dirname(filePath);

        const jsCode = `
try {
    const mod = require('${filePath.replace(/\\/g, '/')}');
    const fn = mod.${functionName} || mod.default?.${functionName};
    if (!fn) throw new Error('Function not found: ${functionName}');
    const result = fn(${argsStr});
    console.log(JSON.stringify({ success: true, result: String(result) }));
} catch (e) {
    console.log(JSON.stringify({ success: false, error: e.name + ': ' + e.message }));
}
`;

        const tempFile = path.join(os.tmpdir(), `sentinel_exec_${Date.now()}.js`);
        fs.writeFileSync(tempFile, jsCode, 'utf8');

        try {
            const output = await this._runCommand('node', [tempFile], dirPath);
            fs.unlinkSync(tempFile);
            return JSON.parse(output.trim());
        } catch (error: any) {
            try { fs.unlinkSync(tempFile); } catch { }
            return { success: false, error: error.message };
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // C EXECUTION - Using GCC
    // ═══════════════════════════════════════════════════════════════

    private async _executeC(functionName: string, args: string[], filePath: string): Promise<{ success: boolean; result?: string; error?: string }> {
        const processedArgs = this._processArgs(args);
        const argsStr = processedArgs.join(', ');
        const dirPath = path.dirname(filePath);
        const baseName = path.basename(filePath, '.c');
        const timestamp = Date.now();

        // Create a test runner that includes the original file
        const cCode = `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Forward declare the function
${this._extractFunctionSignature(functionName, 'c')};

// Include the original source
#include "${path.basename(filePath)}"

int main() {
    ${this._generateCCall(functionName, argsStr)}
    return 0;
}
`;

        const runnerFile = path.join(dirPath, `sentinel_runner_${timestamp}.c`);
        const exeFile = path.join(dirPath, `sentinel_runner_${timestamp}${process.platform === 'win32' ? '.exe' : ''}`);
        fs.writeFileSync(runnerFile, cCode, 'utf8');

        try {
            // Compile with gcc
            await this._runCommand('gcc', ['-o', exeFile, filePath], dirPath);

            // Run
            const output = await this._runCommand(exeFile, [], dirPath);

            // Cleanup
            try {
                fs.unlinkSync(runnerFile);
                fs.unlinkSync(exeFile);
            } catch { }

            // Parse output
            try {
                return JSON.parse(output.trim());
            } catch {
                return { success: true, result: output.trim() };
            }
        } catch (error: any) {
            try {
                fs.unlinkSync(runnerFile);
                fs.unlinkSync(exeFile);
            } catch { }
            return { success: false, error: error.message };
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // C++ EXECUTION - Using G++
    // ═══════════════════════════════════════════════════════════════

    private async _executeCpp(functionName: string, args: string[], filePath: string): Promise<{ success: boolean; result?: string; error?: string }> {
        const processedArgs = this._processArgs(args);
        const argsStr = processedArgs.join(', ');
        const dirPath = path.dirname(filePath);
        const timestamp = Date.now();

        // Create a wrapper that calls the function
        const cppCode = `
#include <iostream>
#include <sstream>
#include <vector>
#include <string>

// Include the original source
#include "${path.basename(filePath)}"

int main() {
    try {
        auto result = ${functionName}(${argsStr});
        std::ostringstream oss;
        oss << result;
        std::cout << "{\\"success\\": true, \\"result\\": \\"" << oss.str() << "\\"}" << std::endl;
    } catch (const std::exception& e) {
        std::cout << "{\\"success\\": false, \\"error\\": \\"" << e.what() << "\\"}" << std::endl;
    } catch (...) {
        std::cout << "{\\"success\\": false, \\"error\\": \\"Unknown error\\"}" << std::endl;
    }
    return 0;
}
`;

        const runnerFile = path.join(dirPath, `wisecode_runner_${timestamp}.cpp`);
        const exeFile = path.join(dirPath, `wisecode_runner_${timestamp}${process.platform === 'win32' ? '.exe' : ''}`);
        fs.writeFileSync(runnerFile, cppCode, 'utf8');

        try {
            // Compile with g++
            await this._runCommand('g++', ['-std=c++17', '-o', exeFile, runnerFile], dirPath);

            // Run
            const output = await this._runCommand(exeFile, [], dirPath);

            // Cleanup
            try {
                fs.unlinkSync(runnerFile);
                fs.unlinkSync(exeFile);
            } catch { }

            return JSON.parse(output.trim());
        } catch (error: any) {
            try {
                fs.unlinkSync(runnerFile);
                fs.unlinkSync(exeFile);
            } catch { }
            return { success: false, error: error.message };
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // GO EXECUTION
    // ═══════════════════════════════════════════════════════════════

    private async _executeGo(functionName: string, args: string[], filePath: string): Promise<{ success: boolean; result?: string; error?: string }> {
        const processedArgs = this._processArgs(args);
        const argsStr = processedArgs.join(', ');
        const dirPath = path.dirname(filePath);
        const timestamp = Date.now();

        // Create a test runner
        const goCode = `
package main

import (
    "encoding/json"
    "fmt"
)

// The function is defined in the same package

func main() {
    defer func() {
        if r := recover(); r != nil {
            result := map[string]interface{}{"success": false, "error": fmt.Sprintf("%v", r)}
            jsonBytes, _ := json.Marshal(result)
            fmt.Println(string(jsonBytes))
        }
    }()

    result := ${functionName}(${argsStr})
    out := map[string]interface{}{"success": true, "result": fmt.Sprintf("%v", result)}
    jsonBytes, _ := json.Marshal(out)
    fmt.Println(string(jsonBytes))
}
`;

        const runnerFile = path.join(dirPath, `wisecode_runner_${timestamp}.go`);
        fs.writeFileSync(runnerFile, goCode, 'utf8');

        try {
            // Run with go run (runs both files together)
            const output = await this._runCommand('go', ['run', path.basename(filePath), `wisecode_runner_${timestamp}.go`], dirPath);

            // Cleanup
            try { fs.unlinkSync(runnerFile); } catch { }

            return JSON.parse(output.trim());
        } catch (error: any) {
            try { fs.unlinkSync(runnerFile); } catch { }
            return { success: false, error: error.message };
        }
    }

    private _extractFunctionSignature(functionName: string, lang: string): string {
        // Extract function signature from current file content
        const funcMatch = this._currentFileContent.match(new RegExp(`(\\w+\\*?\\s+${functionName}\\s*\\([^)]*\\))`));
        return funcMatch ? funcMatch[1] : `void ${functionName}()`;
    }

    private _generateCCall(functionName: string, argsStr: string): string {
        return `
    printf("{\\"success\\": true, \\"result\\": \\"%d\\"}", ${functionName}(${argsStr}));
`;
    }

    private _runCommand(cmd: string, args: string[], cwd: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const proc = cp.spawn(cmd, args, { cwd, shell: true });

            let stdout = '', stderr = '';
            proc.stdout.on('data', (data) => { stdout += data.toString(); });
            proc.stderr.on('data', (data) => { stderr += data.toString(); });

            proc.on('close', (exitCode) => {
                if (exitCode === 0) resolve(stdout);
                else reject(new Error(stderr || stdout || `Exit code ${exitCode}`));
            });

            proc.on('error', (err) => reject(new Error(`Command error: ${err.message}`)));
            setTimeout(() => { proc.kill(); reject(new Error('Timeout (30s)')); }, 30000);
        });
    }

    public static createOrShow(extensionUri: vscode.Uri): DashboardPanel {
        const column = vscode.ViewColumn.Beside;

        if (DashboardPanel.currentPanel) {
            DashboardPanel.currentPanel._panel.reveal(column);
            return DashboardPanel.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            DashboardPanel.viewType,
            'Wisecode Dashboard',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'out'),
                    vscode.Uri.joinPath(extensionUri, 'images')
                ]
            }
        );

        DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri);
        return DashboardPanel.currentPanel;
    }

    public updateFunctions(fileName: string, filePath: string, functions: CodeFunction[], fileContent: string, language: string = 'python'): void {
        this._currentFilePath = filePath;
        this._currentFileContent = fileContent;
        this._currentLanguage = language;

        if (this._webviewReady) {
            this._sendUpdate(fileName, filePath, functions, fileContent, language);
        } else {
            console.log('[Dashboard] Webview not ready, queueing update for:', fileName);
            this._pendingUpdate = { fileName, filePath, functions, fileContent, language };
        }
    }

    private _sendUpdate(fileName: string, filePath: string, functions: CodeFunction[], fileContent: string, language: string): void {
        const isConfigured = watsonService.isConfigured();
        const canExecute = ['python', 'java', 'javascript', 'typescript', 'c', 'cpp', 'go'].includes(language);

        console.log('[Dashboard] Sending update:', fileName, '- Lang:', language, '- Functions:', functions.length, '- Configured:', isConfigured);

        this._panel.webview.postMessage({
            type: 'updateFunctions',
            payload: { fileName, filePath, functions, isConfigured, language, canExecute }
        });
    }

    public dispose(): void {
        DashboardPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const d = this._disposables.pop();
            if (d) d.dispose();
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'webview.js'));
        const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'images', 'icon.png'));
        const nonce = this._getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data:; script-src 'nonce-${nonce}';">
    <title>Wisecode Dashboard</title>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}">
        window.logoUri = "${logoUri}";
    </script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }

    private _getNonce(): string {
        let text = '';
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) text += chars.charAt(Math.floor(Math.random() * chars.length));
        return text;
    }
}
