import { ShapeVal, LayerVal } from '../core/components.js';
import type { ShapeType } from '../types/index.js';

export function shapeTypeToVal(shape: ShapeType): ShapeVal {
  switch (shape) {
    case 'rect': return ShapeVal.Rect;
    case 'circle': return ShapeVal.Circle;
    case 'triangle': return ShapeVal.Triangle;
    case 'diamond': return ShapeVal.Diamond;
    case 'hexagon': return ShapeVal.Hexagon;
    case 'arrow': return ShapeVal.Arrow;
    default: return ShapeVal.Rect;
  }
}

/** hex 颜色字符串 → RGB 分量 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** YAML layer 字符串 → LayerVal 数字 */
export function layerStrToVal(layer: string): LayerVal {
  switch (layer) {
    case 'Ground': return LayerVal.Ground;
    case 'LowAir': return LayerVal.LowAir;
    case 'BelowGrid': return LayerVal.BelowGrid;
    case 'Abyss': return LayerVal.Abyss;
    case 'Space': return LayerVal.Space;
    default: return LayerVal.AboveGrid;
  }
}
