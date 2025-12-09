// 元素类型
export const ElementType = {
  RECTANGLE: 'rectangle',
  ROUNDED_RECTANGLE: 'rounded-rectangle',
  CIRCLE: 'circle',
  TRIANGLE: 'triangle',
  ARROW: 'arrow',
  IMAGE: 'image',
  TEXT: 'text',
  GROUP: 'group',
} as const;

export type ElementType = typeof ElementType[keyof typeof ElementType];

// 图片滤镜类型
export const ImageFilter = {
  GRAYSCALE: 'grayscale',
  SEPIA: 'sepia',
  BLUR: 'blur',
  NONE: 'none',
} as const;

export type ImageFilter = typeof ImageFilter[keyof typeof ImageFilter];

// 文本样式
export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  backgroundColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

// 文本范围样式
export interface TextRangeStyle {
  start: number;
  end: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  backgroundColor?: string;
  fontSize?: number;
  fontFamily?: string;
}

// 基础元素属性
export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
}

// 箭头与元素的绑定关系
export interface ArrowBinding {
  elementId: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

// 图形元素
export interface ShapeElement extends BaseElement {
  type: 'rectangle' | 'rounded-rectangle' | 'circle' | 'triangle' | 'arrow';
  backgroundColor: string;
  borderWidth: number;
  borderColor: string;
  cornerRadius?: number; // 圆角矩形使用
  content?: string;
  textStyle?: TextStyle;
  textRangeStyles?: TextRangeStyle[]; // 局部文本样式
  arrowStart?: { x: number; y: number };
  arrowEnd?: { x: number; y: number };
  arrowHeadSize?: number;
  arrowTailWidth?: number;
  arrowCurve?: number;
  // 箭头吸附绑定信息
  startBinding?: ArrowBinding;
  endBinding?: ArrowBinding;
}

// 图片元素
export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  filter: ImageFilter;
}

// 文本元素
export interface TextElement extends BaseElement {
  type: 'text';
  content: string;
  style: TextStyle;
  rangeStyles?: TextRangeStyle[]; // 局部文本样式
}

// 组合元素
export interface GroupElement extends BaseElement {
  type: 'group';
  children: CanvasElement[];
}

// 联合类型
export type CanvasElement = ShapeElement | ImageElement | TextElement | GroupElement;

// 视口状态
export interface ViewportState {
  x: number;
  y: number;
  scale: number;
}

// 画布状态
export interface CanvasState {
  elements: CanvasElement[];
  selectedIds: string[];
  viewport: ViewportState;
}

// 选择框
export interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

// 拖拽状态
export interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  elementStartPositions: Map<string, { x: number; y: number }>;
}

// 缩放控制点
export const ResizeHandle = {
  TOP_LEFT: 'tl',
  TOP_RIGHT: 'tr',
  BOTTOM_LEFT: 'bl',
  BOTTOM_RIGHT: 'br',
  TOP: 't',
  BOTTOM: 'b',
  LEFT: 'l',
  RIGHT: 'r',
} as const;

export type ResizeHandle = typeof ResizeHandle[keyof typeof ResizeHandle];

// 历史记录项
export interface HistoryItem {
  elements: CanvasElement[];
  timestamp: number;
}
