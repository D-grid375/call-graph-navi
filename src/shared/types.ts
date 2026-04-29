/** グラフ全体のデータ（Webview に渡す形式） */
export interface CallGraphData {
  rootNodeId: string;
  direction: 'outgoing' | 'incoming';
  nodes: GraphNode[];
  edges: GraphEdge[];
  files: FileGroup[];
}

/** 関数ノード */
export interface GraphNode {
  id: string;
  name: string;
  filePath: string;
  line: number;
  character: number;
  kind: string;
  isRoot: boolean;
}

/** 呼び出し関係（エッジ） */
export interface GraphEdge {
  from: string;
  to: string;
}

/** ファイルグループ */
export interface FileGroup {
  filePath: string;
  displayName: string;
  nodeIds: string[];
}

/** 探索オプション */
export interface ExtensionOptions {
  direction: 'outgoing' | 'incoming';
  maxDepth: number; // 0 = 無制限
  showArguments: boolean;
  graphsOrientation: string;
}
