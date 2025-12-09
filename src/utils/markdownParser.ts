/**
 * Markdown 列表解析器 - 支持将缩进的 Markdown 列表转换为流程图
 */

import type { MermaidGraph, MermaidNode, MermaidEdge } from './mermaidParser';

export interface MarkdownNode {
  id: string;
  label: string;
  level: number; // 缩进层级
  parent?: string; // 父节点 ID
}

/**
 * 解析 Markdown 列表为流程图结构
 * 支持格式：
 * - 项目1
 *   - 子项目1.1
 *   - 子项目1.2
 * - 项目2
 */
export function parseMarkdownToGraph(markdown: string): MermaidGraph {
  const lines = markdown.trim().split(/\r?\n/);
  const nodes: MarkdownNode[] = [];
  const edges: MermaidEdge[] = [];
  
  // 解析每一行
  let nodeIdCounter = 0;
  const levelStack: Array<{ level: number; id: string }> = [];
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    // 计算缩进层级（支持空格和 tab）
    const match = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
    if (!match) continue;
    
    const indent = match[1];
    const content = match[3].trim();
    
    // 计算缩进层级（2个空格或1个tab为一级）
    const level = Math.floor(indent.length / 2);
    
    // 生成节点 ID
    const nodeId = `node${nodeIdCounter++}`;
    
    // 查找父节点
    let parent: string | undefined;
    while (levelStack.length > 0 && levelStack[levelStack.length - 1].level >= level) {
      levelStack.pop();
    }
    if (levelStack.length > 0) {
      parent = levelStack[levelStack.length - 1].id;
    }
    
    // 添加节点
    nodes.push({
      id: nodeId,
      label: content,
      level,
      parent,
    });
    
    // 添加边（如果有父节点）
    if (parent) {
      edges.push({
        from: parent,
        to: nodeId,
        type: 'arrow',
      });
    }
    
    // 更新层级栈
    levelStack.push({ level, id: nodeId });
  }
  
  if (nodes.length === 0) {
    throw new Error('未找到有效的 Markdown 列表项');
  }
  
  // 转换为 MermaidGraph 格式
  const mermaidNodes: MermaidNode[] = nodes.map(node => {
    const colors = getColorByLevel(node.level);
    const isDecision = isDecisionKeyword(node.label);
    return {
      id: node.id,
      label: node.label,
      shape: isDecision ? 'diamond' : determineShapeByLevel(node.level),
      level: node.level,
      backgroundColor: colors.bg,
      borderColor: colors.border,
      isDecision: isDecision,  // 添加决策标记
    };
  });
  
  return {
    direction: 'TB', // 从上到下的布局
    nodes: mermaidNodes,
    edges,
  };
}

/**
 * 检测是否为决策关键词
 */
function isDecisionKeyword(label: string): boolean {
  const keywords = ['否', '是', '？', '决策', '判断', '条件'];
  return keywords.some(kw => label.includes(kw));
}

/**
 * 根据层级确定节点形状和样式
 * 第0层（根节点）：圆角矩形，大号字体
 * 第1层：矩形，中号字体
 * 第2层及以下：圆形，小号字体
 */
function determineShapeByLevel(level: number): MermaidNode['shape'] {
  if (level === 0) {
    return 'rounded';
  } else if (level === 1) {
    return 'rectangle';
  } else {
    return 'circle';
  }
}

/**
 * 根据层级获取颜色
 * 不同层级使用不同颜色，便于视觉区分
 */
export function getColorByLevel(level: number): { bg: string; border: string } {
  const colors = [
    { bg: '#3B82F6', border: '#1E40AF' },      // 第0层：蓝色
    { bg: '#10B981', border: '#047857' },      // 第1层：绿色
    { bg: '#F59E0B', border: '#D97706' },      // 第2层：黄色
    { bg: '#8B5CF6', border: '#6D28D9' },      // 第3层：紫色
    { bg: '#EC4899', border: '#BE185D' },      // 第4层：粉色
    { bg: '#06B6D4', border: '#0891B2' },      // 第5层：青色
  ];
  return colors[Math.min(level, colors.length - 1)];
}

/**
 * 生成 Markdown 列表示例
 */
export function getMarkdownExample(): string {
  return `- 项目启动
  - 需求分析
    - 用户调研
    - 竞品分析
  - 设计阶段
    - UI设计
    - 交互设计
- 开发阶段
  - 前端开发
  - 后端开发
  - 测试
- 上线发布`;
}
