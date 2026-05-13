import type { EdgeVM, GraphViewModel } from '../../viewmodel/viewModel';
import { getNodeIdsFromFilePath } from './folderInteraction';

/**
 * 指定ファイルに含まれるノードを再表示する。
 */
export function unhideFile(vm: GraphViewModel, filePath: string): void {
  const unhideNodeIds = getNodeIdsFromFilePath(vm, filePath);
  if (unhideNodeIds.size === 0) {
    return;
  }

  for (const nodeId of unhideNodeIds) {
    unhideNode(vm, nodeId);
  }
}

/**
 * 指定ノードを再表示し、表示中グラフとの接続に必要な隣接ノードも再表示する。
 */
export function unhideNode(vm: GraphViewModel, nodeId: string): void {
  // ノード表示
  for (const node of vm.nodes) {
    if (nodeId === node.id) {
      node.view.visibility = 'visible';
    }
  }

  // ノードからルート方向に延びるエッジを抽出
  const matchingEdges =
    vm.direction === 'incoming'
      ? vm.edges.filter((edge) => edge.from === nodeId)
      : vm.edges.filter((edge) => edge.to === nodeId);

  // エッジから隣接ノードを取得し再帰的に表示有効化
  for (const edge of matchingEdges) {
    edge.view.visibility = 'visible'; // エッジは必ず非表示中なので無条件で再表示

    const targetNode =
      vm.direction === 'incoming'
        ? vm.nodes.find((node) => node.id === edge.to)
        : vm.nodes.find((node) => node.id === edge.from);

    if (targetNode && targetNode.view.visibility === 'hidden') {
      unhideNode(vm, targetNode.id);
    }
  }
}

/**
 * 指定ノード ID 集合に含まれるノードを `hidden`・非選択にし、
 * それらを端点とするエッジも `hidden` にする。
 *
 * @param vm 対象 ViewModel（破壊的に更新される）
 * @param nodeIds 非表示化するノード ID の集合
 */
export function hideNodes(vm: GraphViewModel, nodeIds: Set<string>): void {
  for (const node of vm.nodes) {
    if (nodeIds.has(node.id)) {
      node.view.visibility = 'hidden';
      node.view.selected = false;
    }
  }

  for (const edge of vm.edges) {
    if (nodeIds.has(edge.from) || nodeIds.has(edge.to)) {
      edge.view.visibility = 'hidden';
    }
  }
}

/**
 * ルートからグラフ方向（outgoing は順方向、incoming は逆方向）に到達不能となったノード・エッジを
 * まとめて `hidden` にする。フォルダ／ノード閉じで生じる孤立要素を除去するために使う。
 *
 * @param vm 対象 ViewModel（破壊的に更新される）
 */
export function hideUnreachableNodes(vm: GraphViewModel): void {
  const rootNode = vm.nodes.find((node) => node.id === vm.rootNodeId);
  if (!rootNode || rootNode.view.visibility !== 'visible') {
    return;
  }

  const reachableNodeIds = collectVisibleReachableNodes(vm);
  for (const node of vm.nodes) {
    if (!reachableNodeIds.has(node.id)) {
      node.view.visibility = 'hidden';
      node.view.selected = false;
    }
  }

  for (const edge of vm.edges) {
    if (!reachableNodeIds.has(edge.from) || !reachableNodeIds.has(edge.to)) {
      edge.view.visibility = 'hidden';
    }
  }
}

/**
 * 現在表示中のノードとエッジだけを対象に、ルートから到達できるノードID集合を返す。
 */
function collectVisibleReachableNodes(vm: GraphViewModel): Set<string> {
  const visibleNodeIds = new Set(
    vm.nodes
      .filter((node) => node.view.visibility === 'visible')
      .map((node) => node.id)
  );
  const visibleEdges = vm.edges.filter(
    (edge) =>
      edge.view.visibility === 'visible' &&
      visibleNodeIds.has(edge.from) &&
      visibleNodeIds.has(edge.to)
  );

  return collectReachableNodes(
    vm.rootNodeId,
    visibleEdges,
    vm.direction === 'incoming' ? 'reverse' : 'forward'
  );
}

/**
 * エッジ配列から隣接リスト（`Map<from, to[]>`）を組み立てる。
 * `reverse` を渡すと `from` / `to` を入れ替えた逆向きの隣接リストを生成する。
 *
 * @param edges 対象エッジ
 * @param direction `'forward'` なら `from -> to`、`'reverse'` なら `to -> from` の向きで構築
 * @returns 隣接リストマップ
 */
function buildAdjacencyMap(
  edges: EdgeVM[],
  direction: 'forward' | 'reverse'
): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();

  for (const edge of edges) {
    const from = direction === 'forward' ? edge.from : edge.to;
    const to = direction === 'forward' ? edge.to : edge.from;

    if (!adjacency.has(from)) {
      adjacency.set(from, []);
    }
    adjacency.get(from)!.push(to);
  }

  return adjacency;
}

/**
 * 指定ノードから、指定方向のエッジをたどって到達できるノードID集合を返す。
 */
export function collectReachableNodes(
  startId: string,
  edges: EdgeVM[],
  direction: 'forward' | 'reverse'
): Set<string> {
  const adjacency = buildAdjacencyMap(edges, direction);
  const visited = new Set<string>();
  const stack = [startId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current)) {
      continue;
    }

    visited.add(current);

    const neighbors = adjacency.get(current) ?? [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        stack.push(neighbor);
      }
    }
  }

  return visited;
}
