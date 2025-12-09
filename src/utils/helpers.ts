import type { CanvasElement, SelectionBox } from '../types';

// 生成唯一 ID
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// 检查元素是否在选择框内
export const isElementInSelection = (
  element: CanvasElement,
  selection: SelectionBox
): boolean => {
  const minX = Math.min(selection.startX, selection.endX);
  const maxX = Math.max(selection.startX, selection.endX);
  const minY = Math.min(selection.startY, selection.endY);
  const maxY = Math.max(selection.startY, selection.endY);

  if (!element.rotation || element.rotation === 0) {
    // 未旋转的元素
    return (
      element.x >= minX &&
      element.x + element.width <= maxX &&
      element.y >= minY &&
      element.y + element.height <= maxY
    );
  } else {
    // 旋转的元素，检查其边界框是否与选区重叠
    const bbox = getBoundingBox([element]);
    return (
      bbox.x >= minX &&
      bbox.x + bbox.width <= maxX &&
      bbox.y >= minY &&
      bbox.y + bbox.height <= maxY
    );
  }
};

// 检查点是否在元素内
export const isPointInElement = (
  x: number,
  y: number,
  element: CanvasElement
): boolean => {
  // 如果元素没有旋转，使用简单的矩形碰撞检测
  if (!element.rotation || element.rotation === 0) {
    return (
      x >= element.x &&
      x <= element.x + element.width &&
      y >= element.y &&
      y <= element.y + element.height
    );
  }

  // 对于旋转的元素，需要反向旋转点来检测
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;
  
  // 将点相对于中心进行坐标变换
  const dx = x - centerX;
  const dy = y - centerY;
  
  // 反向旋转点
  const angle = (element.rotation * Math.PI) / 180;
  const rotatedX = dx * Math.cos(-angle) - dy * Math.sin(-angle);
  const rotatedY = dx * Math.sin(-angle) + dy * Math.cos(-angle);
  
  // 检测旋转后的点是否在矩形内
  return (
    rotatedX >= -element.width / 2 &&
    rotatedX <= element.width / 2 &&
    rotatedY >= -element.height / 2 &&
    rotatedY <= element.height / 2
  );
};

// 获取多个元素的边界框
export const getBoundingBox = (elements: CanvasElement[]) => {
  if (elements.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  elements.forEach((element) => {
    if (!element.rotation || element.rotation === 0) {
      // 未旋转的元素
      minX = Math.min(minX, element.x);
      minY = Math.min(minY, element.y);
      maxX = Math.max(maxX, element.x + element.width);
      maxY = Math.max(maxY, element.y + element.height);
    } else {
      // 旋转的元素，计算四个角的旋转后位置
      const cx = element.x + element.width / 2;
      const cy = element.y + element.height / 2;
      const angle = (element.rotation * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      
      const corners = [
        { x: -element.width / 2, y: -element.height / 2 },
        { x: element.width / 2, y: -element.height / 2 },
        { x: element.width / 2, y: element.height / 2 },
        { x: -element.width / 2, y: element.height / 2 },
      ];
      
      corners.forEach((corner) => {
        const rotatedX = corner.x * cos - corner.y * sin + cx;
        const rotatedY = corner.x * sin + corner.y * cos + cy;
        minX = Math.min(minX, rotatedX);
        minY = Math.min(minY, rotatedY);
        maxX = Math.max(maxX, rotatedX);
        maxY = Math.max(maxY, rotatedY);
      });
    }
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

// 深拷贝元素
export const cloneElement = (element: CanvasElement): CanvasElement => {
  return JSON.parse(JSON.stringify(element));
};

// 限制数值范围
export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

// 屏幕坐标转画布坐标
export const screenToCanvas = (
  screenX: number,
  screenY: number,
  viewport: { x: number; y: number; scale: number }
) => {
  return {
    x: (screenX - viewport.x) / viewport.scale,
    y: (screenY - viewport.y) / viewport.scale,
  };
};

// 画布坐标转屏幕坐标
export const canvasToScreen = (
  canvasX: number,
  canvasY: number,
  viewport: { x: number; y: number; scale: number }
) => {
  return {
    x: canvasX * viewport.scale + viewport.x,
    y: canvasY * viewport.scale + viewport.y,
  };
};

// 防抖函数
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: number | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = window.setTimeout(() => func(...args), wait);
  };
};

// 节流函数
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};
