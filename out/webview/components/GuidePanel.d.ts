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
export declare const GuidePanel: React.FC<GuidePanelProps>;
export {};
//# sourceMappingURL=GuidePanel.d.ts.map