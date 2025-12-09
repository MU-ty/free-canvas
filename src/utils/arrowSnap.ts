import type { CanvasElement, ShapeElement, ArrowBinding } from '../types';

// 吸附点类型
export interface SnapPoint {
  x: number;
  y: number;
  elementId: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

// 吸附结果
export interface SnapResult {
  snapped: boolean;
  x: number;
  y: number;
  snapPoint?: SnapPoint;
  binding?: ArrowBinding;
}

// 吸附圈半径（画布坐标）
export const SNAP_RADIUS = 20;

// 吸附检测阈值（画布坐标）
export const SNAP_THRESHOLD = 35;

/**
 * 获取元素的所有吸附点
 */
export function getElementSnapPoints(element: CanvasElement): SnapPoint[] {
  // 箭头元素不生成吸附点
  if (element.type === 'arrow') {
    return [];
  }

  const { id, x, y, width, height } = element;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  // 根据元素类型生成不同的吸附点
  if (element.type === 'circle') {
    // 圆形：四个方向的边缘点 + 中心
    return [
      { x: centerX, y: y, elementId: id, position: 'top' },
      { x: centerX, y: y + height, elementId: id, position: 'bottom' },
      { x: x, y: centerY, elementId: id, position: 'left' },
      { x: x + width, y: centerY, elementId: id, position: 'right' },
      { x: centerX, y: centerY, elementId: id, position: 'center' },
    ];
  }

  // 矩形、圆角矩形、三角形等：四角 + 四边中点 + 中心
  return [
    // 四角
    { x: x, y: y, elementId: id, position: 'top-left' },
    { x: x + width, y: y, elementId: id, position: 'top-right' },
    { x: x, y: y + height, elementId: id, position: 'bottom-left' },
    { x: x + width, y: y + height, elementId: id, position: 'bottom-right' },
    // 四边中点
    { x: centerX, y: y, elementId: id, position: 'top' },
    { x: centerX, y: y + height, elementId: id, position: 'bottom' },
    { x: x, y: centerY, elementId: id, position: 'left' },
    { x: x + width, y: centerY, elementId: id, position: 'right' },
    // 中心
    { x: centerX, y: centerY, elementId: id, position: 'center' },
  ];
}

/**
 * 获取所有元素的吸附点（排除指定的箭头元素）
 */
export function getAllSnapPoints(
  elements: CanvasElement[],
  excludeArrowId?: string
): SnapPoint[] {
  const snapPoints: SnapPoint[] = [];

  for (const element of elements) {
    // 排除当前正在编辑的箭头
    if (element.id === excludeArrowId) {
      continue;
    }
    snapPoints.push(...getElementSnapPoints(element));
  }

  return snapPoints;
}

/**
 * 计算两点间距离
 */
function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/**
 * 查找最近的吸附点
 */
export function findNearestSnapPoint(
  x: number,
  y: number,
  snapPoints: SnapPoint[],
  threshold: number = SNAP_THRESHOLD
): SnapResult {
  let nearestPoint: SnapPoint | undefined;
  let minDistance = Infinity;

  for (const point of snapPoints) {
    const dist = distance(x, y, point.x, point.y);
    if (dist < minDistance && dist <= threshold) {
      minDistance = dist;
      nearestPoint = point;
    }
  }

  if (nearestPoint) {
    return {
      snapped: true,
      x: nearestPoint.x,
      y: nearestPoint.y,
      snapPoint: nearestPoint,
      binding: {
        elementId: nearestPoint.elementId,
        position: nearestPoint.position,
      },
    };
  }

  return {
    snapped: false,
    x,
    y,
  };
}

/**
 * 对箭头点进行吸附处理
 */
export function snapArrowPoint(
  canvasX: number,
  canvasY: number,
  elements: CanvasElement[],
  currentArrowId: string,
  threshold: number = SNAP_THRESHOLD
): SnapResult {
  const snapPoints = getAllSnapPoints(elements, currentArrowId);
  return findNearestSnapPoint(canvasX, canvasY, snapPoints, threshold);
}

/**
 * 获取需要高亮的吸附圈
 * 当箭头端点接近某个吸附点时，返回该吸附点用于高亮显示
 */
export function getActiveSnapCircles(
  arrowElement: ShapeElement,
  elements: CanvasElement[],
  threshold: number = SNAP_THRESHOLD
): SnapPoint[] {
  if (!arrowElement.arrowStart || !arrowElement.arrowEnd) {
    return [];
  }

  const activeCircles: SnapPoint[] = [];
  const snapPoints = getAllSnapPoints(elements, arrowElement.id);

  // 检查起点
  const startX = arrowElement.x + arrowElement.arrowStart.x;
  const startY = arrowElement.y + arrowElement.arrowStart.y;
  const startResult = findNearestSnapPoint(startX, startY, snapPoints, threshold);
  if (startResult.snapped && startResult.snapPoint) {
    activeCircles.push(startResult.snapPoint);
  }

  // 检查终点
  const endX = arrowElement.x + arrowElement.arrowEnd.x;
  const endY = arrowElement.y + arrowElement.arrowEnd.y;
  const endResult = findNearestSnapPoint(endX, endY, snapPoints, threshold);
  if (endResult.snapped && endResult.snapPoint) {
    // 避免重复添加同一个点
    if (!activeCircles.some(p => p.x === endResult.snapPoint!.x && p.y === endResult.snapPoint!.y)) {
      activeCircles.push(endResult.snapPoint);
    }
  }

  return activeCircles;
}

/**
 * 根据绑定关系计算吸附点的绝对坐标
 */
export function getBindingPosition(
  binding: ArrowBinding,
  elements: CanvasElement[]
): { x: number; y: number } | null {
  const element = elements.find(el => el.id === binding.elementId);
  if (!element) {
    return null;
  }

  const { x, y, width, height } = element;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  switch (binding.position) {
    case 'top':
      return { x: centerX, y: y };
    case 'bottom':
      return { x: centerX, y: y + height };
    case 'left':
      return { x: x, y: centerY };
    case 'right':
      return { x: x + width, y: centerY };
    case 'center':
      return { x: centerX, y: centerY };
    case 'top-left':
      return { x: x, y: y };
    case 'top-right':
      return { x: x + width, y: y };
    case 'bottom-left':
      return { x: x, y: y + height };
    case 'bottom-right':
      return { x: x + width, y: y + height };
    default:
      return null;
  }
}

/**
 * 更新所有与指定元素绑定的箭头
 * 返回需要更新的箭头列表
 * @param movedElementIds 被移动/缩放的元素ID列表
 * @param elements 更新后的元素列表（用于计算新的绑定位置）
 * @param includeArrowsInList 是否也处理在 movedElementIds 中的箭头
 */
export function getArrowsToUpdate(
  movedElementIds: string[],
  elements: CanvasElement[],
  includeArrowsInList: boolean = true
): Array<{ arrowId: string; updates: Partial<ShapeElement> }> {
  const updates: Array<{ arrowId: string; updates: Partial<ShapeElement> }> = [];

  for (const element of elements) {
    if (element.type !== 'arrow') continue;
    
    const arrow = element as ShapeElement;
    if (!arrow.arrowStart || !arrow.arrowEnd) continue;

    // 检查这个箭头是否有任何绑定需要更新
    const startNeedsUpdate = arrow.startBinding && movedElementIds.includes(arrow.startBinding.elementId);
    const endNeedsUpdate = arrow.endBinding && movedElementIds.includes(arrow.endBinding.elementId);
    
    // 如果箭头自身在列表中，且有绑定，也需要更新
    const arrowInList = movedElementIds.includes(arrow.id);
    const arrowHasBinding = arrow.startBinding || arrow.endBinding;
    
    if (!startNeedsUpdate && !endNeedsUpdate && !(arrowInList && arrowHasBinding && includeArrowsInList)) {
      continue;
    }

    // 计算起点位置
    let absoluteStartX: number;
    let absoluteStartY: number;
    if (arrow.startBinding) {
      const newPos = getBindingPosition(arrow.startBinding, elements);
      if (newPos) {
        absoluteStartX = newPos.x;
        absoluteStartY = newPos.y;
      } else {
        absoluteStartX = arrow.x + arrow.arrowStart.x;
        absoluteStartY = arrow.y + arrow.arrowStart.y;
      }
    } else {
      absoluteStartX = arrow.x + arrow.arrowStart.x;
      absoluteStartY = arrow.y + arrow.arrowStart.y;
    }

    // 计算终点位置
    let absoluteEndX: number;
    let absoluteEndY: number;
    if (arrow.endBinding) {
      const newPos = getBindingPosition(arrow.endBinding, elements);
      if (newPos) {
        absoluteEndX = newPos.x;
        absoluteEndY = newPos.y;
      } else {
        absoluteEndX = arrow.x + arrow.arrowEnd.x;
        absoluteEndY = arrow.y + arrow.arrowEnd.y;
      }
    } else {
      absoluteEndX = arrow.x + arrow.arrowEnd.x;
      absoluteEndY = arrow.y + arrow.arrowEnd.y;
    }

    // 计算新的边界框
    const minX = Math.min(absoluteStartX, absoluteEndX);
    const minY = Math.min(absoluteStartY, absoluteEndY);
    const newWidth = Math.max(Math.abs(absoluteEndX - absoluteStartX), 10);
    const newHeight = Math.max(Math.abs(absoluteEndY - absoluteStartY), 10);

    // 转换为新的相对坐标
    const relativeStartX = absoluteStartX - minX;
    const relativeStartY = absoluteStartY - minY;
    const relativeEndX = absoluteEndX - minX;
    const relativeEndY = absoluteEndY - minY;

    updates.push({
      arrowId: arrow.id,
      updates: {
        x: minX,
        y: minY,
        width: newWidth,
        height: newHeight,
        arrowStart: { x: relativeStartX, y: relativeStartY },
        arrowEnd: { x: relativeEndX, y: relativeEndY },
      },
    });
  }

  return updates;
}
