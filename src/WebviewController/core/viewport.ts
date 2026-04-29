import { svg, viewport } from './dom';
import { getLayoutPosition, getTransform, setTransform } from './state';

/**
 * `state.ts` が保持する現在の `Transform` を SVG `viewport` 要素の
 * `transform="translate(x,y) scale(s)"` 属性として反映する。
 * パン・ズーム操作やリセット後に呼び出される。
 */
export function applyTransform(): void {
  const t = getTransform();
  viewport.setAttribute(
    'transform',
    `translate(${t.x},${t.y}) scale(${t.scale})`
  );
}

/**
 * ビューポート変換を初期状態（原点・等倍）に戻して SVG に反映する。
 * 再描画完了直後や Reset ボタン押下時に呼ばれる。
 */
export function resetView(): void {
  setTransform({ x: 0, y: 0, scale: 1 });
  applyTransform();
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
  applyTransform();
}
