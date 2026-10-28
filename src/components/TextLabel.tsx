import React, { useState, useRef, useEffect } from 'react';

interface TextLabelProps {
  id: string;
  text?: string;
  color?: string;
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  isSelected?: boolean;
  onTextChange?: (newText: string) => void;
}

export const TextLabel: React.FC<TextLabelProps> = ({
  id,
  text = 'Text Label',
  color = '#f4f4f5',
  fontFamily = 'Inter, sans-serif',
  fontSize = 16,
  bold = false,
  italic = false,
  underline = false,
  isSelected = false,
  onTextChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditText(text);
  }, [text]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleFinishEditing = () => {
    setIsEditing(false);
    if (onTextChange && editText.trim() !== '') {
      onTextChange(editText.trim());
    } else {
      setEditText(text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFinishEditing();
    } else if (e.key === 'Escape') {
      setEditText(text);
      setIsEditing(false);
    }
  };

  return (
    <div
      className={`relative select-none px-2 py-1 rounded transition-colors group ${
        isSelected ? 'bg-zinc-800/40 ring-1 ring-zinc-500' : 'hover:bg-zinc-800/20'
      }`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleFinishEditing}
          onKeyDown={handleKeyDown}
          className="bg-[#18181b] border border-zinc-600 rounded px-1.5 py-0.5 outline-none text-zinc-100 shadow-sm"
          style={{
            color,
            fontFamily,
            fontSize: `${fontSize}px`,
            fontWeight: bold ? 'bold' : 'normal',
            fontStyle: italic ? 'italic' : 'normal',
            textDecoration: underline ? 'underline' : 'none',
            minWidth: '80px',
          }}
        />
      ) : (
        <span
          className="block whitespace-pre cursor-pointer"
          style={{
            color,
            fontFamily,
            fontSize: `${fontSize}px`,
            fontWeight: bold ? 'bold' : 'normal',
            fontStyle: italic ? 'italic' : 'normal',
            textDecoration: underline ? 'underline' : 'none',
          }}
        >
          {text || 'Text Label'}
        </span>
      )}
    </div>
  );
};
