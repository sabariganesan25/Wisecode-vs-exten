import React from 'react';
interface FileInfo {
    name: string;
    path: string;
    type: 'file' | 'folder';
    children?: FileInfo[];
    language?: string;
}
interface FileTreeProps {
    files: FileInfo[];
    selectedFile: string | null;
    onSelectFile: (filePath: string) => void;
    expandedFolders: Set<string>;
    onToggleFolder: (folderPath: string) => void;
}
export declare const FileTree: React.FC<FileTreeProps>;
export {};
//# sourceMappingURL=FileTree.d.ts.map