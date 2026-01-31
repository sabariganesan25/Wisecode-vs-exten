import React from 'react';
interface ChatInterfaceProps {
    functionName: string;
    onClose: () => void;
    onQuery: (question: string) => Promise<{
        answer: string;
        codeSnippet?: string;
    }>;
}
export declare const ChatInterface: React.FC<ChatInterfaceProps>;
export {};
//# sourceMappingURL=ChatInterface.d.ts.map