import React, { useState } from 'react';
import {
  GoFile,
  GoFileDirectory,
  GoCode,
  GoPlus,
  GoTrash,
  GoSync,
  GoCheck,
  GoX,
} from 'react-icons/go';
import { FileCode, FileJson, Folder, FolderOpen } from 'lucide-react';
import { ProjectFileEntry } from '../types';

export interface FileExplorerProps {
  projectName: string;
  projectPath?: string | null;
  files: ProjectFileEntry[];
  activeFile: string;
  onSelectFile: (filePath: string) => void;
  onCreateFile: (fileName: string) => void;
  onDeleteFile: (filePath: string) => void;
  onRefresh?: () => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  projectName,
  projectPath,
  files,
  activeFile,
  onSelectFile,
  onCreateFile,
  onDeleteFile,
  onRefresh,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFileName.trim();
    if (trimmed) {
      onCreateFile(trimmed);
      setNewFileName('');
      setIsCreating(false);
    }
  };

  const getFileIcon = (fileName: string, isDir: boolean) => {
    if (isDir) {
      return <Folder className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
    }
    if (fileName.endsWith('.ino') || fileName.endsWith('.cpp') || fileName.endsWith('.c')) {
      return <GoCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    }
    if (fileName.endsWith('.h') || fileName.endsWith('.hpp')) {
      return <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    }
    if (fileName.endsWith('.json')) {
      return <FileJson className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    }
    return <GoFile className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="h-full flex flex-col bg-[#121215] border-t border-[#222226] overflow-hidden select-none text-xs">
      {/* Header */}
      <div className="h-7 px-3 border-b border-[#222226] flex items-center justify-between text-zinc-400 bg-[#121215] shrink-0">
        <div className="flex items-center gap-1.5 font-medium text-zinc-300 truncate">
          <FolderOpen className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="truncate" title={projectPath || projectName}>
            {projectName}
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="New File"
            onClick={() => setIsCreating(true)}
            className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-[#1f1f23] rounded transition-colors"
          >
            <GoPlus className="w-3.5 h-3.5" />
          </button>
          {onRefresh && (
            <button
              type="button"
              title="Refresh Files"
              onClick={onRefresh}
              className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-[#1f1f23] rounded transition-colors"
            >
              <GoSync className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* New File Inline Form */}
      {isCreating && (
        <form
          onSubmit={handleCreateSubmit}
          className="px-2 py-1.5 bg-[#18181b] border-b border-zinc-800 flex items-center gap-1 animate-in fade-in duration-75"
        >
          <GoFile className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="filename (e.g. config.h)"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setIsCreating(false);
            }}
            className="flex-1 bg-transparent text-xs text-zinc-200 outline-none font-mono placeholder:text-zinc-600"
          />
          <button
            type="submit"
            className="p-0.5 text-emerald-400 hover:text-emerald-300 rounded"
          >
            <GoCheck className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsCreating(false)}
            className="p-0.5 text-zinc-500 hover:text-zinc-300 rounded"
          >
            <GoX className="w-3.5 h-3.5" />
          </button>
        </form>
      )}

      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto p-1 font-mono text-[11px] space-y-0.5">
        {files.length === 0 ? (
          <div className="p-3 text-center text-zinc-500 text-xs">
            No files in project directory
          </div>
        ) : (
          files.map((file) => {
            const isSelected = activeFile === file.path || activeFile === file.name;
            const isProtected = file.name === 'sketch.ino' || file.name === 'diagram.json' || file.name === 'project.json';

            return (
              <div
                key={file.path || file.relative_path}
                onClick={() => !file.is_dir && onSelectFile(file.path || file.relative_path)}
                className={`group px-2 py-1 flex items-center justify-between rounded cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-zinc-800/90 text-zinc-100 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#18181b]'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {getFileIcon(file.name, file.is_dir)}
                  <span className="truncate">{file.relative_path || file.name}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-zinc-600 group-hover:hidden">
                    {formatFileSize(file.size)}
                  </span>

                  {!file.is_dir && !isProtected && (
                    <button
                      type="button"
                      title="Delete File"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete ${file.name}?`)) {
                          onDeleteFile(file.path || file.relative_path);
                        }
                      }}
                      className="hidden group-hover:flex p-0.5 text-zinc-500 hover:text-red-400 rounded transition-colors"
                    >
                      <GoTrash className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
