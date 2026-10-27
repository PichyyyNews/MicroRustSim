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
  const [targetFolder, setTargetFolder] = useState<string | null>(null);
  const [newEntryName, setNewEntryName] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['src']));

  const RECOMMENDED_FILES = [
    'config.h',
    'constants.h',
    'sensors.h',
    'display.cpp',
    'diagram.json',
    'README.md',
  ];

  // Build hierarchical tree from flat relative paths (normalizing Windows \ to /)
  const fileTree = useMemo(() => {
    const rootNodes: FileTreeNode[] = [];
    const map: Record<string, FileTreeNode> = {};

    const sorted = [...files].sort((a, b) => {
      const aNorm = a.relative_path.replace(/\\/g, '/');
      const bNorm = b.relative_path.replace(/\\/g, '/');
      if (a.is_dir === b.is_dir) {
        return aNorm.localeCompare(bNorm);
      }
      return a.is_dir ? -1 : 1;
    });

    for (const f of sorted) {
      const normPath = f.relative_path.replace(/\\/g, '/');
      const parts = normPath.split('/').filter(Boolean);
      const node: FileTreeNode = {
        name: f.name,
        path: f.path,
        relativePath: normPath,
        isDir: f.is_dir,
        size: f.size,
        children: [],
      };
      map[normPath] = node;

      if (parts.length <= 1) {
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
    const norm = folderPath.replace(/\\/g, '/');
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(norm)) {
        next.delete(norm);
      } else {
        next.add(norm);
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
      const fullPath = targetFolder ? `${targetFolder}/${trimmed}` : trimmed;
      onCreateFile(fullPath, createType === 'folder');
      setNewEntryName('');
      setCreateType(null);
      setTargetFolder(null);
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
      return <GoCode className="w-3.5 h-3.5 text-zinc-200 shrink-0" />;
    }
    if (fileName.endsWith('.h') || fileName.endsWith('.hpp')) {
      return <FileCode className="w-3.5 h-3.5 text-zinc-300 shrink-0" />;
    }
    if (fileName.endsWith('.json')) {
      return <FileJson className="w-3.5 h-3.5 text-zinc-300 shrink-0" />;
    }
    if (fileName.endsWith('.md')) {
      return <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
    }
    return <GoFile className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
  };

  const renderTreeNode = (node: FileTreeNode, depth = 0) => {
    const isFolder = node.isDir;
    const hasChildren = isFolder && node.children.length > 0;
    const isExpanded = hasChildren && expandedFolders.has(node.relativePath);
    const isSelected = activeFile === node.path || activeFile === node.relativePath || activeFile === node.name;
    const isProtected = node.name === 'sketch.ino' || node.name === 'diagram.json' || node.name === 'project.json';

    return (
      <React.Fragment key={node.relativePath}>
        <div
          onClick={() => {
            if (isFolder) {
              if (hasChildren) toggleFolder(node.relativePath);
            } else {
              onSelectFile(node.relativePath);
            }
          }}
          style={{ paddingLeft: `${6 + depth * 14}px` }}
          className={`group flex items-center justify-between py-1 pr-2 rounded cursor-pointer transition-colors ${
            isSelected && !isFolder
              ? 'bg-[#27272a] text-white font-medium'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1a1a1e]'
          }`}
        >
          <div className="flex items-center gap-1.5 truncate">
            {hasChildren ? (
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
            {isFolder && (
              <button
                type="button"
                title={`New File in ${node.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setTargetFolder(node.relativePath);
                  setCreateType('file');
                  setNewEntryName('');
                  setExpandedFolders((prev) => new Set(prev).add(node.relativePath));
                }}
                className="p-0.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
              >
                <GoPlus className="w-3 h-3" />
              </button>
            )}

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
              setTargetFolder(null);
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
              setTargetFolder(null);
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
              <FolderOpen className="w-3.5 h-3.5 text-zinc-300" />
            </button>
          )}
        </div>
      </div>

      {/* New File / Folder Inline Form */}
      {createType && (
        <div className="bg-[#18181b] border-b border-zinc-800 animate-in fade-in duration-75">
          <form
            onSubmit={handleCreateSubmit}
            className="px-2 py-1.5 flex items-center gap-1.5"
          >
            {createType === 'folder' ? (
              <FolderPlus className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            ) : (
              <GoFile className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            )}
            {targetFolder && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] border border-zinc-700 shrink-0">
                <span className="truncate max-w-[80px]">{targetFolder}/</span>
                <button
                  type="button"
                  title="Remove target folder"
                  onClick={() => setTargetFolder(null)}
                  className="text-zinc-400 hover:text-white"
                >
                  <GoX className="w-2.5 h-2.5" />
                </button>
              </span>
            )}
            <input
              autoFocus
              type="text"
              placeholder={createType === 'folder' ? 'folder name (e.g. lib)' : 'file name (e.g. utils.h)'}
              value={newEntryName}
              onChange={(e) => setNewEntryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setCreateType(null);
                  setTargetFolder(null);
                }
              }}
              className="flex-1 min-w-0 bg-transparent text-xs text-zinc-200 outline-none font-mono placeholder:text-zinc-600"
            />
            <button
              type="submit"
              className="p-0.5 text-zinc-200 hover:text-white rounded"
            >
              <GoCheck className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setCreateType(null);
                setTargetFolder(null);
              }}
              className="p-0.5 text-zinc-500 hover:text-zinc-300 rounded"
            >
              <GoX className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Quick Recommendation Chips */}
          {createType === 'file' && (
            <div className="px-2 pb-1.5 pt-0.5 flex flex-wrap items-center gap-1 text-[10px]">
              <span className="text-zinc-500 select-none">Rec:</span>
              {RECOMMENDED_FILES.map((fileName) => (
                <button
                  key={fileName}
                  type="button"
                  onClick={() => setNewEntryName(fileName)}
                  className="px-1.5 py-0.5 rounded bg-[#222226] hover:bg-[#2e2e34] hover:text-white text-zinc-400 font-mono transition-colors border border-[#2a2a30]"
                >
                  {fileName}
                </button>
              ))}
            </div>
          )}
        </div>
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
