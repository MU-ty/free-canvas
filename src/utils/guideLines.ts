import type { CanvasElement } from '../types';

export interface GuideLine {
  type: 'vertical' | 'horizontal';
  position: number;
  start: number;
  end: number;
}

export interface AlignmentInfo {
  element: CanvasElement;
  type: 'left' | 'right' | 'top' | 'bottom' | 'centerX' | 'centerY';
  position: number;
}

const SNAP_DISTANCE = 10; // 吸附距离阈值（像素）

/**
 * 获取元素的对齐点
 */
export const getElementAlignments = (
  element: CanvasElement
): Record<string, number> => {
  return {
    left: element.x,
    right: element.x + element.width,
    top: element.y,
    bottom: element.y + element.height,
    centerX: element.x + element.width / 2,
    centerY: element.y + element.height / 2,
  };
};

/**
 * 检测元素之间的对齐关系，返回应绘制的辅助线
 */
export const detectGuideLines = (
  movingElement: CanvasElement,
  otherElements: CanvasElement[],
  viewport: { x: number; y: number; scale: number }
): GuideLine[] => {
  const guidelines: GuideLine[] = [];
  const movingAlignments = getElementAlignments(movingElement);
  const snapDist = SNAP_DISTANCE / viewport.scale;

  otherElements.forEach((otherElement) => {
    const otherAlignments = getElementAlignments(otherElement);

    // 检测垂直对齐（left, right, centerX）
    ['left', 'right', 'centerX'].forEach((alignType) => {
      const movingPos = movingAlignments[alignType];
      const otherPos = otherAlignments[alignType];
      const distance = Math.abs(movingPos - otherPos);

      if (distance < snapDist && distance > 0) {
        const minY = Math.min(movingElement.y, otherElement.y);
        const maxY = Math.max(
          movingElement.y + movingElement.height,
          otherElement.y + otherElement.height
        );

        guidelines.push({
          type: 'vertical',
          position: otherPos,
          start: minY,
          end: maxY,
        });
      }
    });

    // 检测水平对齐（top, bottom, centerY）
    ['top', 'bottom', 'centerY'].forEach((alignType) => {
      const movingPos = movingAlignments[alignType];
      const otherPos = otherAlignments[alignType];
      const distance = Math.abs(movingPos - otherPos);

      if (distance < snapDist && distance > 0) {
        const minX = Math.min(movingElement.x, otherElement.x);
        const maxX = Math.max(
          movingElement.x + movingElement.width,
          otherElement.x + otherElement.width
        );

        guidelines.push({
          type: 'horizontal',
          position: otherPos,
          start: minX,
          end: maxX,
        });
      }
    });
  });

  // 去重
  return guidelines.filter(
    (line, index, arr) =>
      index === arr.findIndex((l) => l.type === line.type && l.position === line.position)
  );
};

/**
 * 计算吸附后的位置
 */
export const calculateSnappedPosition = (
  movingElement: CanvasElement,
  otherElements: CanvasElement[],
  viewport: { x: number; y: number; scale: number }
): { x: number; y: number } => {
  let snappedX = movingElement.x;
  let snappedY = movingElement.y;

  const movingAlignments = getElementAlignments(movingElement);
  const snapDist = SNAP_DISTANCE / viewport.scale;

  otherElements.forEach((otherElement) => {
    const otherAlignments = getElementAlignments(otherElement);

    // 垂直对齐吸附
    ['left', 'right', 'centerX'].forEach((alignType) => {
      const movingPos = movingAlignments[alignType];
      const otherPos = otherAlignments[alignType];
      const distance = movingPos - otherPos;

      if (Math.abs(distance) < snapDist) {
        // 计算需要移动的距离
        if (alignType === 'left') {
          snappedX = otherElement.x - movingElement.x + movingElement.x;
          snappedX = otherElement.x;
        } else if (alignType === 'right') {
          snappedX = otherElement.x + otherElement.width - movingElement.width;
        } else if (alignType === 'centerX') {
          snappedX = otherElement.x + otherElement.width / 2 - movingElement.width / 2;
        }
      }
    });

    // 水平对齐吸附
    ['top', 'bottom', 'centerY'].forEach((alignType) => {
      const movingPos = movingAlignments[alignType];
      const otherPos = otherAlignments[alignType];
      const distance = movingPos - otherPos;

      if (Math.abs(distance) < snapDist) {
        if (alignType === 'top') {
          snappedY = otherElement.y;
        } else if (alignType === 'bottom') {
          snappedY = otherElement.y + otherElement.height - movingElement.height;
        } else if (alignType === 'centerY') {
          snappedY = otherElement.y + otherElement.height / 2 - movingElement.height / 2;
        }
      }
    });
  });

  return { x: snappedX, y: snappedY };
};

/**
 * 检测距离辅助线（等距分布）
 */
export const detectDistanceGuides = (
  elements: CanvasElement[]
): { vertical: number[]; horizontal: number[] } => {
  const result = { vertical: [] as number[], horizontal: [] as number[] };

  if (elements.length < 2) return result;

  // 获取所有元素的对齐信息
  const alignments = elements.map((el) => ({
    element: el,
    alignments: getElementAlignments(el),
  }));

  // 检测垂直等距分布
  const verticalPositions = alignments.map((a) => a.alignments.centerX).sort((a, b) => a - b);
  for (let i = 0; i < verticalPositions.length - 2; i++) {
    const dist1 = verticalPositions[i + 1] - verticalPositions[i];
    const dist2 = verticalPositions[i + 2] - verticalPositions[i + 1];
    if (Math.abs(dist1 - dist2) < 1) {
      // 等距
      result.vertical.push(verticalPositions[i], verticalPositions[i + 1], verticalPositions[i + 2]);
    }
  }

  // 检测水平等距分布
  const horizontalPositions = alignments.map((a) => a.alignments.centerY).sort((a, b) => a - b);
  for (let i = 0; i < horizontalPositions.length - 2; i++) {
    const dist1 = horizontalPositions[i + 1] - horizontalPositions[i];
    const dist2 = horizontalPositions[i + 2] - horizontalPositions[i + 1];
    if (Math.abs(dist1 - dist2) < 1) {
      // 等距
      result.horizontal.push(horizontalPositions[i], horizontalPositions[i + 1], horizontalPositions[i + 2]);
    }
  }

  // 去重
  result.vertical = [...new Set(result.vertical)];
  result.horizontal = [...new Set(result.horizontal)];

  return result;
};

/**
 * 检测缩放时的辅助线（边对齐）
 * 检测元素的边是否与其他元素的边对齐
 */
export const detectResizeGuideLines = (
  resizingElement: CanvasElement,
  otherElements: CanvasElement[],
  viewport: { x: number; y: number; scale: number }
): GuideLine[] => {
  const guidelines: GuideLine[] = [];
  const resizingAlignments = getElementAlignments(resizingElement);
  const snapDist = SNAP_DISTANCE / viewport.scale;

  otherElements.forEach((otherElement) => {
    const otherAlignments = getElementAlignments(otherElement);

    // 检测垂直边对齐（left, right）
    ['left', 'right'].forEach((alignType) => {
      const resizingPos = resizingAlignments[alignType];
      
      ['left', 'right'].forEach((otherAlignType) => {
        const otherPos = otherAlignments[otherAlignType];
        const distance = Math.abs(resizingPos - otherPos);

        if (distance < snapDist) {
          const minY = Math.min(resizingElement.y, otherElement.y);
          const maxY = Math.max(
            resizingElement.y + resizingElement.height,
            otherElement.y + otherElement.height
          );

          guidelines.push({
            type: 'vertical',
            position: otherPos,
            start: minY,
            end: maxY,
          });
        }
      });
    });

    // 检测水平边对齐（top, bottom）
    ['top', 'bottom'].forEach((alignType) => {
      const resizingPos = resizingAlignments[alignType];
      
      ['top', 'bottom'].forEach((otherAlignType) => {
        const otherPos = otherAlignments[otherAlignType];
        const distance = Math.abs(resizingPos - otherPos);

        if (distance < snapDist) {
          const minX = Math.min(resizingElement.x, otherElement.x);
          const maxX = Math.max(
            resizingElement.x + resizingElement.width,
            otherElement.x + otherElement.width
          );

          guidelines.push({
            type: 'horizontal',
            position: otherPos,
            start: minX,
            end: maxX,
          });
        }
      });
    });
  });

  // 去重
  return guidelines.filter(
    (line, index, arr) =>
      index === arr.findIndex((l) => l.type === line.type && l.position === line.position)
  );
};
