export interface EdgeCase {
    inputArgs: string;
    reason: string;
    severity: 'low' | 'medium' | 'high';
}
export interface AuditResult {
    riskScore: number;
    issues: AuditIssue[];
}
export interface AuditIssue {
    type: 'security' | 'performance' | 'compliance';
    severity: 'low' | 'medium' | 'high' | 'critical';
    issue: string;
    line?: number;
    fixCode?: string;
}
export interface ProjectGuide {
    summary: string;
    workflow: WorkflowStep[];
    dependencies: string[];
}
export interface WorkflowStep {
    step: number;
    function: string;
    description: string;
}
export interface ChatResponse {
    answer: string;
    codeSnippet?: string;
}
export interface FunctionSummary {
    purpose: string;
    inputs: string;
    outputs: string;
    complexity: string;
}
export interface ErrorExplanation {
    error: string;
    explanation: string;
    expectedInput: string;
    suggestion: string;
}
export interface ComplianceViolation {
    regulation: 'GDPR' | 'HIPAA' | 'PCI-DSS' | 'SECURITY' | 'OTHER';
    issue: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    line?: number;
    suggestion: string;
}
export interface ComplianceResult {
    isCompliant: boolean;
    overallScore: number;
    violations: ComplianceViolation[];
}
export declare function setExtensionPath(extPath: string): void;
export declare class WatsonAgentService {
    private static instance;
    private accessToken;
    private tokenExpiry;
    private cachedConfig;
    private constructor();
    static getInstance(): WatsonAgentService;
    private getConfig;
    isConfigured(): boolean;
    private getAccessToken;
    private queryAgent;
    explainError(functionCode: string, functionName: string, errorMessage: string, inputArgs: string[], language: string): Promise<ErrorExplanation>;
    generateGuide(fullCode: string, fileName: string): Promise<ProjectGuide>;
    summarizeFunction(functionCode: string, functionName: string): Promise<FunctionSummary>;
    generateEdgeCases(functionCode: string, functionName: string): Promise<EdgeCase[]>;
    auditCode(functionCode: string, functionName: string): Promise<AuditResult>;
    generateFix(functionCode: string, functionName: string, issue: string, language: string): Promise<string>;
    chatAboutCode(functionCode: string, functionName: string, question: string): Promise<ChatResponse>;
    generateQuickFix(functionCode: string, functionName: string, errorMessage: string, inputArgs: string[], language: string): Promise<string>;
    checkCompliance(functionCode: string, functionName: string, language: string): Promise<ComplianceResult>;
    fixCompliance(functionCode: string, functionName: string, violations: ComplianceViolation[], language: string): Promise<string>;
    checkFullFileCompliance(fullCode: string, fileName: string, language: string): Promise<ComplianceResult>;
    fixFullFileCompliance(fullCode: string, fileName: string, violations: ComplianceViolation[], language: string): Promise<string>;
}
export declare const watsonService: WatsonAgentService;
//# sourceMappingURL=WatsonAgentService.d.ts.map