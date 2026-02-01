import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

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

        console.log('[Watsonx] Looking for config. Extension path:', extensionPath);

        // 1. Try VS Code Settings first (Standard for Extensions)
        const config = vscode.workspace.getConfiguration('wisecode');
        const settingsApiKey = config.get<string>('ibmApiKey');
        const settingsProjectId = config.get<string>('projectId');
        const settingsRegion = config.get<string>('region');

        if (settingsApiKey && settingsProjectId) {
            console.log('[Watsonx] Config loaded from VS Code Settings');
            this.cachedConfig = {
                apiKey: settingsApiKey,
                projectId: settingsProjectId,
                region: settingsRegion || 'us-south'
            };
            return this.cachedConfig;
        }

        // 2. Try .env file
        const envPath = path.join(extensionPath, '.env');
        if (fs.existsSync(envPath)) {
            console.log('[Watsonx] Found .env at:', envPath);
            dotenv.config({ path: envPath });

            if (process.env.IBM_API_KEY && process.env.WATSONX_PROJECT_ID) {
                console.log('[Watsonx] Config loaded from .env');
                this.cachedConfig = {
                    apiKey: process.env.IBM_API_KEY,
                    projectId: process.env.WATSONX_PROJECT_ID,
                    region: process.env.WATSONX_REGION || 'us-south'
                };
                return this.cachedConfig;
            }
        }

        // 2. Fallback to watson.config.json
        const configPaths = [
            path.join(extensionPath, 'watson.config.json'),
            'd:/code-vsextension/code2UI-vsCodeExtension/watson.config.json',
            'D:/code-vsextension/code2UI-vsCodeExtension/watson.config.json',
            'd:\\code-vsextension\\code2UI-vsCodeExtension\\watson.config.json',
            path.join(process.cwd(), 'watson.config.json'),
            'r:/ibm/wisecode-ai/watson.config.json',
            'R:/ibm/wisecode-ai/watson.config.json'
        ];

        for (const configPath of configPaths) {
            try {
                console.log('[Watsonx] Checking config at:', configPath);
                if (fs.existsSync(configPath)) {
                    console.log('[Watsonx] Found config at:', configPath);
                    const configContent = fs.readFileSync(configPath, 'utf8');
                    const config = JSON.parse(configContent);

                    // Support both new Wisecode keys and legacy standard keys
                    const apiKey = config.wisecode?.ibmApiKey || config.ibmApiKey;
                    const projectId = config.wisecode?.projectId || config.projectId;
                    const region = config.wisecode?.region || config.region || 'us-south';

                    if (apiKey && projectId) {
                        console.log('[Watsonx] Config loaded successfully!');
                        this.cachedConfig = {
                            apiKey: apiKey,
                            projectId: projectId,
                            region: region
                        };
                        return this.cachedConfig;
                    } else {
                        console.log('[Watsonx] Config found but missing API key or User ID');
                    }
                }
            } catch (e: any) {
                console.log('[Watsonx] Error reading config at:', configPath, e.message);
            }
        }

        console.log('[Watsonx] No valid config found in any location');
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

        console.log('[Watsonx] Getting access token...');
        console.log('[Watsonx] API Key starts with:', config.apiKey.substring(0, 10) + '...');

        const axios = require('axios');

        try {
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
            console.log('[Watsonx] Token obtained successfully');
            return this.accessToken!;
        } catch (error: any) {
            console.error('[Watsonx] Token error:', error.response?.data || error.message);

            if (error.response?.status === 400) {
                throw new Error(`Invalid IBM API Key format. Your key "${config.apiKey.substring(0, 15)}..." is not a valid IBM Cloud API key. Go to https://cloud.ibm.com/iam/apikeys to create a new one.`);
            } else if (error.response?.status === 401) {
                throw new Error('IBM API Key unauthorized. Please check your API key at https://cloud.ibm.com/iam/apikeys');
            }
            throw new Error(`Failed to authenticate with IBM Cloud: ${error.message}`);
        }
    }

    private async queryAgent(systemPrompt: string, userContent: string): Promise<string> {
        const config = this.getConfig();
        if (!config) throw new Error('IBM Watsonx not configured');

        const token = await this.getAccessToken();
        const axios = require('axios');

        const url = `https://${config.region}.ml.cloud.ibm.com/ml/v1/text/generation?version=2024-01-10`;
        const fullPrompt = `${systemPrompt}\n\nCode:\n\`\`\`\n${userContent}\n\`\`\`\n\nResponse:`;

        console.log('[Watsonx] Calling API at:', url);
        console.log('[Watsonx] Using project:', config.projectId);

        try {
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

            console.log('[Watsonx] API response status:', response.status);
            return response.data.results?.[0]?.generated_text || '';
        } catch (error: any) {
            console.error('[Watsonx] API Error:', error.response?.status, error.response?.data || error.message);

            if (error.response) {
                const status = error.response.status;
                const data = error.response.data;

                if (status === 401) {
                    throw new Error(`401 Unauthorized - API token invalid`);
                } else if (status === 403) {
                    throw new Error(`403 Forbidden - ${data?.errors?.[0]?.message || 'Access denied to Watson AI'}`);
                } else if (status === 404) {
                    throw new Error(`404 Not Found - Endpoint or project not found`);
                } else {
                    throw new Error(`API Error ${status}: ${data?.errors?.[0]?.message || error.message}`);
                }
            }
            throw error;
        }
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
        } catch (e: any) {
            console.error('[Watsonx] Guide error:', e.message);
            vscode.window.showWarningMessage(
                `Watson AI: ${e.message}. Check your IBM credentials in Settings.`
            );
        }
        // Fallback: Return meaningful default instead of crashing UI
        return {
            summary: '⚠️ Watson API error - Please configure your IBM Watsonx credentials in VS Code Settings.',
            workflow: [{ step: 1, function: 'Settings', description: 'Go to Settings > Search "wisecode" > Enter your IBM API Key and Project ID' }],
            dependencies: ['IBM API Key (wisecode.ibmApiKey)', 'Watsonx Project ID (wisecode.projectId)']
        };
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
        } catch (e: any) {
            console.error('[Watsonx] Summary error:', e.message);
            // Show notification so user knows API is failing
            vscode.window.showWarningMessage(
                `Watson AI: ${e.message}. Check your IBM credentials in Settings (wisecode.ibmApiKey).`
            );
        }
        // Fallback: Return meaningful default instead of crashing UI
        return {
            purpose: '⚠️ Watson API error - Please check your IBM API Key and Project ID in VS Code Settings.',
            inputs: 'Configure: wisecode.ibmApiKey, wisecode.projectId in Settings',
            outputs: 'Ensure your IBM Watsonx project has text generation models enabled.',
            complexity: 'Visit https://cloud.ibm.com/iam/apikeys to verify credentials.'
        };
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
                typescript: /((?:function|const|let|var|export)\s+\w+[\s\S]*?\n\})/,
                c: /((?:int|void|char|idx|double|float)\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\n\s*\})/,
                cpp: /((?:int|void|char|idx|double|float|auto)\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\n\s*\})/
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

        // First check if Watson is configured
        const config = this.getConfig();
        if (!config) {
            throw new Error('Watson AI is not configured. Please add valid credentials to watson.config.json (ibmApiKey and projectId)');
        }

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
            console.log('[Watsonx] Calling Watson API for quick fix...');
            const response = await this.queryAgent(systemPrompt, functionCode);
            console.log('[Watsonx] Got response, length:', response.length);

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
            console.error('[Watsonx] Quick fix error:', e);

            // Provide specific error messages based on the error type
            if (e.message?.includes('401') || e.message?.includes('Unauthorized')) {
                throw new Error('IBM Cloud API key is invalid or expired. Please update watson.config.json with a valid API key from https://cloud.ibm.com/iam/apikeys');
            } else if (e.message?.includes('403') || e.message?.includes('Forbidden')) {
                throw new Error('Access denied. Your IBM Cloud account may not have access to Watsonx.ai. Please check your account permissions.');
            } else if (e.message?.includes('404')) {
                throw new Error('Watson AI endpoint not found. Please check your region setting in watson.config.json');
            } else if (e.message?.includes('ENOTFOUND') || e.message?.includes('ECONNREFUSED')) {
                throw new Error('Cannot connect to IBM Cloud. Please check your internet connection.');
            } else if (e.message?.includes('timeout')) {
                throw new Error('Watson AI request timed out. Please try again.');
            } else {
                throw new Error(`Failed to generate fix: ${e.message || 'Unknown error'}`);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // COMPLIANCE CHECK - Government Regulation Compliance Analysis
    // ═══════════════════════════════════════════════════════════════

    public async checkCompliance(functionCode: string, functionName: string, language: string): Promise<ComplianceResult> {
        console.log('[Watsonx] COMPLIANCE CHECK:', functionName);

        const config = this.getConfig();
        if (!config) {
            // Return a default result if Watson is not configured
            return {
                isCompliant: true,
                overallScore: 100,
                violations: []
            };
        }

        const systemPrompt = `You are a Government Regulation Compliance Expert analyzing ${language} code.

Analyze this function for compliance with these regulations:

1. **GDPR (General Data Protection Regulation)**:
   - Personal data handling (names, emails, addresses, IPs)
   - Logging of sensitive user information
   - Data retention and deletion
   - User consent requirements

2. **HIPAA (Health Insurance Portability and Accountability Act)**:
   - Protected Health Information (PHI) handling
   - Medical records, health data
   - Encryption requirements for health data

3. **PCI-DSS (Payment Card Industry Data Security Standard)**:
   - Credit card number handling
   - CVV, expiration date storage
   - Payment data encryption

4. **SECURITY Best Practices**:
   - Hardcoded secrets, API keys, passwords
   - SQL injection vulnerabilities
   - XSS vulnerabilities
   - Input validation
   - Unsafe deserialization

Return your analysis as valid JSON ONLY (no other text):
{
  "isCompliant": true/false,
  "overallScore": 0-100 (100 = fully compliant),
  "violations": [
    {
      "regulation": "GDPR" | "HIPAA" | "PCI-DSS" | "SECURITY",
      "issue": "Brief description of the violation",
      "severity": "low" | "medium" | "high" | "critical",
      "suggestion": "How to fix this violation"
    }
  ]
}

If the code is fully compliant, return empty violations array and score of 100.`;

        try {
            const response = await this.queryAgent(systemPrompt, functionCode);
            console.log('[Watsonx] Compliance response:', response.substring(0, 300));

            const match = response.match(/\{[\s\S]*\}/);
            if (match) {
                const parsed = JSON.parse(match[0]);
                return {
                    isCompliant: parsed.isCompliant ?? true,
                    overallScore: parsed.overallScore ?? 100,
                    violations: parsed.violations ?? []
                };
            }
        } catch (e: any) {
            console.error('[Watsonx] Compliance check error:', e.message);
        }

        // Default to compliant if check fails
        return {
            isCompliant: true,
            overallScore: 100,
            violations: []
        };
    }

    public async fixCompliance(functionCode: string, functionName: string, violations: ComplianceViolation[], language: string): Promise<string> {
        console.log('[Watsonx] FIX COMPLIANCE:', functionName, 'Violations:', violations.length);

        const violationsList = violations.map((v, i) =>
            `${i + 1}. [${v.regulation}] ${v.issue} (${v.severity})`
        ).join('\n');

        const systemPrompt = `You are a Government Regulation Compliance Expert.

This ${language} function has the following compliance violations:
${violationsList}

Rewrite the function to fix ALL violations while keeping the core functionality intact.
Apply these fixes:
- For GDPR: Anonymize/hash personal data, add consent checks
- For HIPAA: Encrypt health data, add access controls
- For PCI-DSS: Never store CVV, encrypt card data, use tokenization
- For SECURITY: Remove hardcoded secrets, use parameterized queries, validate inputs

Return ONLY the complete fixed function code. No explanations, just the code.`;

        try {
            const response = await this.queryAgent(systemPrompt, functionCode);

            // Extract code from response
            const codeMatch = response.match(/\`\`\`(?:\w+)?\n?([\s\S]*?)\`\`\`/);
            if (codeMatch) {
                return codeMatch[1].trim();
            }

            return response.trim();
        } catch (e: any) {
            console.error('[Watsonx] Fix compliance error:', e.message);
            throw new Error(`Failed to fix compliance: ${e.message}`);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // FULL FILE COMPLIANCE CHECK - Scans entire code file at once
    // ═══════════════════════════════════════════════════════════════

    public async checkFullFileCompliance(fullCode: string, fileName: string, language: string): Promise<ComplianceResult> {
        console.log('[Watsonx] FULL FILE COMPLIANCE CHECK:', fileName);

        const config = this.getConfig();
        if (!config) {
            return {
                isCompliant: true,
                overallScore: 100,
                violations: []
            };
        }

        const systemPrompt = `You are a Government Regulation Compliance Expert. Analyze the ENTIRE ${language} code file line by line.

Scan EVERY LINE for compliance violations with:

1. **GDPR (General Data Protection Regulation)**:
   - Personal data handling (names, emails, addresses, phone numbers, IPs)
   - Logging sensitive user information without consent
   - Data retention issues
   - Missing user consent mechanisms

2. **HIPAA (Health Insurance Portability and Accountability Act)**:
   - Unencrypted health data (PHI)
   - Medical records handling
   - Missing access controls for health data

3. **PCI-DSS (Payment Card Industry Data Security Standard)**:
   - Credit card numbers stored in plain text
   - CVV storage (NEVER allowed)
   - Unencrypted payment data

4. **SECURITY Best Practices**:
   - Hardcoded API keys, passwords, secrets
   - SQL injection vulnerabilities
   - XSS vulnerabilities
   - Missing input validation
   - Unsafe file operations
   - Insecure random number generation

For EACH violation found, include the LINE NUMBER where it occurs.

Return your analysis as valid JSON ONLY:
{
  "isCompliant": true/false,
  "overallScore": 0-100,
  "violations": [
    {
      "regulation": "GDPR" | "HIPAA" | "PCI-DSS" | "SECURITY",
      "issue": "Description of the violation",
      "severity": "low" | "medium" | "high" | "critical",
      "line": LINE_NUMBER,
      "suggestion": "How to fix this"
    }
  ]
}`;

        try {
            const response = await this.queryAgent(systemPrompt, fullCode);
            console.log('[Watsonx] Full file compliance response:', response.substring(0, 300));

            const match = response.match(/\{[\s\S]*\}/);
            if (match) {
                const parsed = JSON.parse(match[0]);
                return {
                    isCompliant: parsed.isCompliant ?? true,
                    overallScore: parsed.overallScore ?? 100,
                    violations: parsed.violations ?? []
                };
            }
        } catch (e: any) {
            console.error('[Watsonx] Full file compliance error:', e.message);
        }

        return {
            isCompliant: true,
            overallScore: 100,
            violations: []
        };
    }

    public async fixFullFileCompliance(fullCode: string, fileName: string, violations: ComplianceViolation[], language: string): Promise<string> {
        console.log('[Watsonx] FIX FULL FILE COMPLIANCE:', fileName, 'Violations:', violations.length);

        const violationsList = violations.map((v, i) =>
            `${i + 1}. Line ${v.line || '?'} [${v.regulation}] ${v.issue} (${v.severity})`
        ).join('\n');

        const systemPrompt = `You are a Government Regulation Compliance Expert.

This ${language} code file has the following compliance violations:
${violationsList}

Rewrite the ENTIRE code file to fix ALL violations while keeping ALL functionality intact.

Apply these fixes:
- For GDPR: Anonymize/hash personal data, add consent mechanisms, use proper logging
- For HIPAA: Encrypt all health data, add access controls
- For PCI-DSS: Never store CVV, encrypt card numbers, use tokenization
- For SECURITY: Use environment variables for secrets, parameterized queries, validate all inputs

Return ONLY the complete fixed code file. Include ALL imports, functions, and code.
Do NOT add explanations. Return the entire working code file.`;

        try {
            const response = await this.queryAgent(systemPrompt, fullCode);

            // Extract code from response
            const codeMatch = response.match(/\`\`\`(?:\w+)?\n?([\s\S]*?)\`\`\`/);
            if (codeMatch) {
                return codeMatch[1].trim();
            }

            return response.trim();
        } catch (e: any) {
            console.error('[Watsonx] Fix full file compliance error:', e.message);
            throw new Error(`Failed to fix compliance: ${e.message}`);
        }
    }
}

export const watsonService = WatsonAgentService.getInstance();
