import React from 'react';

interface WorkflowStep {
    step: number;
    function: string;
    description: string;
}

interface ProjectGuide {
    summary: string;
    workflow: WorkflowStep[];
    dependencies: string[];
}

interface GuidePanelProps {
    guide: ProjectGuide | null;
    isLoading: boolean;
    onClose: () => void;
    onGenerate: () => void;
}

export const GuidePanel: React.FC<GuidePanelProps> = ({
    guide,
    isLoading,
    onClose,
    onGenerate
}) => {
    return (
        <div className="guide-overlay" onClick={onClose}>
            <div className="guide-panel" onClick={(e) => e.stopPropagation()}>
                <header className="guide-header">
                    <h2>Project Guide</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </header>

                <div className="guide-content">
                    {isLoading ? (
                        <div className="loading-spinner">
                            <p>Analyzing code with IBM Watsonx...</p>
                        </div>
                    ) : guide ? (
                        <>
                            <section className="guide-section">
                                <h3>Summary</h3>
                                <p>{guide.summary}</p>
                            </section>

                            <section className="guide-section">
                                <h3>Testing Workflow</h3>
                                {guide.workflow.length > 0 ? (
                                    guide.workflow.map((step) => (
                                        <div key={step.step} className="workflow-step">
                                            <strong>{step.step}. {step.function}</strong>
                                            <span> - {step.description}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p>No specific workflow suggested</p>
                                )}
                            </section>

                            <section className="guide-section">
                                <h3>Dependencies</h3>
                                {guide.dependencies.length > 0 ? (
                                    <ul>
                                        {guide.dependencies.map((dep, i) => (
                                            <li key={i}>{dep}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p>No dependencies detected</p>
                                )}
                            </section>
                        </>
                    ) : (
                        <div className="loading-spinner">
                            <button className="guide-btn" onClick={onGenerate}>
                                Generate Guide
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
