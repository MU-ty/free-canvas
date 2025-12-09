import type { CanvasState } from '../types';

const STORAGE_KEY = 'canvas-editor-state';

// 保存画布状态到 localStorage
export const saveCanvasState = (state: CanvasState): void => {
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (error) {
    console.error('Failed to save canvas state:', error);
  }
};

// 从 localStorage 加载画布状态
export const loadCanvasState = (): CanvasState | null => {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (!serialized) {
      return null;
    }
    const state = JSON.parse(serialized) as CanvasState;
    // 验证数据结构
    if (!state.elements || !Array.isArray(state.elements)) {
      console.warn('Invalid canvas state, clearing storage');
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return state;
  } catch (error) {
    console.error('Failed to load canvas state:', error);
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

// 清除存储的画布状态
export const clearCanvasState = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear canvas state:', error);
  }
};
