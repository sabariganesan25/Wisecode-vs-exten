import React, { useState, useRef, useEffect } from 'react';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    codeSnippet?: string;
}

interface ChatInterfaceProps {
    functionName: string;
    onClose: () => void;
    onQuery: (question: string) => Promise<{ answer: string; codeSnippet?: string }>;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
    functionName,
    onClose,
    onQuery
}) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        setMessages([]);
    }, [functionName]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const question = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: question }]);
        setIsLoading(true);

        try {
            const response = await onQuery(question);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: response.answer,
                codeSnippet: response.codeSnippet
            }]);
        } catch (error: any) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `Error: ${error.message}`
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="chat-overlay">
            <header className="chat-header">
                <h3>Chat: {functionName}</h3>
                <button className="close-btn" onClick={onClose}>×</button>
            </header>

            <div className="chat-messages">
                {messages.length === 0 && (
                    <div style={{ padding: '12px', color: '#858585', fontSize: '12px' }}>
                        <p>Ask anything about this function.</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                            <button
                                onClick={() => setInput('Explain this code')}
                                style={{
                                    padding: '4px 8px',
                                    background: '#3c3c3c',
                                    border: '1px solid #4c4c4c',
                                    borderRadius: '3px',
                                    color: '#ccc',
                                    cursor: 'pointer',
                                    fontSize: '11px'
                                }}
                            >
                                Explain code
                            </button>
                            <button
                                onClick={() => setInput('How to optimize?')}
                                style={{
                                    padding: '4px 8px',
                                    background: '#3c3c3c',
                                    border: '1px solid #4c4c4c',
                                    borderRadius: '3px',
                                    color: '#ccc',
                                    cursor: 'pointer',
                                    fontSize: '11px'
                                }}
                            >
                                Optimize
                            </button>
                        </div>
                    </div>
                )}

                {messages.map((msg, index) => (
                    <div key={index} className={`chat-message ${msg.role}`}>
                        <div>{msg.content}</div>
                        {msg.codeSnippet && (
                            <pre style={{
                                background: '#1e1e1e',
                                padding: '8px',
                                borderRadius: '3px',
                                marginTop: '8px',
                                overflow: 'auto',
                                fontSize: '12px',
                                fontFamily: 'Consolas, monospace'
                            }}>
                                <code>{msg.codeSnippet}</code>
                            </pre>
                        )}
                    </div>
                ))}

                {isLoading && (
                    <div className="chat-message assistant">
                        <span>Thinking...</span>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
                <input
                    type="text"
                    placeholder="Ask about this function..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                />
                <button onClick={handleSend} disabled={!input.trim() || isLoading}>
                    Send
                </button>
            </div>
        </div>
    );
};
