import React from 'react';
import { PythonFunction } from '../../utilities/pythonParser';
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
interface AtomicCardProps {
    func: PythonFunction;
    onExecute: (functionName: string, args: string[], filePath: string) => Promise<ExecuteResult>;
    onEdgeCases: (functionName: string, functionCode: string) => Promise<EdgeCase[]>;
    onAudit: (functionName: string, functionCode: string) => Promise<AuditResult>;
    onSummarize: (functionName: string, functionCode: string) => Promise<FunctionSummary>;
    onOpenChat: (functionName: string, functionCode: string) => void;
    onExplainError: (functionName: string, functionCode: string, errorMessage: string, inputArgs: string[]) => Promise<ErrorExplanation>;
    onQuickFix: (functionName: string, functionCode: string, errorMessage: string, inputArgs: string[]) => Promise<string>;
    filePath: string;
    language: string;
    canExecute: boolean;
}
export declare const AtomicCard: React.FC<AtomicCardProps>;
export {};
//# sourceMappingURL=AtomicCard.d.ts.map