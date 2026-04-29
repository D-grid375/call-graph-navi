import { getViewModel } from '../../core/state';
import { renderGraph } from '../render';
import { hideNodeContextMenu } from './nodeContextMenu';
import { hideNodes, pruneUnreachableFromRoot } from './visibilityOps';

/**
 * ノード矩形の × ボタン押下（ノード単体閉じ）時のハンドラ。
 *
 * 対象ノードを `hidden` にし、ルートからグラフ方向に到達できなくなったノード・エッジも
 * 合わせて `hidden` にしたうえで再描画する。ルートノードは対象外（× 自体も描画されない）。
 *
 * @param event DOM の `click` イベント（× ボタン または `.node-remove-button` の子要素）
 */
export function handleNodeRemoveClick(event: MouseEvent): void {
  const target = event.target as Element | null;
  const button = target?.closest('.node-remove-button') as HTMLElement | null;
  if (!button) {
    return;
  }

  const nodeId = button.dataset.nodeId;
  if (!nodeId) {
    return;
  }

  const vm = getViewModel();
  if (!vm) {
    return;
  }

  if (nodeId === vm.rootNodeId) {
    return;
  }

  event.stopPropagation();
  hideNodeContextMenu();

  hideNodes(vm, new Set([nodeId]));
  pruneUnreachableFromRoot(vm);

  renderGraph(false);
}
