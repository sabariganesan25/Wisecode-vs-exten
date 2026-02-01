import React, { useState, useEffect, useCallback } from 'react';
import { PythonFunction } from '../utilities/pythonParser';
import { AtomicCard } from './components/AtomicCard';
import { ChatInterface } from './components/ChatInterface';
import { GuidePanel } from './components/GuidePanel';
import { postMessage } from './vscodeApi';
import './styles.css';

interface EdgeCase {
    inputArgs: string;
    reason: string;
    severity: 'low' | 'medium' | 'high';
}

interface AuditResult {
    riskScore: number;
    issues: Array<{
        type: string;
        severity: string;
        issue: string;
        fixCode?: string;
    }>;
}

interface FunctionSummary {
    purpose: string;
    inputs: string;
    outputs: string;
    complexity: string;
}

interface ErrorExplanation {
    error: string;
    explanation: string;
    expectedInput: string;
    suggestion: string;
}

interface ExecuteResult {
    success: boolean;
    result?: string;
    error?: string;
}

interface ProjectGuide {
    summary: string;
    workflow: Array<{ step: number; function: string; description: string }>;
    dependencies: string[];
}

interface ComplianceViolation {
    regulation: 'GDPR' | 'HIPAA' | 'PCI-DSS' | 'SECURITY' | 'OTHER';
    issue: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    line?: number;
    suggestion: string;
}

interface ComplianceResult {
    isCompliant: boolean;
    overallScore: number;
    violations: ComplianceViolation[];
}

interface AppState {
    functions: PythonFunction[];
    fileName: string;
    filePath: string;
    language: string;
    isConfigured: boolean;
    canExecute: boolean;
}

interface PendingRequest {
    resolve: (value: any) => void;
    reject: (error: any) => void;
}

export const App: React.FC = () => {
    const [state, setState] = useState<AppState>({
        functions: [],
        fileName: '',
        filePath: '',
        language: 'python',
        isConfigured: false,
        canExecute: true
    });

    const [chatState, setChatState] = useState<{
        isOpen: boolean;
        functionName: string;
        functionCode: string;
    }>({
        isOpen: false,
        functionName: '',
        functionCode: ''
    });

    const [guideState, setGuideState] = useState<{
        isOpen: boolean;
        guide: ProjectGuide | null;
        isLoading: boolean;
    }>({
        isOpen: false,
        guide: null,
        isLoading: false
    });

    // Full file compliance state
    const [fileComplianceState, setFileComplianceState] = useState<{
        isScanning: boolean;
        isFixing: boolean;
        result: ComplianceResult | null;
        fixedCode: string | null;
    }>({
        isScanning: false,
        isFixing: false,
        result: null,
        fixedCode: null
    });

    const [pendingRequests] = useState<Map<string, PendingRequest>>(new Map());

    const handleMessage = useCallback((event: MessageEvent) => {
        const message = event.data;
        console.log('[Webview] Received message:', message.type);

        switch (message.type) {
            case 'updateFunctions':
                console.log('[Webview] Updating functions:', message.payload);
                setState({
                    functions: message.payload.functions || [],
                    fileName: message.payload.fileName || '',
                    filePath: message.payload.filePath || '',
                    language: message.payload.language || 'python',
                    isConfigured: message.payload.isConfigured ?? false,
                    canExecute: message.payload.canExecute ?? true
                });
                // Reset compliance state on file change
                setFileComplianceState({
                    isScanning: false,
                    isFixing: false,
                    result: null,
                    fixedCode: null
                });
                break;

            case 'executeResult': {
                const { requestId, success, result, error } = message.payload;
                if (requestId && pendingRequests.has(requestId)) {
                    const { resolve, reject } = pendingRequests.get(requestId)!;
                    if (success) {
                        resolve({ success: true, result });
                    } else {
                        resolve({ success: false, error });
                    }
                    pendingRequests.delete(requestId);
                }
                break;
            }

            case 'edgeCasesResult': {
                const { requestId, success, edgeCases, error } = message.payload;
                if (requestId && pendingRequests.has(requestId)) {
                    const { resolve, reject } = pendingRequests.get(requestId)!;
                    if (success) {
                        resolve(edgeCases);
                    } else {
                        reject(new Error(error));
                    }
                    pendingRequests.delete(requestId);
                }
                break;
            }

            case 'auditResult': {
                const { requestId, success, auditResult, error } = message.payload;
                if (requestId && pendingRequests.has(requestId)) {
                    const { resolve, reject } = pendingRequests.get(requestId)!;
                    if (success) {
                        resolve(auditResult);
                    } else {
                        reject(new Error(error));
                    }
                    pendingRequests.delete(requestId);
                }
                break;
            }

            case 'summarizeResult': {
                const { requestId, success, summary, error } = message.payload;
                if (requestId && pendingRequests.has(requestId)) {
                    const { resolve, reject } = pendingRequests.get(requestId)!;
                    if (success) {
                        resolve(summary);
                    } else {
                        reject(new Error(error));
                    }
                    pendingRequests.delete(requestId);
                }
                break;
            }

            case 'chatResult': {
                const { requestId, success, response, error } = message.payload;
                if (requestId && pendingRequests.has(requestId)) {
                    const { resolve, reject } = pendingRequests.get(requestId)!;
                    if (success) {
                        resolve(response);
                    } else {
                        reject(new Error(error));
                    }
                    pendingRequests.delete(requestId);
                }
                break;
            }

            case 'guideResult': {
                const { requestId, success, guide, error } = message.payload;
                if (requestId && pendingRequests.has(requestId)) {
                    const { resolve, reject } = pendingRequests.get(requestId)!;
                    if (success) {
                        resolve(guide);
                    } else {
                        reject(new Error(error));
                    }
                    pendingRequests.delete(requestId);
                }
                setGuideState(prev => ({ ...prev, isLoading: false }));
                break;
            }

            case 'errorExplanationResult': {
                const { requestId, success, explanation, error } = message.payload;
                if (requestId && pendingRequests.has(requestId)) {
                    const { resolve, reject } = pendingRequests.get(requestId)!;
                    if (success) {
                        resolve(explanation);
                    } else {
                        reject(new Error(error));
                    }
                    pendingRequests.delete(requestId);
                }
                break;
            }

            case 'quickFixResult': {
                const { requestId, success, fixedCode, error } = message.payload;
                if (requestId && pendingRequests.has(requestId)) {
                    const { resolve, reject } = pendingRequests.get(requestId)!;
                    if (success) {
                        resolve(fixedCode);
                    } else {
                        reject(new Error(error));
                    }
                    pendingRequests.delete(requestId);
                }
                break;
            }

            case 'complianceResult': {
                const { requestId, success, isCompliant, overallScore, violations, error } = message.payload;
                if (requestId && pendingRequests.has(requestId)) {
                    const { resolve, reject } = pendingRequests.get(requestId)!;
                    if (success) {
                        resolve({ isCompliant, overallScore, violations });
                    } else {
                        reject(new Error(error));
                    }
                    pendingRequests.delete(requestId);
                }
                break;
            }

            case 'fixComplianceResult': {
                const { requestId, success, fixedCode, error } = message.payload;
                if (requestId && pendingRequests.has(requestId)) {
                    const { resolve, reject } = pendingRequests.get(requestId)!;
                    if (success) {
                        resolve(fixedCode);
                    } else {
                        reject(new Error(error));
                    }
                    pendingRequests.delete(requestId);
                }
                break;
            }

            case 'fullFileComplianceResult': {
                const { requestId, success, isCompliant, overallScore, violations, error } = message.payload;
                if (requestId && pendingRequests.has(requestId)) {
                    const { resolve, reject } = pendingRequests.get(requestId)!;
                    if (success) {
                        resolve({ isCompliant, overallScore, violations });
                    } else {
                        reject(new Error(error));
                    }
                    pendingRequests.delete(requestId);
                }
                break;
            }

            case 'fixFullFileComplianceResult': {
                const { requestId, success, fixedCode, error } = message.payload;
                if (requestId && pendingRequests.has(requestId)) {
                    const { resolve, reject } = pendingRequests.get(requestId)!;
                    if (success) {
                        resolve(fixedCode);
                    } else {
                        reject(new Error(error));
                    }
                    pendingRequests.delete(requestId);
                }
                break;
            }
        }
    }, [pendingRequests]);

    useEffect(() => {
        window.addEventListener('message', handleMessage);

        // Notify the extension that the webview is ready to receive messages
        console.log('[Webview] Sending webviewReady message');
        postMessage({ type: 'webviewReady' });

        return () => window.removeEventListener('message', handleMessage);
    }, [handleMessage]);

    const createRequest = <T,>(type: string, payload: any): Promise<T> => {
        return new Promise((resolve, reject) => {
            const requestId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            pendingRequests.set(requestId, { resolve, reject });
            postMessage({ type, payload: { ...payload, requestId } });
        });
    };

    const handleExecute = async (functionName: string, args: string[], filePath: string): Promise<ExecuteResult> => {
        return createRequest<ExecuteResult>('executeFunction', { functionName, args, filePath });
    };

    const handleEdgeCases = async (functionName: string, functionCode: string): Promise<EdgeCase[]> => {
        return createRequest<EdgeCase[]>('generateEdgeCases', { functionName, functionCode });
    };

    const handleAudit = async (functionName: string, functionCode: string): Promise<AuditResult> => {
        return createRequest<AuditResult>('auditCode', { functionName, functionCode });
    };

    const handleSummarize = async (functionName: string, functionCode: string): Promise<FunctionSummary> => {
        return createRequest<FunctionSummary>('summarizeFunction', { functionName, functionCode });
    };

    const handleExplainError = async (
        functionName: string,
        functionCode: string,
        errorMessage: string,
        inputArgs: string[]
    ): Promise<ErrorExplanation> => {
        return createRequest<ErrorExplanation>('explainError', {
            functionName,
            functionCode,
            errorMessage,
            inputArgs
        });
    };

    const handleQuickFix = async (
        functionName: string,
        functionCode: string,
        errorMessage: string,
        inputArgs: string[]
    ): Promise<string> => {
        return createRequest<string>('quickFix', {
            functionName,
            functionCode,
            errorMessage,
            inputArgs
        });
    };

    const handleCheckCompliance = async (functionName: string, functionCode: string): Promise<ComplianceResult> => {
        return createRequest<ComplianceResult>('checkCompliance', { functionName, functionCode });
    };

    const handleFixCompliance = async (
        functionName: string,
        functionCode: string,
        violations: ComplianceViolation[]
    ): Promise<string> => {
        return createRequest<string>('fixCompliance', { functionName, functionCode, violations });
    };

    // Full file compliance handlers
    const [showOnlyIssues, setShowOnlyIssues] = useState(false);

    const handleStartFileScan = async () => {
        setFileComplianceState(prev => ({ ...prev, isScanning: true, result: null, fixedCode: null }));
        setShowOnlyIssues(false); // Reset while scanning
        try {
            const result = await createRequest<ComplianceResult>('checkFullFileCompliance', {});
            setFileComplianceState(prev => ({ ...prev, isScanning: false, result }));
            // Auto-filter: Only show issues if violations found
            if (result && !result.isCompliant) {
                setShowOnlyIssues(true);
            }
        } catch (e: any) {
            setFileComplianceState(prev => ({ ...prev, isScanning: false }));
        }
    };

    const handleFixFullFile = async () => {
        if (!fileComplianceState.result || fileComplianceState.result.isCompliant) return;
        setFileComplianceState(prev => ({ ...prev, isFixing: true }));
        try {
            const fixedCode = await createRequest<string>('fixFullFileCompliance', {
                violations: fileComplianceState.result.violations
            });
            setFileComplianceState(prev => ({ ...prev, isFixing: false, fixedCode }));
        } catch (e: any) {
            setFileComplianceState(prev => ({ ...prev, isFixing: false }));
        }
    };

    const handleApplyFullFileFix = () => {
        if (!fileComplianceState.fixedCode) return;
        postMessage({
            type: 'applyFullFileFix',
            payload: { fixedCode: fileComplianceState.fixedCode }
        });
        // Clear state immediately to hide errors and show "Success" view
        setFileComplianceState({
            isScanning: false,
            isFixing: false,
            result: null,
            fixedCode: null
        });
    };

    const handleOpenChat = (functionName: string, functionCode: string) => {
        setChatState({
            isOpen: true,
            functionName,
            functionCode
        });
    };

    const handleCloseChat = () => {
        setChatState(prev => ({ ...prev, isOpen: false }));
    };

    const handleChatQuery = async (question: string): Promise<{ answer: string; codeSnippet?: string }> => {
        return createRequest<{ answer: string; codeSnippet?: string }>('chatQuery', {
            functionName: chatState.functionName,
            functionCode: chatState.functionCode,
            question
        });
    };

    const handleOpenGuide = () => {
        setGuideState(prev => ({ ...prev, isOpen: true }));
    };

    const handleCloseGuide = () => {
        setGuideState(prev => ({ ...prev, isOpen: false }));
    };

    const handleGenerateGuide = async () => {
        setGuideState(prev => ({ ...prev, isLoading: true }));
        try {
            const guide = await createRequest<ProjectGuide>('generateGuide', {});
            setGuideState(prev => ({ ...prev, guide, isLoading: false }));
        } catch (error) {
            console.error('Failed to generate guide:', error);
            setGuideState(prev => ({ ...prev, isLoading: false }));
        }
    };

    return (
        <div className="app-container">
            <header className="app-header">
                <div className="header-left">
                    <div className="app-title">Wisecode AI</div>
                    {state.fileName ? (
                        <span className="file-badge">{state.fileName}</span>
                    ) : (
                        <span className="file-badge">No File Setup</span>
                    )}
                </div>
                <div className="header-right">
                    <button
                        className="guide-btn"
                        onClick={handleOpenGuide}
                        disabled={state.functions.length === 0}
                        title="Open Project Guide"
                    >
                        📋 Guide
                    </button>
                    <button
                        className="scan-compliance-btn"
                        onClick={handleStartFileScan}
                        disabled={fileComplianceState.isScanning || state.functions.length === 0}
                        title="Scan entire file for compliance violations"
                    >
                        {fileComplianceState.isScanning ? '⏳ Scanning...' : '🛡️ Full Scan'}
                    </button>
                    <span className={`config-status ${state.isConfigured ? 'configured' : 'not-configured'}`}>
                        {state.isConfigured ? '✓ Connected' : '⚠ No API Key'}
                    </span>
                </div>
            </header>

            {/* Full File Compliance Results Panel */}
            {fileComplianceState.result && (
                <div className={`file-compliance-panel ${fileComplianceState.result.isCompliant ? 'compliant' : 'non-compliant'}`}>
                    <div className="file-compliance-header">
                        <span className="file-compliance-icon">
                            {fileComplianceState.result.isCompliant ? '✅' : '⚠️'}
                        </span>
                        <span className="file-compliance-title">
                            {fileComplianceState.result.isCompliant
                                ? 'File is Fully Compliant!'
                                : `${fileComplianceState.result.violations.length} Compliance Violation(s) Found`}
                        </span>
                        <span className="file-compliance-score">
                            Score: {fileComplianceState.result.overallScore}/100
                        </span>
                    </div>

                    {!fileComplianceState.result.isCompliant && (
                        <div className="file-violations-list">
                            {fileComplianceState.result.violations.map((v, i) => (
                                <div key={i} className={`file-violation-item severity-${v.severity}`}>
                                    <span className="violation-line">Line {v.line || '?'}</span>
                                    <span className="violation-regulation">[{v.regulation}]</span>
                                    <span className="violation-issue">{v.issue}</span>
                                    <span className={`violation-severity ${v.severity}`}>{v.severity.toUpperCase()}</span>
                                    <div className="violation-suggestion">💡 {v.suggestion}</div>
                                </div>
                            ))}

                            <button
                                className="fix-all-compliance-btn"
                                onClick={handleFixFullFile}
                                disabled={fileComplianceState.isFixing}
                            >
                                {fileComplianceState.isFixing ? '⏳ Generating Fixed Code...' : '🔧 Auto-Fix All Violations'}
                            </button>
                        </div>
                    )}

                    {fileComplianceState.fixedCode && (
                        <div className="full-file-fix-result">
                            <h4>✅ Compliant Code Generated for Entire File:</h4>
                            <pre className="fixed-code-block">
                                <code>{fileComplianceState.fixedCode}</code>
                            </pre>
                            <button className="apply-full-fix-btn" onClick={handleApplyFullFileFix}>
                                Apply Fix to File
                            </button>
                        </div>
                    )}
                </div>
            )}

            <main className="functions-container">
                {state.functions.length === 0 ? (
                    <div className="empty-state">
                        <h2>No functions detected</h2>
                        <p>Open a source file to analyze its functions.</p>
                        <p>Supported languages: Python, Java, Go, C, C++, JavaScript, TypeScript</p>
                    </div>
                ) : (
                    state.functions
                        .filter(func => {
                            if (!showOnlyIssues) return true;
                            // Strict filtering: Only show if overlaps with a violation
                            if (!fileComplianceState.result || !fileComplianceState.result.violations) return false;

                            return fileComplianceState.result.violations.some(v =>
                                v.line !== undefined && v.line >= func.lineStart && v.line <= func.lineEnd
                            );
                        })
                        .map((func, index) => (
                            <AtomicCard
                                key={`${func.name}-${index}`}
                                func={func}
                                onExecute={handleExecute}
                                onEdgeCases={handleEdgeCases}
                                onAudit={handleAudit}
                                onSummarize={handleSummarize}
                                onOpenChat={handleOpenChat}
                                onExplainError={handleExplainError}
                                onQuickFix={handleQuickFix}
                                onCheckCompliance={handleCheckCompliance}
                                onFixCompliance={handleFixCompliance}
                                filePath={state.filePath}
                                language={state.language}
                                canExecute={state.canExecute}
                            />
                        ))
                )}

                {showOnlyIssues && state.functions.filter(f => {
                    // Check if empty after filtering
                    if (!fileComplianceState.result || !fileComplianceState.result.violations) return false;
                    return fileComplianceState.result.violations.some(v =>
                        v.line !== undefined && v.line >= f.lineStart && v.line <= f.lineEnd
                    );
                }).length === 0 && (
                        <div className="empty-state success">
                            <h3>🎉 No Issues Found in Functions!</h3>
                            <p>All scanned functions are compliant.</p>
                            <button className="scan-compliance-btn" onClick={() => setShowOnlyIssues(false)}>
                                Show All Code
                            </button>
                        </div>
                    )}
            </main>

            {chatState.isOpen && (
                <ChatInterface
                    functionName={chatState.functionName}
                    onClose={handleCloseChat}
                    onQuery={handleChatQuery}
                />
            )}

            {guideState.isOpen && (
                <GuidePanel
                    guide={guideState.guide}
                    isLoading={guideState.isLoading}
                    onClose={handleCloseGuide}
                    onGenerate={handleGenerateGuide}
                />
            )}
        </div>
    );
};
