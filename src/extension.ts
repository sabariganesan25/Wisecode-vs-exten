import * as vscode from 'vscode';
import { DashboardPanel } from './panels/DashboardPanel';
import { SidebarProvider } from './providers/SidebarProvider';
import { parseFunctions, detectLanguage } from './utilities/pythonParser';
import { setExtensionPath } from './services/WatsonAgentService';

let dashboardPanel: DashboardPanel | undefined;

// Supported languages
const SUPPORTED_LANGUAGES = ['python', 'java', 'go', 'c', 'cpp', 'javascript', 'typescript'];

export function activate(context: vscode.ExtensionContext) {
    console.log('Wisecode AI is now active!');
    console.log('[Extension] Extension path:', context.extensionPath);

    setExtensionPath(context.extensionPath);

    const sidebarProvider = new SidebarProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("wisecode.sidebarView", sidebarProvider)
    );

    const openDashboardCommand = vscode.commands.registerCommand(
        'wisecode.openDashboard',
        () => {
            console.log('[Extension] Opening dashboard...');
            dashboardPanel = DashboardPanel.createOrShow(context.extensionUri);

            // Try to get the active editor
            const activeEditor = vscode.window.activeTextEditor;
            console.log('[Extension] Active editor:', activeEditor?.document.fileName);

            if (activeEditor && isSupportedLanguage(activeEditor.document)) {
                console.log('[Extension] Found active editor with supported language');
                updateDashboard(activeEditor.document);
            } else {
                // Try visible text editors
                console.log('[Extension] No active editor, checking visible editors...');
                const visibleEditors = vscode.window.visibleTextEditors;
                for (const editor of visibleEditors) {
                    if (isSupportedLanguage(editor.document)) {
                        console.log('[Extension] Found visible editor:', editor.document.fileName);
                        updateDashboard(editor.document);
                        return;
                    }
                }

                // Retry after a short delay (editor might not be ready yet)
                setTimeout(() => {
                    const retryEditor = vscode.window.activeTextEditor;
                    console.log('[Extension] Retry - Active editor:', retryEditor?.document.fileName);
                    if (retryEditor && isSupportedLanguage(retryEditor.document)) {
                        updateDashboard(retryEditor.document);
                    }
                }, 500);
            }
        }
    );

    const onEditorChange = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && isSupportedLanguage(editor.document) && dashboardPanel) {
            updateDashboard(editor.document);
        }
    });

    const onDocumentChange = vscode.workspace.onDidChangeTextDocument((event) => {
        const activeEditor = vscode.window.activeTextEditor;
        if (
            activeEditor &&
            event.document === activeEditor.document &&
            isSupportedLanguage(event.document) &&
            dashboardPanel
        ) {
            updateDashboard(event.document);
        }
    });

    context.subscriptions.push(
        openDashboardCommand,
        onEditorChange,
        onDocumentChange
    );
}

function isSupportedLanguage(document: vscode.TextDocument): boolean {
    const langId = document.languageId;
    const fileName = document.fileName;
    const detectedLang = detectLanguage(fileName);

    return SUPPORTED_LANGUAGES.includes(langId) ||
        SUPPORTED_LANGUAGES.includes(detectedLang) ||
        langId === 'python' || langId === 'java' || langId === 'go' ||
        langId === 'c' || langId === 'cpp' || langId === 'javascript' || langId === 'typescript';
}

function updateDashboard(document: vscode.TextDocument): void {
    if (!dashboardPanel) {
        return;
    }

    const sourceCode = document.getText();
    const fileName = document.fileName.split(/[/\\]/).pop() || 'Unknown';
    const filePath = document.fileName;
    const language = detectLanguage(fileName);

    console.log('[Extension] Parsing file:', fileName, 'Language:', language);

    const functions = parseFunctions(sourceCode, fileName);

    // [New Flow] Add "Whole File" as the first item so user can scan everything
    functions.unshift({
        name: 'Whole File (All Code)',
        parameters: [],
        code: sourceCode,
        lineStart: 1,
        lineEnd: document.lineCount,
        language: language
    });

    console.log('[Extension] Found', functions.length, 'functions');

    dashboardPanel.updateFunctions(fileName, filePath, functions, sourceCode, language);
}

export function deactivate() {
    if (dashboardPanel) {
        dashboardPanel.dispose();
    }
}
