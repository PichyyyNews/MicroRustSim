import React, { useEffect, useRef, useCallback } from 'react';
import {
  GoCopy,
  GoTrash,
  GoSync,
  GoGear,
  GoPencil,
} from 'react-icons/go';
import { Scissors, Clipboard, FlipHorizontal, Type } from 'lucide-react';

export interface ContextMenuProps {
  x: number;
  y: number;
  type: 'single' | 'group' | 'canvas';
  selectedCount?: number;
  componentName?: string;
  onClose: () => void;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onDelete?: () => void;
  onRotate?: () => void;
  onFlip?: () => void;
  onRename?: () => void;
  onProperties?: () => void;
  onAddText?: () => void;
}

interface MenuItemProps {
  icon: any;
  label: string;
  shortcut?: string;
  onTrigger?: () => void;
  danger?: boolean;
}

// Declared outside parent component so React maintains stable DOM nodes across re-renders (prevents hover flickering)
const MenuItem: React.FC<MenuItemProps> = React.memo(({
  icon: Icon,
  label,
  shortcut,
  onTrigger,
  danger = false,
}) => (
  <button
    type="button"
    onMouseDown={(e) => {
      e.preventDefault();
      e.stopPropagation();
      onTrigger?.();
    }}
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      onTrigger?.();
    }}
    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded text-left cursor-pointer transition-colors duration-75 select-none ${
      danger
        ? 'text-red-400 hover:text-red-300 hover:bg-red-950/50 active:bg-red-900/60'
        : 'text-zinc-200 hover:bg-[#27272a] hover:text-white active:bg-[#323236]'
    }`}
  >
    <div className="flex items-center gap-2 pointer-events-none">
      <Icon className="w-3.5 h-3.5 opacity-80 shrink-0" />
      <span>{label}</span>
    </div>
    {shortcut && <span className="text-[10px] text-zinc-500 font-mono ml-3 pointer-events-none">{shortcut}</span>}
  </button>
));

const MenuDivider: React.FC = React.memo(() => <div className="h-px bg-[#27272a] my-1 pointer-events-none" />);

export const CanvasContextMenu: React.FC<ContextMenuProps> = React.memo(({
  x,
  y,
  type,
  selectedCount = 1,
  componentName,
  onClose,
  onCopy,
  onCut,
  onPaste,
  onDelete,
  onRotate,
  onFlip,
  onRename,
  onProperties,
  onAddText,
}) => {
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Viewport bounding
  const menuWidth = 200;
  const menuHeight = type === 'group' ? 220 : type === 'single' ? 280 : 160;
  const adjustedX = Math.max(10, Math.min(x, window.innerWidth - menuWidth - 10));
  const adjustedY = Math.max(10, Math.min(y, window.innerHeight - menuHeight - 10));

  const handleItemTrigger = useCallback((action?: () => void) => {
    if (hasTriggeredRef.current || !action) return;
    hasTriggeredRef.current = true;
    try {
      action();
    } finally {
      onClose();
    }
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[99999] select-none">
      {/* Invisible backdrop layer that catches clicks outside the menu card */}
      <div
        className="fixed inset-0 bg-transparent"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
      />

      {/* Floating Menu Card with strictly higher z-index than the backdrop */}
      <div
        className="min-w-[200px] bg-[#121215] border border-[#27272a] rounded-lg shadow-2xl p-1 font-sans text-zinc-200"
        style={{
          position: 'fixed',
          zIndex: 100000,
          left: `${adjustedX}px`,
          top: `${adjustedY}px`,
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseMove={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {type === 'single' && (
          <>
            {componentName && (
              <div className="px-2.5 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-[#27272a]/80 mb-1">
                {componentName}
              </div>
            )}
            {onRename && <MenuItem icon={GoPencil} label="Rename Component" shortcut="F2" onTrigger={() => handleItemTrigger(onRename)} />}
            {onCopy && <MenuItem icon={GoCopy} label="Copy" shortcut="Ctrl+C" onTrigger={() => handleItemTrigger(onCopy)} />}
            {onCut && <MenuItem icon={Scissors} label="Cut" shortcut="Ctrl+X" onTrigger={() => handleItemTrigger(onCut)} />}
            {onPaste && <MenuItem icon={Clipboard} label="Paste" shortcut="Ctrl+V" onTrigger={() => handleItemTrigger(onPaste)} />}
            <MenuDivider />
            {onRotate && <MenuItem icon={GoSync} label="Rotate 90°" shortcut="R" onTrigger={() => handleItemTrigger(onRotate)} />}
            {onFlip && <MenuItem icon={FlipHorizontal} label="Flip Horizontal" shortcut="F" onTrigger={() => handleItemTrigger(onFlip)} />}
            <MenuDivider />
            {onDelete && <MenuItem icon={GoTrash} label="Delete" shortcut="Del" onTrigger={() => handleItemTrigger(onDelete)} danger />}
            {onProperties && (
              <>
                <MenuDivider />
                <MenuItem icon={GoGear} label="Properties (Inspect)" onTrigger={() => handleItemTrigger(onProperties)} />
              </>
            )}
          </>
        )}

        {type === 'group' && (
          <>
            <div className="px-2.5 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-[#27272a]/80 mb-1 flex items-center justify-between">
              <span>Group Selection</span>
              <span className="text-[10px] bg-[#27272a] px-1.5 py-0.2 rounded font-mono text-zinc-300">
                {selectedCount} items
              </span>
            </div>
            {onCopy && <MenuItem icon={GoCopy} label="Copy Group" shortcut="Ctrl+C" onTrigger={() => handleItemTrigger(onCopy)} />}
            {onCut && <MenuItem icon={Scissors} label="Cut Group" shortcut="Ctrl+X" onTrigger={() => handleItemTrigger(onCut)} />}
            {onPaste && <MenuItem icon={Clipboard} label="Paste" shortcut="Ctrl+V" onTrigger={() => handleItemTrigger(onPaste)} />}
            <MenuDivider />
            {onRotate && <MenuItem icon={GoSync} label="Rotate Group 90°" shortcut="R" onTrigger={() => handleItemTrigger(onRotate)} />}
            {onFlip && <MenuItem icon={FlipHorizontal} label="Flip Group" shortcut="F" onTrigger={() => handleItemTrigger(onFlip)} />}
            <MenuDivider />
            {onDelete && <MenuItem icon={GoTrash} label="Delete Group" shortcut="Del" onTrigger={() => handleItemTrigger(onDelete)} danger />}
          </>
        )}

        {type === 'canvas' && (
          <>
            <div className="px-2.5 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-[#27272a]/80 mb-1">
              Canvas Actions
            </div>
            {onPaste && <MenuItem icon={Clipboard} label="Paste Component" shortcut="Ctrl+V" onTrigger={() => handleItemTrigger(onPaste)} />}
            <MenuDivider />
            {onAddText && <MenuItem icon={Type} label="Add Text Label" shortcut="T" onTrigger={() => handleItemTrigger(onAddText)} />}
          </>
        )}
      </div>
    </div>
  );
});
