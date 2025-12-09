import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { CanvasElement, TextElement, ShapeElement, TextRangeStyle } from '../types';

interface RichTextEditorProps {
  element: CanvasElement | any;
  viewport: { x: number; y: number; scale: number };
  onUpdate: (content: string, rangeStyles?: TextRangeStyle[]) => void;
  onClose: () => void;
  initialRangeStyles?: TextRangeStyle[];
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  element,
  viewport,
  onUpdate,
  onClose,
  initialRangeStyles,
}) => {
  // 使用 ref 存储文本，避免重渲染导致光标跳动
  const textRef = useRef((element as any).content || '');
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [rangeStyles, setRangeStyles] = useState<TextRangeStyle[]>(
    initialRangeStyles || (element as any).rangeStyles || (element as any).textRangeStyles || []
  );
  const [activeFormats, setActiveFormats] = useState<
    {
      bold: boolean;
      italic: boolean;
      underline: boolean;
      strikethrough: boolean;
    }
  >({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
  });

  const editorRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (editorRef.current && !initializedRef.current) {
      initializedRef.current = true;
      // 设置初始文本内容
      editorRef.current.innerText = textRef.current;
      editorRef.current.focus();
      // 选中所有文本
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, []);

  // 更新活跃格式
  const updateActiveFormats = () => {
    const sel = window.getSelection();
    if (!sel || !editorRef.current) return;

    // 计算选区在文本中的位置
    const text = editorRef.current.innerText || '';
    const start = getTextOffset(editorRef.current, sel.anchorNode, sel.anchorOffset);
    const end = getTextOffset(editorRef.current, sel.focusNode, sel.focusOffset);

    const realStart = Math.min(start, end);
    const realEnd = Math.max(start, end);

    setSelectionStart(realStart);
    setSelectionEnd(realEnd);

    // 检查当前选中范围内的格式
    const relevantStyles = rangeStyles.filter(
      (style) => !(style.end <= realStart || style.start >= realEnd)
    );

    const hasFormat = (format: keyof typeof activeFormats) => {
      return relevantStyles.some((style) => style[format] === true);
    };

    setActiveFormats({
      bold: hasFormat('bold'),
      italic: hasFormat('italic'),
      underline: hasFormat('underline'),
      strikethrough: hasFormat('strikethrough'),
    });
  };

  // 获取文本偏移量
  const getTextOffset = (root: Node, node: Node | null, offset: number): number => {
    if (!node) return 0;
    
    let totalOffset = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    
    while (walker.nextNode()) {
      if (walker.currentNode === node) {
        return totalOffset + offset;
      }
      totalOffset += walker.currentNode.textContent?.length || 0;
    }
    
    return totalOffset + offset;
  };

  const applyFormat = (format: keyof typeof activeFormats) => {
    if (selectionStart === selectionEnd) return; // 没有选中文本

    const newStyles = rangeStyles.filter((style) => {
      // 移除与当前范围重叠的相同格式
      if (style[format] && !(style.end <= selectionStart || style.start >= selectionEnd)) {
        return false;
      }
      return true;
    });

    // 添加新格式
    newStyles.push({
      start: selectionStart,
      end: selectionEnd,
      [format]: true,
    } as TextRangeStyle);

    setRangeStyles(newStyles);
    setActiveFormats((prev) => ({
      ...prev,
      [format]: !prev[format],
    }));

    // 重新聚焦
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.focus();
      }
    }, 0);
  };

  const handleBlur = (e: React.FocusEvent) => {
    // 检查是否点击了工具栏按钮
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget && relatedTarget.closest('[data-toolbar]')) {
      return;
    }
    const currentText = editorRef.current?.innerText || '';
    onUpdate(currentText, rangeStyles.length > 0 ? rangeStyles : undefined);
    onClose();
  };

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      textRef.current = editorRef.current.innerText || '';
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      e.stopPropagation();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      const currentText = editorRef.current?.innerText || '';
      onUpdate(currentText, rangeStyles.length > 0 ? rangeStyles : undefined);
      onClose();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      e.stopPropagation();
      applyFormat('bold');
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      e.stopPropagation();
      applyFormat('italic');
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
      e.preventDefault();
      e.stopPropagation();
      applyFormat('underline');
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.stopPropagation();
    }
  };

  const left = element.x * viewport.scale + viewport.x;
  const top = element.y * viewport.scale + viewport.y;
  const width = element.width * viewport.scale;
  const height = element.height * viewport.scale;

  const styleSource =
    element.type === 'text' ? (element as TextElement).style : (element as ShapeElement).textStyle;

  const fontSizeScaled = (styleSource?.fontSize || 16) * viewport.scale;

  // 判断是否是图形元素（需要居中显示文字）
  const isShape = element.type !== 'text';

  return (
    <>
      {/* 工具栏 - 独立定位,显示在文字上方 */}
      <div
        data-toolbar
        style={{
          position: 'absolute',
          left,
          top: top - 44, // 工具栏高度约40px + 4px间距
          zIndex: 10001,
          display: 'flex',
          gap: '4px',
          padding: '8px',
          backgroundColor: '#f3f4f6',
          border: '2px solid #3b82f6',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <button
          tabIndex={-1}
          onMouseDown={(e) => {
            e.preventDefault();
            applyFormat('bold');
          }}
          style={{
            padding: '4px 8px',
            backgroundColor: activeFormats.bold ? '#3b82f6' : '#ffffff',
            color: activeFormats.bold ? '#ffffff' : '#000000',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '12px',
          }}
          title="粗体 (Ctrl+B)"
        >
          B
        </button>
        <button
          tabIndex={-1}
          onMouseDown={(e) => {
            e.preventDefault();
            applyFormat('italic');
          }}
          style={{
            padding: '4px 8px',
            backgroundColor: activeFormats.italic ? '#3b82f6' : '#ffffff',
            color: activeFormats.italic ? '#ffffff' : '#000000',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            cursor: 'pointer',
            fontStyle: 'italic',
            fontSize: '12px',
          }}
          title="斜体 (Ctrl+I)"
        >
          I
        </button>
        <button
          tabIndex={-1}
          onMouseDown={(e) => {
            e.preventDefault();
            applyFormat('underline');
          }}
          style={{
            padding: '4px 8px',
            backgroundColor: activeFormats.underline ? '#3b82f6' : '#ffffff',
            color: activeFormats.underline ? '#ffffff' : '#000000',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            cursor: 'pointer',
            textDecoration: 'underline',
            fontSize: '12px',
          }}
          title="下划线 (Ctrl+U)"
        >
          U
        </button>
        <button
          tabIndex={-1}
          onMouseDown={(e) => {
            e.preventDefault();
            applyFormat('strikethrough');
          }}
          style={{
            padding: '4px 8px',
            backgroundColor: activeFormats.strikethrough ? '#3b82f6' : '#ffffff',
            color: activeFormats.strikethrough ? '#ffffff' : '#000000',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            cursor: 'pointer',
            textDecoration: 'line-through',
            fontSize: '12px',
          }}
          title="删除线"
        >
          S
        </button>
      </div>
      
      {/* 文本编辑区 - 透明背景，直接在原文字上编辑 */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onSelect={updateActiveFormats}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onClick={updateActiveFormats}
        onMouseUp={updateActiveFormats}
        style={{
          position: 'absolute',
          left,
          top,
          width,
          height: isShape ? height : undefined,
          minHeight: isShape ? undefined : height,
          fontSize: fontSizeScaled,
          fontFamily: styleSource?.fontFamily || 'Arial',
          color: styleSource?.color || '#000000',
          backgroundColor: 'transparent',
          border: isShape ? 'none' : '2px solid #3b82f6',
          borderRadius: '2px',
          outline: isShape ? 'none' : '2px solid #3b82f6',
          padding: '0',
          boxSizing: 'border-box',
          zIndex: 10000,
          lineHeight: 1.2,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflow: 'hidden',
          caretColor: styleSource?.color || '#000000',
          fontWeight: styleSource?.bold ? 'bold' : 'normal',
          fontStyle: styleSource?.italic ? 'italic' : 'normal',
          textDecoration: styleSource?.underline 
            ? 'underline' 
            : styleSource?.strikethrough 
              ? 'line-through' 
              : 'none',
          display: isShape ? 'flex' : 'block',
          alignItems: isShape ? 'center' : 'flex-start',
          justifyContent: isShape ? 'center' : 'flex-start',
          textAlign: isShape ? 'center' : 'left',
        }}
      />
    </>
  );
};
