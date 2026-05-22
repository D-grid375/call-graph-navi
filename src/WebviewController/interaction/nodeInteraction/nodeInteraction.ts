import {
  getViewModel,
  type GraphViewModel,
  type NodeVM,
} from '../../viewmodel/viewModel';


/**
 * DOM イベントの target から対応する `NodeVM` を逆引きする。
 * 最寄りの `.func-node` 要素を辿り、その `data-node-id` から ViewModel 内のノードを見つける。
 *
 * @param target イベントの `target`
 * @returns 見つかれば `{ vm, node }`、どれかが欠ける場合は null
 */
export function resolveNodeFromEventTarget(
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
