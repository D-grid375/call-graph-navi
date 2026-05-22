import { vscode } from '../../common/vscodeAPI';
import {
  contextMenu,
  tooltip,
} from '../../dom/dom';
import type { GraphDirection } from '../../../shared/webviewMessages';
import { renderViewport } from '../../viewport/render';
import {
  collectReachableNodes,
  getViewModel,
  type GraphViewModel,
  type NodeVM,
} from '../../viewmodel/viewModel';
import { resolveNodeFromEventTarget } from './nodeInteraction';

let contextMenuNode: NodeVM | null = null;

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
 * ノード右クリック時に表示するコンテキストメニューを開く。
 *
 * 対象ノードをモジュール内の `contextMenuNode` に保持し、
 * ツールチップを非表示にしてからマウス座標にメニューを配置する。
 * 画面外にはみ出さないよう、表示後にメニューの bounding rect を取って左上座標をクランプする。
 *
 * @param node 対象のノード（後続のメニュー操作で参照される）
 * @param event トリガとなった `contextmenu` イベント
 */
export function showNodeContextMenu(node: NodeVM, event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();

  contextMenuNode = node;
  tooltip.classList.add('hidden');

  contextMenu.style.left = `${event.clientX}px`;
  contextMenu.style.top = `${event.clientY}px`;
  contextMenu.classList.remove('hidden');

  const menuRect = contextMenu.getBoundingClientRect();
  const maxLeft = window.innerWidth - menuRect.width - 8;
  const maxTop = window.innerHeight - menuRect.height - 8;

  contextMenu.style.left = `${Math.max(8, Math.min(event.clientX, maxLeft))}px`;
  contextMenu.style.top = `${Math.max(8, Math.min(event.clientY, maxTop))}px`;
}

/**
 * コンテキストメニューを閉じ、保持している対象ノード参照をクリアする。
 * メニュー内のボタンにフォーカスが残っている場合は blur してからクラス付与で非表示にする。
 */
export function hideNodeContextMenu(): void {
  const activeElement = document.activeElement as HTMLElement | null;
  if (activeElement && contextMenu.contains(activeElement)) {
    activeElement.blur();
  }
  contextMenuNode = null;
  contextMenu.classList.add('hidden');
}

/**
 * コンテキストメニュー "Show Outgoing Calls From Here" 押下時のハンドラ。
 * 対象ノードを起点に outgoing 方向でグラフ再構築を要求する。
 *
 * @param event DOM の `click` イベント
 */
export function handleContextMenuOutgoingClick(event: MouseEvent): void {
  handleContextMenuRequest(event, 'outgoing');
  hideNodeContextMenu();
}

/**
 * コンテキストメニュー "Show Incoming Calls To Here" 押下時のハンドラ。
 * 対象ノードを起点に incoming 方向でグラフ再構築を要求する。
 *
 * @param event DOM の `click` イベント
 */
export function handleContextMenuIncomingClick(event: MouseEvent): void {
  handleContextMenuRequest(event, 'incoming');
  hideNodeContextMenu();
}

/**
 * コンテキストメニュー "Show Path to Root" 押下時のハンドラ。
 * 対象ノード～ルートノード間でパスを持つグラフを表示する（含まれないノードを非表示にする）
 *
 */
export function handleContextMenuShowPathToRootClick(): void {
  // コンテキストメニュー展開時にノードを取得しているため、それを参照する
  if (!contextMenuNode) {
    return;
  }
  applyPathVisualization(contextMenuNode.id);
  renderViewport(true);
  hideNodeContextMenu();
}

/**
 * window の click ハンドラ。
 * コンテキストメニュー外でクリックされた場合のみメニューを閉じる。
 *
 * @param event DOM の `click` イベント
 */
export function handleWindowClickForContextMenu(event: MouseEvent): void {
  const target = event.target as Element | null;
  if (target?.closest('#node-context-menu')) {
    return;
  }
  hideNodeContextMenu();
}

/**
 * window の keydown ハンドラ。Escape キーでコンテキストメニューを閉じる。
 *
 * @param event DOM の `keydown` イベント
 */
export function handleWindowKeyDownForContextMenu(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    hideNodeContextMenu();
  }
}

/**
 * Path Visualize モードでの経路可視化を ViewModel に反映する。
 *
 * ルートとクリックノードの間の経路上にあるノード／エッジだけを `visible` にし、それ以外を `hidden` にする。
 * アルゴリズム:
 * 1. `direction` に応じて `source`（探索始点）と `target`（到達先）を決定
 *    （outgoing: root→clicked、incoming: clicked→root）
 * 2. `source == target`（ルートをクリック）ならルートのみ表示、エッジ全て非表示
 * 3. 順方向到達可能集合（`source` から到達可能）と逆方向到達可能集合（`target` に到達可能）の積集合を経路上ノードとする
 * 4. エッジは `from` が順方向集合に含まれかつ `to` が逆方向集合に含まれるものを経路上エッジとする
 * 5. 経路が空のときはルートとクリックノードのみ表示するフォールバックを適用
 *
 * @param clickedNodeId ユーザがクリックしたノードの ID
 */
function applyPathVisualization(clickedNodeId: string): void {
  const vm = getViewModel();
  if (!vm) {
    return;
  }

  const { sourceId, targetId } = getPathEndpoints(vm, clickedNodeId);

  if (sourceId === targetId) {
    for (const node of vm.nodes) {
      node.view.visibility = node.id === sourceId ? 'visible' : 'hidden';
    }
    for (const edge of vm.edges) {
      edge.view.visibility = 'hidden';
    }
    return;
  }

  const reachableFromSource = collectReachableNodes(
    sourceId,
    vm.edges,
    'forward'
  );
  const canReachTarget = collectReachableNodes(
    targetId,
    vm.edges,
    'reverse'
  );
  const pathNodeIds = new Set<string>();
  const pathEdgeIds = new Set<string>();

  for (const node of vm.nodes) {
    if (reachableFromSource.has(node.id) && canReachTarget.has(node.id)) {
      pathNodeIds.add(node.id);
    }
  }

  for (const edge of vm.edges) {
    if (reachableFromSource.has(edge.from) && canReachTarget.has(edge.to)) {
      pathEdgeIds.add(edge.id);
    }
  }

  if (pathNodeIds.size === 0) {
    pathNodeIds.add(vm.rootNodeId);
    pathNodeIds.add(clickedNodeId);
  }

  for (const node of vm.nodes) {
    node.view.visibility = pathNodeIds.has(node.id) ? 'visible' : 'hidden';
  }

  for (const edge of vm.edges) {
    edge.view.visibility = pathEdgeIds.has(edge.id) ? 'visible' : 'hidden';
  }
}

/**
 * 別グラフ描画共通処理。
 * 保持している対象ノードを起点に `requestGraphFromNode` メッセージを Extension Host に送り、
 * メニューを閉じる。対象ノードが無い場合（メニューが閉じた後など）は何もせず閉じる。
 *
 * @param event トリガイベント（preventDefault / stopPropagation のため）
 * @param direction 再構築したい探索方向
 */
function handleContextMenuRequest(event: MouseEvent, direction: GraphDirection): void {
  event.preventDefault();
  event.stopPropagation();

  if (!contextMenuNode) {
    hideNodeContextMenu();
    return;
  }

  vscode.postMessage({
    type: 'requestGraphFromNode',
    direction,
    filePath: contextMenuNode.filePath,
    line: contextMenuNode.line,
    character: contextMenuNode.character,
  });

  hideNodeContextMenu();
}

/**
 * 経路探索の始点と到達点を `direction` に応じて決定する。
 *
 * - `outgoing`: `source = root`, `target = clicked`
 * - `incoming`: 保持エッジ向きが `caller -> callee` のままなので `source = clicked`, `target = root`
 *
 * @param vm 対象 ViewModel
 * @param clickedNodeId クリックされたノードの ID
 * @returns `source` / `target` の ID
 */
function getPathEndpoints(
  vm: GraphViewModel,
  clickedNodeId: string
): { sourceId: string; targetId: string } {
  if (vm.direction === 'incoming') {
    return { sourceId: clickedNodeId, targetId: vm.rootNodeId };
  }
  return { sourceId: vm.rootNodeId, targetId: clickedNodeId };
}
