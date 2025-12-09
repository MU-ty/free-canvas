import React, { useEffect, useRef, useState } from 'react';
import type { CanvasElement, TextElement, ShapeElement, TextStyle } from '../types';

interface TextEditorProps {
  element: CanvasElement | any;
  viewport: { x: number; y: number; scale: number };
  onUpdate: (content: string) => void;
  onClose: () => void;
}

export const TextEditor: React.FC<TextEditorProps> = ({
  element,
  viewport,
  onUpdate,
  onClose,
}) => {
  const [text, setText] = useState((element as any).content || '');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleBlur = () => {
    onUpdate(text);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      e.stopPropagation();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      handleBlur();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.stopPropagation();
    }
  };

  const left = element.x * viewport.scale + viewport.x;
  const top = element.y * viewport.scale + viewport.y;
  const width = element.width * viewport.scale;

  const height = element.height * viewport.scale;
  const isShape = element.type && element.type !== 'text';

  // 获取样式（支持文本元素与图形内部文本）
  const styleSource: TextStyle | undefined =
    element.type === 'text' ? (element as TextElement).style : (element as ShapeElement).textStyle;

  const fontSizeScaled = (styleSource?.fontSize || 16) * viewport.scale;

  return (
    <textarea
      ref={inputRef}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        minHeight: height,
        fontSize: fontSizeScaled,
        fontFamily: styleSource?.fontFamily || 'Arial',
        color: styleSource?.color || '#000000',
        backgroundColor: styleSource?.backgroundColor || 'transparent',
        fontWeight: styleSource?.bold ? 'bold' : 'normal',
        fontStyle: styleSource?.italic ? 'italic' : 'normal',
        textDecoration: styleSource?.underline ? 'underline' : styleSource?.strikethrough ? 'line-through' : 'none',
        border: '2px solid #3b82f6',
        outline: 'none',
        padding: '6px 8px',
        resize: 'none',
        overflow: 'hidden',
        zIndex: 1000,
        textAlign: isShape ? 'center' : 'left',
        lineHeight: `${fontSizeScaled}px`,
      }}
    />
  );
};

export default TextEditor;
