/**
 * Multi-Language Code Parser
 * Supports: Python, Java, Go, C, C++, JavaScript, TypeScript
 */

export interface CodeParameter {
    name: string;
    type: string;
    defaultValue?: string;
}

export interface CodeFunction {
    name: string;
    parameters: CodeParameter[];
    code: string;
    lineStart: number;
    lineEnd: number;
    language: string;
}

// Re-export as PythonFunction for backward compatibility
export type PythonFunction = CodeFunction;
export type PythonParameter = CodeParameter;

/**
 * Detect language from file extension
 */
export function detectLanguage(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
        'py': 'python',
        'java': 'java',
        'go': 'go',
        'c': 'c',
        'cpp': 'cpp',
        'cc': 'cpp',
        'cxx': 'cpp',
        'h': 'c',
        'hpp': 'cpp',
        'js': 'javascript',
        'ts': 'typescript',
        'tsx': 'typescript',
        'jsx': 'javascript',
        'rs': 'rust',
        'rb': 'ruby',
        'php': 'php'
    };
    return langMap[ext] || 'unknown';
}

/**
 * Parse functions based on language
 */
export function parseFunctions(sourceCode: string, fileName: string): CodeFunction[] {
    const language = detectLanguage(fileName);

    switch (language) {
        case 'python':
            return parsePythonFunctions(sourceCode);
        case 'java':
            return parseJavaFunctions(sourceCode);
        case 'go':
            return parseGoFunctions(sourceCode);
        case 'c':
        case 'cpp':
            return parseCFunctions(sourceCode, language);
        case 'javascript':
        case 'typescript':
            return parseJSFunctions(sourceCode, language);
        default:
            return parsePythonFunctions(sourceCode); // Fallback
    }
}

// ═══════════════════════════════════════════════════════════════
// PYTHON PARSER
// ═══════════════════════════════════════════════════════════════

function parseParameters(argsString: string): CodeParameter[] {
    if (!argsString.trim()) return [];

    const params: CodeParameter[] = [];
    const parts = argsString.split(',');

    for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed || trimmed === 'self') continue;

        const match = trimmed.match(/^(\w+)(?:\s*:\s*([^=]+?))?(?:\s*=\s*(.+))?$/);
        if (match) {
            params.push({
                name: match[1],
                type: match[2]?.trim() || 'any',
                defaultValue: match[3]?.trim()
            });
        }
    }

    return params;
}

export function parsePythonFunctions(sourceCode: string): CodeFunction[] {
    const functions: CodeFunction[] = [];
    const lines = sourceCode.split('\n');
    const functionDefRegex = /^(\s*)def\s+(\w+)\s*\(([^)]*)\)\s*(?:->.*)?:/;

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const match = line.match(functionDefRegex);

        if (match) {
            const baseIndent = match[1].length;
            const functionName = match[2];
            const functionArgs = match[3].trim();
            const lineStart = i + 1;

            const bodyLines: string[] = [line];
            let j = i + 1;

            while (j < lines.length) {
                const nextLine = lines[j];
                if (nextLine.trim() === '') {
                    bodyLines.push(nextLine);
                    j++;
                    continue;
                }
                const nextIndentMatch = nextLine.match(/^(\s*)/);
                const nextIndent = nextIndentMatch ? nextIndentMatch[1].length : 0;
                if (nextIndent > baseIndent) {
                    bodyLines.push(nextLine);
                    j++;
                } else {
                    break;
                }
            }

            while (bodyLines.length > 1 && bodyLines[bodyLines.length - 1].trim() === '') {
                bodyLines.pop();
            }

            functions.push({
                name: functionName,
                parameters: parseParameters(functionArgs),
                code: bodyLines.join('\n'),
                lineStart,
                lineEnd: i + bodyLines.length,
                language: 'python'
            });

            i = j;
        } else {
            i++;
        }
    }

    return functions;
}

// ═══════════════════════════════════════════════════════════════
// JAVA PARSER
// ═══════════════════════════════════════════════════════════════

function parseJavaFunctions(sourceCode: string): CodeFunction[] {
    const functions: CodeFunction[] = [];
    const lines = sourceCode.split('\n');

    // Match Java method: [modifiers] returnType methodName(params) {
    const methodRegex = /^\s*(public|private|protected)?\s*(static)?\s*(\w+)\s+(\w+)\s*\(([^)]*)\)\s*{?\s*$/;

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const match = line.match(methodRegex);

        if (match && match[4] !== 'if' && match[4] !== 'for' && match[4] !== 'while') {
            const functionName = match[4];
            const paramsStr = match[5];
            const lineStart = i + 1;

            // Find matching brace
            let braceCount = line.includes('{') ? 1 : 0;
            const bodyLines: string[] = [line];
            let j = i + 1;

            if (braceCount === 0 && j < lines.length && lines[j].trim() === '{') {
                bodyLines.push(lines[j]);
                braceCount = 1;
                j++;
            }

            while (j < lines.length && braceCount > 0) {
                const nextLine = lines[j];
                bodyLines.push(nextLine);
                braceCount += (nextLine.match(/{/g) || []).length;
                braceCount -= (nextLine.match(/}/g) || []).length;
                j++;
            }

            const params = paramsStr.split(',').filter(p => p.trim()).map(p => {
                const parts = p.trim().split(/\s+/);
                return {
                    name: parts[parts.length - 1] || 'arg',
                    type: parts.slice(0, -1).join(' ') || 'Object'
                };
            });

            functions.push({
                name: functionName,
                parameters: params,
                code: bodyLines.join('\n'),
                lineStart,
                lineEnd: i + bodyLines.length,
                language: 'java'
            });

            i = j;
        } else {
            i++;
        }
    }

    return functions;
}

// ═══════════════════════════════════════════════════════════════
// GO PARSER
// ═══════════════════════════════════════════════════════════════

function parseGoFunctions(sourceCode: string): CodeFunction[] {
    const functions: CodeFunction[] = [];
    const lines = sourceCode.split('\n');

    // Match Go function: func [receiver] name(params) [return] {
    const funcRegex = /^\s*func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(([^)]*)\)/;

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const match = line.match(funcRegex);

        if (match) {
            const functionName = match[1];
            const paramsStr = match[2];
            const lineStart = i + 1;

            let braceCount = line.includes('{') ? 1 : 0;
            const bodyLines: string[] = [line];
            let j = i + 1;

            while (j < lines.length && braceCount > 0) {
                const nextLine = lines[j];
                bodyLines.push(nextLine);
                braceCount += (nextLine.match(/{/g) || []).length;
                braceCount -= (nextLine.match(/}/g) || []).length;
                j++;
            }

            const params = paramsStr.split(',').filter(p => p.trim()).map(p => {
                const parts = p.trim().split(/\s+/);
                return {
                    name: parts[0] || 'arg',
                    type: parts.slice(1).join(' ') || 'interface{}'
                };
            });

            functions.push({
                name: functionName,
                parameters: params,
                code: bodyLines.join('\n'),
                lineStart,
                lineEnd: i + bodyLines.length,
                language: 'go'
            });

            i = j;
        } else {
            i++;
        }
    }

    return functions;
}

// ═══════════════════════════════════════════════════════════════
// C/C++ PARSER
// ═══════════════════════════════════════════════════════════════

function parseCFunctions(sourceCode: string, language: string): CodeFunction[] {
    const functions: CodeFunction[] = [];
    const lines = sourceCode.split('\n');

    // Match C function: returnType functionName(params) {
    const funcRegex = /^\s*(?:static\s+)?(?:inline\s+)?(\w+(?:\s*\*)*)\s+(\w+)\s*\(([^)]*)\)\s*{?\s*$/;

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const match = line.match(funcRegex);

        if (match && !['if', 'for', 'while', 'switch'].includes(match[2])) {
            const functionName = match[2];
            const paramsStr = match[3];
            const lineStart = i + 1;

            let braceCount = line.includes('{') ? 1 : 0;
            const bodyLines: string[] = [line];
            let j = i + 1;

            if (braceCount === 0 && j < lines.length && lines[j].trim() === '{') {
                bodyLines.push(lines[j]);
                braceCount = 1;
                j++;
            }

            while (j < lines.length && braceCount > 0) {
                const nextLine = lines[j];
                bodyLines.push(nextLine);
                braceCount += (nextLine.match(/{/g) || []).length;
                braceCount -= (nextLine.match(/}/g) || []).length;
                j++;
            }

            const params = paramsStr.split(',').filter(p => p.trim()).map(p => {
                const parts = p.trim().split(/\s+/);
                return {
                    name: parts[parts.length - 1]?.replace('*', '') || 'arg',
                    type: parts.slice(0, -1).join(' ') || 'int'
                };
            });

            functions.push({
                name: functionName,
                parameters: params,
                code: bodyLines.join('\n'),
                lineStart,
                lineEnd: i + bodyLines.length,
                language
            });

            i = j;
        } else {
            i++;
        }
    }

    return functions;
}

// ═══════════════════════════════════════════════════════════════
// JAVASCRIPT/TYPESCRIPT PARSER
// ═══════════════════════════════════════════════════════════════

function parseJSFunctions(sourceCode: string, language: string): CodeFunction[] {
    const functions: CodeFunction[] = [];
    const lines = sourceCode.split('\n');

    // Match: function name(params), const name = (params) =>, async function name(params)
    const funcPatterns = [
        /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/,
        /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/,
        /^\s*(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*\w+)?\s*{/
    ];

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        let match: RegExpMatchArray | null = null;

        for (const pattern of funcPatterns) {
            match = line.match(pattern);
            if (match) break;
        }

        if (match && !['if', 'for', 'while', 'switch', 'catch'].includes(match[1])) {
            const functionName = match[1];
            const paramsStr = match[2];
            const lineStart = i + 1;

            let braceCount = line.includes('{') ? 1 : 0;
            const bodyLines: string[] = [line];
            let j = i + 1;

            while (j < lines.length && braceCount > 0) {
                const nextLine = lines[j];
                bodyLines.push(nextLine);
                braceCount += (nextLine.match(/{/g) || []).length;
                braceCount -= (nextLine.match(/}/g) || []).length;
                j++;
            }

            const params = paramsStr.split(',').filter(p => p.trim()).map(p => {
                const parts = p.trim().split(/:\s*/);
                return {
                    name: parts[0]?.replace('?', '') || 'arg',
                    type: parts[1] || 'any'
                };
            });

            functions.push({
                name: functionName,
                parameters: params,
                code: bodyLines.join('\n'),
                lineStart,
                lineEnd: i + bodyLines.length,
                language
            });

            i = j;
        } else {
            i++;
        }
    }

    return functions;
}
