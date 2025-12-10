import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { PixiRenderer } from '../renderer/PixiRenderer';
import type { CanvasElement, SelectionBox } from '../types';
import {
  isElementInSelection,
  isPointInElement,
  screenToCanvas,
} from '../utils/helpers';
import { detectGuideLines, calculateSnappedPosition, detectResizeGuideLines } from '../utils/guideLines';
import type { GuideLine } from '../utils/guideLines';
import { ResizeHandles } from './ResizeHandles';
import { ArrowHandles } from './ArrowHandles';
import { RichTextEditor } from './RichTextEditor';
import type { TextRangeStyle } from '../types';
import { ContextMenu } from './ContextMenu';
import { MiniMap } from './MiniMap';
import { GuideLineRenderer } from './GuideLineRenderer';
import { SnapCirclesRenderer } from './SnapCirclesRenderer';
import type { SnapPoint } from '../utils/arrowSnap';
import { getArrowsToUpdate, getAllSnapPoints, findNearestSnapPoint, SNAP_THRESHOLD } from '../utils/arrowSnap';
import type { ArrowBinding } from '../types';

interface CanvasViewProps {
  elements: CanvasElement[];
  selectedIds: string[];
  viewport: { x: number; y: number; scale: number };
  onSelectElements: (ids: string[]) => void;
  onUpdateElement: (id: string, updates: Partial<CanvasElement>) => void;
  onUpdateElements: (updates: Array<{ id: string; updates: Partial<CanvasElement> }>) => void;
  onBeginBatchUpdate?: () => void;
  onEndBatchUpdate?: () => void;
  onUpdateViewport: (updates: { x?: number; y?: number; scale?: number }) => void;
  onClearSelection: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onGroup?: (ids: string[]) => void;
  onUngroup?: (ids: string[]) => void;
  onBringToFront?: (ids: string[]) => void;
  onSendToBack?: (ids: string[]) => void;
  onBringForward?: (ids: string[]) => void;
  onSendBackward?: (ids: string[]) => void;
  onCreateArrow?: (startX: number, startY: number, endX: number, endY: number, startBinding?: ArrowBinding, endBinding?: ArrowBinding) => void;
  isDrawingArrow?: boolean;
  onCancelArrowDrawing?: () => void;
  onUpdateArrowPoint?: (elementId: string, point: 'start' | 'end', x: number, y: number, binding?: ArrowBinding) => void;
}

export interface CanvasViewHandle {
  exportSelection: (options?: SelectionExportOptions) => Promise<SelectionExportResult>;
}

export interface SelectionExportOptions {
  format?: 'image/png' | 'image/jpeg';
  background?: string;
  padding?: number;
  quality?: number;
}

export interface SelectionExportResult {
  dataUrl: string;
  width: number;
  height: number;
  pixelWidth: number;
  pixelHeight: number;
}

const InteractionMode = {
  NONE: 'none',
  PANNING: 'panning',
  SELECTING: 'selecting',
  DRAGGING: 'dragging',
  RESIZING: 'resizing',
  DRAWING_ARROW: 'drawing-arrow',
} as const;

type InteractionMode = typeof InteractionMode[keyof typeof InteractionMode];

const CanvasViewComponent = forwardRef<CanvasViewHandle, CanvasViewProps>(({ 
  elements,
  selectedIds,
  viewport,
  onSelectElements,
  onUpdateElement,
  onUpdateElements,
  onBeginBatchUpdate,
  onEndBatchUpdate,
  onUpdateViewport,
  onClearSelection,
  onCopy,
  onPaste,
  onDelete,
  onGroup,
  onUngroup,
  onBringToFront,
  onSendToBack,
  onBringForward,
  onSendBackward,
  onCreateArrow,
  isDrawingArrow = false,
  onCancelArrowDrawing,
  onUpdateArrowPoint,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PixiRenderer | null>(null);
  const [mode, setMode] = useState<InteractionMode>(InteractionMode.NONE);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [elementStartPos, setElementStartPos] = useState<
    Map<string, { x: number; y: number }>
  >(new Map());
  const [rendererReady, setRendererReady] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStartData, setResizeStartData] = useState<{
    mouseX: number;
    mouseY: number;
    elements: Map<string, { x: number; y: number; width: number; height: number }>;
    shiftKey: boolean;
  } | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [guidelines, setGuidelines] = useState<GuideLine[]>([]);
  const dragThreshold = 5; // 拖拽阈值(像素)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [arrowStartPoint, setArrowStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [arrowStartBinding, setArrowStartBinding] = useState<ArrowBinding | undefined>(undefined);
  const [isDraggingArrowPoint, setIsDraggingArrowPoint] = useState(false);
  const [arrowPreviewEnd, setArrowPreviewEnd] = useState<{ x: number; y: number } | null>(null);
  const [arrowEndBinding, setArrowEndBinding] = useState<ArrowBinding | undefined>(undefined);
  const [highlightedSnapPoints, setHighlightedSnapPoints] = useState<SnapPoint[]>([]);
  const [arrowDrawingSnapPoints, setArrowDrawingSnapPoints] = useState<SnapPoint[]>([]);
  
  // 用于追踪前一个元素状态，实现增量更新
  const prevElementsRef = useRef<CanvasElement[]>([]);
  
  // 用于 requestAnimationFrame 节流拖拽更新
  const rafIdRef = useRef<number | null>(null);
  const pendingUpdateRef = useRef<Array<{ id: string; updates: Partial<CanvasElement> }> | null>(null);

  const canGroup = selectedIds.length > 1;
  const canUngroup = selectedIds.some(id => elements.find(el => el.id === id)?.type === 'group');

    const computeSelectionBounds = useCallback(() => {
    if (!selectedIds.length) {
      return null;
    }
    const idSet = new Set(selectedIds);
    const selectedElements = elements.filter(el => idSet.has(el.id));
    if (!selectedElements.length) {
      return null;
    }
    return mergeSelectionBounds(selectedElements.map(getElementSelectionBounds));
  }, [elements, selectedIds]);

  const exportSelectionCallback = useCallback(async (options: SelectionExportOptions = {}) => {
    const bounds = computeSelectionBounds();
    if (!bounds) {
      throw new Error('当前没有选中的元素');
    }
    const renderer = rendererRef.current;
    if (!renderer) {
      throw new Error('渲染器尚未就绪');
    }

    const cssWidth = canvasRef.current?.clientWidth || canvasRef.current?.width || 0;
    const cssHeight = canvasRef.current?.clientHeight || canvasRef.current?.height || 0;

    // 使用新的 exportSelectedElements 方法，它会创建一个独立的渲染环境，不受视口影响
    let sourceCanvas: HTMLCanvasElement | null = null;
    try {
      // 传入选中的 ID 和计算好的边界
      sourceCanvas = await renderer.exportSelectedElements(selectedIds, bounds, options.padding ?? 24);
      console.log('Using PixiRenderer.exportSelectedElements for export');
    } catch (err) {
      console.error('PixiRenderer.exportSelectedElements failed', err);
      throw new Error('导出失败：渲染器错误');
    }

    if (!sourceCanvas) {
      throw new Error('导出失败：无法生成图像');
    }

    // sourceCanvas 已经是正确的大小和内容（物理像素）
    // 我们只需要根据格式处理背景色
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = sourceCanvas.width;
    exportCanvas.height = sourceCanvas.height;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) throw new Error('无法创建导出画布');

    const mime = options.format ?? 'image/png';
    if (mime === 'image/jpeg') {
      ctx.fillStyle = options.background ?? '#ffffff';
      ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    } else {
      ctx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
    }

    ctx.drawImage(sourceCanvas, 0, 0);

    const quality = mime === 'image/jpeg' ? (options.quality ?? 0.92) : undefined;
    const dataUrl = exportCanvas.toDataURL(mime, quality);
    
    // 计算 CSS 尺寸（假设 sourceCanvas 是 2x 分辨率，或者根据实际需求）
    // 在 exportSelectedElements 中我们设置了 resolution: 2
    const densityFactor = 2; 
    const cssW = Math.max(1, Math.round(exportCanvas.width / densityFactor));
    const cssH = Math.max(1, Math.round(exportCanvas.height / densityFactor));

    return {
      dataUrl,
      width: cssW,
      height: cssH,
      pixelWidth: exportCanvas.width,
      pixelHeight: exportCanvas.height,
    } as SelectionExportResult;
  }, [computeSelectionBounds, viewport, selectedIds]);

  // 初始化渲染器
  useEffect(() => {
    if (!canvasRef.current) return;

    const renderer = new PixiRenderer(canvasRef.current);
    rendererRef.current = renderer;

    // 等待渲染器初始化完成
    renderer.waitForInit().then(() => {
      console.log('Renderer initialized');
      // 确保 rendererRef 仍然指向当前 renderer（防止组件卸载后设置状态）
      if (rendererRef.current === renderer) {
        setRendererReady(true);
      }
    });

    return () => {
      if (renderer) {
        renderer.destroy();
      }
      rendererRef.current = null;
      setRendererReady(false);
    };
  }, []);

  // 渲染元素 - 使用增量更新策略优化性能
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !rendererReady) {
      console.log('Render skipped - rendererReady:', rendererReady, 'renderer:', !!renderer);
      return;
    }

    // 使用标记来处理竞态条件
    let cancelled = false;

    const updateElements = async () => {
      const prevElements = prevElementsRef.current;
      const currentElements = elements;

      // 判断是否需要全量重新渲染
      const needsFullRender = 
        prevElements.length !== currentElements.length ||
        // 检查是否有新增或删除的元素
        !prevElements.every(prev => currentElements.some(curr => curr.id === prev.id)) ||
        !currentElements.every(curr => prevElements.some(prev => prev.id === curr));

      if (needsFullRender) {
        // 全量重新渲染（新增/删除元素、内容改变等）
        console.log('Full render triggered - elements:', currentElements.length);
        renderer.clear();
        
        for (const element of currentElements) {
          if (cancelled) return;
          
          if (element.id === editingTextId) {
            if (element.type === 'text') {
              continue;
            } else {
              const tempElement = { ...element, content: '' };
              try {
                await renderer.renderElement(tempElement as any);
              } catch (err) {
                console.error(`Failed to render temp element ${element.id}:`, err);
              }
              continue;
            }
          }
          try {
            await renderer.renderElement(element);
          } catch (err) {
            console.error(`Failed to render element ${element.id}:`, err);
          }
        }
      } else {
        // 增量更新（只更新位置、旋转等转换属性）
        const updatedElements: CanvasElement[] = [];
        
        for (const currentElement of currentElements) {
          const prevElement = prevElements.find(e => e.id === currentElement.id);
          
          if (!prevElement) {
            // 理论上不会发生，因为上面已经检查过长度
            continue;
          }

          // 检查是否只有转换属性改变（x, y, rotation, zIndex）
          const hasContentChange = 
            currentElement.type !== prevElement.type ||
            currentElement.width !== prevElement.width ||
            currentElement.height !== prevElement.height ||
            JSON.stringify(currentElement.backgroundColor) !== JSON.stringify(prevElement.backgroundColor) ||
            JSON.stringify(currentElement.borderColor) !== JSON.stringify(prevElement.borderColor) ||
            currentElement.borderWidth !== prevElement.borderWidth ||
            (currentElement as any).content !== (prevElement as any).content ||
            JSON.stringify((currentElement as any).textStyle) !== JSON.stringify((prevElement as any).textStyle);

          if (hasContentChange) {
            // 需要完全重新渲染此元素
            if (!cancelled) {
              await renderer.renderElement(currentElement);
            }
          } else {
            // 只有转换属性改变，使用高性能的 updateElementTransform
            updatedElements.push(currentElement);
          }
        }

        // 批量更新转换属性
        if (updatedElements.length > 0 && !cancelled) {
          renderer.updateElementsTransform(updatedElements);
        }
      }

      // 确保渲染一帧
      if (!cancelled) {
        renderer.render();
      }

      // 更新 ref
      prevElementsRef.current = currentElements;
    };
    
    updateElements();

    return () => {
      cancelled = true;
    };
  }, [elements, rendererReady, editingTextId]);

  // 更新视口
  useEffect(() => {
    console.log('Viewport update:', viewport, 'rendererReady:', rendererReady);
    if (!rendererRef.current || !rendererReady) return;
    rendererRef.current.updateViewport(viewport.x, viewport.y, viewport.scale);
  }, [viewport, rendererReady]);

  // 鼠标按下
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // 如果正在编辑文字，不处理其他交互
      if (editingTextId) return;

      // 右键点击不处理，交给 onContextMenu
      if (e.button === 2) return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const { x: canvasX, y: canvasY } = screenToCanvas(screenX, screenY, viewport);

      // 如果正在绘制箭头
      if (isDrawingArrow) {
        // 获取所有可吸附点
        const snapPoints = getAllSnapPoints(elements);
        const snapResult = findNearestSnapPoint(canvasX, canvasY, snapPoints, SNAP_THRESHOLD);
        
        const finalX = snapResult.snapped ? snapResult.x : canvasX;
        const finalY = snapResult.snapped ? snapResult.y : canvasY;
        const binding = snapResult.snapped ? snapResult.binding : undefined;
        
        if (!arrowStartPoint) {
          // 设置起点（带吸附）
          setArrowStartPoint({ x: finalX, y: finalY });
          setArrowStartBinding(binding);
          setMode(InteractionMode.DRAWING_ARROW);
          setArrowDrawingSnapPoints(snapResult.snapped && snapResult.snapPoint ? [snapResult.snapPoint] : []);
        } else {
          // 设置终点并创建箭头（带吸附）
          if (onCreateArrow) {
            onCreateArrow(arrowStartPoint.x, arrowStartPoint.y, finalX, finalY, arrowStartBinding, binding);
          }
          setArrowStartPoint(null);
          setArrowStartBinding(undefined);
          setArrowPreviewEnd(null);
          setArrowEndBinding(undefined);
          setArrowDrawingSnapPoints([]);
          setMode(InteractionMode.NONE);
        }
        return;
      }

      // 空格键 + 鼠标按下 = 拖拽画布
      if (e.button === 0 && e.nativeEvent.which === 1 && e.altKey) {
        setMode(InteractionMode.PANNING);
        setDragStart({ x: screenX, y: screenY });
        return;
      }

      // 检查是否点击到元素
      let clickedElement: CanvasElement | null = null;
      for (let i = elements.length - 1; i >= 0; i--) {
        if (isPointInElement(canvasX, canvasY, elements[i])) {
          clickedElement = elements[i];
          break;
        }
      }

      if (clickedElement) {
        // 点击元素
        if (!e.shiftKey) {
          // 非 Shift 点击，选中单个元素
          if (!selectedIds.includes(clickedElement.id)) {
            onSelectElements([clickedElement.id]);
          }
        } else {
          // Shift 点击，切换选择
          if (selectedIds.includes(clickedElement.id)) {
            onSelectElements(selectedIds.filter((id) => id !== clickedElement.id));
          } else {
            onSelectElements([...selectedIds, clickedElement.id]);
          }
        }

        // 准备拖拽(但不立即开始,等待鼠标移动超过阈值)
        setMode(InteractionMode.DRAGGING);
        setDragStart({ x: canvasX, y: canvasY });
        setIsDragging(false);

        // 记录所有选中元素的初始位置
        const startPositions = new Map<string, { x: number; y: number }>();
        const targetIds = selectedIds.includes(clickedElement.id)
          ? selectedIds
          : [clickedElement.id];

        targetIds.forEach((id) => {
          const el = elements.find((e) => e.id === id);
          if (el) {
            startPositions.set(id, { x: el.x, y: el.y });
          }
        });
        setElementStartPos(startPositions);
      } else {
        // 未点击元素，开始框选
        setMode(InteractionMode.SELECTING);
        setSelectionBox({
          startX: canvasX,
          startY: canvasY,
          endX: canvasX,
          endY: canvasY,
        });
        if (!e.shiftKey) {
          onClearSelection();
        }
      }
    },
    [elements, selectedIds, viewport, onSelectElements, onClearSelection, editingTextId, isDrawingArrow, arrowStartPoint, onCreateArrow]
  );

  // 鼠标移动 - 使用 requestAnimationFrame 来节流更新，提高拖拽性能
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // 如果正在编辑文字，不处理其他交互
      if (editingTextId) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      // 箭头绘制时的吸附检测
      if (isDrawingArrow && arrowStartPoint) {
        const { x: canvasX, y: canvasY } = screenToCanvas(screenX, screenY, viewport);
        const snapPoints = getAllSnapPoints(elements);
        const snapResult = findNearestSnapPoint(canvasX, canvasY, snapPoints, SNAP_THRESHOLD);
        
        if (snapResult.snapped && snapResult.snapPoint) {
          setArrowPreviewEnd({ x: snapResult.x, y: snapResult.y });
          setArrowEndBinding(snapResult.binding);
          setArrowDrawingSnapPoints([snapResult.snapPoint]);
        } else {
          setArrowPreviewEnd({ x: canvasX, y: canvasY });
          setArrowEndBinding(undefined);
          setArrowDrawingSnapPoints([]);
        }
      }

      if (mode === InteractionMode.PANNING && dragStart) {
        // 拖拽画布
        const dx = screenX - dragStart.x;
        const dy = screenY - dragStart.y;
        onUpdateViewport({
          x: viewport.x + dx,
          y: viewport.y + dy,
        });
        setDragStart({ x: screenX, y: screenY });
      } else if (mode === InteractionMode.SELECTING && selectionBox) {
        // 更新框选区域
        const { x: canvasX, y: canvasY } = screenToCanvas(screenX, screenY, viewport);
        setSelectionBox({
          ...selectionBox,
          endX: canvasX,
          endY: canvasY,
        });
      } else if (mode === InteractionMode.DRAGGING && dragStart) {
        // 拖拽元素 - 使用 requestAnimationFrame 合并高频更新
        const { x: canvasX, y: canvasY } = screenToCanvas(screenX, screenY, viewport);
        const dx = canvasX - dragStart.x;
        const dy = canvasY - dragStart.y;

        // 检查是否超过拖拽阈值
        if (!isDragging) {
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance > dragThreshold / viewport.scale) {
              setIsDragging(true);
              // 开始批量更新历史（避免中间步骤写入历史）
              if (onBeginBatchUpdate) onBeginBatchUpdate();
          } else {
            return; // 未超过阈值,不执行拖拽
          }
        }

        // 计算需要的更新
        const calculateUpdates = () => {
          const draggedElements = Array.from(elementStartPos.entries()).map(([id, startPos]) => {
            const element = elements.find((e) => e.id === id);
            return element ? { ...element, x: startPos.x + dx, y: startPos.y + dy } : null;
          }).filter(Boolean) as CanvasElement[];

          // 检测辅助线（只检测第一个拖拽的元素）
          if (draggedElements.length > 0) {
            const otherElements = elements.filter((e) => !elementStartPos.has(e.id));
            const detectedGuideLines = detectGuideLines(draggedElements[0], otherElements, viewport);
            setGuidelines(detectedGuideLines);

            // 计算吸附位置（只吸附第一个元素，其他元素跟随）
            const snappedResult = calculateSnappedPosition(draggedElements[0], otherElements, viewport);
            const snappedDx = snappedResult.x - draggedElements[0].x;
            const snappedDy = snappedResult.y - draggedElements[0].y;

            // 收集所有需要更新的元素（包括拖拽的元素和绑定的箭头）
            const allUpdates: Array<{ id: string; updates: Partial<CanvasElement> }> = [];
            
            // 先模拟更新后的元素位置
            const updatedElements = elements.map(el => {
              const startPos = elementStartPos.get(el.id);
              if (startPos) {
                return {
                  ...el,
                  x: startPos.x + dx + snappedDx,
                  y: startPos.y + dy + snappedDy,
                };
              }
              return el;
            });

            // 添加拖拽元素的位置更新
            elementStartPos.forEach((startPos, id) => {
              allUpdates.push({
                id,
                updates: {
                  x: startPos.x + dx + snappedDx,
                  y: startPos.y + dy + snappedDy,
                },
              });
            });

            // 获取需要更新的箭头（绑定到被拖拽元素的箭头）
            const movedIds = Array.from(elementStartPos.keys());
            const arrowUpdates = getArrowsToUpdate(movedIds, updatedElements);
            arrowUpdates.forEach(({ arrowId, updates }) => {
              // 只有当箭头不在被拖拽的元素中时才添加更新
              if (!elementStartPos.has(arrowId)) {
                allUpdates.push({ id: arrowId, updates });
              }
            });

            return allUpdates;
          }
          return [];
        };

        // 保存待处理的更新，在下一帧执行
        pendingUpdateRef.current = calculateUpdates();
        
        // 取消之前的 raf，设置新的
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
        }
        
        rafIdRef.current = requestAnimationFrame(() => {
          if (pendingUpdateRef.current && pendingUpdateRef.current.length > 0) {
            onUpdateElements(pendingUpdateRef.current);
          }
          rafIdRef.current = null;
        });
      }
      // RESIZING 模式由 document 监听器处理
    },
    [
      mode,
      dragStart,
      selectionBox,
      elementStartPos,
      isDragging,
      dragThreshold,
      viewport,
      onUpdateViewport,
      onUpdateElements,
      editingTextId,
      elements,
    ]
  );

  // 鼠标释放
  const handleMouseUp = useCallback(() => {
    // 如果正在编辑文字，不处理其他交互
    if (editingTextId) return;
    
    // 清理待处理的 RAF 更新
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    
    // 确保最后一次更新被应用
    if (pendingUpdateRef.current && pendingUpdateRef.current.length > 0) {
      onUpdateElements(pendingUpdateRef.current);
      pendingUpdateRef.current = null;
    }
    
    if (mode === InteractionMode.SELECTING && selectionBox) {
      // 完成框选
      const selectedElements = elements.filter((el) =>
        isElementInSelection(el, selectionBox)
      );
      const newSelectedIds = selectedElements.map((el) => el.id);
      onSelectElements(newSelectedIds);
      setSelectionBox(null);
    }

    setMode(InteractionMode.NONE);
    setDragStart(null);
    setElementStartPos(new Map());
    setResizeHandle(null);
    setResizeStartData(null);
    // 如果正在进行拖拽操作，结束批量更新并保存一次最终历史
    if (isDragging) {
      if (onEndBatchUpdate) onEndBatchUpdate();
    }
    setIsDragging(false);
    setGuidelines([]); // 清除辅助线
  }, [mode, selectionBox, elements, onSelectElements, editingTextId, onUpdateElements, onEndBatchUpdate, isDragging]);

  // 开始缩放
  const handleResizeStart = useCallback(
    (handle: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const { x: canvasX, y: canvasY } = screenToCanvas(screenX, screenY, viewport);

      setMode(InteractionMode.RESIZING);
      setResizeHandle(handle);

      // 记录所有选中元素的初始状态
      const elementData = new Map<
        string,
        { x: number; y: number; width: number; height: number }
      >();
      selectedIds.forEach((id) => {
        const el = elements.find((e) => e.id === id);
        if (el) {
          elementData.set(id, {
            x: el.x,
            y: el.y,
            width: el.width,
            height: el.height,
          });
        }
      });

      setResizeStartData({
        mouseX: canvasX,
        mouseY: canvasY,
        elements: elementData,
        shiftKey: e.shiftKey,
      });
    },
    [elements, selectedIds, viewport]
  );

  // 监听wheel事件（用原生事件以避免passive警告）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheelEvent = (e: WheelEvent) => {
      e.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      // 计算缩放前的画布坐标
      const beforeX = (screenX - viewport.x) / viewport.scale;
      const beforeY = (screenY - viewport.y) / viewport.scale;

      // 计算新的缩放比例
      const scaleDelta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(0.1, Math.min(5, viewport.scale * scaleDelta));

      // 计算缩放后的画布坐标
      const afterX = screenX - beforeX * newScale;
      const afterY = screenY - beforeY * newScale;

      onUpdateViewport({
        scale: newScale,
        x: afterX,
        y: afterY,
      });
    };

    canvas.addEventListener('wheel', handleWheelEvent, { passive: false });
    
    return () => {
      canvas.removeEventListener('wheel', handleWheelEvent);
    };
  }, [viewport, onUpdateViewport]);

  // 监听document的mousemove和mouseup，以便在resize时鼠标移出canvas也能继续工作
  useEffect(() => {
    const handleDocumentMouseMove = (e: MouseEvent) => {
      if (mode === InteractionMode.RESIZING && resizeStartData && resizeHandle && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const { x: canvasX, y: canvasY } = screenToCanvas(screenX, screenY, viewport);
        
        const dx = canvasX - resizeStartData.mouseX;
        const dy = canvasY - resizeStartData.mouseY;
        const keepAspectRatio = !resizeStartData.shiftKey;

        // 收集所有元素更新
        const allUpdates: Array<{ id: string; updates: Partial<CanvasElement> }> = [];
        const resizedElementIds: string[] = [];

        resizeStartData.elements.forEach((startData, id) => {
          let newX = startData.x;
          let newY = startData.y;
          let newWidth = startData.width;
          let newHeight = startData.height;
          
          // 角控制点
          if (resizeHandle === 'tl' || resizeHandle === 'tr' || 
              resizeHandle === 'bl' || resizeHandle === 'br') {
            
            if (keepAspectRatio) {
              const aspectRatio = startData.width / startData.height;
              
              if (resizeHandle === 'br') {
                newWidth = Math.max(20, startData.width + dx);
                newHeight = Math.max(20, newWidth / aspectRatio);
              } else if (resizeHandle === 'tl') {
                newWidth = Math.max(20, startData.width - dx);
                newHeight = Math.max(20, newWidth / aspectRatio);
                newX = startData.x + startData.width - newWidth;
                newY = startData.y + startData.height - newHeight;
              } else if (resizeHandle === 'tr') {
                newWidth = Math.max(20, startData.width + dx);
                newHeight = Math.max(20, newWidth / aspectRatio);
                newY = startData.y + startData.height - newHeight;
              } else if (resizeHandle === 'bl') {
                newWidth = Math.max(20, startData.width - dx);
                newHeight = Math.max(20, newWidth / aspectRatio);
                newX = startData.x + startData.width - newWidth;
              }
            } else {
              if (resizeHandle === 'br') {
                newWidth = Math.max(20, startData.width + dx);
                newHeight = Math.max(20, startData.height + dy);
              } else if (resizeHandle === 'tl') {
                newWidth = Math.max(20, startData.width - dx);
                newHeight = Math.max(20, startData.height - dy);
                newX = startData.x + startData.width - newWidth;
                newY = startData.y + startData.height - newHeight;
              } else if (resizeHandle === 'tr') {
                newWidth = Math.max(20, startData.width + dx);
                newHeight = Math.max(20, startData.height - dy);
                newY = startData.y + startData.height - newHeight;
              } else if (resizeHandle === 'bl') {
                newWidth = Math.max(20, startData.width - dx);
                newHeight = Math.max(20, startData.height + dy);
                newX = startData.x + startData.width - newWidth;
              }
            }
          } else {
            // 边控制点
            if (resizeHandle === 't') {
              newHeight = Math.max(20, startData.height - dy);
              newY = startData.y + startData.height - newHeight;
            } else if (resizeHandle === 'b') {
              newHeight = Math.max(20, startData.height + dy);
            } else if (resizeHandle === 'l') {
              newWidth = Math.max(20, startData.width - dx);
              newX = startData.x + startData.width - newWidth;
            } else if (resizeHandle === 'r') {
              newWidth = Math.max(20, startData.width + dx);
            }
          }

          allUpdates.push({
            id,
            updates: {
              x: newX,
              y: newY,
              width: newWidth,
              height: newHeight,
            },
          });
          resizedElementIds.push(id);
        });

        // 模拟更新后的元素状态（非箭头元素），以计算绑定箭头的更新
        const updatedElements = elements.map(el => {
          const update = allUpdates.find(u => u.id === el.id);
          if (update) {
            return { ...el, ...update.updates };
          }
          return el;
        });

        // 检测缩放时的参考线（只对第一个缩放的元素检测）
        if (resizedElementIds.length > 0) {
          const resizedElement = updatedElements.find(el => el.id === resizedElementIds[0]);
          if (resizedElement) {
            const otherElements = updatedElements.filter(el => !resizedElementIds.includes(el.id));
            const detectedGuideLines = detectResizeGuideLines(resizedElement, otherElements, viewport);
            setGuidelines(detectedGuideLines);
          }
        }

        // 获取需要更新的绑定箭头
        const arrowUpdates = getArrowsToUpdate(resizedElementIds, updatedElements);
        
        // 对于有绑定的箭头，用绑定位置覆盖缩放结果
        arrowUpdates.forEach(({ arrowId, updates }) => {
          // 查找这个箭头是否已经在 allUpdates 中
          const existingIndex = allUpdates.findIndex(u => u.id === arrowId);
          if (existingIndex >= 0) {
            // 已存在，用绑定更新覆盖
            allUpdates[existingIndex] = { id: arrowId, updates };
          } else {
            // 不存在，添加新更新
            allUpdates.push({ id: arrowId, updates });
          }
        });

        // 批量更新所有元素
        onUpdateElements(allUpdates);
      }
    };

    const handleDocumentMouseUp = () => {
      if (mode === InteractionMode.RESIZING) {
        setMode(InteractionMode.NONE);
        setResizeHandle(null);
        setResizeStartData(null);
        setGuidelines([]); // 清除参考线
      }
    };

    if (mode === InteractionMode.RESIZING) {
      document.addEventListener('mousemove', handleDocumentMouseMove);
      document.addEventListener('mouseup', handleDocumentMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleDocumentMouseMove);
        document.removeEventListener('mouseup', handleDocumentMouseUp);
      };
    }
  }, [mode, resizeHandle, resizeStartData, viewport, onUpdateElements, elements]);

  // 鼠标滚轮（缩放）
  // 右键菜单
  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY });
    },
    []
  );

  // 双击事件 - 用于文字编辑
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const { x: canvasX, y: canvasY } = screenToCanvas(screenX, screenY, viewport);

      // 查找被双击的元素
      let clickedElement: CanvasElement | null = null;
      for (let i = elements.length - 1; i >= 0; i--) {
        if (isPointInElement(canvasX, canvasY, elements[i])) {
          clickedElement = elements[i];
          break;
        }
      }

      // 如果双击的是文字元素或带有内部文本的图形，进入编辑模式
      if (
        clickedElement &&
        (clickedElement.type === 'text' || (['rectangle','rounded-rectangle','circle','triangle'] as string[]).includes(clickedElement.type))
      ) {
        e.stopPropagation();
        onSelectElements([clickedElement.id]);
        setEditingTextId(clickedElement.id);
        // 清除拖拽状态
        setMode(InteractionMode.NONE);
        setDragStart(null);
        setIsDragging(false);
      }
    },
    [elements, viewport, onSelectElements]
  );

  // 处理键盘事件 - ESC 取消箭头绘制
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawingArrow) {
        setArrowStartPoint(null);
        setArrowStartBinding(undefined);
        setArrowPreviewEnd(null);
        setArrowEndBinding(undefined);
        setArrowDrawingSnapPoints([]);
        setMode(InteractionMode.NONE);
        if (onCancelArrowDrawing) {
          onCancelArrowDrawing();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawingArrow, onCancelArrowDrawing]);

  useImperativeHandle(ref, () => ({
    exportSelection: exportSelectionCallback,
  }), [exportSelectionCallback]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          cursor:
            isDrawingArrow
              ? 'crosshair'
              : mode === InteractionMode.PANNING
              ? 'grabbing'
              : mode === InteractionMode.DRAGGING
              ? 'move'
              : 'default',
        }}
      />

      {/* 箭头绘制提示 */}
      {isDrawingArrow && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(59, 130, 246, 0.9)',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            pointerEvents: 'none',
            zIndex: 2000,
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          }}
        >
          {arrowStartPoint ? '点击确定箭头终点' : '点击确定箭头起点'}
          <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.9 }}>
            按 ESC 取消
          </div>
        </div>
      )}

      {/* 辅助线渲染 */}
      {canvasRef.current && (
        <GuideLineRenderer
          guidelines={guidelines}
          viewport={viewport}
          canvasWidth={canvasRef.current.width}
          canvasHeight={canvasRef.current.height}
        />
      )}

      {/* 框选矩形 */}
      {selectionBox && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(selectionBox.startX, selectionBox.endX) * viewport.scale + viewport.x,
            top: Math.min(selectionBox.startY, selectionBox.endY) * viewport.scale + viewport.y,
            width:
              Math.abs(selectionBox.endX - selectionBox.startX) * viewport.scale,
            height:
              Math.abs(selectionBox.endY - selectionBox.startY) * viewport.scale,
            border: '2px dashed #3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* 缩放控制点 */}
      {!editingTextId && (
        <ResizeHandles
          selectedElements={elements.filter((el) => selectedIds.includes(el.id))}
          viewport={viewport}
          onResizeStart={handleResizeStart}
        />
      )}

      {/* 吸附圈渲染 - 拖动箭头端点时 */}
      {isDraggingArrowPoint && selectedIds.length === 1 && (
        <SnapCirclesRenderer
          elements={elements}
          viewport={viewport}
          activeArrowId={selectedIds[0]}
          highlightedPoints={highlightedSnapPoints}
          showAll={true}
        />
      )}

      {/* 吸附圈渲染 - 绘制箭头时 */}
      {isDrawingArrow && (
        <SnapCirclesRenderer
          elements={elements}
          viewport={viewport}
          activeArrowId=""
          highlightedPoints={arrowDrawingSnapPoints}
          showAll={true}
        />
      )}

      {/* 箭头控制点 */}
      {!editingTextId && selectedIds.length === 1 && onUpdateArrowPoint && (() => {
        const selectedElement = elements.find((el) => el.id === selectedIds[0]);
        if (selectedElement?.type === 'arrow') {
          return (
            <ArrowHandles
              element={selectedElement as any}
              viewport={viewport}
              elements={elements}
              onUpdateArrowPoint={(point, x, y, binding) => {
                onUpdateArrowPoint(selectedIds[0], point, x, y, binding);
              }}
              onDragStart={() => setIsDraggingArrowPoint(true)}
              onDragEnd={() => setIsDraggingArrowPoint(false)}
              onSnapChange={setHighlightedSnapPoints}
            />
          );
        }
        return null;
      })()}

      {/* 文字编辑器 */}
      {editingTextId && (() => {
        const textElement = elements.find((el) => el.id === editingTextId);
        if (!textElement) return null;
        // 允许 text 类型或 shape
        const isEditableShape = (['rectangle','rounded-rectangle','circle','triangle'] as string[]).includes(textElement.type);
        if (textElement.type !== 'text' && !isEditableShape) return null;
        
        // 获取当前的样式数组
        const currentStyles = textElement.type === 'text' 
          ? (textElement as any).rangeStyles 
          : (textElement as any).textRangeStyles;
        
        return (
          <RichTextEditor
            element={textElement}
            viewport={viewport}
            onUpdate={(content: string, rangeStyles?: TextRangeStyle[]) => {
              if (textElement.type === 'text') {
                onUpdateElement(editingTextId, { content, rangeStyles } as any);
              } else {
                onUpdateElement(editingTextId, { content, textRangeStyles: rangeStyles } as any);
              }
            }}
            onClose={() => setEditingTextId(null)}
            initialRangeStyles={currentStyles}
          />
        );
      })()}

      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          hasSelection={selectedIds.length > 0}
          onCopy={onCopy}
          onPaste={onPaste}
          onDelete={onDelete}
          onGroup={() => onGroup && onGroup(selectedIds)}
          onUngroup={() => onUngroup && onUngroup(selectedIds)}
          onBringToFront={() => onBringToFront && onBringToFront(selectedIds)}
          onSendToBack={() => onSendToBack && onSendToBack(selectedIds)}
          onBringForward={() => onBringForward && onBringForward(selectedIds)}
          onSendBackward={() => onSendBackward && onSendBackward(selectedIds)}
          canGroup={canGroup}
          canUngroup={canUngroup}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* MiniMap */}
      <MiniMap
        elements={elements}
        viewport={viewport}
        canvasWidth={window.innerWidth}
        canvasHeight={window.innerHeight}
        onViewportChange={onUpdateViewport}
      />
    </div>
  );
});

CanvasViewComponent.displayName = 'CanvasView';

export const CanvasView = CanvasViewComponent;

interface SelectionBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function getElementSelectionBounds(element: CanvasElement): SelectionBounds {
  const rotation = ((element.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const halfW = element.width / 2;
  const halfH = element.height / 2;
  const centerX = element.x + halfW;
  const centerY = element.y + halfH;

  const corners = [
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
    { x: -halfW, y: halfH },
  ].map(({ x, y }) => ({
    x: centerX + x * cos - y * sin,
    y: centerY + x * sin + y * cos,
  }));

  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);

  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

function mergeSelectionBounds(boundsList: SelectionBounds[]): SelectionBounds {
  return boundsList.reduce<SelectionBounds>((acc, bounds) => ({
    minX: Math.min(acc.minX, bounds.minX),
    minY: Math.min(acc.minY, bounds.minY),
    maxX: Math.max(acc.maxX, bounds.maxX),
    maxY: Math.max(acc.maxY, bounds.maxY),
  }), {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  });
}
