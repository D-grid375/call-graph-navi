import type { CallGraphData } from '../../shared/types';
import type { GraphViewModel } from '../core/types';
import { makeEdgeId } from '../core/util';

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
