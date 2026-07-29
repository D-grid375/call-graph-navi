import { infoToggle, infoTree } from '../dom/dom';
import type { GraphViewModel, NodeVM } from '../viewmodel/viewModel';
import type { FileGroup } from '../../shared/types';

export function clearInfoTree(): void {
  while (infoTree.firstChild) {
    infoTree.removeChild(infoTree.firstChild);
  }
}

export function applyExpandedState(expanded: boolean): void {
  if (expanded) {
    infoTree.classList.remove('hidden');
    infoToggle.textContent = '-';
    infoToggle.setAttribute('aria-expanded', 'true');
  } else {
    infoTree.classList.add('hidden');
    infoToggle.textContent = '+';
    infoToggle.setAttribute('aria-expanded', 'false');
  }
}

export function renderInfoTree(vm: GraphViewModel): void {
  const previousFileChecks = collectChecks('.info-tree-checkbox-file', 'filePath');
  const previousNodeChecks = collectChecks('.info-tree-checkbox-node', 'nodeId');

  clearInfoTree();

  const nodesById = new Map<string, NodeVM>();
  for (const node of vm.nodes) {
    nodesById.set(node.id, node);
  }

  const sortedFiles = sortFiles(vm.files, vm.rootNodeId);

  for (const file of sortedFiles) {
    const fileEl = document.createElement('div');
    fileEl.className = 'info-tree-file';
    fileEl.dataset.filePath = file.filePath;

    const fileRow = document.createElement('div');
    fileRow.className = 'info-tree-row';

    const fileCheckbox = document.createElement('input');
    fileCheckbox.type = 'checkbox';
    fileCheckbox.className = 'info-tree-checkbox info-tree-checkbox-file';
    fileCheckbox.dataset.filePath = file.filePath;
    fileCheckbox.checked = previousFileChecks.get(file.filePath) ?? false;
    fileRow.appendChild(fileCheckbox);

    const fileLabel = document.createElement('span');
    fileLabel.className = 'info-tree-label';
    fileLabel.textContent = file.displayName;
    fileRow.appendChild(fileLabel);

    fileEl.appendChild(fileRow);

    const nodeListEl = document.createElement('div');
    nodeListEl.className = 'info-tree-node-list';

    const nodes = file.nodeIds
      .map((id) => nodesById.get(id))
      .filter((n): n is NodeVM => n !== undefined);
    const sortedNodes = sortNodes(nodes, vm.rootNodeId);

    for (const node of sortedNodes) {
      const nodeRow = document.createElement('div');
      nodeRow.className = 'info-tree-row';

      const nodeCheckbox = document.createElement('input');
      nodeCheckbox.type = 'checkbox';
      nodeCheckbox.className = 'info-tree-checkbox info-tree-checkbox-node';
      nodeCheckbox.dataset.nodeId = node.id;
      nodeCheckbox.checked = previousNodeChecks.get(node.id) ?? false;
      nodeRow.appendChild(nodeCheckbox);

      const nodeLabel = document.createElement('span');
      nodeLabel.className = 'info-tree-label info-tree-label-node';
      nodeLabel.dataset.nodeId = node.id;
      nodeLabel.textContent = node.name;
      nodeRow.appendChild(nodeLabel);

      nodeListEl.appendChild(nodeRow);
    }

    fileEl.appendChild(nodeListEl);
    infoTree.appendChild(fileEl);
  }

  applyVisibleChecks(vm);
}

function applyVisibleChecks(vm: GraphViewModel): void {
  const visibleNodes = vm.nodes.filter(
    (node) => node.view.visibility === 'visible'
  );
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const visibleFilePaths = new Set(
    vm.files
      .filter((file) => file.nodeIds.some((nodeId) => visibleNodeIds.has(nodeId)))
      .map((file) => file.filePath)
  );

  const nodeCheckboxes = infoTree.querySelectorAll<HTMLInputElement>(
    '.info-tree-checkbox-node'
  );
  nodeCheckboxes.forEach((el) => {
    const id = el.dataset.nodeId;
    if (id !== undefined) {
      el.checked = visibleNodeIds.has(id);
    }
  });

  const fileCheckboxes = infoTree.querySelectorAll<HTMLInputElement>(
    '.info-tree-checkbox-file'
  );
  fileCheckboxes.forEach((el) => {
    const path = el.dataset.filePath;
    if (path !== undefined) {
      el.checked = visibleFilePaths.has(path);
    }
  });
}

function sortFiles(files: FileGroup[], rootNodeId: string): FileGroup[] {
  const rootFiles: FileGroup[] = [];
  const others: FileGroup[] = [];
  for (const file of files) {
    if (file.nodeIds.includes(rootNodeId)) {
      rootFiles.push(file);
    } else {
      others.push(file);
    }
  }
  const byName = (a: FileGroup, b: FileGroup) =>
    a.displayName.localeCompare(b.displayName) ||
    a.filePath.localeCompare(b.filePath);
  rootFiles.sort(byName);
  others.sort(byName);
  return [...rootFiles, ...others];
}

function sortNodes(nodes: NodeVM[], rootNodeId: string): NodeVM[] {
  const rootNodes: NodeVM[] = [];
  const others: NodeVM[] = [];
  for (const node of nodes) {
    if (node.id === rootNodeId) {
      rootNodes.push(node);
    } else {
      others.push(node);
    }
  }
  others.sort(
    (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
  );
  return [...rootNodes, ...others];
}

function collectChecks(
  selector: string,
  datasetKey: 'filePath' | 'nodeId'
): Map<string, boolean> {
  const result = new Map<string, boolean>();
  const elements = infoTree.querySelectorAll<HTMLInputElement>(selector);
  elements.forEach((el) => {
    const key = el.dataset[datasetKey];
    if (key !== undefined) {
      result.set(key, el.checked);
    }
  });
  return result;
}
