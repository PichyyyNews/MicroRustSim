import React, { useState, useMemo } from 'react';
import {
  GoFile,
  GoCode,
  GoPlus,
  GoTrash,
  GoSync,
  GoCheck,
  GoX,
  GoChevronRight,
  GoChevronDown,
  GoFold,
} from 'react-icons/go';
import {
  FileCode,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderKanban,
} from 'lucide-react';
import { ProjectFileEntry, FileTreeNode } from '../types';

export interface FileExplorerProps {
  projectName: string;
  projectPath?: string | null;
  files: ProjectFileEntry[];
  activeFile: string;
  onSelectFile: (filePath: string) => void;
  onCreateFile: (fileName: string, isDir?: boolean) => void;
  onDeleteFile: (filePath: string) => void;
  onRefresh?: () => void;
  onOpenFolder?: () => void;
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
  onOpenFolder,
}) => {
  const [createType, setCreateType] = useState<'file' | 'folder' | null>(null);
  const [newEntryName, setNewEntryName] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['src']));

  // Build hierarchical tree from flat relative paths
  const fileTree = useMemo(() => {
    const rootNodes: FileTreeNode[] = [];
    const map: Record<string, FileTreeNode> = {};

    const sorted = [...files].sort((a, b) => {
      if (a.is_dir === b.is_dir) {
        return a.relative_path.localeCompare(b.relative_path);
      }
      return a.is_dir ? -1 : 1;
    });

    for (const f of sorted) {
      const parts = f.relative_path.split('/');
      const node: FileTreeNode = {
        name: f.name,
        path: f.path,
        relativePath: f.relative_path,
        isDir: f.is_dir,
        size: f.size,
        children: [],
      };
      map[f.relative_path] = node;

      if (parts.length === 1) {
        rootNodes.push(node);
      } else {
        const parentPath = parts.slice(0, -1).join('/');
        if (map[parentPath]) {
          map[parentPath].children.push(node);
        } else {
          rootNodes.push(node);
        }
      }
    }

    return rootNodes;
  }, [files]);

  const toggleFolder = (folderPath: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const collapseAllFolders = () => {
    setExpandedFolders(new Set());
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newEntryName.trim();
    if (trimmed) {
      onCreateFile(trimmed, createType === 'folder');
      setNewEntryName('');
      setCreateType(null);
    }
  };

  const getFileIcon = (fileName: string, isDir: boolean, isOpen: boolean) => {
    if (isDir) {
      return isOpen ? (
        <FolderOpen className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
      ) : (
        <Folder className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
      );
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
    if (fileName.endsWith('.md')) {
      return <FileText className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
    }
    return <GoFile className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
  };

  const renderTreeNode = (node: FileTreeNode, depth = 0) => {
    const isFolder = node.isDir;
    const isExpanded = expandedFolders.has(node.relativePath);
    const isSelected = activeFile === node.path || activeFile === node.relativePath || activeFile === node.name;
    const isProtected = node.name === 'sketch.ino' || node.name === 'diagram.json' || node.name === 'project.json';

    return (
      <React.Fragment key={node.relativePath}>
        <div
          onClick={() => {
            if (isFolder) {
              toggleFolder(node.relativePath);
            } else {
              onSelectFile(node.path || node.relativePath);
            }
          }}
          style={{ paddingLeft: `${6 + depth * 14}px` }}
          className={`group flex items-center justify-between py-1 pr-2 rounded cursor-pointer transition-colors ${
            isSelected && !isFolder
              ? 'bg-[#27272a] text-zinc-100 font-medium'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1a1a1e]'
          }`}
        >
          <div className="flex items-center gap-1.5 truncate">
            {isFolder ? (
              <span
                onClick={(e) => toggleFolder(node.relativePath, e)}
                className="w-3.5 h-3.5 flex items-center justify-center text-zinc-500 hover:text-zinc-300"
              >
                {isExpanded ? (
                  <GoChevronDown className="w-3 h-3" />
                ) : (
                  <GoChevronRight className="w-3 h-3" />
                )}
              </span>
            ) : (
              <span className="w-3.5" />
            )}

            {getFileIcon(node.name, isFolder, isExpanded)}
            <span className="truncate">{node.name}</span>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!isProtected && !isFolder && (
              <button
                type="button"
                title="Delete File"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFile(node.path || node.relativePath);
                }}
                className="p-0.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors"
              >
                <GoTrash className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {isFolder && isExpanded && node.children.length > 0 && (
          <div>
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </React.Fragment>
    );
  };

  // 1. Empty State (No Folder Opened)
  if (!projectPath && files.length === 0) {
    return (
      <div className="h-full flex flex-col bg-[#121215] border-t border-[#222226] p-4 items-center justify-center text-center select-none">
        <FolderKanban className="w-8 h-8 text-zinc-600 mb-2 stroke-1" />
        <span className="font-semibold text-xs text-zinc-300 mb-1">
          No Folder Opened
        </span>
        <p className="text-[11px] text-zinc-500 mb-3 max-w-[200px]">
          Select or open a working folder to start programming & simulating.
        </p>
        {onOpenFolder && (
          <button
            type="button"
            onClick={onOpenFolder}
            className="px-3 py-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-zinc-200 border border-zinc-700 rounded text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Open Folder</span>
          </button>
        )}
      </div>
    );
  }

  // 2. Project Explorer Tree
  return (
    <div className="h-full flex flex-col bg-[#121215] border-t border-[#222226] overflow-hidden select-none text-xs">
      {/* VS Code Header */}
      <div className="h-7 px-3 border-b border-[#222226] flex items-center justify-between text-zinc-400 bg-[#121215] shrink-0">
        <div
          className="flex items-center gap-1.5 font-semibold text-[11px] text-zinc-300 uppercase tracking-wide truncate"
          title={projectPath || projectName}
        >
          <FolderOpen className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="truncate">{projectName}</span>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="New File"
            onClick={() => {
              setCreateType('file');
              setNewEntryName('');
            }}
            className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-[#1f1f23] rounded transition-colors"
          >
            <GoPlus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="New Folder"
            onClick={() => {
              setCreateType('folder');
              setNewEntryName('');
            }}
            className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-[#1f1f23] rounded transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Collapse All Folders"
            onClick={collapseAllFolders}
            className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-[#1f1f23] rounded transition-colors"
          >
            <GoFold className="w-3.5 h-3.5" />
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
          {onOpenFolder && (
            <button
              type="button"
              title="Open Another Working Folder (Ctrl+O)"
              onClick={onOpenFolder}
              className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-[#1f1f23] rounded transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
            </button>
          )}
        </div>
      </div>

      {/* New File / Folder Inline Form */}
      {createType && (
        <form
          onSubmit={handleCreateSubmit}
          className="px-2 py-1.5 bg-[#18181b] border-b border-zinc-800 flex items-center gap-1.5 animate-in fade-in duration-75"
        >
          {createType === 'folder' ? (
            <FolderPlus className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          ) : (
            <GoFile className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          )}
          <input
            autoFocus
            type="text"
            placeholder={createType === 'folder' ? 'folder name (e.g. src)' : 'file name (e.g. config.h)'}
            value={newEntryName}
            onChange={(e) => setNewEntryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setCreateType(null);
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
            onClick={() => setCreateType(null)}
            className="p-0.5 text-zinc-500 hover:text-zinc-300 rounded"
          >
            <GoX className="w-3.5 h-3.5" />
          </button>
        </form>
      )}

      {/* Hierarchical Tree List */}
      <div className="flex-1 overflow-y-auto p-1 font-mono text-[11px] space-y-0.5">
        {fileTree.length === 0 ? (
          <div className="p-4 text-center text-zinc-500 text-xs">
            No files in directory
          </div>
        ) : (
          fileTree.map((node) => renderTreeNode(node))
        )}
      </div>
    </div>
  );
};
