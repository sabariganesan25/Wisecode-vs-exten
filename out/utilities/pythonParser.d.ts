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
export type PythonFunction = CodeFunction;
export type PythonParameter = CodeParameter;
/**
 * Detect language from file extension
 */
export declare function detectLanguage(fileName: string): string;
/**
 * Parse functions based on language
 */
export declare function parseFunctions(sourceCode: string, fileName: string): CodeFunction[];
export declare function parsePythonFunctions(sourceCode: string): CodeFunction[];
//# sourceMappingURL=pythonParser.d.ts.map