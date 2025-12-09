import { useState } from 'react';
import { ElementType } from '../types';
import type { CanvasElement } from '../types';
import MermaidDialog from './MermaidDialog';
import { mermaidToCanvasElements, mermaidGraphToCanvasElements } from '../utils/mermaidToCanvas';
import { parseMarkdownToGraph } from '../utils/markdownParser';
import { parseUMLToGraph } from '../utils/umlParser';

interface ToolbarProps {
  onCreateElement: (type: ElementType) => void;
  onUploadImage: (file: File) => void;
  onDelete: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onResetView: () => void;
  onRotate: (angle: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onBringToFront?: () => void;
  onSendToBack?: () => void;
  onBringForward?: () => void;
  onSendBackward?: () => void;
  hasSelection: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onExportJpg: () => void;
  onExportPdf: () => void;
  onImportMermaid: (elements: CanvasElement[]) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onCreateElement,
  onUploadImage,
  onDelete,
  onBringToFront,
  onSendToBack,
  onBringForward,
  onSendBackward,
  onCopy,
  onPaste,
  onResetView,
  onRotate,
  onUndo,
  onRedo,
  hasSelection,
  canUndo,
  canRedo,
  onExportJpg,
  onExportPdf,
  onImportMermaid,
}) => {
  const [showMermaidDialog, setShowMermaidDialog] = useState(false);
  const [mermaidCode, setMermaidCode] = useState('');

  const handleImportMermaid = (options: { enableBend: boolean; stylePreset: 'colorful' | 'serious'; curveStrength: number; inputMode: 'mermaid' | 'markdown' | 'uml' }) => {
    try {
      let elements: CanvasElement[];
      
      if (options.inputMode === 'markdown') {
        // 解析 Markdown 列表为图结构
        const graph = parseMarkdownToGraph(mermaidCode);
        // 使用通用函数转换为画布元素
        elements = mermaidGraphToCanvasElements(graph, 100, 100, {
          enableBend: options.enableBend,
          stylePreset: options.stylePreset,
          curveStrength: options.curveStrength,
        });
      } else if (options.inputMode === 'uml') {
        // 解析 UML 为图结构
        const graph = parseUMLToGraph(mermaidCode);
        // 使用通用函数转换为画布元素
        elements = mermaidGraphToCanvasElements(graph, 100, 100, {
          enableBend: options.enableBend,
          stylePreset: options.stylePreset,
          curveStrength: options.curveStrength,
        });
      } else {
        // 使用原有的 Mermaid 解析
        elements = mermaidToCanvasElements(mermaidCode, 100, 100, {
          enableBend: options.enableBend,
          stylePreset: options.stylePreset,
          curveStrength: options.curveStrength,
        });
      }
      
      onImportMermaid(elements);
      setShowMermaidDialog(false);
      setMermaidCode('');
    } catch (error) {
      const modeText = options.inputMode === 'mermaid' ? 'Mermaid' : options.inputMode === 'markdown' ? 'Markdown' : 'UML';
      alert(`${modeText} 语法错误：` + (error as Error).message);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onUploadImage(file);
    }
    // 重置input以允许选择同一文件
    e.target.value = '';
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 20,
        left: 20,
        backgroundColor: 'white',
        padding: '12px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        maxWidth: '800px',
        zIndex: 1000,
      }}
    >
      <div style={{ display: 'flex', gap: '4px', borderRight: '1px solid #e5e7eb', paddingRight: '8px' }}>
        <button
          onClick={() => setShowMermaidDialog(true)}
          style={{ ...buttonStyle, backgroundColor: '#f0f9ff', color: '#0369a1', fontWeight: 'bold' }}
          title="导入 Mermaid / Markdown / UML 流程图"
        >
          ✨
        </button>
      </div>

      <div style={{ display: 'flex', gap: '4px', borderRight: '1px solid #e5e7eb', paddingRight: '8px' }}>
        <button
          onClick={() => onCreateElement(ElementType.RECTANGLE)}
          style={buttonStyle}
          title="创建矩形"
        >
          □
        </button>
        <button
          onClick={() => onCreateElement(ElementType.ROUNDED_RECTANGLE)}
          style={buttonStyle}
          title="创建圆角矩形"
        >
          ▢
        </button>
        <button
          onClick={() => onCreateElement(ElementType.CIRCLE)}
          style={buttonStyle}
          title="创建圆形"
        >
          ○
        </button>
        <button
          onClick={() => onCreateElement(ElementType.TRIANGLE)}
          style={buttonStyle}
          title="创建三角形"
        >
          △
        </button>
        <button
          onClick={() => onCreateElement(ElementType.ARROW)}
          style={buttonStyle}
          title="创建箭头"
        >
          ➔
        </button>
        <button
          onClick={() => onCreateElement(ElementType.TEXT)}
          style={buttonStyle}
          title="创建文本"
        >
          T
        </button>
        <label
          style={{
            ...buttonStyle,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="上传图片"
        >
          🖼️
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      <div style={{ display: 'flex', gap: '4px', borderRight: '1px solid #e5e7eb', paddingRight: '8px' }}>
        <button
          onClick={onCopy}
          disabled={!hasSelection}
          style={buttonStyle}
          title="复制 (Ctrl+C)"
        >
          📋
        </button>
        <button
          onClick={onPaste}
          style={buttonStyle}
          title="粘贴 (Ctrl+V)"
        >
          📄
        </button>
        <button
          onClick={onDelete}
          disabled={!hasSelection}
          style={{ ...buttonStyle, color: '#ef4444' }}
          title="删除 (Delete)"
        >
          🗑️
        </button>
        <button
          onClick={onBringToFront}
          disabled={!hasSelection}
          style={buttonStyle}
          title="置顶 (Ctrl+Alt+ArrowUp)"
        >
          ⤒
        </button>
        <button
          onClick={onSendToBack}
          disabled={!hasSelection}
          style={buttonStyle}
          title="置底 (Ctrl+Alt+ArrowDown)"
        >
          ⤓
        </button>
        <button
          onClick={onBringForward}
          disabled={!hasSelection}
          style={buttonStyle}
          title="上移一层 (Ctrl+Alt+ArrowRight)"
        >
          🔼
        </button>
        <button
          onClick={onSendBackward}
          disabled={!hasSelection}
          style={buttonStyle}
          title="下移一层 (Ctrl+Alt+ArrowLeft)"
        >
          🔽
        </button>
      </div>

      <div style={{ display: 'flex', gap: '4px', borderRight: '1px solid #e5e7eb', paddingRight: '8px' }}>
        <button
          onClick={onExportJpg}
          disabled={!hasSelection}
          style={buttonStyle}
          title="导出选区为 JPG"
        >
          JPG
        </button>
        <button
          onClick={onExportPdf}
          disabled={!hasSelection}
          style={buttonStyle}
          title="导出选区为 PDF"
        >
          PDF
        </button>
      </div>

      <div style={{ display: 'flex', gap: '4px', borderRight: '1px solid #e5e7eb', paddingRight: '8px' }}>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          style={buttonStyle}
          title="撤销 (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          style={buttonStyle}
          title="重做 (Ctrl+Shift+Z)"
        >
          ↷
        </button>
      </div>

      <div style={{ display: 'flex', gap: '4px', borderRight: '1px solid #e5e7eb', paddingRight: '8px' }}>
        <button
          onClick={() => onRotate(-90)}
          disabled={!hasSelection}
          style={buttonStyle}
          title="逆时针旋转90° (Ctrl+[)"
        >
          ⟲
        </button>
        <button
          onClick={() => onRotate(90)}
          disabled={!hasSelection}
          style={buttonStyle}
          title="顺时针旋转90° (Ctrl+])"
        >
          ⟳
        </button>
      </div>

      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          onClick={onResetView}
          style={buttonStyle}
          title="重置视图"
        >
          🔄
        </button>
      </div>

      <div style={{ fontSize: '12px', color: '#6b7280', alignSelf: 'center', marginLeft: '8px' }}>
        提示: Alt+拖拽 = 移动画布 | 滚轮 = 缩放 | Shift+点击 = 多选
      </div>

      {showMermaidDialog && (
        <MermaidDialog
          value={mermaidCode}
          onChange={setMermaidCode}
          onConfirm={handleImportMermaid}
          onCancel={() => {
            setShowMermaidDialog(false);
            setMermaidCode('');
          }}
        />
      )}
    </div>
  );
};

const buttonStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: '4px',
  backgroundColor: 'white',
  cursor: 'pointer',
  fontSize: '16px',
  transition: 'all 0.2s',
  minWidth: '40px',
};
