import { getViewModel, unhideNode, unhideFile, hideUnreachableNodes, hideFile } from '../viewmodel/viewModel';
import { nodeRemoveFromVM } from './graphInteraction/nodeClick';
import { renderViewport } from '../renderViewport/render';
import { applyExpandedState } from '../renderViewport/renderInfoTree';
import { centerOnNode } from '../transformView/transformView';

let expanded = false;

export function handleInfoTreeToggle(): void {
  expanded = !expanded;
  applyExpandedState(expanded);
}

export function handleInfoTreeFileClick(event: MouseEvent): void {
  const target = event.target as Element | null;
  const checkbox = target?.closest(
    '.info-tree-checkbox-file'
  ) as HTMLInputElement | null;
  if (!checkbox) {
    return;
  }
  const filePath = checkbox.dataset.filePath;
  if (!filePath) {
    return;
  }

  if (checkbox.checked) {
    // 再表示処理
    const vm = getViewModel();
    if (!vm) {
      return;
    }
    unhideFile(vm, filePath);
    hideUnreachableNodes(vm);
    renderViewport(false);
  } else {
    // 非表示処理
    const vm = getViewModel();
    if (!vm) {
      return;
    }
    hideFile(vm, filePath);
    hideUnreachableNodes(vm);
    renderViewport(false);
  }
}

export function handleInfoTreeNodeNameClick(event: MouseEvent): void {
  const target = event.target as Element | null;
  const label = target?.closest('.info-tree-label-node') as HTMLElement | null;
  if (!label) {
    return;
  }
  const nodeId = label.dataset.nodeId;
  if (!nodeId) {
    return;
  }

  // 非表示ノードは中央寄せできないため、チェック状態で可視判定する。
  // ルートノードは非表示にできず目玉マークを持たないため、常に可視として扱う。
  const checkbox = label
    .closest('.info-tree-row')
    ?.querySelector<HTMLInputElement>('.info-tree-checkbox-node');
  if (checkbox && !checkbox.checked) {
    return;
  }

  centerOnNode(nodeId);
}

export function handleInfoTreeNodeClick(event: MouseEvent): void {
  const target = event.target as Element | null;
  const checkbox = target?.closest(
    '.info-tree-checkbox-node'
  ) as HTMLInputElement | null;
  if (!checkbox) {
    return;
  }
  const nodeId = checkbox.dataset.nodeId;
  if (!nodeId) {
    return;
  }

  if (checkbox.checked) {
    // 再表示処理
    const vm = getViewModel();
    if (!vm) {
      return;
    }
    unhideNode(vm, nodeId);
    hideUnreachableNodes(vm);
    renderViewport(false);
  } else {
    // 非表示処理
    nodeRemoveFromVM(nodeId);
  }
}
