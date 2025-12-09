/**
 * Mermaid 转画布元素
 */

import type { CanvasElement, ShapeElement } from '../types';
import { parseMermaid } from './mermaidParser';
import type { MermaidNode, MermaidGraph } from './mermaidParser';
import { layoutGraph } from './graphLayout';
import type { LayoutNode } from './graphLayout';

/**
 * Markdown 树形布局 - 优化箭头方向
 * 基于层级和父子关系进行布局，使箭头方向更自然
 * 采用树形展示：左右两侧各有一条竖线连接
 * 判断节点（diamond）显示在右侧线外
 */
function layoutMarkdownTree(graph: MermaidGraph): { positions: Map<string, LayoutNode>; layers: string[][] } {
  const positions = new Map<string, LayoutNode>();
  const layers: string[][] = [];
  
  // 按层级分组节点
  const levelGroups = new Map<number, string[]>();
  const levelGroupsOutside = new Map<number, string[]>();  // 外部节点（decision）
  const nodeLevel = new Map<string, number>();
  const parentMap = new Map<string, string>();  // 记录父子关系
  
  // 首先建立父子关系
  graph.edges.forEach(edge => {
    const fromNode = graph.nodes.find(n => n.id === edge.from);
    const toNode = graph.nodes.find(n => n.id === edge.to);
    if (fromNode && toNode) {
      const fromLevel = (fromNode as any).level ?? 0;
      const toLevel = (toNode as any).level ?? 0;
      if (toLevel > fromLevel) {
        parentMap.set(toNode.id, fromNode.id);
      }
    }
  });
  
  // 判断节点是否应该显示在外面（isDecision 属性或 diamond 形状）
  const isDecisionNode = (node: any): boolean => {
    return node.isDecision === true || node.shape === 'diamond';
  };
  
  graph.nodes.forEach((node: any) => {
    const level = node.level ?? 0;
    nodeLevel.set(node.id, level);
    
    if (isDecisionNode(node)) {
      // 决策节点放在外部
      if (!levelGroupsOutside.has(level)) {
        levelGroupsOutside.set(level, []);
      }
      levelGroupsOutside.get(level)!.push(node.id);
    } else {
      // 普通节点在中间
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)!.push(node.id);
    }
  });
  
  // 按层级顺序构建 layers（中间节点）
  const sortedLevels = Array.from(levelGroups.keys()).sort((a, b) => a - b);
  sortedLevels.forEach(level => {
    layers.push(levelGroups.get(level)!);
  });
  
  // 分配坐标 - 树形布局
  const nodeSpacing = 160;
  const layerSpacing = 220;
  const treeWidth = 600;  // 树形宽度
  const outsideOffsetX = 400;  // 外部节点的水平偏移
  
  layers.forEach((layer, layerIndex) => {
    const y = layerIndex * layerSpacing;
    const layerSize = layer.length;
    
    if (layerSize === 1) {
      // 单个节点居中
      const nodeId = layer[0];
      const node = graph.nodes.find(n => n.id === nodeId)!;
      const x = 0;
      
      let width = 160;
      let height = 80;
      
      if (node.shape === 'diamond') {
        width = 120;
        height = 120;
      } else if (node.shape === 'circle') {
        width = height = 100;
      } else if (node.shape === 'rounded') {
        width = 160;
        height = 80;
      }
      
      positions.set(nodeId, { id: nodeId, x, y, width, height });
    } else {
      // 多个节点分散排列
      const itemWidth = treeWidth / layerSize;
      
      layer.forEach((nodeId, nodeIndex) => {
        const node = graph.nodes.find(n => n.id === nodeId)!;
        const x = (nodeIndex + 0.5) * itemWidth - treeWidth / 2;
        
        let width = 160;
        let height = 80;
        
        if (node.shape === 'diamond') {
          width = 120;
          height = 120;
        } else if (node.shape === 'circle') {
          width = height = 100;
        } else if (node.shape === 'rounded') {
          width = 160;
          height = 80;
        }
        
        positions.set(nodeId, { id: nodeId, x, y, width, height });
      });
    }
  });
  
  // 分配外部节点坐标（决策节点显示在右侧外面）
  const sortedOutsideLevels = Array.from(levelGroupsOutside.keys()).sort((a, b) => a - b);
  sortedOutsideLevels.forEach(level => {
    const outsideLayer = levelGroupsOutside.get(level)!;
    const y = level * layerSpacing;
    
    outsideLayer.forEach((nodeId, nodeIndex) => {
      const node = graph.nodes.find(n => n.id === nodeId)!;
      // 外部节点显示在右侧，垂直分散
      const x = outsideOffsetX + (nodeIndex - outsideLayer.length / 2 + 0.5) * 120;
      
      let width = 120;
      let height = 120;
      
      if (node.shape === 'diamond') {
        width = 120;
        height = 120;
      } else if (node.shape === 'circle') {
        width = height = 100;
      }
      
      positions.set(nodeId, { id: nodeId, x, y, width, height });
    });
  });
  
  return { positions, layers };
}

/**
 * 将长文本按照指定宽度自动换行
 */
function wrapText(text: string, maxCharsPerLine: number = 20): string {
  if (!text || text.length <= maxCharsPerLine) return text;
  
  const words = text.split('');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const char of words) {
    if (currentLine.length >= maxCharsPerLine && (char === ' ' || char === ',' || char === '\u3001' || char === '\uff0c')) {
      lines.push(currentLine);
      currentLine = char === ' ' ? '' : char;
    } else if (currentLine.length >= maxCharsPerLine) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine += char;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines.join('\n');
}

/**
 * 将 Mermaid 代码转换为画布元素
 */
export interface MermaidToCanvasOptions {
  enableBend?: boolean;
  stylePreset?: 'colorful' | 'serious';
  curveStrength?: number; // multiplier for base curve
}

/**
 * 将 MermaidGraph 结构转换为画布元素（通用函数）
 */
export function mermaidGraphToCanvasElements(
  graph: ReturnType<typeof parseMermaid>,
  startX: number = 100,
  startY: number = 100,
  options: MermaidToCanvasOptions = { enableBend: true, stylePreset: 'colorful', curveStrength: 0.7 }
): CanvasElement[] {
  
  // 2. 计算布局（返回 positions 和层级信息）
  // 检测是否为 Markdown 生成的树形图（所有节点都有 level 属性）
  const isMarkdownGraph = graph.nodes.every((n: any) => typeof n.level === 'number');
  const { positions, layers } = isMarkdownGraph
    ? layoutMarkdownTree(graph)
    : layoutGraph(graph);
  
  // 3. 生成节点元素
  const nodeElements = new Map<string, ShapeElement>();
  let maxZIndex = 0;
  
  graph.nodes.forEach(node => {
    const pos = positions.get(node.id)!;
    
    // 应用文本换行
    const wrappedLabel = wrapText(node.label, 20);
    const lineCount = wrappedLabel.split('\n').length;
    
    // 根据文本长度调整节点宽度，使标签不被挤压
    const maxLineLength = Math.max(...wrappedLabel.split('\n').map(line => line.length));
    const textBasedWidth = Math.max(pos.width, Math.min(400, maxLineLength * 12 + 60));
    const textBasedHeight = Math.max(pos.height, lineCount * 20 + 30);
    
    // 优先使用节点自定义颜色，如果没有则使用默认配色方案
    const bg = (node as any).backgroundColor || getNodeColor(node.id, options.stylePreset || 'colorful');
    const border = (node as any).borderColor || getNodeBorderColor(node.id, options.stylePreset || 'colorful');
    const textColor = getReadableTextColor(bg);
    
    // 根据层级调整边框粗细和字体大小
    const level = (node as any).level ?? 0;
    const borderWidth = Math.max(2, 4 - level * 0.5);
    const fontSize = Math.max(12, 16 - level * 1);

    // 对于 Markdown 图，外部节点需要额外的右侧偏移
    let nodeX = startX + pos.x - pos.width / 2;
    if (isMarkdownGraph && ((node as any).isDecision === true || node.shape === 'diamond')) {
      // 外部决策节点显示在更右侧
      nodeX = startX + 600;  // 固定在较右的位置
    }

    const element: ShapeElement = {
      id: `node-${node.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: getCanvasShape(node.shape),
      x: nodeX,
      y: startY + pos.y - pos.height / 2,
      width: textBasedWidth,
      height: textBasedHeight,
      backgroundColor: bg,
      borderColor: border,
      borderWidth: borderWidth,
      rotation: 0,
      zIndex: maxZIndex++,
      content: wrappedLabel,
      textStyle: {
        fontFamily: 'Arial, sans-serif',
        fontSize: fontSize,
        color: textColor,
        bold: level === 0, // 根层级加粗
        italic: false,
      },
    };
    
    if (element.type === 'rounded-rectangle') {
      element.cornerRadius = 10;
    }
    
    nodeElements.set(node.id, element);
  });
  
  // 在创建完节点元素后，重新计算每个节点的位置以适应基于文本的宽度
  // 使用 layoutGraph 中计算出的层次信息（layers）来进行重新布局
  const isHorizontal = graph.direction === 'LR' || graph.direction === 'RL';
  const isReverse = graph.direction === 'RL' || graph.direction === 'BT';
  const cfg = { nodeSpacing: 160, layerSpacing: 220 };

  layers.forEach((layer, layerIndex) => {
    const dims = layer.map(id => {
      const el = nodeElements.get(id)!;
      return { id, width: el.width, height: el.height };
    });
    const layerSize = dims.length;
    // 计算总宽度
    const totalWidth = dims.reduce((s, d) => s + d.width, 0) + Math.max(0, dims.length - 1) * cfg.nodeSpacing;
    let offset = -totalWidth / 2;

    dims.forEach((d, idx) => {
      const id = d.id;
      const el = nodeElements.get(id)!;
      if (isHorizontal) {
        const actualLayerIndex = isReverse ? (layers.length - 1 - layerIndex) : layerIndex;
        const y = (idx - (layerSize - 1) / 2) * cfg.nodeSpacing;
        const x = actualLayerIndex * cfg.layerSpacing;
        el.x = startX + x - el.width / 2;
        el.y = startY + y - el.height / 2;
      } else {
        const actualLayerIndex = isReverse ? (layers.length - 1 - layerIndex) : layerIndex;
        const x = offset + d.width / 2;
        const y = actualLayerIndex * cfg.layerSpacing;
        el.x = startX + x - el.width / 2;
        el.y = startY + y - el.height / 2;
        offset += d.width + cfg.nodeSpacing;
      }
      nodeElements.set(id, el);
    });
  });

  // 4. 生成箭头元素
  // 计算每个边对的并发数量，用于绘制弧度
  const pairCounts = new Map<string, number>();
  
  graph.edges.forEach(e => {
    const key = `${e.from}->${e.to}`;
    pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
  });
  const pairIndex = new Map<string, number>();

  // 为 Markdown 树形图准备连接线
  const connectorLines: ShapeElement[] = [];
  
  if (isMarkdownGraph) {
    // 为每条边添加连接线（从节点连到左/右竖线）
    graph.edges.forEach(edge => {
      const fromNode = nodeElements.get(`node-${edge.from}-from-nodeElements`);
      const toNode = nodeElements.get(`node-${edge.to}-from-nodeElements`);
      
      if (fromNode && toNode) {
        // 从 fromNode 底部连接到 toNode 顶部
        const fromBottom = fromNode.y + fromNode.height / 2;
        const toTop = toNode.y - toNode.height / 2;
        
        // 添加从 fromNode 到中间竖线的水平连接
        if (fromNode.x < 0) {
          // 左侧连接
          const connector: ShapeElement = {
            id: `connector-${edge.from}-left-${Date.now()}`,
            type: 'arrow',
            x: (fromNode.x - 80) / 2,
            y: fromBottom,
            width: Math.abs(fromNode.x - (-80)),
            height: 2,
            backgroundColor: '#CBD5E1',
            borderColor: '#CBD5E1',
            borderWidth: 1,
            rotation: 0,
            zIndex: maxZIndex,
            arrowStart: { x: 0, y: 0 },
            arrowEnd: { x: Math.abs(fromNode.x - (-80)), y: 0 },
            arrowHeadSize: 0,
            arrowTailWidth: 1,
            arrowCurve: 0,
          };
          connectorLines.push(connector);
        } else {
          // 右侧连接
          const connector: ShapeElement = {
            id: `connector-${edge.from}-right-${Date.now()}`,
            type: 'arrow',
            x: (fromNode.x + 80) / 2,
            y: fromBottom,
            width: Math.abs(fromNode.x - 80),
            height: 2,
            backgroundColor: '#CBD5E1',
            borderColor: '#CBD5E1',
            borderWidth: 1,
            rotation: 0,
            zIndex: maxZIndex,
            arrowStart: { x: 0, y: 0 },
            arrowEnd: { x: Math.abs(fromNode.x - 80), y: 0 },
            arrowHeadSize: 0,
            arrowTailWidth: 1,
            arrowCurve: 0,
          };
          connectorLines.push(connector);
        }
      }
    });
  }

  const arrowElements: ShapeElement[] = graph.edges.map(edge => {
    const fromNode = nodeElements.get(edge.from);
    const toNode = nodeElements.get(edge.to);
    
    if (!fromNode || !toNode) {
      console.warn(`找不到节点: ${edge.from} -> ${edge.to}`);
      return null;
    }
    
    // 计算箭头起点和终点（连接节点边缘而不是中心）
    const fromCenterX = fromNode.x + fromNode.width / 2;
    const fromCenterY = fromNode.y + fromNode.height / 2;
    const toCenterX = toNode.x + toNode.width / 2;
    const toCenterY = toNode.y + toNode.height / 2;

    const computeIntersection = (
      cx: number,
      cy: number,
      w: number,
      h: number,
      targetX: number,
      targetY: number
    ) => {
      // vector from center to target
      const tx = targetX - cx;
      const ty = targetY - cy;
      if (tx === 0 && ty === 0) return { x: cx, y: cy };
      const hx = w / 2;
      const hy = h / 2;
      const sx = Math.abs(hx / (tx || Number.EPSILON));
      const sy = Math.abs(hy / (ty || Number.EPSILON));
      const t = Math.min(sx, sy);
      const ix = cx + tx * t;
      const iy = cy + ty * t;
      return { x: ix, y: iy };
    };
    
    // 计算箭头在局部坐标系中的起点和终点
    const minX = Math.min(fromCenterX, toCenterX);
    const minY = Math.min(fromCenterY, toCenterY);
    const maxX = Math.max(fromCenterX, toCenterX);
    const maxY = Math.max(fromCenterY, toCenterY);
    
    const width = maxX - minX || 1;
    const height = maxY - minY || 1;
    
    const startPoint = computeIntersection(
      fromNode.x + fromNode.width / 2,
      fromNode.y + fromNode.height / 2,
      fromNode.width,
      fromNode.height,
      toCenterX,
      toCenterY
    );
    const endPoint = computeIntersection(
      toNode.x + toNode.width / 2,
      toNode.y + toNode.height / 2,
      toNode.width,
      toNode.height,
      fromCenterX,
      fromCenterY
    );

    const arrowStartX = startPoint.x - minX;
    const arrowStartY = startPoint.y - minY;
    const arrowEndX = endPoint.x - minX;
    const arrowEndY = endPoint.y - minY;
    
    // 根据 from->to 方向选择最佳绑定位置（四方向）
    const dx = toCenterX - fromCenterX;
    const dy = toCenterY - fromCenterY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    // startBindingPosition 和 endBindingPosition 不再需要
    let startPos: any = 'center';
    let endPos: any = 'center';
    if (absDx > absDy) {
      // 横向
      if (dx > 0) {
        startPos = 'right';
        endPos = 'left';
      } else {
        startPos = 'left';
        endPos = 'right';
      }
    } else {
      // 纵向
      if (dy > 0) {
        startPos = 'bottom';
        endPos = 'top';
      } else {
        startPos = 'top';
        endPos = 'bottom';
      }
    }

    // 计算弧度（如果有多条平行边）
    const pairKey = `${edge.from}->${edge.to}`;
    
    const totalForPair = pairCounts.get(pairKey) || 1;
    const indexForPair = (pairIndex.get(pairKey) || 0);
    pairIndex.set(pairKey, indexForPair + 1);
    const centerIndex = (totalForPair - 1) / 2;
    
    // 增强弯曲度：使用更大的基准值
    const baseCurve = options.enableBend ? 2.0 : 0; // 大幅增加基准弧度
    
    let offset = indexForPair - centerIndex;
    
    // 对于平行箭头，增加偏移量
    if (totalForPair > 1) {
      offset = (indexForPair - centerIndex) * 1.5;
    } else if (Math.abs(offset) < 1e-6) {
      // 对于单条箭头，给一个小的默认偏移
      offset = 0.2;
    }
    
    const curveFactor = offset * baseCurve * (options.curveStrength || 1);

    const element: ShapeElement = {
      id: `arrow-${edge.from}-${edge.to}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'arrow',
      x: minX,
      y: minY,
      width,
      height,
      backgroundColor: getArrowColor(edge.type),
      borderColor: getArrowColor(edge.type),
      borderWidth: edge.type === 'thick' ? 3 : 2,
      rotation: 0,
      zIndex: maxZIndex++,
      arrowStart: { x: arrowStartX, y: arrowStartY },
      arrowEnd: { x: arrowEndX, y: arrowEndY },
      arrowHeadSize: 12,
      arrowTailWidth: edge.type === 'thick' ? 3 : 2,
      arrowCurve: curveFactor,
      content: edge.label || '',
      textStyle: edge.label ? {
        fontFamily: 'Arial, sans-serif',
        fontSize: 12,
        color: '#1e293b',
        bold: false,
        italic: false,
      } : undefined,
      // 绑定到节点，根据方向选择边缘位置
      startBinding: {
        elementId: fromNode.id,
        position: startPos,
      },
      endBinding: {
        elementId: toNode.id,
        position: endPos,
      },
    };
    
    return element;
  }).filter(Boolean) as ShapeElement[];
  
  // 为 Markdown 树形图添加左右竖线（形成闭合的树形结构）
  if (isMarkdownGraph && layers.length > 1) {
    const guideLines: ShapeElement[] = [];
    
    // 计算所有节点的位置范围（只计算中间节点，不包括外部决策节点）
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    Array.from(nodeElements.values()).forEach(node => {
      // 获取节点 ID 来检查是否是决策节点
      const nodeId = Object.keys(positions).find(id => {
        const pos = positions.get(id);
        return pos && Math.abs(pos.x - (node.x - startX)) < 1 && Math.abs(pos.y - (node.y - startY)) < 1;
      });
      
      if (nodeId) {
        const graphNode = graph.nodes.find(n => n.id === nodeId);
        const isOutside = (graphNode as any)?.isDecision === true || graphNode?.shape === 'diamond';
        
        // 只计算中间节点
        if (!isOutside) {
          minX = Math.min(minX, node.x - node.width / 2);
          maxX = Math.max(maxX, node.x + node.width / 2);
          minY = Math.min(minY, node.y - node.height / 2);
          maxY = Math.max(maxY, node.y + node.height / 2);
        }
      }
    });
    
    // 添加左竖线
    const leftLineId = `guide-left-${Date.now()}`;
    guideLines.push({
      id: leftLineId,
      type: 'arrow',
      x: minX - 80,
      y: (minY + maxY) / 2,
      width: 1,
      height: maxY - minY + 100,
      backgroundColor: '#94A3B8',
      borderColor: '#94A3B8',
      borderWidth: 2,
      rotation: 0,
      zIndex: maxZIndex,
      arrowStart: { x: 0, y: 0 },
      arrowEnd: { x: 0, y: maxY - minY + 100 },
      arrowHeadSize: 0,
      arrowTailWidth: 2,
      arrowCurve: 0,
    });
    
    // 添加右竖线（外部节点会在此线右侧显示）
    const rightLineId = `guide-right-${Date.now()}`;
    guideLines.push({
      id: rightLineId,
      type: 'arrow',
      x: maxX + 80,
      y: (minY + maxY) / 2,
      width: 1,
      height: maxY - minY + 100,
      backgroundColor: '#94A3B8',
      borderColor: '#94A3B8',
      borderWidth: 2,
      rotation: 0,
      zIndex: maxZIndex,
      arrowStart: { x: 0, y: 0 },
      arrowEnd: { x: 0, y: maxY - minY + 100 },
      arrowHeadSize: 0,
      arrowTailWidth: 2,
      arrowCurve: 0,
    });
    
    return [...Array.from(nodeElements.values()), ...connectorLines, ...arrowElements, ...guideLines];
  }
  
  return [...Array.from(nodeElements.values()), ...arrowElements];
}

/**
 * 映射 Mermaid 形状到画布形状
 */
function getCanvasShape(mermaidShape: MermaidNode['shape']): ShapeElement['type'] {
  const shapeMap: Record<MermaidNode['shape'], ShapeElement['type']> = {
    rectangle: 'rounded-rectangle',
    rounded: 'rounded-rectangle',
    circle: 'circle',
    diamond: 'rectangle', // 暂时用矩形代替菱形
    parallelogram: 'rectangle', // 暂时用矩形代替平行四边形
  };
  return shapeMap[mermaidShape] || 'rectangle';
}

// 生成基于 id 的颜色选择，保证相同 id 使用相同颜色
function hashStringToIndex(s: string, mod: number) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  }
  return h % mod;
}

function getNodeColor(id?: string, preset: 'colorful' | 'serious' = 'colorful'): string {
  // 调色板：colorful（更彩）与 serious（更严肃）
  const colorful = ['#60A5FA', '#34D399', '#A78BFA', '#F59E0B', '#FB7185', '#F97316', '#06B6D4', '#F472B6'];
  const serious = ['#2563EB', '#0F766E', '#6D28D9', '#92400E', '#7C2D12', '#334155', '#0F172A', '#374151'];
  const palette = preset === 'serious' ? serious : colorful;
  const idx = id ? hashStringToIndex(id, palette.length) : 0;
  return palette[idx];
}

function getNodeBorderColor(id?: string, preset: 'colorful' | 'serious' = 'colorful'): string {
  const colorfulBorder = ['#1E40AF', '#065F46', '#4C1D95', '#92400E', '#981B1B', '#C2410C', '#075985', '#BE185D'];
  const seriousBorder = ['#0B3B8C', '#064E40', '#3B1F6B', '#6B2F0A', '#5C1F1A', '#1F2937', '#071833', '#111827'];
  const palette = preset === 'serious' ? seriousBorder : colorfulBorder;
  const idx = id ? hashStringToIndex(id, palette.length) : 0;
  return palette[idx];
}

function hexToRgb(hex: string) {
  const m = hex.replace('#', '');
  const bigint = parseInt(m, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return { r, g, b };
}

function getReadableTextColor(bgHex: string) {
  const { r, g, b } = hexToRgb(bgHex);
  // 相对亮度公式
  const lum = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
  return lum > 0.6 ? '#0f172a' : '#ffffff';
}

/**
 * 根据箭头类型获取颜色
 */
function getArrowColor(type: 'arrow' | 'dotted' | 'thick'): string {
  const colorMap = {
    arrow: '#334155',
    dotted: '#6B7280',
    thick: '#0F172A',
  };
  return colorMap[type] || '#334155';
}

/**
 * 将 Mermaid 代码转换为画布元素（包装器函数）
 */
export function mermaidToCanvasElements(
  mermaidCode: string,
  startX: number = 100,
  startY: number = 100,
  options: MermaidToCanvasOptions = { enableBend: true, stylePreset: 'colorful', curveStrength: 0.7 }
): CanvasElement[] {
  const graph = parseMermaid(mermaidCode);
  return mermaidGraphToCanvasElements(graph, startX, startY, options);
}
