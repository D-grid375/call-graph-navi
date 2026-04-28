import { CallGraphData, FileGroup, GraphEdge, GraphNode } from '../../shared/types';

/** Provider が中間的に保持する生データ */
export interface RawCallData {
  rootNodeId: string;
  direction: 'outgoing' | 'incoming';
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
}

/**
 * Provider が取得した生データを Webview 用に正規化する。
 * - ノードのファイル別グルーピング
 * - 形式変換（Map → Array）
 */
export class GraphDataTransformer {
  /**
   * Provider の生データ（`Map` ベース）を Webview 用の `CallGraphData`（配列ベース）に正規化する。
   * 同時にファイル別のグループ情報 `files` を生成する。
   *
   * @param raw Provider が蓄積した生データ
   * @returns Webview に渡す `CallGraphData`
   */
  transform(raw: RawCallData): CallGraphData {
    const nodes = Array.from(raw.nodes.values());
    return {
      rootNodeId: raw.rootNodeId,
      direction: raw.direction,
      nodes,
      edges: raw.edges,
      files: this.groupByFile(nodes),
    };
  }

  /**
   * ノードを filePath をキーにファイル別グループへまとめる。
   * `displayName` は basename、`nodeIds` は同じファイルに属するノード ID の配列。
   *
   * @param nodes 全ノードの配列
   * @returns ファイルグループの配列
   */
  private groupByFile(nodes: GraphNode[]): FileGroup[] {
    const map = new Map<string, GraphNode[]>();
    for (const n of nodes) {
      const arr = map.get(n.filePath) ?? [];
      arr.push(n);
      map.set(n.filePath, arr);
    }
    return Array.from(map.entries()).map(([filePath, ns]) => ({
      filePath,
      displayName: GraphDataTransformer.basename(filePath),
      nodeIds: ns.map((n) => n.id),
    }));
  }

  /**
   * パス文字列からファイル名部分（basename）のみを取り出す。
   * `/` と `\` の両方に対応するのでクロスプラットフォームで動作する。
   *
   * @param p 対象のパス文字列
   * @returns 最後のセパレータ以降の部分。セパレータが無い場合は入力そのまま
   */
  private static basename(p: string): string {
    const idx = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
    return idx >= 0 ? p.substring(idx + 1) : p;
  }
}
