/**
 * PlantUML 解析器 - 支持基础的 UML 语法
 * 主要支持：类图、序列图、活动图等
 */

import type { MermaidGraph, MermaidNode, MermaidEdge } from './mermaidParser';

export interface UMLClass {
  name: string;
  attributes: string[];
  methods: string[];
}

export interface UMLRelation {
  from: string;
  to: string;
  type: 'inheritance' | 'composition' | 'aggregation' | 'association' | 'dependency';
  label?: string;
}

/**
 * 解析 PlantUML 代码为通用图结构
 */
export function parseUMLToGraph(umlCode: string): MermaidGraph {
  const lines = umlCode.trim().split(/\r?\n/);
  const nodes: MermaidNode[] = [];
  const edges: MermaidEdge[] = [];
  
  let inClassDef = false;
  let currentClass: { name: string; content: string[] } | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 跳过空行和注释
    if (!line || line.startsWith("'") || line.startsWith('//')) continue;
    
    // 跳过 @startuml 和 @enduml
    if (line.startsWith('@startuml') || line.startsWith('@enduml')) continue;
    
    // 解析类定义
    const classMatch = line.match(/^class\s+(\w+)\s*\{?$/);
    if (classMatch) {
      currentClass = { name: classMatch[1], content: [] };
      inClassDef = !line.includes('}');
      if (!inClassDef && currentClass) {
        // 单行类定义
        nodes.push({
          id: currentClass.name,
          label: currentClass.name,
          shape: 'rectangle',
        });
        currentClass = null;
      }
      continue;
    }
    
    // 类定义结束
    if (inClassDef && line.includes('}')) {
      inClassDef = false;
      if (currentClass) {
        // 创建类节点
        const content = currentClass.content.length > 0 
          ? `${currentClass.name}\n${currentClass.content.slice(0, 3).join('\n')}${currentClass.content.length > 3 ? '\n...' : ''}`
          : currentClass.name;
        
        nodes.push({
          id: currentClass.name,
          label: content,
          shape: 'rectangle',
        });
        currentClass = null;
      }
      continue;
    }
    
    // 收集类内容
    if (inClassDef && currentClass) {
      currentClass.content.push(line);
      continue;
    }
    
    // 解析关系（类图）
    // 继承: --|> 或 <|--
    // 组合: --* 或 *--
    // 聚合: --o 或 o--
    // 关联: --> 或 --
    // 依赖: ..> 或 ..|>
    
    const relationPatterns = [
      { regex: /(\w+)\s*<\|-+\s*(\w+)/, type: 'inheritance' as const, reversed: true },
      { regex: /(\w+)\s*-+\|>\s*(\w+)/, type: 'inheritance' as const, reversed: false },
      { regex: /(\w+)\s*\*-+\s*(\w+)/, type: 'composition' as const, reversed: true },
      { regex: /(\w+)\s*-+\*\s*(\w+)/, type: 'composition' as const, reversed: false },
      { regex: /(\w+)\s*o-+\s*(\w+)/, type: 'aggregation' as const, reversed: true },
      { regex: /(\w+)\s*-+o\s*(\w+)/, type: 'aggregation' as const, reversed: false },
      { regex: /(\w+)\s*-+>\s*(\w+)(?:\s*:\s*(.+))?/, type: 'association' as const, reversed: false },
      { regex: /(\w+)\s*<-+\s*(\w+)(?:\s*:\s*(.+))?/, type: 'association' as const, reversed: true },
      { regex: /(\w+)\s*\.+\|?>\s*(\w+)(?:\s*:\s*(.+))?/, type: 'dependency' as const, reversed: false },
      { regex: /(\w+)\s*-+\s*(\w+)(?:\s*:\s*(.+))?/, type: 'association' as const, reversed: false },
    ];
    
    let matched = false;
    for (const pattern of relationPatterns) {
      const match = line.match(pattern.regex);
      if (match) {
        const from = pattern.reversed ? match[2] : match[1];
        const to = pattern.reversed ? match[1] : match[2];
        const label = match[3] || '';
        
        // 确保节点存在
        if (!nodes.find(n => n.id === from)) {
          nodes.push({ id: from, label: from, shape: 'rectangle' });
        }
        if (!nodes.find(n => n.id === to)) {
          nodes.push({ id: to, label: to, shape: 'rectangle' });
        }
        
        // 根据关系类型选择箭头样式
        const edgeType = pattern.type === 'dependency' ? 'dotted' : 
                        pattern.type === 'inheritance' ? 'thick' : 'arrow';
        
        edges.push({
          from,
          to,
          label: label.trim(),
          type: edgeType,
        });
        
        matched = true;
        break;
      }
    }
    
    if (matched) continue;
    
    // 解析序列图参与者（支持中文）
    const participantMatch = line.match(/^(?:participant|actor)\s+(.+?)(?:\s+as\s+"([^"]+)")?$/);
    if (participantMatch) {
      const id = participantMatch[1].trim();
      const label = participantMatch[2] || participantMatch[1].trim();
      const shape = line.startsWith('actor') ? 'circle' : 'rectangle';
      
      if (!nodes.find(n => n.id === id)) {
        nodes.push({ id, label, shape });
      }
      continue;
    }
    
    // 解析序列图消息（支持中文，支持 -> 和 --> 等）
    const messageMatch = line.match(/(.+?)\s*(-+>|<-+|-+<>|-+<|<-+>)\s*(.+?)(?:\s*:\s*(.+))?$/);
    if (messageMatch) {
      let from = messageMatch[1].trim();
      let to = messageMatch[3].trim();
      const arrow = messageMatch[2];
      const label = messageMatch[4] || '';
      
      // 如果是反向箭头，交换 from 和 to
      if (arrow.startsWith('<') && !arrow.includes('>')) {
        [from, to] = [to, from];
      }
      
      // 确保节点存在
      if (!nodes.find(n => n.id === from)) {
        nodes.push({ id: from, label: from, shape: 'rectangle' });
      }
      if (!nodes.find(n => n.id === to)) {
        nodes.push({ id: to, label: to, shape: 'rectangle' });
      }
      
      edges.push({
        from,
        to,
        label: label.trim(),
        type: 'arrow',
      });
      continue;
    }
    
    // 解析活动图节点
    const activityMatch = line.match(/^:([^;:]+);$/);
    if (activityMatch) {
      const label = activityMatch[1].trim();
      const id = `activity_${nodes.length}`;
      nodes.push({
        id,
        label,
        shape: 'rounded',
      });
      
      // 自动连接到前一个节点
      if (nodes.length > 1) {
        const prevNode = nodes[nodes.length - 2];
        edges.push({
          from: prevNode.id,
          to: id,
          type: 'arrow',
        });
      }
      continue;
    }
    
    // 解析活动图开始/结束
    if (line === 'start' || line === '(*)') {
      const id = 'start';
      if (!nodes.find(n => n.id === id)) {
        nodes.push({ id, label: '开始', shape: 'circle' });
      }
      continue;
    }
    
    if (line === 'stop' || line === 'end') {
      const id = 'end';
      if (!nodes.find(n => n.id === id)) {
        nodes.push({ id, label: '结束', shape: 'circle' });
      }
      
      // 连接最后一个活动到结束节点
      if (nodes.length > 1) {
        const lastActivity = nodes[nodes.length - 2];
        edges.push({
          from: lastActivity.id,
          to: id,
          type: 'arrow',
        });
      }
      continue;
    }
    
    // 解析活动图条件分支
    const ifMatch = line.match(/^if\s*\(([^)]+)\)\s*then$/);
    if (ifMatch) {
      const label = ifMatch[1];
      const id = `decision_${nodes.length}`;
      nodes.push({
        id,
        label,
        shape: 'diamond',
      });
      
      // 连接到前一个节点
      if (nodes.length > 1) {
        const prevNode = nodes[nodes.length - 2];
        edges.push({
          from: prevNode.id,
          to: id,
          type: 'arrow',
        });
      }
      continue;
    }
  }
  
  if (nodes.length === 0) {
    throw new Error('未找到有效的 UML 定义');
  }
  
  return {
    direction: 'TB',
    nodes,
    edges,
  };
}

/**
 * 生成 PlantUML 示例代码
 */
export function getUMLExample(type: 'class' | 'sequence' | 'activity' = 'class'): string {
  switch (type) {
    case 'class':
      return `@startuml
class User {
  -name: string
  -email: string
  +login()
  +logout()
}

class Order {
  -id: number
  -total: number
  +calculate()
}

class Product {
  -name: string
  -price: number
}

User --> Order : places
Order --> Product : contains
@enduml`;

    case 'sequence':
      return `@startuml
participant 用户
participant 系统
participant 数据库

用户 -> 系统: 登录请求
系统 -> 数据库: 查询用户
数据库 -> 系统: 返回用户信息
系统 -> 用户: 登录成功
@enduml`;

    case 'activity':
      return `@startuml
start
:用户登录;
:验证身份;
if (验证成功?) then
  :显示主页;
else
  :显示错误;
endif
:结束;
stop
@enduml`;

    default:
      return getUMLExample('class');
  }
}
