import React, { useState } from 'react';
import { getMarkdownExample } from '../utils/markdownParser';
import { getUMLExample } from '../utils/umlParser';

interface MermaidDialogProps {
  value: string;
  onChange: (value: string) => void;
  onConfirm: (options: { enableBend: boolean; stylePreset: 'colorful' | 'serious'; curveStrength: number; inputMode: 'mermaid' | 'markdown' | 'uml' }) => void;
  onCancel: () => void;
}

const MermaidDialog: React.FC<MermaidDialogProps> = ({
  value,
  onChange,
  onConfirm,
  onCancel,
}) => {
  const [error, setError] = useState<string>('');
  const [enableBend, setEnableBend] = useState<boolean>(true);
  const [stylePreset, setStylePreset] = useState<'colorful' | 'serious'>('colorful');
  const [curveStrength, setCurveStrength] = useState<number>(0.7);
  const [inputMode, setInputMode] = useState<'mermaid' | 'markdown' | 'uml'>('mermaid');
  const [umlType, setUmlType] = useState<'class' | 'sequence' | 'activity'>('class');

  const handleConfirm = () => {
    if (!value.trim()) {
      const modeText = inputMode === 'mermaid' ? 'Mermaid 代码' : inputMode === 'markdown' ? 'Markdown 列表' : 'UML 代码';
      setError(`请输入 ${modeText}`);
      return;
    }
    setError('');
    onConfirm({ enableBend, stylePreset, curveStrength, inputMode });
  };

  const mermaidExampleCode = `graph TD
    A[开始] --> B{判断}
    B -->|是| C[处理]
    B -->|否| D[结束]
    C --> D`;

  const markdownExampleCode = getMarkdownExample();

  const useExample = () => {
    if (inputMode === 'uml') {
      onChange(getUMLExample(umlType));
    } else {
      onChange(inputMode === 'mermaid' ? mermaidExampleCode : markdownExampleCode);
    }
    setError('');
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          width: '600px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#1e293b' }}>
            导入流程图
          </h2>
          <button
            onClick={onCancel}
            style={{
              border: 'none',
              background: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#64748b',
              padding: '0',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* 标签切换 */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #e5e7eb' }}>
          <button
            onClick={() => {
              setInputMode('mermaid');
              onChange('');
              setError('');
            }}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              fontSize: '14px',
              fontWeight: inputMode === 'mermaid' ? 'bold' : 'normal',
              color: inputMode === 'mermaid' ? '#3b82f6' : '#64748b',
              cursor: 'pointer',
              borderBottom: inputMode === 'mermaid' ? '2px solid #3b82f6' : '2px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            Mermaid 语法
          </button>
          <button
            onClick={() => {
              setInputMode('markdown');
              onChange('');
              setError('');
            }}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              fontSize: '14px',
              fontWeight: inputMode === 'markdown' ? 'bold' : 'normal',
              color: inputMode === 'markdown' ? '#3b82f6' : '#64748b',
              cursor: 'pointer',
              borderBottom: inputMode === 'markdown' ? '2px solid #3b82f6' : '2px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            Markdown 列表
          </button>
          <button
            onClick={() => {
              setInputMode('uml');
              onChange('');
              setError('');
            }}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              fontSize: '14px',
              fontWeight: inputMode === 'uml' ? 'bold' : 'normal',
              color: inputMode === 'uml' ? '#3b82f6' : '#64748b',
              cursor: 'pointer',
              borderBottom: inputMode === 'uml' ? '2px solid #3b82f6' : '2px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            PlantUML
          </button>
        </div>

        {inputMode === 'mermaid' ? (
          <div style={{ marginBottom: '12px', color: '#475569', fontSize: '14px' }}>
            <p style={{ margin: '0 0 8px 0' }}>
              支持基本的 Mermaid 流程图语法：
            </p>
            <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '13px', color: '#64748b' }}>
              <li>节点：<code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '3px' }}>A[矩形]</code>, <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '3px' }}>B(圆角)</code>, <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '3px' }}>C{'{菱形}'}</code>, <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '3px' }}>D((圆形))</code></li>
              <li>连接：<code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '3px' }}>--&gt;</code>, <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '3px' }}>==&gt;</code>, <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '3px' }}>-..-&gt;</code></li>
              <li>标签：<code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '3px' }}>A --&gt;|标签| B</code></li>
            </ul>
          </div>
        ) : inputMode === 'markdown' ? (
          <div style={{ marginBottom: '12px', color: '#475569', fontSize: '14px' }}>
            <p style={{ margin: '0 0 8px 0' }}>
              使用缩进的 Markdown 列表自动生成流程图：
            </p>
            <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '13px', color: '#64748b' }}>
              <li>使用 <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '3px' }}>-</code> 或 <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '3px' }}>*</code> 开始列表项</li>
              <li>使用 2 个空格缩进表示子项目</li>
              <li>自动根据层级关系生成流程图</li>
              <li>第0层：圆角矩形，第1层：矩形，第2层+：圆形</li>
            </ul>
          </div>
        ) : (
          <div style={{ marginBottom: '12px', color: '#475569', fontSize: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <p style={{ margin: 0 }}>支持 PlantUML 语法（类图、序列图、活动图）：</p>
              <select
                value={umlType}
                onChange={(e) => setUmlType(e.target.value as any)}
                style={{
                  padding: '4px 8px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                <option value="class">类图</option>
                <option value="sequence">序列图</option>
                <option value="activity">活动图</option>
              </select>
            </div>
            <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '13px', color: '#64748b' }}>
              <li>类图：<code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '3px' }}>class A {'{'} ... {'}'}</code>, 关系：<code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '3px' }}>A --|&gt; B</code></li>
              <li>序列图：<code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '3px' }}>participant A</code>, <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '3px' }}>A -&gt; B: 消息</code></li>
              <li>活动图：<code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '3px' }}>:活动;</code>, <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '3px' }}>if (条件?) then</code></li>
            </ul>
          </div>
        )}

        <textarea
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setError('');
          }}
          placeholder={inputMode === 'mermaid' ? '输入 Mermaid 代码...' : inputMode === 'markdown' ? '输入 Markdown 列表...' : '输入 PlantUML 代码...'}
          style={{
            width: '100%',
            height: '300px',
            padding: '12px',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            fontSize: '14px',
            fontFamily: 'monospace',
            resize: 'vertical',
            outline: 'none',
            marginBottom: '12px',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#3b82f6';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#cbd5e1';
          }}
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
          <input
            type="checkbox"
            checked={enableBend}
            onChange={(e) => setEnableBend(e.target.checked)}
          />
          <span style={{ color: '#475569', fontSize: 13 }}>箭头弯曲 (可选)</span>
        </label>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
          <div>
            <label style={{ marginRight: 8, color: '#475569' }}>风格：</label>
            <label style={{ marginRight: 8 }}>
              <input type="radio" name="preset" value="colorful" checked={stylePreset === 'colorful'} onChange={() => setStylePreset('colorful')} /> 更彩
            </label>
            <label>
              <input type="radio" name="preset" value="serious" checked={stylePreset === 'serious'} onChange={() => setStylePreset('serious')} /> 更严肃
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ color: '#475569' }}>弯曲强度：</label>
            <input type="range" min={0} max={2} step={0.05} value={curveStrength} onChange={(e) => setCurveStrength(Number(e.target.value))} disabled={!enableBend} />
            <span style={{ width: 40, textAlign: 'right', color: '#475569' }}>{curveStrength.toFixed(2)}</span>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              borderRadius: '4px',
              fontSize: '14px',
              marginBottom: '12px',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
          <button
            onClick={useExample}
            style={{
              padding: '8px 16px',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              backgroundColor: 'white',
              color: '#475569',
              fontSize: '14px',
              cursor: 'pointer',
              fontWeight: '500',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f8fafc';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
            }}
          >
            使用示例
          </button>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={onCancel}
              style={{
                padding: '8px 16px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                backgroundColor: 'white',
                color: '#475569',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: '500',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f8fafc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
              }}
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: '#3b82f6',
                color: 'white',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: '500',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#2563eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#3b82f6';
              }}
            >
              生成流程图
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MermaidDialog;
