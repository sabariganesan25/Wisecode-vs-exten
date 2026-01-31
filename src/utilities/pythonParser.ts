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
export function parsePythonFunctions(sourceCode: string): PythonFunction[] {
    const functions: PythonFunction[] = [];
    const lines = sourceCode.split('\n');

    // Regex to match function definition line
    const functionDefRegex = /^(\s*)def\s+(\w+)\s*\(([^)]*)\)\s*(?:->.*)?:/;

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const match = line.match(functionDefRegex);

        if (match) {
            const baseIndent = match[1].length;
            const functionName = match[2];
            const functionArgs = match[3].trim();
            const lineStart = i + 1; // 1-indexed for VS Code

            // Collect function body lines
            const bodyLines: string[] = [line];
            let j = i + 1;

            while (j < lines.length) {
                const nextLine = lines[j];

                // Empty lines are part of the function
                if (nextLine.trim() === '') {
                    bodyLines.push(nextLine);
                    j++;
                    continue;
                }

                // Calculate indentation of this line
                const nextIndentMatch = nextLine.match(/^(\s*)/);
                const nextIndent = nextIndentMatch ? nextIndentMatch[1].length : 0;

                // If indentation is greater than base, it's part of the function
                if (nextIndent > baseIndent) {
                    bodyLines.push(nextLine);
                    j++;
                } else {
                    // Found a line with equal or less indentation - function ends
                    break;
                }
            }

            // Remove trailing empty lines from body
            while (bodyLines.length > 1 && bodyLines[bodyLines.length - 1].trim() === '') {
                bodyLines.pop();
            }

            const lineEnd = i + bodyLines.length; // 1-indexed

            functions.push({
                name: functionName,
                args: functionArgs,
                body: bodyLines.join('\n'),
                lineStart,
                lineEnd
            });

            // Move to the line after the function
            i = j;
        } else {
            i++;
        }
    }

    return functions;
}
