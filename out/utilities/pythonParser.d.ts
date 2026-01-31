/**
 * Python Function Parser
 * Uses line-by-line analysis with indentation tracking
 */
export interface PythonFunction {
    name: string;
    args: string;
    body: string;
    lineStart: number;
    lineEnd: number;
}
/**
 * Parse Python source code and extract all function definitions
 * Uses indentation-based parsing (not regex for body capture)
 */
export declare function parsePythonFunctions(sourceCode: string): PythonFunction[];
//# sourceMappingURL=pythonParser.d.ts.map