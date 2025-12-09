import type { TextStyle, TextRangeStyle } from '../types';

/**
 * 文本范围与样式的组合
 */
export interface TextSegment {
  text: string;
  style: TextStyle;
  start: number;
  end: number;
}

/**
 * 将文本和范围样式拆分成多个段落，每个段落有一致的样式
 */
export const segmentTextWithStyles = (
  content: string,
  baseStyle: TextStyle,
  rangeStyles?: TextRangeStyle[]
): TextSegment[] => {
  if (!rangeStyles || rangeStyles.length === 0) {
    return [
      {
        text: content,
        style: baseStyle,
        start: 0,
        end: content.length,
      },
    ];
  }

  const segments: TextSegment[] = [];
  const positions: Set<number> = new Set([0, content.length]);

  // 收集所有分割点
  rangeStyles.forEach((range) => {
    positions.add(Math.max(0, range.start));
    positions.add(Math.min(content.length, range.end));
  });

  const sortedPositions = Array.from(positions).sort((a, b) => a - b);

  // 为每个段落计算样式
  for (let i = 0; i < sortedPositions.length - 1; i++) {
    const start = sortedPositions[i];
    const end = sortedPositions[i + 1];
    const text = content.substring(start, end);

    if (text.length === 0) continue;

    // 合并该范围内的所有样式
    let segmentStyle: TextStyle = { ...baseStyle };

    rangeStyles.forEach((range) => {
      // 检查当前段落是否与样式范围重叠（而不仅仅是完全包含）
      if (!(range.end <= start || range.start >= end)) {
        // 这个段落与样式范围重叠，应用样式
        segmentStyle = {
          ...segmentStyle,
          ...Object.fromEntries(
            Object.entries(range).filter(([key]) => key !== 'start' && key !== 'end')
          ),
        };
      }
    });

    segments.push({
      text,
      style: segmentStyle,
      start,
      end,
    });
  }

  return segments.length > 0
    ? segments
    : [
        {
          text: content,
          style: baseStyle,
          start: 0,
          end: content.length,
        },
      ];
};

/**
 * 应用范围样式到基础样式
 */
export const mergeTextStyle = (
  baseStyle: TextStyle,
  rangeStyles: Partial<TextStyle>[]
): TextStyle => {
  let merged = { ...baseStyle };

  rangeStyles.forEach((rangeStyle) => {
    merged = {
      ...merged,
      ...Object.fromEntries(
        Object.entries(rangeStyle).filter(([, value]) => value !== undefined)
      ),
    };
  });

  return merged;
};
