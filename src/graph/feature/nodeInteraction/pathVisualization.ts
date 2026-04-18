import { getViewModel } from '../../core/state';
import type { GraphViewModel } from '../../core/types';
import { buildAdjacencyMaps, collectReachable } from './visibilityOps';

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
export function applyPathVisualization(clickedNodeId: string): void {
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

  const { adjacency, reverseAdjacency } = buildAdjacencyMaps(vm.edges);
  const reachableFromSource = collectReachable(sourceId, adjacency);
  const canReachTarget = collectReachable(targetId, reverseAdjacency);
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
