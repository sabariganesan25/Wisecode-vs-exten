import React, { useState, useEffect, useCallback } from 'react';
import AtomicCard from './components/AtomicCard';

interface PythonFunction {
    name: string;
    args: string;
    body: string;
    lineStart: number;
    lineEnd: number;
}

interface UpdateFunctionsMessage {
    type: 'updateFunctions';
    payload: {
        fileName: string;
        filePath: string;
        functions: PythonFunction[];
    };
}

interface ExecuteResultMessage {
    type: 'executeResult';
    payload: {
        requestId: string;
        success: boolean;
        result?: string;
        error?: string;
    };
}

type WebviewMessage = UpdateFunctionsMessage | ExecuteResultMessage;

// Declare vscode API type
declare const acquireVsCodeApi: () => {
    postMessage: (message: unknown) => void;
    getState: () => unknown;
    setState: (state: unknown) => void;
};

const vscode = acquireVsCodeApi();

// Store pending execution promises
const pendingExecutions: Map<string, {
    resolve: (value: { success: boolean; result?: string; error?: string }) => void;
}> = new Map();

let requestCounter = 0;

const App: React.FC = () => {
    const [fileName, setFileName] = useState<string>('');
    const [filePath, setFilePath] = useState<string>('');
    const [functions, setFunctions] = useState<PythonFunction[]>([]);

    useEffect(() => {
        // Listen for messages from the extension
        const handleMessage = (event: MessageEvent<WebviewMessage>) => {
            const message = event.data;

            if (message.type === 'updateFunctions') {
                setFileName(message.payload.fileName);
                setFilePath(message.payload.filePath);
                setFunctions(message.payload.functions);
            } else if (message.type === 'executeResult') {
                const pending = pendingExecutions.get(message.payload.requestId);
                if (pending) {
                    pending.resolve({
                        success: message.payload.success,
                        result: message.payload.result,
                        error: message.payload.error
                    });
                    pendingExecutions.delete(message.payload.requestId);
                }
            }
        };

        window.addEventListener('message', handleMessage);

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    const handleScanRisk = useCallback((functionName: string) => {
        vscode.postMessage({
            type: 'scanRisk',
            payload: { functionName }
        });
    }, []);

    const handleGoToLine = useCallback((lineNumber: number) => {
        vscode.postMessage({
            type: 'goToLine',
            payload: { lineNumber }
        });
    }, []);

    const handleExecuteFunction = useCallback(async (functionName: string, args: string[]): Promise<{ success: boolean; result?: string; error?: string }> => {
        const requestId = `exec-${++requestCounter}`;

        return new Promise((resolve) => {
            pendingExecutions.set(requestId, { resolve });

            vscode.postMessage({
                type: 'executeFunction',
                payload: {
                    requestId,
                    functionName,
                    args,
                    filePath
                }
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                if (pendingExecutions.has(requestId)) {
                    pendingExecutions.delete(requestId);
                    resolve({ success: false, error: 'Execution timed out after 30 seconds' });
                }
            }, 30000);
        });
    }, [filePath]);

    return (
        <div className="sentinel-container">
            <header className="sentinel-header">
                <h1>🛡️ Sentinel Dashboard</h1>
                {fileName && (
                    <span className="file-badge">{fileName}</span>
                )}
            </header>

            {functions.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">📂</div>
                    <h2>No Functions Detected</h2>
                    <p>Open a Python file to visualize its functions</p>
                </div>
            ) : (
                <div className="bento-grid">
                    {functions.map((func, index) => (
                        <AtomicCard
                            key={`${func.name}-${func.lineStart}-${index}`}
                            name={func.name}
                            args={func.args}
                            body={func.body}
                            lineStart={func.lineStart}
                            lineEnd={func.lineEnd}
                            onScanRisk={handleScanRisk}
                            onGoToLine={handleGoToLine}
                            onExecuteFunction={handleExecuteFunction}
                        />
                    ))}
                </div>
            )}

            <footer className="sentinel-footer">
                <span>{functions.length} function{functions.length !== 1 ? 's' : ''} detected</span>
            </footer>
        </div>
    );
};

export default App;
