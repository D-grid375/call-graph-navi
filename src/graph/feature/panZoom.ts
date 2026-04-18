import { svg, viewport } from '../core/dom';
import { getTransform, setTransform } from '../core/state';
import { applyTransform } from '../core/viewport';

let isPanning = false;
let panStart = { x: 0, y: 0 };
let panOriginal = { x: 0, y: 0 };

/**
 * viewport 要素上での mousedown ハンドラ。
 * ノードやファイルヘッダの × ボタン上でのパン開始を抑止し、
 * クリック動作（選択・ファイル閉じ）を優先させる。
 *
 * @param event DOM の `mousedown` イベント
 */
export function handleViewportMouseDown(event: MouseEvent): void {
  // ノード上でのパン開始を抑止（通常クリックで選択動作を優先）
  const target = event.target as Element | null;
  if (target?.closest('.func-node, .file-remove-button, .node-remove-button')) {
    event.stopPropagation();
  }
}

/**
 * SVG 上での mousedown ハンドラ。
 * パン開始位置と現在の変換を記録し、パン状態に入る。
 *
 * @param event DOM の `mousedown` イベント
 */
export function handleSvgMouseDown(event: MouseEvent): void {
  isPanning = true;
  panStart = { x: event.clientX, y: event.clientY };
  const t = getTransform();
  panOriginal = { x: t.x, y: t.y };
}

/**
 * window の mousemove ハンドラ。
 * パン中であればマウス移動量を開始位置に加えて現在の変換を更新し、SVG に反映する。
 *
 * @param event DOM の `mousemove` イベント
 */
export function handleWindowMouseMove(event: MouseEvent): void {
  if (!isPanning) {
    return;
  }
  const t = getTransform();
  setTransform({
    x: panOriginal.x + (event.clientX - panStart.x),
    y: panOriginal.y + (event.clientY - panStart.y),
    scale: t.scale,
  });
  applyTransform();
}

/**
 * window の mouseup ハンドラ。
 * パン状態を終了する。
 */
export function handleWindowMouseUp(): void {
  isPanning = false;
}

/**
 * SVG 上での wheel ハンドラ（マウスホイールによるズーム）。
 * マウスカーソル位置を中心に `scale` を 0.9〜1.1 倍し、
 * ズーム倍率を [0.1, 5.0] にクランプした上で `x`/`y` を補正して、カーソル直下の点を固定する。
 *
 * @param event DOM の `wheel` イベント
 */
export function handleSvgWheel(event: WheelEvent): void {
  event.preventDefault();

  const delta = event.deltaY > 0 ? 0.9 : 1.1;
  const rect = svg.getBoundingClientRect();
  const mx = event.clientX - rect.left;
  const my = event.clientY - rect.top;
  const t = getTransform();
  const newScale = Math.max(0.1, Math.min(5, t.scale * delta));
  const factor = newScale / t.scale;

  setTransform({
    x: mx - (mx - t.x) * factor,
    y: my - (my - t.y) * factor,
    scale: newScale,
  });
  applyTransform();
}
