import type { EdgeVM, GraphViewModel } from '../../core/types';

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
export function pruneUnreachableFromRoot(vm: GraphViewModel): void {
  const rootNode = vm.nodes.find((node) => node.id === vm.rootNodeId);
  if (!rootNode || rootNode.view.visibility !== 'visible') {
    return;
  }

  const reachableNodeIds = collectReachableFromRoot(vm);
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
 * 現在表示されているノード・エッジだけを対象に、ルートから到達可能なノード ID 集合を返す。
 * `direction` が `incoming` のときは保持エッジの向きが `caller -> callee` なので逆方向 BFS を行う。
 *
 * @param vm 対象 ViewModel
 * @returns ルートから到達可能なノード ID の集合
 */
function collectReachableFromRoot(vm: GraphViewModel): Set<string> {
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
  const adjacency = buildAdjacencyMap(
    visibleEdges,
    vm.direction === 'incoming' ? 'reverse' : 'forward'
  );
  return collectReachable(vm.rootNodeId, adjacency);
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
 * エッジ配列から順方向・逆方向の隣接リストを同時に構築する。
 *
 * @param edges 対象エッジ
 * @returns `adjacency`（`from -> to[]`）と `reverseAdjacency`（`to -> from[]`）
 */
export function buildAdjacencyMaps(edges: EdgeVM[]): {
  adjacency: Map<string, string[]>;
  reverseAdjacency: Map<string, string[]>;
} {
  return {
    adjacency: buildAdjacencyMap(edges, 'forward'),
    reverseAdjacency: buildAdjacencyMap(edges, 'reverse'),
  };
}

/**
 * 開始ノードから隣接リストに従って DFS 探索し、到達可能なノード ID 集合を返す。
 *
 * @param startId 起点ノード ID
 * @param adjacency 隣接リストマップ
 * @returns 到達可能ノード ID の集合（開始ノードも含む）
 */
export function collectReachable(
  startId: string,
  adjacency: Map<string, string[]>
): Set<string> {
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
