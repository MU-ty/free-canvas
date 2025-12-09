import React, { useEffect, useRef } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  onBringToFront?: () => void;
  onSendToBack?: () => void;
  onBringForward?: () => void;
  onSendBackward?: () => void;
  onClose: () => void;
  hasSelection: boolean;
  canGroup?: boolean;
  canUngroup?: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  onCopy,
  onPaste,
  onDelete,
  onGroup,
  onUngroup,
  onBringToFront,
  onSendToBack,
  onBringForward,
  onSendBackward,
  onClose,
  hasSelection,
  canGroup,
  canUngroup,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Ignore right-click release so the menu can appear
      if (e.button === 2) {
        return;
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: x,
    top: y,
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    padding: '4px',
    minWidth: '160px',
    zIndex: 10000,
  };

  const menuItemStyle: React.CSSProperties = {
    padding: '8px 12px',
    cursor: 'pointer',
    borderRadius: '4px',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'background-color 0.1s',
  };

  const disabledStyle: React.CSSProperties = {
    ...menuItemStyle,
    cursor: 'not-allowed',
    opacity: 0.5,
  };

  const handleItemClick = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div ref={menuRef} style={menuStyle}>
      <div
        style={hasSelection ? menuItemStyle : disabledStyle}
        onMouseEnter={(e) => {
          if (hasSelection) {
            e.currentTarget.style.backgroundColor = '#f3f4f6';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        onClick={() => hasSelection && handleItemClick(onCopy)}
      >
        <span>📋</span>
        <span>复制</span>
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#9ca3af' }}>Ctrl+C</span>
      </div>

      <div
        style={menuItemStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f3f4f6';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        onClick={() => handleItemClick(onPaste)}
      >
        <span>📄</span>
        <span>粘贴</span>
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#9ca3af' }}>Ctrl+V</span>
      </div>

      <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '4px 0' }} />

      {onGroup && (
        <div
          style={canGroup ? menuItemStyle : disabledStyle}
          onMouseEnter={(e) => {
            if (canGroup) {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          onClick={() => canGroup && handleItemClick(onGroup)}
        >
          <span>🔗</span>
          <span>组合</span>
          <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#9ca3af' }}>Ctrl+G</span>
        </div>
      )}

      {onBringToFront && (
        <div
          style={hasSelection ? menuItemStyle : disabledStyle}
          onMouseEnter={(e) => {
            if (hasSelection) e.currentTarget.style.backgroundColor = '#f3f4f6';
          }}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          onClick={() => hasSelection && onBringToFront && handleItemClick(onBringToFront)}
        >
          <span>⬆️</span>
          <span>置顶</span>
        </div>
      )}

      {onSendToBack && (
        <div
          style={hasSelection ? menuItemStyle : disabledStyle}
          onMouseEnter={(e) => {
            if (hasSelection) e.currentTarget.style.backgroundColor = '#f3f4f6';
          }}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          onClick={() => hasSelection && onSendToBack && handleItemClick(onSendToBack)}
        >
          <span>⬇️</span>
          <span>置底</span>
        </div>
      )}

      {onBringForward && (
        <div
          style={hasSelection ? menuItemStyle : disabledStyle}
          onMouseEnter={(e) => {
            if (hasSelection) e.currentTarget.style.backgroundColor = '#f3f4f6';
          }}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          onClick={() => hasSelection && onBringForward && handleItemClick(onBringForward)}
        >
          <span>🔼</span>
          <span>上移一层</span>
        </div>
      )}

      {onSendBackward && (
        <div
          style={hasSelection ? menuItemStyle : disabledStyle}
          onMouseEnter={(e) => {
            if (hasSelection) e.currentTarget.style.backgroundColor = '#f3f4f6';
          }}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          onClick={() => hasSelection && onSendBackward && handleItemClick(onSendBackward)}
        >
          <span>🔽</span>
          <span>下移一层</span>
        </div>
      )}

      {onUngroup && (
        <div
          style={canUngroup ? menuItemStyle : disabledStyle}
          onMouseEnter={(e) => {
            if (canUngroup) {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          onClick={() => canUngroup && handleItemClick(onUngroup)}
        >
          <span>🔓</span>
          <span>取消组合</span>
          <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#9ca3af' }}>Ctrl+Shift+G</span>
        </div>
      )}

      <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '4px 0' }} />

      <div
        style={hasSelection ? menuItemStyle : disabledStyle}
        onMouseEnter={(e) => {
          if (hasSelection) {
            e.currentTarget.style.backgroundColor = '#fef2f2';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        onClick={() => hasSelection && handleItemClick(onDelete)}
      >
        <span>🗑️</span>
        <span style={{ color: hasSelection ? '#ef4444' : 'inherit' }}>删除</span>
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#9ca3af' }}>Del</span>
      </div>
    </div>
  );
};
