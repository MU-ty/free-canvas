import { useEffect, useCallback, useState, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { CanvasView, type CanvasViewHandle } from './components/CanvasView';
import { Toolbar } from './components/Toolbar';
import { PropertyPanel } from './components/PropertyPanel';
import { useCanvasState } from './hooks/useCanvasState';
import { getBoundingBox, clamp } from './utils/helpers';
import { ElementType } from './types';
import type { CanvasElement } from './types';
import type { ArrowBinding } from './types';
import './App.css';

function App() {
  const {
    elements,
    selectedIds,
    viewport,
    updateElement,
    updateElements,
    deleteElements,
    rotateElements,
    setRotation,
    selectElements,
    clearSelection,
    updateViewport,
    copySelected,
    paste,
    createElement,
    createArrowWithPoints,
    updateArrowPoint,
    getSelectedElements,
    undo,
    redo,
    canUndo,
    canRedo,
    groupElements,
    ungroupElements,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    beginBatchUpdate,
    endBatchUpdate,
    addElements,
  } = useCanvasState();

  const [isDrawingArrow, setIsDrawingArrow] = useState(false);
  const canvasViewRef = useRef<CanvasViewHandle>(null);

  // 处理键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl/Cmd + Shift + Z 或 Ctrl/Cmd + Y: Redo
      if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key === 'z' || e.key === 'y')) {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl/Cmd + C: 复制
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        copySelected();
      }

      // Ctrl/Cmd + V: 粘贴
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        paste();
      }

      // Ctrl/Cmd + G: 组合
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        if (selectedIds.length > 1) {
          groupElements(selectedIds);
        }
      }

      // Ctrl/Cmd + Shift + G: 取消组合
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        ungroupElements(selectedIds);
      }

      // Ctrl/Cmd + [: 逆时针旋转90°
      if ((e.ctrlKey || e.metaKey) && e.key === '[') {
        e.preventDefault();
        if (selectedIds.length > 0) {
          rotateElements(selectedIds, -90);
        }
      }

      // Ctrl/Cmd + ]: 顺时针旋转90°
      if ((e.ctrlKey || e.metaKey) && e.key === ']') {
        e.preventDefault();
        if (selectedIds.length > 0) {
          rotateElements(selectedIds, 90);
        }
      }

      // Delete/Backspace: 删除
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          deleteElements(selectedIds);
        }
      }

      // Ctrl/Cmd + Alt + ArrowUp: 置顶
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        if (selectedIds.length > 0) bringToFront(selectedIds);
      }

      // Ctrl/Cmd + Alt + ArrowDown: 置底
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'ArrowDown') {
        e.preventDefault();
        if (selectedIds.length > 0) sendToBack(selectedIds);
      }

      // Ctrl/Cmd + Alt + ArrowRight: 上移一层
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        if (selectedIds.length > 0) bringForward(selectedIds);
      }

      // Ctrl/Cmd + Alt + ArrowLeft: 下移一层
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        if (selectedIds.length > 0) sendBackward(selectedIds);
      }

      // Escape: 取消选择
      if (e.key === 'Escape') {
        clearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, copySelected, paste, deleteElements, rotateElements, clearSelection, undo, redo, groupElements, ungroupElements]);

  // 创建元素（在画布中心）
  const handleCreateElement = useCallback(
    (type: ElementType) => {
      if (type === ElementType.ARROW) {
        // 进入箭头绘制模式
        setIsDrawingArrow(true);
        clearSelection();
        return;
      }
      const centerX = -viewport.x / viewport.scale + window.innerWidth / 2 / viewport.scale;
      const centerY = -viewport.y / viewport.scale + window.innerHeight / 2 / viewport.scale;
      createElement(type, centerX - 75, centerY - 75);
    },
    [viewport, createElement, clearSelection]
  );

  // 创建箭头
  const handleCreateArrow = useCallback(
    (startX: number, startY: number, endX: number, endY: number, startBinding?: ArrowBinding, endBinding?: ArrowBinding) => {
      createArrowWithPoints(startX, startY, endX, endY, startBinding, endBinding);
      setIsDrawingArrow(false);
    },
    [createArrowWithPoints]
  );

  // 取消箭头绘制
  const handleCancelArrowDrawing = useCallback(() => {
    setIsDrawingArrow(false);
  }, []);

  // 处理图片上传
  const handleImageUpload = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          // 创建临时图片对象获取尺寸
          const img = new Image();
          img.onload = () => {
            const centerX = -viewport.x / viewport.scale + window.innerWidth / 2 / viewport.scale;
            const centerY = -viewport.y / viewport.scale + window.innerHeight / 2 / viewport.scale;
            
            // 限制最大尺寸为400px
            const maxSize = 400;
            let width = img.width;
            let height = img.height;
            
            if (width > maxSize || height > maxSize) {
              const ratio = Math.min(maxSize / width, maxSize / height);
              width = width * ratio;
              height = height * ratio;
            }
            
            createElement(
              ElementType.IMAGE, 
              centerX - width / 2, 
              centerY - height / 2, 
              dataUrl,
              width,
              height
            );
          };
          img.src = dataUrl;
        }
      };
      reader.readAsDataURL(file);
    },
    [viewport, createElement]
  );

  // 重置视图
  const handleResetView = useCallback(() => {
    updateViewport({ x: 0, y: 0, scale: 1 });
  }, [updateViewport]);

  // 删除选中元素
  const handleDelete = useCallback(() => {
    if (selectedIds.length > 0) {
      deleteElements(selectedIds);
    }
  }, [selectedIds, deleteElements]);

  // 旋转选中元素
  const handleRotate = useCallback((angle: number) => {
    if (selectedIds.length > 0) {
      rotateElements(selectedIds, angle);
    }
  }, [selectedIds, rotateElements]);

  // 导入 Mermaid 流程图
  const handleImportMermaid = useCallback((newElements: CanvasElement[]) => {
    addElements(newElements);
    // 选中新添加的元素
    const newIds = newElements.map(el => el.id);
    selectElements(newIds);
    // 自动缩放并居中
    try {
      const bbox = getBoundingBox(newElements);
      if (bbox.width > 0 && bbox.height > 0) {
        const padding = 80;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const maxWidth = Math.max(1, viewportWidth * 0.8 - padding * 2);
        const maxHeight = Math.max(1, viewportHeight * 0.8 - padding * 2);
        const scale = clamp(Math.min(maxWidth / bbox.width, maxHeight / bbox.height), 0.25, 2);
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;
        const newViewportX = viewportWidth / 2 - centerX * scale;
        const newViewportY = viewportHeight / 2 - centerY * scale;
        updateViewport({ x: newViewportX, y: newViewportY, scale });
      }
    } catch (error) {
      // ignore
    }
    // 结束：viewport 已经在上面被 updateViewport 设置为缩放/居中，不需要额外调用
  }, [addElements, selectElements, updateViewport]);

  const triggerDownload = useCallback((dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleExportJpg = useCallback(async () => {
    if (!canvasViewRef.current) {
      return;
    }
    try {
      const result = await canvasViewRef.current.exportSelection({
        format: 'image/jpeg',
        background: '#ffffff',
        padding: 32,
      });
      console.log('Export JPG result', result);
      triggerDownload(result.dataUrl, `canvas-selection-${Date.now()}.jpg`);
    } catch (error) {
      console.error('导出 JPG 失败', error);
      window.alert(error instanceof Error ? error.message : '导出 JPG 失败');
    }
  }, [triggerDownload]);

  const handleExportPdf = useCallback(async () => {
    if (!canvasViewRef.current) {
      return;
    }
    try {
      // 第1步：先导出成 JPG（高质量）
      const jpgExport = await canvasViewRef.current.exportSelection({
        format: 'image/jpeg',
        quality: 0.95,
        background: '#ffffff',
        padding: 32,
      });

      const { dataUrl: jpgDataUrl } = jpgExport;
      
      // 第2步：从 dataUrl 创建一个临时 image，获取真实的像素尺寸
      const img = new Image();
      img.onload = () => {
        const imgPixelWidth = img.width;
        const imgPixelHeight = img.height;
        const aspectRatio = imgPixelWidth / imgPixelHeight;
        
        console.log('Original image dimensions:', { imgPixelWidth, imgPixelHeight, aspectRatio });

        // 第3步：计算适应 A4 的最佳尺寸
        // A4 纸张：210mm x 297mm，留 10mm 边距
        const a4Width = 210;   // mm
        const a4Height = 297;  // mm
        const margin = 10;     // mm
        const contentWidth = a4Width - margin * 2;
        const contentHeight = a4Height - margin * 2;

        let pdfWidth = contentWidth;
        let pdfHeight = contentWidth / aspectRatio;

        // 如果高度超过可用高度，按高度缩放
        if (pdfHeight > contentHeight) {
          pdfHeight = contentHeight;
          pdfWidth = contentHeight * aspectRatio;
        }

        // 计算图片在页面上的位置（居中）
        const imgX = (a4Width - pdfWidth) / 2;
        const imgY = (a4Height - pdfHeight) / 2;

        console.log('Scaled for PDF:', { pdfWidth, pdfHeight, imgX, imgY });

        // 创建 PDF，使用 A4 纸张大小
        const pdf = new jsPDF({
          unit: 'mm',
          format: 'a4',
        });

        // 将 JPG 图片放置到 PDF 页面（居中）
        pdf.addImage(jpgDataUrl, 'JPEG', imgX, imgY, pdfWidth, pdfHeight);
        pdf.save(`canvas-selection-${Date.now()}.pdf`);

        console.log('PDF export completed successfully');
      };
      img.onerror = () => {
        throw new Error('Failed to load exported image');
      };
      img.src = jpgDataUrl;
    } catch (error) {
      console.error('导出 PDF 失败', error);
      window.alert(error instanceof Error ? error.message : '导出 PDF 失败');
    }
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <CanvasView
        ref={canvasViewRef}
        elements={elements}
        selectedIds={selectedIds}
        viewport={viewport}
        onSelectElements={selectElements}
        onUpdateElement={updateElement}
        onUpdateElements={updateElements}
        onUpdateViewport={updateViewport}
        onClearSelection={clearSelection}
        onCopy={copySelected}
        onPaste={paste}
        onDelete={handleDelete}
        onGroup={groupElements}
        onUngroup={ungroupElements}
        onBringToFront={bringToFront}
        onSendToBack={sendToBack}
        onBringForward={bringForward}
        onSendBackward={sendBackward}
        onCreateArrow={handleCreateArrow}
        isDrawingArrow={isDrawingArrow}
        onCancelArrowDrawing={handleCancelArrowDrawing}
        onUpdateArrowPoint={updateArrowPoint}
        onBeginBatchUpdate={beginBatchUpdate}
        onEndBatchUpdate={endBatchUpdate}
      />
      
      <Toolbar
        onCreateElement={handleCreateElement}
        onUploadImage={handleImageUpload}
        onDelete={handleDelete}
        onCopy={copySelected}
        onPaste={paste}
        onResetView={handleResetView}
        onRotate={handleRotate}
        onUndo={undo}
        onRedo={redo}
        onBringToFront={() => bringToFront(selectedIds)}
        onSendToBack={() => sendToBack(selectedIds)}
        onBringForward={() => bringForward(selectedIds)}
        onSendBackward={() => sendBackward(selectedIds)}
        hasSelection={selectedIds.length > 0}
        canUndo={canUndo}
        canRedo={canRedo}
        onExportJpg={handleExportJpg}
        onExportPdf={handleExportPdf}
        onImportMermaid={handleImportMermaid}
      />

      <PropertyPanel
        selectedElements={getSelectedElements()}
        onUpdateElement={updateElement}
        onUpdateElements={updateElements}
        onRotateElements={setRotation}
      />

      {/* 画布信息 */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#6b7280',
          zIndex: 1000,
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        <span>元素数: {elements.length}</span>
        <span>缩放: {Math.round(viewport.scale * 100)}%</span>
        <span>位置: ({Math.round(viewport.x)}, {Math.round(viewport.y)})</span>
      </div>
    </div>
  );
}

export default App;
