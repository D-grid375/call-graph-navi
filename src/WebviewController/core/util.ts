import { viewport, tooltip } from './dom';
import type { NodeVM, UiMode } from './types';

export const NODE_LABEL_MARGIN_LEFT = 12;
export const NODE_LABEL_MARGIN_RIGHT = 12;

/**
 * エッジの一意な ID（`${from}->${to}`）を生成する。
 *
 * @param from 出発ノードの ID
 * @param to 到着ノードの ID
 * @returns `from->to` 形式のエッジ ID
 */
export function makeEdgeId(from: string, to: string): string {
  return `${from}->${to}`;
}

/**
 * 関数名テキストから、ノード矩形の幅を見積もる。
 * 最低幅 80px を確保し、文字数 × 8px + 水平パディング で算出する。
 *
 * @param text ノードラベルに使う文字列
 * @returns 推定した幅（px）
 */
export function estimateWidth(text: string): number {
  return Math.max(80, text.length * 7 + NODE_LABEL_MARGIN_LEFT + NODE_LABEL_MARGIN_RIGHT);
}

/**
 * `NodeVM` の状態に応じた SVG class 属性文字列を組み立てる。
 * 常に `func-node` を付け、ルートなら `root`、選択中なら `selected` を追加する。
 *
 * @param node 対象のノード ViewModel
 * @returns 半角スペース区切りの class 文字列
 */
export function buildNodeClassName(node: NodeVM): string {
  const classNames = ['func-node'];
  if (node.isRoot) {
    classNames.push('root');
  }
  if (node.view.selected) {
    classNames.push('selected');
  }
  if (node.view.highlighted) {
    classNames.push('matched');
  }
  return classNames.join(' ');
}

/**
 * UI モードを情報ラベル用の表示文字列に変換する。
 *
 * @param mode 現在の UI モード
 * @returns ユーザ向けラベル文字列
 */
export function formatModeLabel(mode: UiMode): string {
  return 'Normal';
}

/**
 * SVG viewport 要素の子要素を全て削除し、ツールチップを非表示にする。
 * 再描画の前処理として呼ばれる。
 */
export function clearViewport(): void {
  while (viewport.firstChild) {
    viewport.removeChild(viewport.firstChild);
  }
  tooltip.classList.add('hidden');
}

/**
 * dagre が返す折れ線の点列を SVG `path` の `d` 属性に変換する。
 * 3 点以上の場合は角をクォータニック・ベジェ曲線で丸め（半径 5px）、
 * 隣接線分長に応じて曲線半径を縮めて折返しを自然に見せる。
 *
 * @param points `{ x, y }` 座標の配列（dagre の `edge().points`）
 * @returns SVG `path` 要素の `d` 属性値。空配列なら空文字列
 */
export function pointsToPath(points: Array<{ x: number; y: number }>): string {
  if (!points || points.length === 0) {
    return '';
  }

  if (points.length < 3) {
    let d = `M${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L${points[i].x},${points[i].y}`;
    }
    return d;
  }

  const R = 5;
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    const r = Math.min(R, len1 / 2, len2 / 2);
    const bx = curr.x - (dx1 / len1) * r;
    const by = curr.y - (dy1 / len1) * r;
    const ax = curr.x + (dx2 / len2) * r;
    const ay = curr.y + (dy2 / len2) * r;

    d += ` L${bx},${by} Q${curr.x},${curr.y} ${ax},${ay}`;
  }
  const last = points[points.length - 1];
  d += ` L${last.x},${last.y}`;
  return d;
}
