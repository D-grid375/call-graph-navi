import { renderGraph } from './render';
import { getUiState, getViewModel } from '../core/state';
import { exportPlantUmlToClipboard } from './export/exportPlantUml';

/**
 * Show All ボタン押下時の処理。
 * 全ノード・全エッジを `visible` にしてグラフを再描画する。
 * ViewModel 未ロード時は何もしない。
 */
export function showAllNodes(): void {
  const vm = getViewModel();
  if (!vm) {
    return;
  }
  setAllVisibility('visible');
  renderGraph(false);
}

/**
 * Hide All ボタン押下時の処理。
 * ルートノード以外のすべてのノードと全エッジを `hidden` にしてグラフを再描画する。
 * ViewModel 未ロード時は何もしない。
 */
export function hideAllNodes(): void {
  const vm = getViewModel();
  if (!vm) {
    return;
  }
  setAllHiddenExceptRoot();
  renderGraph(false);
}

/**
 * Export PlantUML ボタン押下時の処理。
 * 現在表示中のグラフを PlantUML テキストに変換し、
 * Extension Host 経由でクリップボードに書き込ませる（通知は Extension Host 側で表示）。
 * ViewModel 未ロード時は何もしない。
 */
export function exportPlantUml(): void {
  const vm = getViewModel();
  if (!vm) {
    return;
  }
  exportPlantUmlToClipboard();
}

/**
 * 全ノード・全エッジの `visibility` を指定値に一括設定する内部ヘルパー。
 *
 * @param visibility 設定したい可視状態（`'visible'` または `'hidden'`）
 */
function setAllVisibility(visibility: 'visible' | 'hidden'): void {
  const vm = getViewModel();
  if (!vm) {
    return;
  }
  for (const node of vm.nodes) {
    node.view.visibility = visibility;
  }
  for (const edge of vm.edges) {
    edge.view.visibility = visibility;
  }
}

/**
 * ルート以外を全て `hidden`、全エッジを `hidden` にする内部ヘルパー。
 * Hide All の挙動本体。
 */
function setAllHiddenExceptRoot(): void {
  const vm = getViewModel();
  if (!vm) {
    return;
  }
  for (const node of vm.nodes) {
    node.view.visibility = node.id === vm.rootNodeId ? 'visible' : 'hidden';
  }
  for (const edge of vm.edges) {
    edge.view.visibility = 'hidden';
  }
}