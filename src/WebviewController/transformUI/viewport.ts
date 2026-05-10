import { svg, viewport } from '../dom/dom';

export interface Transform {
  x: number;
  y: number;
  scale: number;
}

let currentTransform: Transform = { x: 0, y: 0, scale: 1 };
let persistStateCallback: (() => void) | undefined;
let layoutPositions: Map<string, { x: number; y: number }> = new Map(); // ノードIDから、そのノードの描画位置を引くためのMap

export function setTransformPersistStateCallback(callback: () => void): void {
  persistStateCallback = callback;
}

export function getTransform(): Transform {
  return currentTransform;
}

export function setTransform(t: Transform): void {
  // Transform値を更新
  currentTransform = t;
  persistStateCallback?.();

  // DOMにTransform値を反映
  viewport.setAttribute(
    'transform',
    `translate(${currentTransform.x},${currentTransform.y}) scale(${currentTransform.scale})`
  );
}

export function getLayoutPosition(nodeId: string): { x: number; y: number } | undefined {
  return layoutPositions.get(nodeId);
}

export function setLayoutPositions(positions: Map<string, { x: number; y: number }>): void {
  layoutPositions = positions;
}

/**
 * ビューポート変換を初期状態（原点・等倍）に戻して SVG に反映する。
 * 再描画完了直後や Reset ボタン押下時に呼ばれる。
 */
export function resetView(): void {
  setTransform({ x: 0, y: 0, scale: 1 });
}

/**
 * 指定ノードを画面中央に来るようにビューポート変換を更新する。
 * スケールは現状維持。`setLayoutPositions` で登録済みのノードのみ対象。
 *
 * @param nodeId 対象ノード ID
 */
export function centerOnNode(nodeId: string): void {
  const pos = getLayoutPosition(nodeId);
  if (!pos) {
    return;
  }
  const rect = svg.getBoundingClientRect();
  const { scale } = getTransform();
  setTransform({
    x: rect.width / 2 - pos.x * scale,
    y: rect.height / 2 - pos.y * scale,
    scale,
  });
}
