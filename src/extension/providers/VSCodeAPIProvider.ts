import * as vscode from 'vscode';
import { CallGraphData, CallGraphOptions, FileGroup, GraphEdge, GraphNode } from '../../shared/types';

/**
 * VSCode の Call Hierarchy API を利用したデータプロバイダ。
 * Language Server Protocol の Call Hierarchy をサポートする全ての言語で動作する。
 */
export class VSCodeAPIProvider {
  /**
   * カーソル位置の関数を起点に Call Hierarchy を再帰探索してコールグラフを構築する。
   *
   * 1. `vscode.prepareCallHierarchy` でルート関数を特定
   * 2. `traverse` で `outgoing` / `incoming` 方向に再帰探索
   * 3. ノード・エッジを `CallGraphData` へ正規化して返す
   *
   * @param document 起点関数が含まれるテキストドキュメント
   * @param position 起点関数のカーソル位置
   * @param options 探索方向 / 最大深さ / 引数表示の有無
   * @returns 正規化済みの {@link CallGraphData}
   * @throws カーソル位置から Call Hierarchy を取得できなかった場合
   */
  async getCallGraph(
    document: vscode.TextDocument,
    position: vscode.Position,
    options: CallGraphOptions
  ): Promise<CallGraphData> {
    // ルートノード取得
    const rootItems = await vscode.commands.executeCommand<vscode.CallHierarchyItem[]>
      ('vscode.prepareCallHierarchy', document.uri, position);
    if (!rootItems || rootItems.length === 0) {
      throw new Error('No call hierarchy found…');
    }
    const rootItem = rootItems[0];
    const rootId = VSCodeAPIProvider.makeNodeId(rootItem);

    // グラフ用データ初期化
    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    nodes.set(rootId, VSCodeAPIProvider.toGraphNode(rootItem, true, options.showArguments));
    const visited = new Set<string>();
    const edgeKeys = new Set<string>();

    // ノードとエッジを再帰的に取得
    await this.traverse(rootItem, rootId, 0, options, nodes, edges, visited, edgeKeys);
    const nodesArray = Array.from(nodes.values());

    // グラフ用データを返す
    return {
      rootNodeId: rootId,
      direction: options.direction,
      nodes: nodesArray,
      edges,
      files: VSCodeAPIProvider.groupByFile(nodesArray),
    };
  }

  /**
   * `CallHierarchyItem` からノードの一意な ID を生成する。
   * 形式は `filePath::name::line:character`。
   * 同名の関数でもファイル・位置が違えば別ノードとして扱えるようにする。
   *
   * @param item 対象の `CallHierarchyItem`
   * @returns 一意なノード ID
   */
  private static makeNodeId(item: vscode.CallHierarchyItem): string {
    return `${item.uri.fsPath}::${item.name}::${item.range.start.line}:${item.range.start.character}`;
  }

  /**
   * `CallHierarchyItem` を Webview 用の `GraphNode` に変換する。
   * `showArguments = false` のときは関数名から引数部を削る。
   *
   * @param item 変換対象の `CallHierarchyItem`
   * @param isRoot ルートノード（ユーザがカーソルを置いた起点関数）なら true
   * @param showArguments true なら引数付きの関数名をそのまま保持する
   * @returns 生成された `GraphNode`
   */
  private static toGraphNode(
    item: vscode.CallHierarchyItem,
    isRoot: boolean,
    showArguments: boolean
  ): GraphNode {
    return {
      id: VSCodeAPIProvider.makeNodeId(item),
      name: showArguments ? item.name : VSCodeAPIProvider.stripArguments(item.name),
      filePath: item.uri.fsPath,
      line: item.selectionRange.start.line,
      character: item.selectionRange.start.character,
      kind: vscode.SymbolKind[item.kind] ?? 'Unknown',
      isRoot,
    };
  }

  /**
   * 関数名から引数リスト部を取り除く。
   *
   * 例: `"funcA(int x, char *y)"` → `"funcA"`
   *
   * Call Hierarchy API は言語サーバ次第で関数名に引数リストを含めて返すことがあるため、
   * 最初の `'('` より前を関数名とみなして切り出す。
   *
   * @param name 元の関数名（引数リストを含む可能性がある）
   * @returns 引数リストを除いた関数名
   */
  private static stripArguments(name: string): string {
    const idx = name.indexOf('(');
    return idx >= 0 ? name.substring(0, idx) : name;
  }

  /**
   * ノードを filePath をキーにファイル別グループへまとめる。
   * `displayName` は basename、`nodeIds` は同じファイルに属するノード ID の配列。
   *
   * @param nodes 全ノードの配列
   * @returns ファイルグループの配列
   */
  private static groupByFile(nodes: GraphNode[]): FileGroup[] {
    const map = new Map<string, GraphNode[]>();
    for (const n of nodes) {
      const arr = map.get(n.filePath) ?? [];
      arr.push(n);
      map.set(n.filePath, arr);
    }
    return Array.from(map.entries()).map(([filePath, ns]) => ({
      filePath,
      displayName: VSCodeAPIProvider.basename(filePath),
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

  /**
   * 再帰的に Call Hierarchy を辿り、ノードとエッジを蓄積する。
   *
   * - `visited` で循環参照を抑止
   * - `edgeKeys` で重複エッジを排除
   * - `maxDepth = 0` のときは無制限探索
   * - `outgoing` は `from -> to`、`incoming` は `caller -> callee` の向きで統一してエッジを記録する
   *
   * @param item 現在探索中の `CallHierarchyItem`
   * @param itemId `makeNodeId` で生成した `item` のノード ID
   * @param depth 現在の探索深さ（ルート = 0）
   * @param options 探索オプション（方向・最大深さ・引数表示）
   * @param nodes 蓄積先のノードマップ（破壊的に更新される）
   * @param edges 蓄積先のエッジ配列（破壊的に更新される）
   * @param visited 既訪問ノード ID の集合（循環防止用）
   * @param edgeKeys 既登録エッジキー `from->to` の集合（重複防止用）
   */
  private async traverse(
    item: vscode.CallHierarchyItem,
    itemId: string,
    depth: number,
    options: CallGraphOptions,
    nodes: Map<string, GraphNode>,
    edges: GraphEdge[],
    visited: Set<string>,
    edgeKeys: Set<string>
  ): Promise<void> {
    if (visited.has(itemId)) {
      return;
    }
    visited.add(itemId);

    if (options.maxDepth > 0 && depth >= options.maxDepth) {
      return;
    }

    if (options.direction === 'outgoing') {
      const outgoing = await vscode.commands.executeCommand<
        vscode.CallHierarchyOutgoingCall[]
      >('vscode.provideOutgoingCalls', item);

      if (!outgoing) {
        return;
      }

      for (const call of outgoing) {
        const targetItem = call.to;
        const targetId = VSCodeAPIProvider.makeNodeId(targetItem);

        if (!nodes.has(targetId)) {
          nodes.set(targetId, VSCodeAPIProvider.toGraphNode(targetItem, false, options.showArguments));
        }

        const edgeKey = `${itemId}->${targetId}`;
        if (!edgeKeys.has(edgeKey)) {
          edgeKeys.add(edgeKey);
          edges.push({ from: itemId, to: targetId });
        }

        await this.traverse(targetItem, targetId, depth + 1, options, nodes, edges, visited, edgeKeys);
      }
    } else {
      const incoming = await vscode.commands.executeCommand<
        vscode.CallHierarchyIncomingCall[]
      >('vscode.provideIncomingCalls', item);

      if (!incoming) {
        return;
      }

      for (const call of incoming) {
        const callerItem = call.from;
        const callerId = VSCodeAPIProvider.makeNodeId(callerItem);

        if (!nodes.has(callerId)) {
          nodes.set(callerId, VSCodeAPIProvider.toGraphNode(callerItem, false, options.showArguments));
        }

        // incoming: caller → callee の方向でエッジを記録
        const edgeKey = `${callerId}->${itemId}`;
        if (!edgeKeys.has(edgeKey)) {
          edgeKeys.add(edgeKey);
          edges.push({ from: callerId, to: itemId });
        }

        await this.traverse(callerItem, callerId, depth + 1, options, nodes, edges, visited, edgeKeys);
      }
    }
  }
}
