import { getViewModel } from '../../core/state';
import type { GraphViewModel } from '../../core/types';
import { renderGraph } from '../render';
import { hideNodeContextMenu } from './nodeContextMenu';
import { hideNodes, pruneUnreachableFromRoot } from './visibilityOps';

/**
 * ファイルグループヘッダの × ボタン押下（フォルダ閉じ）時のハンドラ。
 *
 * 対象ファイルに属するノードをすべて `hidden` にし、ルートからグラフ方向に到達できなくなった
 * ノード・エッジも合わせて `hidden` にしたうえで再描画する。
 * ルートが含まれるファイルは閉じられないため何もしない。
 *
 * @param event DOM の `click` イベント（× ボタン または `.file-remove-button` の子要素）
 */
export function handleFolderClick(event: MouseEvent): void {
  const target = event.target as Element | null;
  const button = target?.closest('.file-remove-button') as HTMLElement | null;
  if (!button) {
    return;
  }

  const filePath =
    button.dataset.filePath ??
    button.closest('.file-group')?.getAttribute('data-file-path');
  if (!filePath) {
    return;
  }

  const vm = getViewModel();
  if (!vm) {
    return;
  }

  const removedNodeIds = collectRemovedNodeIds(vm, filePath);
  if (removedNodeIds.size === 0 || removedNodeIds.has(vm.rootNodeId)) {
    return;
  }

  event.stopPropagation();
  hideNodeContextMenu();

  hideNodes(vm, removedNodeIds);
  pruneUnreachableFromRoot(vm);

  renderGraph(false);
}

/**
 * 指定ファイルに属するノード ID 集合を求める。
 * 通常は `vm.files` のエントリから引くが、見つからなければ `vm.nodes` を走査してフォールバックする。
 *
 * @param vm 対象 ViewModel
 * @param filePath 閉じたいファイルのパス
 * @returns 非表示化対象ノード ID の集合
 */
function collectRemovedNodeIds(
  vm: GraphViewModel,
  filePath: string
): Set<string> {
  const file = vm.files.find((item) => item.filePath === filePath);
  if (file) {
    return new Set(file.nodeIds);
  }

  return new Set(
    vm.nodes
      .filter((node) => node.filePath === filePath)
      .map((node) => node.id)
  );
}
