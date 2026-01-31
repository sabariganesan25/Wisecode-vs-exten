import React from 'react';
interface AtomicCardProps {
    name: string;
    args: string;
    body: string;
    lineStart: number;
    lineEnd: number;
    onScanRisk: (functionName: string) => void;
    onGoToLine: (lineNumber: number) => void;
    onExecuteFunction: (functionName: string, args: string[]) => Promise<{
        success: boolean;
        result?: string;
        error?: string;
    }>;
}
declare const AtomicCard: React.FC<AtomicCardProps>;
export default AtomicCard;
//# sourceMappingURL=AtomicCard.d.ts.map