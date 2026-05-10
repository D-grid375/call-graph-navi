import type { CallGraphData, FileGroup, GraphNode } from '../../shared/types';
import { makeEdgeId } from '../common/util';

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

export function restoreViewModel(vm: GraphViewModel | null): void {
  currentGraphViewModel = vm;
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
      id: makeEdgeId(edge.from, edge.to),
      from: edge.from,
      to: edge.to,
      view: {
        visibility: 'visible',
      },
    })),
  };
}
