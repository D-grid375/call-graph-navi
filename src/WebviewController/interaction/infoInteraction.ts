import { infoToggle } from '../dom/dom';
import { getViewModel, unhideNode, unhideFile, hideUnreachableNodes, hideFile } from '../viewmodel/viewModel';
import { nodeRemoveFromVM } from './graphInteraction/nodeClick';
import { renderViewport } from '../renderViewport/render';
import { applyExpandedState } from '../renderViewport/renderInfoTree';

let expanded = false;

export function setupInfoTreeToggle(): void {
  applyExpandedState(expanded);
  infoToggle.addEventListener('click', () => {
    expanded = !expanded;
    applyExpandedState(expanded);
  });
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
