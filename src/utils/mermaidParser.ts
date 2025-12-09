/**
 * Mermaid 解析器 - 支持基础的流程图语法
 */

export interface MermaidNode {
  id: string;
  label: string;
  shape: 'rectangle' | 'rounded' | 'circle' | 'diamond' | 'parallelogram';
  level?: number; // 可选：层级信息（用于 Markdown 流程图）
  backgroundColor?: string; // 可选：背景色
  borderColor?: string; // 可选：边框色
  isDecision?: boolean; // 可选：是否为决策节点
}

export interface MermaidEdge {
  from: string;
  to: string;
  label?: string;
  type: 'arrow' | 'dotted' | 'thick';
}

export interface MermaidGraph {
  direction: 'TB' | 'TD' | 'LR' | 'RL' | 'BT';
  nodes: MermaidNode[];
  edges: MermaidEdge[];
}

/**
 * 解析 Mermaid 代码
 */
export function parseMermaid(code: string): MermaidGraph {
  const lines = code.trim().split(/\r?\n/);
  const graph: MermaidGraph = {
    direction: 'TB',
    nodes: [],
    edges: [],
  };
  
  if (lines.length === 0) {
    throw new Error('Mermaid 代码不能为空');
  }
  
  // 解析每一行
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('%%')) continue;
    
    try {
      parseGraphLine(line, graph);
    } catch (error) {
      console.warn(`解析第 ${i + 1} 行失败:`, line, error);
    }
  }
  
  // 补充未显式定义的节点
  graph.edges.forEach(edge => {
    if (!graph.nodes.find(n => n.id === edge.from)) {
      graph.nodes.push({ id: edge.from, label: edge.from, shape: 'rectangle' });
    }
    if (!graph.nodes.find(n => n.id === edge.to)) {
      graph.nodes.push({ id: edge.to, label: edge.to, shape: 'rectangle' });
    }
  });
  
  if (graph.nodes.length === 0) {
    throw new Error('未找到任何节点');
  }
  
  return graph;
}

/**
 * 解析单行 Mermaid 语法
 */
function parseGraphLine(line: string, graph: MermaidGraph) {
  let content = line.trim();
  
  // 处理 header (graph TD 或 flowchart TD)
  // 支持 graph TD; A-->B 这种写法
  const headerMatch = content.match(/^(?:graph|flowchart)\s+([A-Za-z]{2})(.*)$/i);
  if (headerMatch) {
    const direction = headerMatch[1].toUpperCase();
    if (['TB', 'TD', 'LR', 'RL', 'BT'].includes(direction)) {
      graph.direction = direction as any;
    }
    content = headerMatch[2].trim();
    // 去除可能的分号或逗号
    content = content.replace(/^[;,]\s*/, '');
  }
  
  if (!content) return;

  // 节点 ID 允许字母、数字、下划线、短横线
  const idRegex = '[A-Za-z0-9_-]+';
  
  // 定义节点模式，注意顺序：特殊形状优先于通用形状
  const nodePatterns = [
    { regex: new RegExp(`(${idRegex})\\[\\[(.*?)\\]\\]`, 'g'), shape: 'rectangle' }, // [[Subroutine]]
    { regex: new RegExp(`(${idRegex})\\(\\((.*?)\\)\\)`, 'g'), shape: 'circle' },    // ((Circle))
    { regex: new RegExp(`(${idRegex})\\{\\{(.*?)\\}\\}`, 'g'), shape: 'diamond' },   // {{Hexagon}}
    { regex: new RegExp(`(${idRegex})\\[\\\\(.*?)\\\/\\]`, 'g'), shape: 'parallelogram' }, // [\Parallelogram/]
    { regex: new RegExp(`(${idRegex})\\[\\/(.*?)\\\\\\]`, 'g'), shape: 'parallelogram' }, // [/Parallelogram\]
    { regex: new RegExp(`(${idRegex})\\[(.*?)\\]`, 'g'), shape: 'rectangle' },        // [Rectangle]
    { regex: new RegExp(`(${idRegex})\\{(.*?)\\}`, 'g'), shape: 'diamond' },          // {Rhombus}
    { regex: new RegExp(`(${idRegex})\\((.*?)\\)`, 'g'), shape: 'rounded' },          // (Rounded)
  ];

  // 提取节点并替换为纯 ID，以便后续解析边
  let cleanLine = content;
  
  for (const { regex, shape } of nodePatterns) {
    cleanLine = cleanLine.replace(regex, (_match, id, label) => {
      // 注册节点
      if (!graph.nodes.find(n => n.id === id)) {
        graph.nodes.push({ id, label, shape: shape as any });
      }
      return id; // 替换为 ID
    });
  }
  
  // 解析边
  // 支持 ->, -->, ==>, -.->
  // 支持标签: -->|label|
  const edgeRegex = new RegExp(`(${idRegex})\\s*(-->|==>|-\\.->|->)\\s*(?:\\|([^|]+)\\|\\s*)?(${idRegex})`, 'g');
  
  let match;
  while ((match = edgeRegex.exec(cleanLine)) !== null) {
    const from = match[1];
    const arrow = match[2];
    const label = match[3] || '';
    const to = match[4];
    
    let type: MermaidEdge['type'] = 'arrow';
    if (arrow.includes('==>')) {
      type = 'thick';
    } else if (arrow.includes('-.->')) {
      type = 'dotted';
    }
    
    graph.edges.push({ from, to, label: label.trim(), type });
  }
}
