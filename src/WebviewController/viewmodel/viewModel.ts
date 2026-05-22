import type { CallGraphData, FileGroup, GraphNode } from '../../shared/types';

export interface NodeViewState {
  visibility: 'visible' | 'hidden';
  selected: boolean;
  highlighted: boolean;
}

export interface EdgeViewState {
  visibility: 'visible' | 'hidden';
}

export interface NodeVM extends GraphNode {
  view: NodeViewState;
}

export interface EdgeVM {
  id: string;
  from: string;
  to: string;
  view: EdgeViewState;
}

export type FileVM = FileGroup;

export interface GraphViewModel {
  rootNodeId: string;
  direction: CallGraphData['direction'];
  files: FileVM[];
  nodes: NodeVM[];
  edges: EdgeVM[];
}

type EdgeDirection = 'forward' | 'reverse';

let currentGraphViewModel: GraphViewModel | null = null;
let persistStateCallback: (() => void) | undefined;

export function setViewModelPersistStateCallback(callback: () => void): void {
  persistStateCallback = callback;
}

export function getViewModel(): GraphViewModel | null {
  return currentGraphViewModel;
}

export function setViewModel(vm: GraphViewModel | null): void {
  currentGraphViewModel = vm;
  persistStateCallback?.();
}

/**
 * Extension Host から受け取った `CallGraphData` から、Webview 内部表示用の `GraphViewModel` を生成する。
 *
 * - 各ノードに `view: { visibility: 'visible', selected: false }` の初期表示状態を付与
 * - 各エッジに `id`（`from->to`）と `view: { visibility: 'visible' }` を付与
 * - files は shallow copy のみ（後から破壊的に変更されても元データへ影響させない目的）
 *
 * `CallGraphData` は構造データとして不変に保ち、UI 状態はこの ViewModel 側で管理する。
 *
 * @param data Extension Host から `updateGraph` で受け取ったグラフデータ
 * @returns 表示状態付きの `GraphViewModel`
 */
export function createGraphViewModel(data: CallGraphData): GraphViewModel {
  return {
    rootNodeId: data.rootNodeId,
    direction: data.direction,
    files: data.files.map((file) => ({ ...file })),
    nodes: data.nodes.map((node) => ({
      ...node,
      view: {
        visibility: 'visible',
        selected: false,
        highlighted: false,
      },
    })),
    edges: data.edges.map((edge) => ({
      id: `${edge.from}->${edge.to}`,
      from: edge.from,
      to: edge.to,
      view: {
        visibility: 'visible',
      },
    })),
  };
}

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

export function hideFile(vm: GraphViewModel, filePath: string): void {
  const targetNodeIds = getNodeIdsFromFilePath(vm, filePath);
  if (targetNodeIds.size === 0 || targetNodeIds.has(vm.rootNodeId)) {
    return;
  }

  hideNodes(vm, targetNodeIds);
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

  const reachableNodeIds = collectVisibleReachableNodes(vm.rootNodeId, vm, 'default');
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
 * 表示中のノードのみが対象
 */
export function collectVisibleReachableNodes(
  startId: string,
  vm: GraphViewModel,
  direction: 'default' | EdgeDirection
): Set<string> {
  // 表示中のエッジのみを抽出
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

  // 到達可能ノードの抽出
  var resolvedDirection: EdgeDirection;
  if (direction === 'default') { // default：グラフ方向とは逆方向向きに探索するよう設定
    resolvedDirection = vm.direction === 'incoming' ? 'reverse' : 'forward';
  } else { // defaultでない場合は探索方向を直接指定
    resolvedDirection = direction;
  }
  return collectReachableNodes(startId, visibleEdges, resolvedDirection);
}

/**
 * 指定ノードから、指定方向のエッジをたどって到達できるノードID集合を返す。
 * 受け取ったedges全体に対して抽出を行う（非表示ノードも対象）
 */
export function collectReachableNodes(
  startId: string,
  edges: EdgeVM[],
  direction: EdgeDirection
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
  direction: EdgeDirection
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
 * 指定ファイルに属するノード ID 集合を求める。
 * 通常は `vm.files` のエントリから引くが、見つからなければ `vm.nodes` を走査してフォールバックする。
 *
 * @param vm 対象 ViewModel
 * @param filePath 閉じたいファイルのパス
 * @returns 非表示化対象ノード ID の集合
 */
function getNodeIdsFromFilePath(
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