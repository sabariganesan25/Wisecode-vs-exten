import React, { useState, useMemo } from 'react';

interface AtomicCardProps {
    name: string;
    args: string;
    body: string;
    lineStart: number;
    lineEnd: number;
    onScanRisk: (functionName: string) => void;
    onGoToLine: (lineNumber: number) => void;
    onExecuteFunction: (functionName: string, args: string[]) => Promise<{ success: boolean; result?: string; error?: string }>;
}

interface ParsedArg {
    name: string;
    type: string;
    defaultValue?: string;
}

/**
 * Parse function arguments string into structured data
 */
function parseArguments(argsString: string): ParsedArg[] {
    if (!argsString.trim()) return [];

    const args: ParsedArg[] = [];
    const argParts = argsString.split(',').map(s => s.trim()).filter(s => s && s !== 'self');

    for (const part of argParts) {
        // Match patterns like: "name: str", "x: float = 0", "items: list"
        const match = part.match(/^(\w+)(?:\s*:\s*(\w+))?(?:\s*=\s*(.+))?$/);
        if (match) {
            args.push({
                name: match[1],
                type: match[2] || 'any',
                defaultValue: match[3]
            });
        }
    }

    return args;
}

/**
 * Get placeholder text based on argument type
 */
function getPlaceholder(arg: ParsedArg): string {
    const typeHints: Record<string, string> = {
        str: 'Hello',
        int: '42',
        float: '3.14',
        bool: 'True',
        list: '[1, 2, 3]',
        dict: '{"key": "value"}',
        any: 'value'
    };
    return arg.defaultValue || typeHints[arg.type] || typeHints.any;
}

/**
 * Format input value for Python based on expected type
 */
function formatInputForPython(value: string, argType: string): string {
    const trimmed = value.trim();

    if (!trimmed) return '';

    // If it's already properly formatted (starts with quote, bracket, number, True/False/None)
    if (/^["'\[\]{]/.test(trimmed) ||
        /^-?\d/.test(trimmed) ||
        /^(True|False|None)$/i.test(trimmed)) {
        return trimmed;
    }

    // For string types, auto-quote if not already quoted
    if (argType === 'str' || argType === 'any') {
        // Check if the input looks like a number
        if (/^-?\d+\.?\d*$/.test(trimmed)) {
            return trimmed; // It's a number, don't quote
        }
        // Wrap in quotes for strings
        return `"${trimmed.replace(/"/g, '\\"')}"`;
    }

    return trimmed;
}

const AtomicCard: React.FC<AtomicCardProps> = ({
    name,
    args,
    body,
    lineStart,
    lineEnd,
    onScanRisk,
    onGoToLine,
    onExecuteFunction
}) => {
    const parsedArgs = useMemo(() => parseArguments(args), [args]);
    const [inputValues, setInputValues] = useState<Record<string, string>>({});
    const [output, setOutput] = useState<{ success: boolean; result?: string; error?: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);

    const handleInputChange = (argName: string, value: string) => {
        setInputValues(prev => ({ ...prev, [argName]: value }));
        // Clear output when input changes
        if (output) setOutput(null);
    };

    const handleExecute = async () => {
        setIsLoading(true);
        setOutput(null);

        try {
            // Get argument values in order, formatting them for Python
            const argValues = parsedArgs.map(arg => {
                const rawValue = inputValues[arg.name] || arg.defaultValue || '';
                return formatInputForPython(rawValue, arg.type);
            });

            // Check if all required args have values
            const emptyArgs = parsedArgs.filter((arg, i) => !argValues[i] && !arg.defaultValue);
            if (emptyArgs.length > 0) {
                setOutput({
                    success: false,
                    error: `Missing required argument(s): ${emptyArgs.map(a => a.name).join(', ')}`
                });
                setIsLoading(false);
                return;
            }

            const result = await onExecuteFunction(name, argValues);
            setOutput(result);
        } catch (err) {
            setOutput({
                success: false,
                error: err instanceof Error ? err.message : 'Unknown error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleHeaderClick = () => {
        onGoToLine(lineStart);
    };

    const handleToggleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleExecute();
        }
    };

    return (
        <article className="atomic-card">
            <header
                className="card-header card-header-clickable"
                onClick={handleHeaderClick}
                title={`Click to go to line ${lineStart}`}
            >
                <div className="function-info">
                    <span className="function-name">{name}</span>
                    <span className="function-args">({args})</span>
                </div>
                <div className="header-actions">
                    <button
                        className="expand-button"
                        onClick={handleToggleExpand}
                        title={isExpanded ? 'Collapse' : 'Expand'}
                    >
                        {isExpanded ? '▼' : '▶'}
                    </button>
                    <span className="line-badge">L{lineStart}-{lineEnd}</span>
                </div>
            </header>

            {isExpanded && (
                <>
                    <div className="card-body">
                        <pre className="code-block">
                            <code>{body}</code>
                        </pre>
                    </div>

                    {/* Test Section */}
                    <div className="test-section">
                        <div className="test-header">
                            <span className="test-title">🧪 Test Function</span>
                        </div>

                        {parsedArgs.length > 0 ? (
                            <div className="input-grid">
                                {parsedArgs.map((arg) => (
                                    <div key={arg.name} className="input-group">
                                        <label className="input-label">
                                            {arg.name}
                                            <span className="type-hint">: {arg.type}</span>
                                        </label>
                                        <input
                                            type="text"
                                            className="param-input"
                                            placeholder={getPlaceholder(arg)}
                                            value={inputValues[arg.name] || ''}
                                            onChange={(e) => handleInputChange(arg.name, e.target.value)}
                                            onKeyDown={handleKeyDown}
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="no-params">No parameters required</p>
                        )}

                        <button
                            className="run-button"
                            onClick={handleExecute}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <span className="spinner"></span>
                                    Running...
                                </>
                            ) : (
                                '▶ Run'
                            )}
                        </button>

                        {/* Output Section */}
                        {output && (
                            <div className={`output-section ${output.success ? 'output-success' : 'output-error'}`}>
                                <div className="output-header">
                                    {output.success ? '✅ Result' : '❌ Error'}
                                </div>
                                <pre className="output-content">
                                    {output.success ? output.result : output.error}
                                </pre>
                            </div>
                        )}
                    </div>

                    <footer className="card-footer">
                        <button
                            className="scan-button"
                            onClick={() => onScanRisk(name)}
                            title="Scan this function for security risks (Coming Soon)"
                        >
                            🔍 Scan Risk
                        </button>
                    </footer>
                </>
            )}
        </article>
    );
};

export default AtomicCard;
