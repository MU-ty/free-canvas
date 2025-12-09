/**
 * 图布局算法 - 分层布局（简化版 Sugiyama）
 */

import type { MermaidGraph } from './mermaidParser';

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutConfig {
  nodeSpacing: number;    // 节点水平间距
  layerSpacing: number;   // 层级垂直间距
  nodeWidth: number;      // 默认节点宽度
  nodeHeight: number;     // 默认节点高度
}

const DEFAULT_CONFIG: LayoutConfig = {
  // 增大间距以避免拥挤
  nodeSpacing: 160,
  layerSpacing: 220,
  nodeWidth: 160,
  nodeHeight: 80,
};

/**
 * 分层布局算法（简化版 Sugiyama）
 */
export function layoutGraph(
  graph: MermaidGraph,
  config: Partial<LayoutConfig> = {}
): { positions: Map<string, LayoutNode>; layers: string[][] } {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const positions = new Map<string, LayoutNode>();
  
  // 1. 拓扑排序 - 确定层级
  const layers = assignLayers(graph);
  
  // 1.5 减少交叉（Barycenter heuristic）
  minimizeCrossings(layers, graph, 3);
  
  // 2. 分配坐标
  assignCoordinates(layers, positions, cfg, graph);
  
  return { positions, layers };
}

/**
 * 使用 Barycenter 重新排序每一层节点以减少交叉
 */
function minimizeCrossings(layers: string[][], graph: MermaidGraph, iterations: number = 3) {
  // const nodeIndexInLayer = new Map<string, number>();
  const inMap = new Map<string, string[]>();
  const outMap = new Map<string, string[]>();

  graph.nodes.forEach(n => {
    inMap.set(n.id, []);
    outMap.set(n.id, []);
  });
  graph.edges.forEach(e => {
    const ins = inMap.get(e.to) || [];
    ins.push(e.from);
    inMap.set(e.to, ins);
    const outs = outMap.get(e.from) || [];
    outs.push(e.to);
    outMap.set(e.from, outs);
  });

  const reorderLayer = (layerIndex: number, fromPrev: boolean) => {
    const layer = layers[layerIndex];
    if (!layer || layer.length <= 1) return;
    // map neighbor positions
    const neighborLayer = fromPrev ? layers[layerIndex - 1] : layers[layerIndex + 1];
    const neighborIndex = new Map<string, number>();
    if (neighborLayer) {
      neighborLayer.forEach((id, idx) => neighborIndex.set(id, idx));
    }

    const barycenters = layer.map(id => {
      const neighbors = fromPrev ? (inMap.get(id) || []) : (outMap.get(id) || []);
      const indices = neighbors.map(nid => neighborIndex.get(nid)).filter(i => typeof i === 'number') as number[];
      if (indices.length === 0) return { id, bary: Number.POSITIVE_INFINITY };
      const sum = indices.reduce((a, b) => a + b, 0);
      return { id, bary: sum / indices.length };
    });

    barycenters.sort((a, b) => a.bary - b.bary || a.id.localeCompare(b.id));
    for (let i = 0; i < barycenters.length; i++) {
      layer[i] = barycenters[i].id;
    }
  };

  for (let it = 0; it < iterations; it++) {
    // top-down
    for (let i = 1; i < layers.length; i++) {
      reorderLayer(i, true);
    }
    // bottom-up
    for (let i = layers.length - 2; i >= 0; i--) {
      reorderLayer(i, false);
    }
  }
}

/**
 * 分配层级（基于 BFS）
 */
function assignLayers(graph: MermaidGraph): string[][] {
  const layers: string[][] = [];
  const visited = new Set<string>();
  const nodeLayer = new Map<string, number>();
  
  // 计算入度
  const inDegree = new Map<string, number>();
  const outEdges = new Map<string, string[]>();
  
  graph.nodes.forEach(node => {
    inDegree.set(node.id, 0);
    outEdges.set(node.id, []);
  });
  
  graph.edges.forEach(edge => {
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    const edges = outEdges.get(edge.from) || [];
    edges.push(edge.to);
    outEdges.set(edge.from, edges);
  });
  
  // 找到根节点（入度为 0）
  const roots = graph.nodes.filter(n => inDegree.get(n.id) === 0);
  
  if (roots.length === 0) {
    // 如果有环或没有根节点，随便选一个起点
    roots.push(graph.nodes[0]);
  }
  
  // BFS 分层
  let currentLayer: string[] = roots.map(n => n.id);
  let layerIndex = 0;
  
  while (currentLayer.length > 0) {
    // 记录当前层
    layers[layerIndex] = [...currentLayer];
    currentLayer.forEach(id => {
      visited.add(id);
      nodeLayer.set(id, layerIndex);
    });
    
    // 计算下一层
    const nextLayer = new Set<string>();
    currentLayer.forEach(nodeId => {
      const edges = outEdges.get(nodeId) || [];
      edges.forEach(targetId => {
        if (!visited.has(targetId)) {
          nextLayer.add(targetId);
        }
      });
    });
    
    currentLayer = Array.from(nextLayer);
    layerIndex++;
  }
  
  // 添加未访问的节点（孤立节点）
  const unvisited = graph.nodes.filter(n => !visited.has(n.id));
  if (unvisited.length > 0) {
    layers.push(unvisited.map(n => n.id));
  }
  
  return layers;
}

/**
 * 分配坐标
 */
function assignCoordinates(
  layers: string[][],
  positions: Map<string, LayoutNode>,
  config: LayoutConfig,
  graph: MermaidGraph
) {
  const isHorizontal = graph.direction === 'LR' || graph.direction === 'RL';
  const isReverse = graph.direction === 'RL' || graph.direction === 'BT';
  
  layers.forEach((layer, layerIndex) => {
    const layerSize = layer.length;
    
    // 计算每个节点的宽高
    const nodeDims = layer.map(nodeId => {
      const gnode = graph.nodes.find(n => n.id === nodeId)!;
      let width = config.nodeWidth;
      let height = config.nodeHeight;
      if (gnode.shape === 'diamond') {
        width = 120;
        height = 120;
      } else if (gnode.shape === 'circle') {
        width = height = 100;
      } else if (gnode.shape === 'parallelogram') {
        width = 160;
        height = 70;
      }
      return { id: nodeId, width, height };
    });

    // 计算这一层的总宽度（包含间距），便于居中
    const totalWidth = nodeDims.reduce((s, n) => s + n.width, 0) + Math.max(0, nodeDims.length - 1) * config.nodeSpacing;
    let offset = -totalWidth / 2;

    layer.forEach((nodeId, nodeIndex) => {
      const node = graph.nodes.find(n => n.id === nodeId)!;
      const dims = nodeDims[nodeIndex];
      
      // 根据形状确定宽高
      let width = config.nodeWidth;
      let height = config.nodeHeight;
      
      if (node.shape === 'diamond') {
        width = 120;
        height = 120;
      } else if (node.shape === 'circle') {
        width = height = 100;
      } else if (node.shape === 'parallelogram') {
        width = 160;
        height = 70;
      }
      
      // 计算坐标（居中对齐）
      let x, y;
      
      if (isHorizontal) {
        // 水平布局 (LR, RL)
        const actualLayerIndex = isReverse ? (layers.length - 1 - layerIndex) : layerIndex;
        y = (nodeIndex - (layerSize - 1) / 2) * config.nodeSpacing;
        x = actualLayerIndex * config.layerSpacing; // layer spacing along X
      } else {
        // 垂直布局 (TB, TD, BT)
        const actualLayerIndex = isReverse ? (layers.length - 1 - layerIndex) : layerIndex;
        x = offset + dims.width / 2; // x based on computed position
        offset += dims.width + config.nodeSpacing; // move offset for next node
        y = actualLayerIndex * config.layerSpacing;
      }
      
      positions.set(nodeId, { id: nodeId, x, y, width, height });
    });
  });
}
