import * as vscode from 'vscode';
import { DashboardPanel } from './panels/DashboardPanel';
import { parsePythonFunctions } from './utilities/pythonParser';

let dashboardPanel: DashboardPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Sentinel-Atomic extension is now active!');

    // Register the open dashboard command
    const openDashboardCommand = vscode.commands.registerCommand(
        'sentinel.openDashboard',
        () => {
            dashboardPanel = DashboardPanel.createOrShow(context.extensionUri);

            // If there's an active Python file, parse it immediately
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && activeEditor.document.languageId === 'python') {
                updateDashboard(activeEditor.document);
            }
        }
    );

    // Watch for active editor changes
    const onEditorChange = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && editor.document.languageId === 'python' && dashboardPanel) {
            updateDashboard(editor.document);
        }
    });

    // Watch for document content changes
    const onDocumentChange = vscode.workspace.onDidChangeTextDocument((event) => {
        const activeEditor = vscode.window.activeTextEditor;
        if (
            activeEditor &&
            event.document === activeEditor.document &&
            event.document.languageId === 'python' &&
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

/**
 * Parse the document and update the dashboard
 */
function updateDashboard(document: vscode.TextDocument): void {
    if (!dashboardPanel) {
        return;
    }

    const sourceCode = document.getText();
    const functions = parsePythonFunctions(sourceCode);
    const fileName = document.fileName.split(/[/\\]/).pop() || 'Unknown';
    const filePath = document.fileName;

    dashboardPanel.updateFunctions(fileName, filePath, functions);
}

export function deactivate() {
    if (dashboardPanel) {
        dashboardPanel.dispose();
    }
}
