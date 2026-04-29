import { showNodeContextMenu } from './nodeContextMenu';
import { handleNodeClick } from './nodeClick';
import { getViewModel } from '../../core/state';
import type { GraphViewModel, NodeVM } from '../../core/types';

/**
 * viewport 上の click イベントをノードクリックとして処理する委譲ハンドラ。
 * `main.ts` が viewport に 1 つだけ登録する想定で、イベントの target から対象ノードを解決し
 * {@link handleNodeClick} に振り分ける。ノード外クリックなら何もしない。
 *
 * @param event DOM の `click` イベント
 */
export function handleViewportClick(event: MouseEvent): void {
  const resolved = resolveNodeFromEventTarget(event.target);
  if (!resolved) {
    return;
  }
  handleNodeClick(resolved.vm, resolved.node, event);
}

/**
 * viewport 上の contextmenu イベントをノード右クリックとして処理する委譲ハンドラ。
 * イベントの target から対象ノードを解決し、{@link showNodeContextMenu} を呼び出す。
 * ノード外での右クリックでは何もしない（ブラウザ既定のメニューが出る想定）。
 *
 * @param event DOM の `contextmenu` イベント
 */
export function handleViewportContextMenu(event: MouseEvent): void {
  const resolved = resolveNodeFromEventTarget(event.target);
  if (!resolved) {
    return;
  }
  showNodeContextMenu(resolved.node, event);
}

/**
 * DOM イベントの target から対応する `NodeVM` を逆引きする。
 * 最寄りの `.func-node` 要素を辿り、その `data-node-id` から ViewModel 内のノードを見つける。
 *
 * @param target イベントの `target`
 * @returns 見つかれば `{ vm, node }`、どれかが欠ける場合は null
 */
function resolveNodeFromEventTarget(
  target: EventTarget | null
): { vm: GraphViewModel; node: NodeVM } | null {
  const element = target as Element | null;
  if (element?.closest('.node-remove-button')) {
    return null;
  }
  const group = element?.closest('.func-node') as HTMLElement | null;
  if (!group) {
    return null;
  }

  const nodeId = group.dataset.nodeId;
  if (!nodeId) {
    return null;
  }

  const vm = getViewModel();
  if (!vm) {
    return null;
  }

  const node = vm.nodes.find((item) => item.id === nodeId);
  if (!node) {
    return null;
  }

  return { vm, node };
}
