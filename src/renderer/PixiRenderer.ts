import * as PIXI from 'pixi.js';
import type {
  CanvasElement,
  ShapeElement,
  ImageElement,
  TextElement,
  TextRangeStyle,
} from '../types';
import { segmentTextWithStyles } from '../utils/textStyles';

export class PixiRenderer {
  private app: PIXI.Application | null = null;
  private elementSprites: Map<string, PIXI.Container> = new Map();
  private mainContainer: PIXI.Container;
  private initPromise: Promise<void>;

  constructor(canvas: HTMLCanvasElement) {
    this.mainContainer = new PIXI.Container();
    
    // 异步初始化
    this.initPromise = this.init(canvas);
  }

  private async init(canvas: HTMLCanvasElement): Promise<void> {
    try {
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      const app = new PIXI.Application();
      await app.init({
        canvas: canvas,
        backgroundColor: 0xffffff,
        width: width,
        height: height,
        antialias: true,
        resolution: dpr,
        autoDensity: true,
        preserveDrawingBuffer: true,
      });
      
      this.app = app;
      this.app.stage.addChild(this.mainContainer);
      // Ensure main container supports z-index ordering
      this.mainContainer.sortableChildren = true;
      
      // 强制一次 resize 以确保视口正确
      this.handleResize();

      if (!this.app.ticker.started) {
        this.app.ticker.start();
      }

      // Debug: verify extract plugin availability
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hasExtract = !!(this.app && (this.app.renderer as any).extract);
        console.log('PixiRenderer: extract plugin available=', hasExtract);
      } catch (err) {
        console.warn('PixiRenderer: error while checking extract plugin', err);
      }
      
      // 监听窗口大小变化
      window.addEventListener('resize', this.handleResize);
    } catch (err) {
      console.error('Failed to initialize PixiJS:', err);
    }
  }
  
  private handleResize = () => {
    if (!this.app) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.app.renderer.resize(width, height);
  };

  // 等待初始化完成
  public async waitForInit(): Promise<void> {
    await this.initPromise;
  }

  // 渲染单个元素
  public async renderElement(element: CanvasElement, parentContainer: PIXI.Container = this.mainContainer): Promise<void> {
    if (!this.app) return;
    
    // 如果元素已存在，先移除
    this.removeElement(element.id);

    let container: PIXI.Container;

    switch (element.type) {
      case 'rectangle':
      case 'rounded-rectangle':
      case 'circle':
      case 'triangle':
      case 'arrow':
        container = this.createShapeSprite(element as ShapeElement);
        break;
      case 'image':
        container = await this.createImageSprite(element as ImageElement);
        break;
      case 'text':
        container = this.createTextSprite(element as TextElement);
        break;
      case 'group':
        container = await this.createGroupSprite(element as any);
        break;
      default:
        return;
    }

    // 设置位置和旋转
    // 设置旋转中心点为元素中心
    container.pivot.set(element.width / 2, element.height / 2);
    // 位置设置为元素的中心点
    container.position.set(element.x + element.width / 2, element.y + element.height / 2);
    container.rotation = ((element.rotation || 0) * Math.PI) / 180;
    container.zIndex = element.zIndex;

    // 注意：不要为组合元素设置 width/height，会导致意外的缩放
    // 组的尺寸由子元素的边界框决定

    parentContainer.addChild(container);
    // Ensure parent container supports z-index ordering
    parentContainer.sortableChildren = true;
    parentContainer.sortableChildren = true; // 启用排序
    this.elementSprites.set(element.id, container);
    parentContainer.sortChildren();
  }

  // 创建组合精灵
  private async createGroupSprite(element: any): Promise<PIXI.Container> {
    const container = new PIXI.Container();
    // 渲染子元素
    if (element.children && Array.isArray(element.children)) {
      for (const child of element.children) {
        await this.renderElement(child, container);
      }
    }
    return container;
  }

  // 创建图形精灵
  private createShapeSprite(element: ShapeElement): PIXI.Container {
    const container = new PIXI.Container();
    const graphics = new PIXI.Graphics();
    let arrowHead: PIXI.Graphics | null = null;

    // 解析颜色
    const bgColor = this.parseColor(element.backgroundColor);
    const borderColor = this.parseColor(element.borderColor);

    // 绘制形状
    switch (element.type) {
      case 'rectangle':
        // 填充
        graphics.beginFill(bgColor);
        graphics.drawRect(0, 0, element.width, element.height);
        graphics.endFill();
        // 边框
        if (element.borderWidth > 0) {
          graphics.lineStyle(element.borderWidth, borderColor);
          graphics.drawRect(0, 0, element.width, element.height);
          graphics.stroke({ width: element.borderWidth, color: borderColor });
        }
        break;
      case 'rounded-rectangle':
        graphics.beginFill(bgColor);
        graphics.drawRoundedRect(
          0,
          0,
          element.width,
          element.height,
          element.cornerRadius || 10
        );
        graphics.endFill();
        if (element.borderWidth > 0) {
          graphics.lineStyle(element.borderWidth, borderColor);
          graphics.drawRoundedRect(
            0,
            0,
            element.width,
            element.height,
            element.cornerRadius || 10
          );
          graphics.stroke({ width: element.borderWidth, color: borderColor });
        }
        break;
      case 'circle':
        graphics.beginFill(bgColor);
        graphics.drawEllipse(element.width / 2, element.height / 2, element.width / 2, element.height / 2);
        graphics.endFill();
        if (element.borderWidth > 0) {
          graphics.lineStyle(element.borderWidth, borderColor);
          graphics.drawEllipse(element.width / 2, element.height / 2, element.width / 2, element.height / 2);
          graphics.stroke({ width: element.borderWidth, color: borderColor });
        }
        break;
      case 'triangle':
        graphics.beginFill(bgColor);
        graphics.moveTo(element.width / 2, 0);
        graphics.lineTo(element.width, element.height);
        graphics.lineTo(0, element.height);
        graphics.closePath();
        graphics.endFill();
        if (element.borderWidth > 0) {
          graphics.lineStyle(element.borderWidth, borderColor);
          graphics.moveTo(element.width / 2, 0);
          graphics.lineTo(element.width, element.height);
          graphics.lineTo(0, element.height);
          graphics.closePath();
          graphics.stroke({ width: element.borderWidth, color: borderColor });
        }
        break;
      case 'arrow': {
        const tailWidth = element.arrowTailWidth ?? element.borderWidth ?? 4;
        const start = element.arrowStart || { x: 0, y: element.height / 2 };
        const end = element.arrowEnd || { x: element.width, y: element.height / 2 };
        const headSize = element.arrowHeadSize || 16;
        const curve = element.arrowCurve ?? 0;

        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const normalX = -dy / distance;
        const normalY = dx / distance;
        const curveStrength = curve * distance * 0.5;
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;
        const hasCurve = Math.abs(curve) > 0.001;
        const controlPoint = hasCurve
          ? { x: midX + normalX * curveStrength, y: midY + normalY * curveStrength }
          : null;

        // Draw a soft glow/stroke underneath to reduce jagged edges (antialiasing aid)
        if (controlPoint) {
          const glow = new PIXI.Graphics();
          glow.lineStyle(tailWidth + 4, borderColor, 0.14);
          glow.moveTo(start.x, start.y);
          // compute two control points for cubic bezier for smoother curve
          const cp1 = { x: (start.x + midX) / 2 + normalX * curveStrength * 0.6, y: (start.y + midY) / 2 + normalY * curveStrength * 0.6 };
          const cp2 = { x: (midX + end.x) / 2 + normalX * curveStrength * 0.6, y: (midY + end.y) / 2 + normalY * curveStrength * 0.6 };
          glow.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
          container.addChild(glow);

          graphics.lineStyle(tailWidth, borderColor, 1);
          graphics.moveTo(start.x, start.y);
          graphics.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
          graphics.stroke({ width: tailWidth, color: borderColor, cap: 'round', join: 'round' });
        } else {
          // straight line
          const glow = new PIXI.Graphics();
          glow.lineStyle(tailWidth + 4, borderColor, 0.12);
          glow.moveTo(start.x, start.y);
          glow.lineTo(end.x, end.y);
          container.addChild(glow);

          graphics.lineStyle(tailWidth, borderColor, 1);
          graphics.moveTo(start.x, start.y);
          graphics.lineTo(end.x, end.y);
          graphics.stroke({ width: tailWidth, color: borderColor, cap: 'round', join: 'round' });
        }

        const tangentX = controlPoint ? end.x - controlPoint.x : dx;
        const tangentY = controlPoint ? end.y - controlPoint.y : dy;
        const tangentLength = Math.sqrt(tangentX * tangentX + tangentY * tangentY) || 1;
        const dirX = tangentX / tangentLength;
        const dirY = tangentY / tangentLength;
        const headLength = Math.max(headSize, tailWidth * 2);
        const headWidth = Math.max(headSize * 0.75, tailWidth * 1.5);
        const baseX = end.x - dirX * headLength;
        const baseY = end.y - dirY * headLength;
        const perpX = -dirY;
        const perpY = dirX;
        const leftPointX = baseX + perpX * (headWidth / 2);
        const leftPointY = baseY + perpY * (headWidth / 2);
        const rightPointX = baseX - perpX * (headWidth / 2);
        const rightPointY = baseY - perpY * (headWidth / 2);

        const head = new PIXI.Graphics();
        head.beginFill(borderColor);
        head.moveTo(end.x, end.y);
        head.lineTo(leftPointX, leftPointY);
        head.lineTo(rightPointX, rightPointY);
        head.closePath();
        head.endFill();
        arrowHead = head;
        break;
      }
    }

    container.addChild(graphics);
    if (arrowHead) {
      container.addChild(arrowHead);
    }

    // 如果图形带有内部文本，则渲染文本
    if ((element as any).content) {
      const content = (element as any).content as string;
      const styleObj = (element as any).textStyle as any;
      const rangeStyles = (element as any).textRangeStyles as TextRangeStyle[] | undefined;

      const baseStyle = {
        fontFamily: styleObj?.fontFamily || 'Arial',
        fontSize: styleObj?.fontSize || 16,
        color: styleObj?.color || '#000000',
        bold: styleObj?.bold || false,
        italic: styleObj?.italic || false,
        underline: styleObj?.underline || false,
        strikethrough: styleObj?.strikethrough || false,
      };

      const hasRangeStyles = rangeStyles && rangeStyles.length > 0;

      if (hasRangeStyles) {
        // 使用 segmentTextWithStyles 将文本拆分成多个段落
        const segments = segmentTextWithStyles(content, baseStyle, rangeStyles);
        
        const textContainer = new PIXI.Container();
        let currentX = 0;
        let currentY = 0;
        const lineHeight = (baseStyle.fontSize || 16) * 1.2;
        const maxWidth = element.width - 12;

        segments.forEach((segment) => {
          // 按字符逐个处理以支持换行
          for (let i = 0; i < segment.text.length; i++) {
            const char = segment.text[i];
            
            const textStyle = new PIXI.TextStyle({
              fontFamily: segment.style.fontFamily || 'Arial',
              fontSize: segment.style.fontSize || 16,
              fill: segment.style.color || 0x000000,
              fontWeight: segment.style.bold ? 'bold' : 'normal',
              fontStyle: segment.style.italic ? 'italic' : 'normal',
              wordWrap: false,
            });

            const text = new PIXI.Text(char, textStyle);
            text.resolution = Math.min(window.devicePixelRatio || 1, 2);
            
            // 检查是否需要换行
            if (currentX + text.width > maxWidth && currentX > 0) {
              currentX = 0;
              currentY += lineHeight;
            }
            
            text.x = currentX;
            text.y = currentY;
            textContainer.addChild(text);

            // 添加下划线和删除线
            if (segment.style.underline || segment.style.strikethrough) {
              const lineColor = this.parseColor(segment.style.color);
              const textWidth = text.width;
              const textHeight = text.height;

              if (segment.style.underline) {
                const underline = new PIXI.Graphics();
                underline.moveTo(currentX, currentY + textHeight - 2);
                underline.lineTo(currentX + textWidth, currentY + textHeight - 2);
                underline.stroke({ width: 2, color: lineColor });
                textContainer.addChild(underline);
              }

              if (segment.style.strikethrough) {
                const strikethrough = new PIXI.Graphics();
                const y = currentY + textHeight / 2;
                strikethrough.moveTo(currentX, y);
                strikethrough.lineTo(currentX + textWidth, y);
                strikethrough.stroke({ width: 2, color: lineColor });
                textContainer.addChild(strikethrough);
              }
            }

            // 更新水平位置
            currentX += text.width;
          }
        });

        // 居中显示整个文本容器
        textContainer.x = Math.max(0, (element.width - textContainer.width) / 2);
        textContainer.y = Math.max(0, (element.height - textContainer.height) / 2);
        container.addChild(textContainer);
      } else {
        // 没有范围样式，使用原来的单一样式渲染
        // 对于箭头，特殊处理文本位置以避免重叠
        const isArrow = element.type === 'arrow';
        
        const textStyle = new PIXI.TextStyle({
          fontFamily: styleObj?.fontFamily || 'Arial',
          fontSize: styleObj?.fontSize || 16,
          fill: styleObj?.color || 0x000000,
          fontWeight: styleObj?.bold ? 'bold' : 'normal',
          fontStyle: styleObj?.italic ? 'italic' : 'normal',
          align: 'center',
          wordWrap: !isArrow, // 箭头不启用自动换行
          wordWrapWidth: isArrow ? 500 : Math.max(10, element.width - 8), // 箭头使用更大的包装宽度
        });

        const text = new PIXI.Text(content, textStyle);
        text.resolution = Math.min(window.devicePixelRatio || 1, 2);
        
        if (isArrow) {
          // 对于箭头，根据曲率调整文本位置
          const curve = (element as any).arrowCurve ?? 0;
          const start = (element as any).arrowStart || { x: 0, y: element.height / 2 };
          const end = (element as any).arrowEnd || { x: element.width, y: element.height / 2 };
          
          // 计算箭头中点
          const midX = (start.x + end.x) / 2;
          const midY = (start.y + end.y) / 2;
          
          // 计算偏移方向（根据曲率）
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          const normalX = -dy / distance;
          const normalY = dx / distance;
          
          // 根据曲率放置文本（偏移到曲线外侧）
          const offsetDistance = Math.abs(curve) > 0.01 ? Math.abs(curve) * distance * 0.5 : 0;
          
          text.x = midX + normalX * offsetDistance - text.width / 2;
          text.y = midY + normalY * offsetDistance - text.height / 2;
        } else {
          // 非箭头：使用原来的居中方式
          text.style.wordWrapWidth = Math.max(10, element.width - 12);
          text.x = Math.max(0, (element.width - text.width) / 2);
          text.y = Math.max(0, (element.height - text.height) / 2);
        }
        
        container.addChild(text);
      }
    }

    return container;
  }

  // 创建图片精灵
  private async createImageSprite(element: ImageElement): Promise<PIXI.Container> {
    const container = new PIXI.Container();
    try {
      // Use Assets.load for both data URLs and remote URLs.
      const texture = await PIXI.Assets.load(element.src);
      const sprite = new PIXI.Sprite(texture);
      sprite.width = element.width;
      sprite.height = element.height;
      this.applyImageFilter(sprite, element.filter);
      container.addChild(sprite);
    } catch (error) {
      console.error('Failed to load image:', element.src.substring(0, 50), error);
      const errorGraphics = new PIXI.Graphics();
      errorGraphics.beginFill(0xcccccc);
      errorGraphics.drawRect(0, 0, element.width, element.height);
      errorGraphics.endFill();
      const errorText = new PIXI.Text('图片加载失败', new PIXI.TextStyle({ fontSize: 16, fill: 0x666666 }));
      errorText.x = element.width / 2 - errorText.width / 2;
      errorText.y = element.height / 2 - errorText.height / 2;
      container.addChild(errorGraphics);
      container.addChild(errorText);
    }
    return container;
  }

  // 应用图片滤镜
  private applyImageFilter(sprite: PIXI.Sprite, filter: string): void {
    const filters: PIXI.Filter[] = [];

    switch (filter) {
      case 'grayscale':
        const grayscaleFilter = new PIXI.ColorMatrixFilter();
        grayscaleFilter.desaturate();
        filters.push(grayscaleFilter);
        break;
      case 'sepia':
        const sepiaFilter = new PIXI.ColorMatrixFilter();
        sepiaFilter.sepia(true);
        filters.push(sepiaFilter);
        break;
      case 'blur':
        filters.push(new PIXI.BlurFilter(8));
        break;
    }

    if (filters.length > 0) {
      sprite.filters = filters;
    }
  }

  // 创建文本精灵
  private createTextSprite(element: TextElement): PIXI.Container {
    const container = new PIXI.Container();

    // 背景
    if (element.style.backgroundColor) {
      const bg = new PIXI.Graphics();
      const bgColor = this.parseColor(element.style.backgroundColor);
      bg.beginFill(bgColor);
      bg.drawRect(0, 0, element.width, element.height);
      bg.endFill();
      container.addChild(bg);
    }

    // 检查是否有范围样式
    const hasRangeStyles = element.rangeStyles && element.rangeStyles.length > 0;

    if (hasRangeStyles) {
      // 使用 segmentTextWithStyles 将文本拆分成多个段落
      const segments = segmentTextWithStyles(element.content, element.style, element.rangeStyles);
      
      let currentX = 0;
      let currentY = 0;
      const lineHeight = element.style.fontSize * 1.2; // 行高
      const maxWidth = element.width - 10;

      segments.forEach((segment) => {
        // 按字符逐个处理以支持换行
        for (let i = 0; i < segment.text.length; i++) {
          const char = segment.text[i];
          
          const style = new PIXI.TextStyle({
            fontFamily: segment.style.fontFamily,
            fontSize: segment.style.fontSize,
            fill: segment.style.color,
            fontWeight: segment.style.bold ? 'bold' : 'normal',
            fontStyle: segment.style.italic ? 'italic' : 'normal',
            wordWrap: false,
          });

          const text = new PIXI.Text({ text: char, style });
          text.resolution = Math.min(window.devicePixelRatio || 1, 2);
          
          // 检查是否需要换行
          if (currentX + text.width > maxWidth && currentX > 0) {
            currentX = 0;
            currentY += lineHeight;
          }
          
          text.x = currentX;
          text.y = currentY;
          container.addChild(text);

          // 添加下划线和删除线
          if (segment.style.underline || segment.style.strikethrough) {
            const lineColor = this.parseColor(segment.style.color);
            const textWidth = text.width;
            const textHeight = text.height;

            if (segment.style.underline) {
              const underline = new PIXI.Graphics();
              underline.moveTo(currentX, currentY + textHeight - 2);
              underline.lineTo(currentX + textWidth, currentY + textHeight - 2);
              underline.stroke({ width: 2, color: lineColor });
              container.addChild(underline);
            }

            if (segment.style.strikethrough) {
              const strikethrough = new PIXI.Graphics();
              const y = currentY + textHeight / 2;
              strikethrough.moveTo(currentX, y);
              strikethrough.lineTo(currentX + textWidth, y);
              strikethrough.stroke({ width: 2, color: lineColor });
              container.addChild(strikethrough);
            }
          }

          // 更新水平位置
          currentX += text.width;
        }
      });
    } else {
      // 没有范围样式，使用原来的单一样式渲染
      const style = new PIXI.TextStyle({
        fontFamily: element.style.fontFamily,
        fontSize: element.style.fontSize,
        fill: element.style.color,
        fontWeight: element.style.bold ? 'bold' : 'normal',
        fontStyle: element.style.italic ? 'italic' : 'normal',
        wordWrap: true,
        wordWrapWidth: element.width,
      });

      const text = new PIXI.Text({ text: element.content, style });
      text.resolution = Math.min(window.devicePixelRatio || 1, 2);
      container.addChild(text);

      // 添加下划线和删除线
      if (element.style.underline || element.style.strikethrough) {
        const lineColor = this.parseColor(element.style.color);
        const textWidth = text.width;
        const textHeight = text.height;

        if (element.style.underline) {
          const underline = new PIXI.Graphics();
          underline.moveTo(0, textHeight - 2);
          underline.lineTo(textWidth, textHeight - 2);
          underline.stroke({ width: 2, color: lineColor });
          container.addChild(underline);
        }

        if (element.style.strikethrough) {
          const strikethrough = new PIXI.Graphics();
          const y = textHeight / 2;
          strikethrough.moveTo(0, y);
          strikethrough.lineTo(textWidth, y);
          strikethrough.stroke({ width: 2, color: lineColor });
          container.addChild(strikethrough);
        }
      }
    }

    return container;
  }


  // 移除元素
  public removeElement(id: string): void {
    const sprite = this.elementSprites.get(id);
    if (sprite) {
      if (sprite.parent) {
        sprite.parent.removeChild(sprite);
      }
      sprite.destroy({ children: true });
      this.elementSprites.delete(id);
    }
  }

  // 高性能更新元素位置、旋转等属性（不重新渲染内容）
  public updateElementTransform(element: CanvasElement): void {
    const sprite = this.elementSprites.get(element.id);
    if (!sprite) return;

    // 更新位置（中心点）
    sprite.position.set(element.x + element.width / 2, element.y + element.height / 2);
    
    // 更新旋转
    sprite.rotation = ((element.rotation || 0) * Math.PI) / 180;
    
    // 更新 z-index
    sprite.zIndex = element.zIndex;
    
    // 如果有父容器且支持排序，需要重新排序
    if (sprite.parent && sprite.parent.sortableChildren) {
      sprite.parent.sortChildren();
    }
  }

  // 批量更新多个元素的转换属性
  public updateElementsTransform(elements: CanvasElement[]): void {
    const parents = new Set<PIXI.Container>();
    
    for (const element of elements) {
      this.updateElementTransform(element);
      const sprite = this.elementSprites.get(element.id);
      if (sprite && sprite.parent) {
        parents.add(sprite.parent);
      }
    }
    
    // 一次性对所有受影响的父容器重新排序
    parents.forEach(parent => {
      if (parent.sortableChildren) {
        parent.sortChildren();
      }
    });
  }

  // 更新视口
  public updateViewport(x: number, y: number, scale: number): void {
    this.mainContainer.position.set(x, y);
    this.mainContainer.scale.set(scale, scale);
  }

  // 清空画布
  public clear(): void {
    this.elementSprites.forEach((sprite) => {
      this.mainContainer.removeChild(sprite);
      sprite.destroy({ children: true });
    });
    this.elementSprites.clear();
  }

  // 获取 PIXI Application
  public getApp(): PIXI.Application | null {
    return this.app;
  }

  // 获取主容器
  public getMainContainer(): PIXI.Container {
    return this.mainContainer;
  }

  // 导出选中的元素
  public async exportSelectedElements(
    selectedIds: string[],
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    padding = 24
  ): Promise<HTMLCanvasElement> {
    if (!this.app) throw new Error('Renderer not initialized');

    const tempContainer = new PIXI.Container();
    const spritesToExport: PIXI.Container[] = [];
    
    // 1. 收集选中的 Sprite
    selectedIds.forEach(id => {
      const sprite = this.elementSprites.get(id);
      if (sprite) {
        spritesToExport.push(sprite);
      }
    });

    if (spritesToExport.length === 0) {
      throw new Error('No elements to export');
    }

    // 2. 临时移动 Sprite 到 tempContainer
    // 注意：这会从 mainContainer 移除它们
    spritesToExport.forEach(sprite => {
      tempContainer.addChild(sprite);
    });
    
    // 3. 调整 tempContainer 位置，使内容居中并留出 padding
    // bounds 是世界坐标，tempContainer 默认在 (0,0)
    // 我们希望 bounds.minX, bounds.minY 对应到 padding, padding
    tempContainer.position.set(-bounds.minX + padding, -bounds.minY + padding);
    
    // 4. 生成 Texture / Canvas
    const width = Math.ceil(bounds.maxX - bounds.minX + padding * 2);
    const height = Math.ceil(bounds.maxY - bounds.minY + padding * 2);
    
    // 使用 RenderTexture 渲染，不受屏幕视口影响
    const renderTexture = PIXI.RenderTexture.create({
      width,
      height,
      resolution: 2, // 导出 2x 清晰度
    });
    
    this.app.renderer.render({
        container: tempContainer,
        target: renderTexture
    });
    
    // 提取 Canvas
    const canvas = (this.app.renderer as any).extract.canvas(renderTexture);
    
    // 5. 还原 Sprite 到 mainContainer
    spritesToExport.forEach(sprite => {
      this.mainContainer.addChild(sprite);
    });
    this.mainContainer.sortChildren();
    
    // 清理
    renderTexture.destroy(true);
    tempContainer.destroy();
    
    return canvas;
  }

  // 导出裁剪区域为 HTMLCanvasElement，bounds 使用世界坐标（和元素坐标相同的单位）
  public exportCroppedCanvas(bounds: { minX: number; minY: number; maxX: number; maxY: number }, padding = 24): HTMLCanvasElement {
    if (!this.app) {
      throw new Error('PixiRenderer: app not initialized');
    }

    const renderer = this.app.renderer as any;
    const view = renderer.view as HTMLCanvasElement;
    const resolution = renderer.resolution || window.devicePixelRatio || 1;

    const scale = this.mainContainer.scale.x || 1;
    const offsetX = this.mainContainer.position.x || 0;
    const offsetY = this.mainContainer.position.y || 0;

    const minScreenX = bounds.minX * scale + offsetX;
    const minScreenY = bounds.minY * scale + offsetY;
    const maxScreenX = bounds.maxX * scale + offsetX;
    const maxScreenY = bounds.maxY * scale + offsetY;

    const paddedMinX = Math.max(0, Math.floor((Math.min(minScreenX, maxScreenX) - padding) * resolution));
    const paddedMinY = Math.max(0, Math.floor((Math.min(minScreenY, maxScreenY) - padding) * resolution));
    const paddedMaxX = Math.min(view.width, Math.ceil((Math.max(minScreenX, maxScreenX) + padding) * resolution));
    const paddedMaxY = Math.min(view.height, Math.ceil((Math.max(minScreenY, maxScreenY) + padding) * resolution));

    const cropWidth = Math.max(1, paddedMaxX - paddedMinX);
    const cropHeight = Math.max(1, paddedMaxY - paddedMinY);

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = cropWidth;
    exportCanvas.height = cropHeight;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) throw new Error('PixiRenderer.exportCroppedCanvas: cannot create 2D context');

    try {
      ctx.drawImage(view, paddedMinX, paddedMinY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    } catch (err) {
      console.error('PixiRenderer.exportCroppedCanvas drawImage error', err, { paddedMinX, paddedMinY, cropWidth, cropHeight, viewWidth: view.width, viewHeight: view.height });
      throw err;
    }

    return exportCanvas;
  }

  // 解析颜色字符串到数字
  private parseColor(color: string): number {
    if (color.startsWith('#')) {
      return parseInt(color.slice(1), 16);
    }
    if (color.startsWith('rgb')) {
      const matches = color.match(/\d+/g);
      if (matches && matches.length >= 3) {
        const r = parseInt(matches[0]);
        const g = parseInt(matches[1]);
        const b = parseInt(matches[2]);
        return (r << 16) | (g << 8) | b;
      }
    }
    return 0x000000;
  }

  // 销毁渲染器
  public destroy(): void {
    window.removeEventListener('resize', this.handleResize);
    this.clear();
    if (this.app) {
      this.app.destroy(false, { children: true });
    }
  }

  // 手动触发渲染
  public render(): void {
    if (this.app) {
      this.app.render();
    }
  }
}
