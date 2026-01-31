/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/extension.ts"
/*!**************************!*\
  !*** ./src/extension.ts ***!
  \**************************/
(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(__webpack_require__(/*! vscode */ "vscode"));
const DashboardPanel_1 = __webpack_require__(/*! ./panels/DashboardPanel */ "./src/panels/DashboardPanel.ts");
const pythonParser_1 = __webpack_require__(/*! ./utilities/pythonParser */ "./src/utilities/pythonParser.ts");
let dashboardPanel;
function activate(context) {
    console.log('Sentinel-Atomic extension is now active!');
    // Register the open dashboard command
    const openDashboardCommand = vscode.commands.registerCommand('sentinel.openDashboard', () => {
        dashboardPanel = DashboardPanel_1.DashboardPanel.createOrShow(context.extensionUri);
        // If there's an active Python file, parse it immediately
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.languageId === 'python') {
            updateDashboard(activeEditor.document);
        }
    });
    // Watch for active editor changes
    const onEditorChange = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && editor.document.languageId === 'python' && dashboardPanel) {
            updateDashboard(editor.document);
        }
    });
    // Watch for document content changes
    const onDocumentChange = vscode.workspace.onDidChangeTextDocument((event) => {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor &&
            event.document === activeEditor.document &&
            event.document.languageId === 'python' &&
            dashboardPanel) {
            updateDashboard(event.document);
        }
    });
    context.subscriptions.push(openDashboardCommand, onEditorChange, onDocumentChange);
}
/**
 * Parse the document and update the dashboard
 */
function updateDashboard(document) {
    if (!dashboardPanel) {
        return;
    }
    const sourceCode = document.getText();
    const functions = (0, pythonParser_1.parsePythonFunctions)(sourceCode);
    const fileName = document.fileName.split(/[/\\]/).pop() || 'Unknown';
    const filePath = document.fileName;
    dashboardPanel.updateFunctions(fileName, filePath, functions);
}
function deactivate() {
    if (dashboardPanel) {
        dashboardPanel.dispose();
    }
}


/***/ },

/***/ "./src/panels/DashboardPanel.ts"
/*!**************************************!*\
  !*** ./src/panels/DashboardPanel.ts ***!
  \**************************************/
(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DashboardPanel = void 0;
const vscode = __importStar(__webpack_require__(/*! vscode */ "vscode"));
const cp = __importStar(__webpack_require__(/*! child_process */ "child_process"));
const path = __importStar(__webpack_require__(/*! path */ "path"));
const fs = __importStar(__webpack_require__(/*! fs */ "fs"));
const os = __importStar(__webpack_require__(/*! os */ "os"));
/**
 * Manages the Sentinel Dashboard webview panel as a Singleton
 */
class DashboardPanel {
    constructor(panel, extensionUri) {
        this._disposables = [];
        this._currentFilePath = '';
        this._panel = panel;
        this._extensionUri = extensionUri;
        // Set the webview's initial html content
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'scanRisk':
                    vscode.window.showInformationMessage(`Scan Risk requested for: ${message.payload.functionName}`);
                    break;
                case 'goToLine':
                    this._goToLine(message.payload.lineNumber);
                    break;
                case 'executeFunction':
                    await this._executeFunction(message.payload.requestId, message.payload.functionName, message.payload.args, message.payload.filePath);
                    break;
            }
        }, null, this._disposables);
    }
    /**
     * Navigate to a specific line in the active Python file
     */
    _goToLine(lineNumber) {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'python') {
            const position = new vscode.Position(lineNumber - 1, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
            // Focus the editor
            vscode.window.showTextDocument(editor.document, editor.viewColumn);
        }
    }
    /**
     * Execute a Python function and return the result
     */
    async _executeFunction(requestId, functionName, args, filePath) {
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
                }
                catch {
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
            }
            finally {
                // Clean up temp file
                try {
                    fs.unlinkSync(tempFile);
                }
                catch {
                    // Ignore cleanup errors
                }
            }
        }
        catch (error) {
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
    _runPython(scriptPath) {
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
                }
                else {
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
    static createOrShow(extensionUri) {
        const column = vscode.ViewColumn.Beside;
        // If we already have a panel, show it
        if (DashboardPanel.currentPanel) {
            DashboardPanel.currentPanel._panel.reveal(column);
            return DashboardPanel.currentPanel;
        }
        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(DashboardPanel.viewType, 'Sentinel Dashboard', column, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'out')]
        });
        DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri);
        return DashboardPanel.currentPanel;
    }
    /**
     * Send updated function data to the webview
     */
    updateFunctions(fileName, filePath, functions) {
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
    dispose() {
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
    _getHtmlForWebview(webview) {
        // Get the local path to the bundled webview script
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'webview.js'));
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
    _getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
exports.DashboardPanel = DashboardPanel;
DashboardPanel.viewType = 'sentinelDashboard';


/***/ },

/***/ "./src/utilities/pythonParser.ts"
/*!***************************************!*\
  !*** ./src/utilities/pythonParser.ts ***!
  \***************************************/
(__unused_webpack_module, exports) {


/**
 * Python Function Parser
 * Uses line-by-line analysis with indentation tracking
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.parsePythonFunctions = parsePythonFunctions;
/**
 * Parse Python source code and extract all function definitions
 * Uses indentation-based parsing (not regex for body capture)
 */
function parsePythonFunctions(sourceCode) {
    const functions = [];
    const lines = sourceCode.split('\n');
    // Regex to match function definition line
    const functionDefRegex = /^(\s*)def\s+(\w+)\s*\(([^)]*)\)\s*(?:->.*)?:/;
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const match = line.match(functionDefRegex);
        if (match) {
            const baseIndent = match[1].length;
            const functionName = match[2];
            const functionArgs = match[3].trim();
            const lineStart = i + 1; // 1-indexed for VS Code
            // Collect function body lines
            const bodyLines = [line];
            let j = i + 1;
            while (j < lines.length) {
                const nextLine = lines[j];
                // Empty lines are part of the function
                if (nextLine.trim() === '') {
                    bodyLines.push(nextLine);
                    j++;
                    continue;
                }
                // Calculate indentation of this line
                const nextIndentMatch = nextLine.match(/^(\s*)/);
                const nextIndent = nextIndentMatch ? nextIndentMatch[1].length : 0;
                // If indentation is greater than base, it's part of the function
                if (nextIndent > baseIndent) {
                    bodyLines.push(nextLine);
                    j++;
                }
                else {
                    // Found a line with equal or less indentation - function ends
                    break;
                }
            }
            // Remove trailing empty lines from body
            while (bodyLines.length > 1 && bodyLines[bodyLines.length - 1].trim() === '') {
                bodyLines.pop();
            }
            const lineEnd = i + bodyLines.length; // 1-indexed
            functions.push({
                name: functionName,
                args: functionArgs,
                body: bodyLines.join('\n'),
                lineStart,
                lineEnd
            });
            // Move to the line after the function
            i = j;
        }
        else {
            i++;
        }
    }
    return functions;
}


/***/ },

/***/ "child_process"
/*!********************************!*\
  !*** external "child_process" ***!
  \********************************/
(module) {

module.exports = require("child_process");

/***/ },

/***/ "fs"
/*!*********************!*\
  !*** external "fs" ***!
  \*********************/
(module) {

module.exports = require("fs");

/***/ },

/***/ "os"
/*!*********************!*\
  !*** external "os" ***!
  \*********************/
(module) {

module.exports = require("os");

/***/ },

/***/ "path"
/*!***********************!*\
  !*** external "path" ***!
  \***********************/
(module) {

module.exports = require("path");

/***/ },

/***/ "vscode"
/*!*************************!*\
  !*** external "vscode" ***!
  \*************************/
(module) {

module.exports = require("vscode");

/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Check if module exists (development only)
/******/ 		if (__webpack_modules__[moduleId] === undefined) {
/******/ 			var e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./src/extension.ts");
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=extension.js.map