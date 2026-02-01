import React, { useState } from 'react';
import { PythonFunction } from '../../utilities/pythonParser';
import { postMessage } from '../vscodeApi';

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

interface AtomicCardProps {
    func: PythonFunction;
    onExecute: (functionName: string, args: string[], filePath: string) => Promise<ExecuteResult>;
    onEdgeCases: (functionName: string, functionCode: string) => Promise<EdgeCase[]>;
    onAudit: (functionName: string, functionCode: string) => Promise<AuditResult>;
    onSummarize: (functionName: string, functionCode: string) => Promise<FunctionSummary>;
    onOpenChat: (functionName: string, functionCode: string) => void;
    onExplainError: (functionName: string, functionCode: string, errorMessage: string, inputArgs: string[]) => Promise<ErrorExplanation>;
    onQuickFix: (functionName: string, functionCode: string, errorMessage: string, inputArgs: string[]) => Promise<string>;
    onCheckCompliance: (functionName: string, functionCode: string) => Promise<ComplianceResult>;
    onFixCompliance: (functionName: string, functionCode: string, violations: ComplianceViolation[]) => Promise<string>;
    filePath: string;
    language: string;
    canExecute: boolean;
}

export const AtomicCard: React.FC<AtomicCardProps> = ({
    func,
    onExecute,
    onEdgeCases,
    onAudit,
    onSummarize,
    onOpenChat,
    onExplainError,
    onQuickFix,
    onCheckCompliance,
    onFixCompliance,
    filePath,
    language,
    canExecute
}) => {
    const [inputValues, setInputValues] = useState<Record<string, string>>({});
    const [result, setResult] = useState<ExecuteResult | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);
    const [currentInputArgs, setCurrentInputArgs] = useState<string[]>([]);

    const [edgeCases, setEdgeCases] = useState<EdgeCase[] | null>(null);
    const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
    const [summary, setSummary] = useState<FunctionSummary | null>(null);
    const [errorExplanation, setErrorExplanation] = useState<ErrorExplanation | null>(null);
    const [fixedCode, setFixedCode] = useState<string | null>(null);

    const [isLoadingEdges, setIsLoadingEdges] = useState(false);
    const [isLoadingAudit, setIsLoadingAudit] = useState(false);
    const [isLoadingSummary, setIsLoadingSummary] = useState(false);
    const [isExplainingError, setIsExplainingError] = useState(false);
    const [isGeneratingFix, setIsGeneratingFix] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Compliance state
    const [complianceResult, setComplianceResult] = useState<ComplianceResult | null>(null);
    const [complianceFixedCode, setComplianceFixedCode] = useState<string | null>(null);
    const [isCheckingCompliance, setIsCheckingCompliance] = useState(false);
    const [isFixingCompliance, setIsFixingCompliance] = useState(false);

    const handleInputChange = (paramName: string, value: string) => {
        setInputValues(prev => ({ ...prev, [paramName]: value }));
    };

    const handleRun = async () => {
        setIsRunning(true);
        setResult(null);
        setError(null);
        setErrorExplanation(null);
        setFixedCode(null);

        try {
            const args = func.parameters.map(p => inputValues[p.name] || '');
            setCurrentInputArgs(args);
            const response = await onExecute(func.name, args, filePath);
            setResult(response);
        } catch (e: any) {
            setResult({ success: false, error: e.message });
        } finally {
            setIsRunning(false);
        }
    };

    const handleExplainError = async () => {
        if (!result || result.success || !result.error) return;

        setIsExplainingError(true);
        setErrorExplanation(null);
        try {
            const explanation = await onExplainError(func.name, func.code, result.error, currentInputArgs);
            setErrorExplanation(explanation);
        } catch (e: any) {
            setError(`Could not explain error: ${e.message}`);
        } finally {
            setIsExplainingError(false);
        }
    };

    const handleQuickFix = async () => {
        if (!result || result.success || !result.error) return;

        setIsGeneratingFix(true);
        setFixedCode(null);
        try {
            const fixed = await onQuickFix(func.name, func.code, result.error, currentInputArgs);
            setFixedCode(fixed);
        } catch (e: any) {
            setError(`Could not generate fix: ${e.message}`);
        } finally {
            setIsGeneratingFix(false);
        }
    };

    const handleApplyQuickFix = () => {
        if (!fixedCode) return;

        postMessage({
            type: 'applyFix',
            payload: {
                functionName: func.name,
                functionCode: fixedCode,
                issue: result?.error || 'Error fix',
                lineStart: func.lineStart,
                lineEnd: func.lineEnd
            }
        });
        // Clear error state immediately
        setResult(null);
        setFixedCode(null);
    };

    const handleCheckCompliance = async () => {
        setIsCheckingCompliance(true);
        setComplianceResult(null);
        setComplianceFixedCode(null);
        try {
            const result = await onCheckCompliance(func.name, func.code);
            setComplianceResult(result);
        } catch (e: any) {
            setError(`Could not check compliance: ${e.message}`);
        } finally {
            setIsCheckingCompliance(false);
        }
    };

    const handleFixCompliance = async () => {
        if (!complianceResult || complianceResult.isCompliant) return;

        setIsFixingCompliance(true);
        setComplianceFixedCode(null);
        try {
            const fixed = await onFixCompliance(func.name, func.code, complianceResult.violations);
            setComplianceFixedCode(fixed);
        } catch (e: any) {
            setError(`Could not fix compliance: ${e.message}`);
        } finally {
            setIsFixingCompliance(false);
        }
    };

    const handleApplyComplianceFix = () => {
        if (!complianceFixedCode) return;

        postMessage({
            type: 'applyFix',
            payload: {
                functionName: func.name,
                functionCode: complianceFixedCode,
                issue: 'Compliance fix',
                lineStart: func.lineStart,
                lineEnd: func.lineEnd
            }
        });
        // Clear compliance state immediately
        setComplianceResult(null);
        setComplianceFixedCode(null);
    };

    const handleEdgeCases = async () => {
        setIsLoadingEdges(true);
        setError(null);
        try {
            const cases = await onEdgeCases(func.name, func.code);
            setEdgeCases(cases);
        } catch (e: any) {
            setError(`Edge cases failed: ${e.message}`);
        } finally {
            setIsLoadingEdges(false);
        }
    };

    const handleAudit = async () => {
        setIsLoadingAudit(true);
        setError(null);
        try {
            const result = await onAudit(func.name, func.code);
            setAuditResult(result);
        } catch (e: any) {
            setError(`Audit failed: ${e.message}`);
        } finally {
            setIsLoadingAudit(false);
        }
    };

    const handleSummarize = async () => {
        setIsLoadingSummary(true);
        setError(null);
        try {
            const result = await onSummarize(func.name, func.code);
            setSummary(result);
        } catch (e: any) {
            setError(`Summary failed: ${e.message}`);
        } finally {
            setIsLoadingSummary(false);
        }
    };

    const applyEdgeCase = (edgeCase: EdgeCase) => {
        const args = edgeCase.inputArgs.split(',').map(a => a.trim());
        func.parameters.forEach((param, index) => {
            if (args[index]) {
                setInputValues(prev => ({ ...prev, [param.name]: args[index] }));
            }
        });
    };

    const handleApplyFix = (issue: any) => {
        postMessage({
            type: 'applyFix',
            payload: {
                functionName: func.name,
                functionCode: func.code,
                issue: issue.issue,
                lineStart: func.lineStart,
                lineEnd: func.lineEnd
            }
        });
    };

    const goToLine = () => {
        postMessage({
            type: 'goToLine',
            payload: { lineNumber: func.lineStart }
        });
    };

    const getRiskBadge = () => {
        if (!auditResult) return null;
        const score = auditResult.riskScore;
        const color = score < 30 ? '#89d185' : score < 70 ? '#cca700' : '#f14c4c';
        const label = score < 30 ? 'LOW' : score < 70 ? 'MEDIUM' : 'HIGH';
        return (
            <span className="risk-badge" style={{ backgroundColor: color }}>
                {label} {score}
            </span>
        );
    };

    return (
        <div className="atomic-card">
            {/* Compliance Banner - Violations Only (Header Removed) */}
            <div className="compliance-section">


                {complianceResult && (
                    <div className={`compliance-status ${complianceResult.isCompliant ? 'compliant' : 'non-compliant'}`}>
                        <div className="compliance-summary">
                            <span className="compliance-icon">
                                {complianceResult.isCompliant ? '✅' : '⚠️'}
                            </span>
                            <span className="compliance-score">
                                Score: {complianceResult.overallScore}/100
                            </span>
                            <span className="compliance-label">
                                {complianceResult.isCompliant ? 'Compliant' : `${complianceResult.violations.length} Violation(s)`}
                            </span>
                        </div>

                        {!complianceResult.isCompliant && complianceResult.violations.length > 0 && (
                            <div className="compliance-violations">
                                {complianceResult.violations.map((v, i) => (
                                    <div key={i} className={`violation-item severity-${v.severity}`}>
                                        <span className="violation-regulation">[{v.regulation}]</span>
                                        <span className="violation-issue">{v.issue}</span>
                                        <span className={`violation-severity ${v.severity}`}>{v.severity.toUpperCase()}</span>
                                        <div className="violation-suggestion">💡 {v.suggestion}</div>
                                    </div>
                                ))}

                                <button
                                    className="fix-compliance-btn"
                                    onClick={handleFixCompliance}
                                    disabled={isFixingCompliance}
                                >
                                    {isFixingCompliance ? '⏳ Generating Fix...' : '🔧 Fix Compliance Issues'}
                                </button>
                            </div>
                        )}

                        {complianceFixedCode && (
                            <div className="compliance-fix-result">
                                <h4>✅ Compliant Code Generated:</h4>
                                <pre className="fixed-code-block">
                                    <code>{complianceFixedCode}</code>
                                </pre>
                                <button className="apply-fix-btn" onClick={handleApplyComplianceFix}>
                                    Apply Compliance Fix
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Header */}
            <div className="card-header">
                <div className="function-info">
                    <span className="function-name" onClick={goToLine}>
                        {func.name}
                    </span>
                    <span className="function-params">
                        ({func.parameters.map(p => `${p.name}: ${p.type}`).join(', ')})
                    </span>
                    {getRiskBadge()}
                </div>
                {/* Actions Removed as per request */}

            </div>

            {/* Code Block */}
            {isExpanded && (
                <pre className="code-block">
                    <code>{func.code}</code>
                </pre>
            )}

            {/* AI Action Buttons */}
            <div className="ai-buttons">
                <button
                    className="ai-btn edge-btn"
                    onClick={handleEdgeCases}
                    disabled={isLoadingEdges}
                >
                    {isLoadingEdges ? 'Loading...' : 'Edge Cases'}
                </button>
                <button
                    className="ai-btn audit-btn"
                    onClick={handleAudit}
                    disabled={isLoadingAudit}
                >
                    {isLoadingAudit ? 'Loading...' : 'Audit'}
                </button>
                <button
                    className="ai-btn summary-btn"
                    onClick={handleSummarize}
                    disabled={isLoadingSummary}
                >
                    {isLoadingSummary ? 'Loading...' : 'Summarize'}
                </button>
            </div>

            {/* Error Display */}
            {error && (
                <div className="error-box">
                    {error}
                </div>
            )}

            {/* Summary Display */}
            {summary && (
                <div className="summary-box">
                    <h4>Function Summary</h4>
                    <div className="summary-item"><strong>Purpose:</strong> {summary.purpose}</div>
                    <div className="summary-item"><strong>Inputs:</strong> {summary.inputs}</div>
                    <div className="summary-item"><strong>Outputs:</strong> {summary.outputs}</div>
                    <div className="summary-item"><strong>Complexity:</strong> {summary.complexity}</div>
                </div>
            )}

            {/* Edge Cases Display */}
            {edgeCases && edgeCases.length > 0 && (
                <div className="edge-cases-box">
                    <h4>Test Cases (Priority Order)</h4>
                    {edgeCases.map((ec, i) => (
                        <div
                            key={i}
                            className={`edge-case severity-${ec.severity}`}
                            onClick={() => applyEdgeCase(ec)}
                        >
                            <span className={`severity-badge ${ec.severity}`}>{ec.severity.toUpperCase()}</span>
                            <code>{ec.inputArgs}</code>
                            <span className="edge-reason">{ec.reason}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Audit Results Display */}
            {auditResult && auditResult.issues.length > 0 && (
                <div className="audit-box">
                    <h4>Security & Performance Issues ({auditResult.issues.length})</h4>
                    {auditResult.issues.map((issue, i) => (
                        <div key={i} className={`audit-issue severity-${issue.severity}`}>
                            <span className={`severity-badge ${issue.severity}`}>
                                {issue.severity.toUpperCase()}
                            </span>
                            <span className="issue-type">{issue.type}</span>
                            <p>{issue.issue}</p>
                            {issue.fixCode && (
                                <button
                                    className="apply-fix-btn"
                                    onClick={() => handleApplyFix(issue)}
                                >
                                    Apply Fix
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {auditResult && auditResult.issues.length === 0 && (
                <div className="audit-box success">
                    <h4>No Issues Found</h4>
                    <p>Risk Score: {auditResult.riskScore}</p>
                </div>
            )}

            {/* Test Function Section */}
            <div className="test-section">
                <h4>Test Function {!canExecute && <span className="lang-badge-inline">(Requires Compiler)</span>}</h4>

                {canExecute ? (
                    <>
                        <div className="params-grid">
                            {func.parameters.map(param => (
                                <div key={param.name} className="param-input">
                                    <label>{param.name}: <span className="type-hint">{param.type}</span></label>
                                    <input
                                        type="text"
                                        value={inputValues[param.name] || ''}
                                        onChange={(e) => handleInputChange(param.name, e.target.value)}
                                        placeholder={param.defaultValue || `Enter ${param.type}`}
                                    />
                                </div>
                            ))}
                        </div>

                        <button
                            className="run-btn"
                            onClick={handleRun}
                            disabled={isRunning}
                        >
                            {isRunning ? 'Running...' : 'Run'}
                        </button>

                        {/* Success Result */}
                        {result && result.success && (
                            <div className="result-box success">
                                <span className="result-label">Result</span>
                                <pre className="result-value">{result.result}</pre>
                            </div>
                        )}

                        {/* Error Result with Explain and Quick Fix Buttons */}
                        {result && !result.success && (
                            <div className="result-box error">
                                <span className="result-label">Error</span>
                                <pre className="result-value">{result.error}</pre>

                                <div className="error-actions">
                                    {!errorExplanation && (
                                        <button
                                            className="explain-error-btn"
                                            onClick={handleExplainError}
                                            disabled={isExplainingError}
                                        >
                                            {isExplainingError ? 'Analyzing...' : 'Explain Error'}
                                        </button>
                                    )}

                                    {!fixedCode && (
                                        <button
                                            className="quick-fix-btn"
                                            onClick={handleQuickFix}
                                            disabled={isGeneratingFix}
                                        >
                                            {isGeneratingFix ? 'Generating Fix...' : 'Quick Fix'}
                                        </button>
                                    )}
                                </div>

                                {errorExplanation && (
                                    <div className="error-explanation">
                                        <div className="explanation-section">
                                            <strong>Error Type:</strong>
                                            <p>{errorExplanation.error}</p>
                                        </div>
                                        <div className="explanation-section">
                                            <strong>Why this happened:</strong>
                                            <p>{errorExplanation.explanation}</p>
                                        </div>
                                        <div className="explanation-section">
                                            <strong>Expected input:</strong>
                                            <p>{errorExplanation.expectedInput}</p>
                                        </div>
                                        <div className="explanation-section">
                                            <strong>Suggestion:</strong>
                                            <p>{errorExplanation.suggestion}</p>
                                        </div>
                                    </div>
                                )}

                                {fixedCode && (
                                    <div className="quick-fix-result">
                                        <h5>AI Generated Fix:</h5>
                                        <pre className="fixed-code">{fixedCode}</pre>
                                        <button
                                            className="apply-quick-fix-btn"
                                            onClick={handleApplyQuickFix}
                                        >
                                            Apply This Fix to Code
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="lang-notice">
                        <p>Requires {language.toUpperCase()} compiler installed (gcc/g++/go).</p>
                        <p>Use <strong>Edge Cases</strong>, <strong>Audit</strong>, and <strong>Summarize</strong> for AI analysis.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
