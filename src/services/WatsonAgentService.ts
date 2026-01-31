import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface WatsonConfig {
    apiKey: string;
    projectId: string;
    region: string;
}

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

let extensionPath: string = '';

export function setExtensionPath(extPath: string): void {
    extensionPath = extPath;
    console.log('[Watsonx] Extension path set:', extensionPath);
}

export class WatsonAgentService {
    private static instance: WatsonAgentService;
    private accessToken: string | null = null;
    private tokenExpiry: number = 0;
    private cachedConfig: WatsonConfig | null = null;

    private constructor() { }

    public static getInstance(): WatsonAgentService {
        if (!WatsonAgentService.instance) {
            WatsonAgentService.instance = new WatsonAgentService();
        }
        return WatsonAgentService.instance;
    }

    private getConfig(): WatsonConfig | null {
        if (this.cachedConfig) {
            return this.cachedConfig;
        }

        const configPaths = [
            path.join(extensionPath, 'watson.config.json'),
            'r:/ibm/sentinel-atomic/watson.config.json',
            'R:/ibm/sentinel-atomic/watson.config.json'
        ];

        for (const configPath of configPaths) {
            try {
                if (fs.existsSync(configPath)) {
                    const configContent = fs.readFileSync(configPath, 'utf8');
                    const config = JSON.parse(configContent);

                    if (config.ibmApiKey && config.projectId) {
                        this.cachedConfig = {
                            apiKey: config.ibmApiKey,
                            projectId: config.projectId,
                            region: config.region || 'us-south'
                        };
                        return this.cachedConfig;
                    }
                }
            } catch (e) {
                console.log('[Watsonx] Config not at:', configPath);
            }
        }

        return null;
    }

    public isConfigured(): boolean {
        return this.getConfig() !== null;
    }

    private async getAccessToken(): Promise<string> {
        const config = this.getConfig();
        if (!config) throw new Error('IBM Watsonx not configured');

        if (this.accessToken && Date.now() < this.tokenExpiry - 300000) {
            return this.accessToken;
        }

        const axios = require('axios');
        const response = await axios.post(
            'https://iam.cloud.ibm.com/identity/token',
            new URLSearchParams({
                grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
                apikey: config.apiKey
            }),
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 20000
            }
        );

        this.accessToken = response.data.access_token;
        this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
        return this.accessToken!;
    }

    private async queryAgent(systemPrompt: string, userContent: string): Promise<string> {
        const config = this.getConfig();
        if (!config) throw new Error('IBM Watsonx not configured');

        const token = await this.getAccessToken();
        const axios = require('axios');

        const url = `https://${config.region}.ml.cloud.ibm.com/ml/v1/text/generation?version=2024-01-10`;
        const fullPrompt = `${systemPrompt}\n\nCode:\n\`\`\`\n${userContent}\n\`\`\`\n\nResponse:`;

        const response = await axios.post(url, {
            model_id: 'ibm/granite-3-8b-instruct',
            project_id: config.projectId,
            input: fullPrompt,
            parameters: {
                decoding_method: 'greedy',
                max_new_tokens: 2500,
                min_new_tokens: 20,
                repetition_penalty: 1.1,
                temperature: 0.7
            }
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 60000
        });

        return response.data.results?.[0]?.generated_text || '';
    }

    // ═══════════════════════════════════════════════════════════════
    // ERROR EXPLAINER - Uses Watson AI to analyze runtime errors
    // ═══════════════════════════════════════════════════════════════

    public async explainError(functionCode: string, functionName: string, errorMessage: string, inputArgs: string[], language: string): Promise<ErrorExplanation> {
        console.log('[Watsonx] ERROR EXPLAINER called for:', functionName);
        console.log('[Watsonx] Error message:', errorMessage);
        console.log('[Watsonx] User input:', inputArgs);

        const inputArgsDisplay = inputArgs.length > 0 ? inputArgs.join(', ') : '(no input provided)';

        const systemPrompt = `You are an expert ${language} debugging assistant. A user tried to run a function and got an error.

CONTEXT:
- Function name: ${functionName}
- Programming language: ${language}
- Error message: ${errorMessage}
- User provided these inputs: ${inputArgsDisplay}

ANALYZE THE CODE AND ERROR:
Look at the function code below, understand what parameters it expects, and explain why the error occurred based on the user's actual input.

YOUR TASK:
1. Identify the specific error type (e.g., TypeError, missing argument, invalid value)
2. Explain in simple terms WHY this happened given what the user entered
3. Tell them exactly what type/format each parameter needs
4. Give them a CONCRETE example of working input values

Return ONLY valid JSON (no other text):
{
  "error": "Error type (e.g., 'Missing Required Argument' or 'Type Mismatch')",
  "explanation": "The function '${functionName}' failed because [specific reason based on their input '${inputArgsDisplay}' and the error '${errorMessage}']",
  "expectedInput": "This function expects: [describe each parameter type clearly]",
  "suggestion": "Try: [give specific example values that will work, like 'hello' for name or 5 for n]"
}`;

        try {
            console.log('[Watsonx] Sending request to Watson AI...');
            const response = await this.queryAgent(systemPrompt, functionCode);
            console.log('[Watsonx] Got response:', response.substring(0, 200));

            const match = response.match(/\{[\s\S]*\}/);
            if (match) {
                const parsed = JSON.parse(match[0]);
                console.log('[Watsonx] Parsed explanation:', parsed);
                return parsed;
            } else {
                console.log('[Watsonx] No JSON found in response');
            }
        } catch (e: any) {
            console.error('[Watsonx] Error explainer failed:', e.message);
        }

        // Fallback with actual error info
        return {
            error: errorMessage,
            explanation: `The function '${functionName}' failed with: ${errorMessage}`,
            expectedInput: `Review the function parameters in the code above`,
            suggestion: `Check that your inputs match the expected types: ${inputArgsDisplay}`
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // PROJECT GUIDE
    // ═══════════════════════════════════════════════════════════════

    public async generateGuide(fullCode: string, fileName: string): Promise<ProjectGuide> {
        const systemPrompt = `You are a Senior Software Architect analyzing a codebase.
Create a comprehensive testing guide for this file.

Return your response as valid JSON only:
{
  "summary": "2-3 sentences describing what this file does",
  "workflow": [{"step": 1, "function": "function_name", "description": "Why test this first"}],
  "dependencies": ["List dependencies"]
}`;

        try {
            const response = await this.queryAgent(systemPrompt, fullCode);
            const match = response.match(/\{[\s\S]*\}/);
            if (match) return JSON.parse(match[0]);
        } catch (e) {
            console.error('[Watsonx] Guide error:', e);
        }
        throw new Error('Failed to generate guide');
    }

    // ═══════════════════════════════════════════════════════════════
    // SUMMARIZER
    // ═══════════════════════════════════════════════════════════════

    public async summarizeFunction(functionCode: string, functionName: string): Promise<FunctionSummary> {
        const systemPrompt = `Analyze this function and provide a clear summary.

Return as valid JSON only:
{
  "purpose": "What this function does",
  "inputs": "Parameters and their types",
  "outputs": "Return value",
  "complexity": "Time/space complexity notes"
}`;

        try {
            const response = await this.queryAgent(systemPrompt, functionCode);
            const match = response.match(/\{[\s\S]*\}/);
            if (match) return JSON.parse(match[0]);
        } catch (e) {
            console.error('[Watsonx] Summary error:', e);
        }
        throw new Error('Failed to generate summary');
    }

    // ═══════════════════════════════════════════════════════════════
    // EDGE CASES - Advanced with priority ordering
    // ═══════════════════════════════════════════════════════════════

    public async generateEdgeCases(functionCode: string, functionName: string): Promise<EdgeCase[]> {
        console.log('[Watsonx] EDGE CASES:', functionName);

        const systemPrompt = `You are an expert QA Engineer. Find edge cases that could break this function.

PRIORITY ORDER (show critical issues first):
1. HIGH: Stack overflow risks (recursion with large input), memory issues
2. HIGH: Input that causes infinite loops or crashes
3. MEDIUM: Boundary conditions (0, negative, very large numbers)
4. MEDIUM: Type mismatches (string vs int, null values)
5. LOW: Empty inputs, edge boundaries

For recursive functions: ALWAYS include a test case with large input (like 100 or 1000) that could cause stack overflow. Mark this as HIGH severity.

Return as JSON array, ordered by severity (high first):
[
  {"inputArgs": "exact input to test", "reason": "why this is dangerous", "severity": "high|medium|low"}
]

Provide 4-6 test cases with high severity ones first.`;

        try {
            const response = await this.queryAgent(systemPrompt, functionCode);
            const match = response.match(/\[[\s\S]*\]/);
            if (match) {
                const parsed = JSON.parse(match[0]);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Sort by severity: high > medium > low
                    return parsed.sort((a: EdgeCase, b: EdgeCase) => {
                        const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
                        return (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
                    });
                }
            }
        } catch (e) {
            console.error('[Watsonx] Edge cases error:', e);
        }

        return [
            { inputArgs: "1000", reason: "Large input may cause stack overflow if recursive", severity: "high" },
            { inputArgs: "None", reason: "Null input test", severity: "medium" },
            { inputArgs: "-1", reason: "Negative number boundary", severity: "medium" }
        ];
    }

    // ═══════════════════════════════════════════════════════════════
    // AUDIT - Advanced with recursion and performance detection
    // ═══════════════════════════════════════════════════════════════

    public async auditCode(functionCode: string, functionName: string): Promise<AuditResult> {
        console.log('[Watsonx] AUDIT:', functionName);

        const systemPrompt = `You are a Security and Performance Auditor. Analyze this code thoroughly.

CHECK FOR THESE ISSUES:

PERFORMANCE (CRITICAL):
- RECURSION: If this function uses recursion, mark as HIGH severity. Explain it can cause stack overflow with large inputs and suggest iterative solution.
- Inefficient algorithms (O(n^2) or worse when O(n) possible)
- Memory leaks, unnecessary allocations

SECURITY:
- Hardcoded API keys, passwords, secrets → suggest .env files
- SQL injection, command injection, XSS
- Logging sensitive data

COMPLIANCE (GDPR, OWASP):
- Personal data handling issues
- Missing input validation
- Missing error handling

For recursive functions:
- ALWAYS mark as HIGH severity performance issue
- Explain the stack overflow risk
- Provide complete iterative solution as fixCode

Return as valid JSON:
{
  "riskScore": 0-100 (recursion = minimum 70),
  "issues": [
    {
      "type": "security|performance|compliance",
      "severity": "low|medium|high|critical",
      "issue": "Clear description of problem",
      "fixCode": "Complete fixed function code"
    }
  ]
}`;

        try {
            const response = await this.queryAgent(systemPrompt, functionCode);
            const match = response.match(/\{[\s\S]*\}/);
            if (match) {
                const result = JSON.parse(match[0]);
                return {
                    riskScore: result.riskScore || 0,
                    issues: result.issues || []
                };
            }
        } catch (e) {
            console.error('[Watsonx] Audit error:', e);
        }

        return { riskScore: 0, issues: [] };
    }

    // ═══════════════════════════════════════════════════════════════
    // CODE FIXER
    // ═══════════════════════════════════════════════════════════════

    public async generateFix(functionCode: string, functionName: string, issue: string, language: string): Promise<string> {
        console.log('[Watsonx] FIX:', functionName);

        const systemPrompt = `You are a code expert. Fix the following issue in this ${language} function.

Issue: ${issue}

Rules:
- If issue is about recursion, convert to iterative solution
- If about hardcoded secrets, use environment variables
- Add proper input validation
- Follow OWASP guidelines

Return ONLY the complete fixed function code. No explanations, just the code.
Make sure the code is valid ${language} syntax.`;

        try {
            const response = await this.queryAgent(systemPrompt, functionCode);

            const langPatterns: Record<string, RegExp> = {
                python: /(def\s+\w+[\s\S]*?)(?=\n\ndef\s|\nclass\s|$)/,
                java: /((?:public|private|protected)?\s*(?:static)?\s*\w+\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\n\s*\})/,
                go: /(func\s+[\s\S]*?\n\})/,
                javascript: /((?:function|const|let|var)\s+\w+[\s\S]*?\n\})/,
                typescript: /((?:function|const|let|var|export)\s+\w+[\s\S]*?\n\})/
            };

            // Try to extract code block
            const codeMatch = response.match(/```(?:\w+)?\n?([\s\S]*?)```/);
            if (codeMatch) {
                return codeMatch[1].trim();
            }

            // Try language-specific pattern
            const pattern = langPatterns[language.toLowerCase()];
            if (pattern) {
                const funcMatch = response.match(pattern);
                if (funcMatch) return funcMatch[1].trim();
            }

            return response.trim();
        } catch (e) {
            console.error('[Watsonx] Fix error:', e);
            throw new Error('Failed to generate fix');
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // CHAT
    // ═══════════════════════════════════════════════════════════════

    public async chatAboutCode(functionCode: string, functionName: string, question: string): Promise<ChatResponse> {
        const systemPrompt = `You are a helpful programming assistant. Answer clearly and concisely.`;
        const userContent = `Function: ${functionName}\n\n${functionCode}\n\nQuestion: ${question}`;

        try {
            const response = await this.queryAgent(systemPrompt, userContent);
            const codeMatch = response.match(/```(?:\w+)?\n?([\s\S]*?)```/);

            return {
                answer: response.replace(/```[\s\S]*?```/g, '').trim(),
                codeSnippet: codeMatch ? codeMatch[1].trim() : undefined
            };
        } catch (e) {
            throw new Error('Failed to get response');
        }
    }
    // ═══════════════════════════════════════════════════════════════
    // QUICK FIX - Generates working code from error
    // ═══════════════════════════════════════════════════════════════

    public async generateQuickFix(functionCode: string, functionName: string, errorMessage: string, inputArgs: string[], language: string): Promise<string> {
        console.log('[Watsonx] QUICK FIX:', functionName, 'Error:', errorMessage);

        const inputDisplay = inputArgs.length > 0 ? inputArgs.join(', ') : '(no input)';

        const systemPrompt = `You are an expert ${language} programmer. A function failed with an error.

CONTEXT:
- Function name: ${functionName}
- Programming language: ${language}
- Error message: ${errorMessage}
- User input that caused error: ${inputDisplay}

YOUR TASK:
Fix the function so it handles this error gracefully. The fix should:
1. Keep the existing core logic intact
2. Add proper input validation or type handling
3. Handle the specific error case
4. Return a sensible default or error value instead of crashing

Return ONLY the complete fixed function code. No explanations, just the code.
Make sure the code is valid ${language} syntax.`;

        try {
            const response = await this.queryAgent(systemPrompt, functionCode);

            // Extract code from response
            const codeMatch = response.match(/\`\`\`(?:\w+)?\n?([\s\S]*?)\`\`\`/);
            if (codeMatch) {
                return codeMatch[1].trim();
            }

            // Try to find the function definition
            const langPatterns: Record<string, RegExp> = {
                python: /(def\s+\w+[\s\S]*?)(?=\n\ndef\s|\nclass\s|$)/,
                java: /((?:public|private|protected)?\s*(?:static)?\s*\w+\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\n\s*\})/,
                javascript: /((?:function|const|let|var)\s+\w+[\s\S]*?\n\})/,
                typescript: /((?:function|const|let|var|export)\s+\w+[\s\S]*?\n\})/,
                c: /(\w+\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\n\})/,
                cpp: /(\w+\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\n\})/,
                go: /(func\s+\w+[\s\S]*?\n\})/
            };

            const pattern = langPatterns[language.toLowerCase()];
            if (pattern) {
                const funcMatch = response.match(pattern);
                if (funcMatch) return funcMatch[1].trim();
            }

            return response.trim();
        } catch (e: any) {
            console.error('[Watsonx] Quick fix error:', e.message);
            throw new Error('Failed to generate fix');
        }
    }
}

export const watsonService = WatsonAgentService.getInstance();
