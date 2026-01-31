import * as vscode from 'vscode';
import { DashboardPanel } from './panels/DashboardPanel';
import { parseFunctions, detectLanguage } from './utilities/pythonParser';
import { setExtensionPath } from './services/WatsonAgentService';

let dashboardPanel: DashboardPanel | undefined;

// Supported languages
const SUPPORTED_LANGUAGES = ['python', 'java', 'go', 'c', 'cpp', 'javascript', 'typescript'];

export function activate(context: vscode.ExtensionContext) {
    console.log('Sentinel-Atomic Pro is now active!');
    console.log('[Extension] Extension path:', context.extensionPath);

    setExtensionPath(context.extensionPath);

    const openDashboardCommand = vscode.commands.registerCommand(
        'sentinel.openDashboard',
        () => {
            dashboardPanel = DashboardPanel.createOrShow(context.extensionUri);

            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && isSupportedLanguage(activeEditor.document)) {
                updateDashboard(activeEditor.document);
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

    console.log('[Extension] Found', functions.length, 'functions');

    dashboardPanel.updateFunctions(fileName, filePath, functions, sourceCode, language);
}

export function deactivate() {
    if (dashboardPanel) {
        dashboardPanel.dispose();
    }
}
