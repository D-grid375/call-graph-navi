"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode3 = __toESM(require("vscode"));

// src/extension/providers/VSCodeAPIProvider.ts
var vscode = __toESM(require("vscode"));
var VSCodeAPIProvider = class {
  /**
   * @param transformer 取得した生データを `CallGraphData` に正規化する Transformer
   */
  constructor(transformer) {
    this.transformer = transformer;
  }
  /**
   * カーソル位置の関数を起点に Call Hierarchy を再帰探索してコールグラフを構築する。
   *
   * 1. `vscode.prepareCallHierarchy` でルート関数を特定
   * 2. `traverse` で `outgoing` / `incoming` 方向に再帰探索
   * 3. `transformer.transform` で Webview 用の `CallGraphData` へ正規化
   *
   * @param document 起点関数が含まれるテキストドキュメント
   * @param position 起点関数のカーソル位置
   * @param options 探索方向 / 最大深さ / 引数表示の有無
   * @returns 正規化済みの {@link CallGraphData}
   * @throws カーソル位置から Call Hierarchy を取得できなかった場合
   */
  async getCallGraph(document, position, options) {
    const rootItems = await vscode.commands.executeCommand("vscode.prepareCallHierarchy", document.uri, position);
    if (!rootItems || rootItems.length === 0) {
      throw new Error(
        "\u30AB\u30FC\u30BD\u30EB\u4F4D\u7F6E\u304B\u3089Call Hierarchy\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u95A2\u6570\u540D\u306E\u4E0A\u306B\u30AB\u30FC\u30BD\u30EB\u3092\u7F6E\u3044\u3066\u304F\u3060\u3055\u3044\u3002"
      );
    }
    const rootItem = rootItems[0];
    const rootId = makeNodeId(rootItem);
    const raw = {
      rootNodeId: rootId,
      direction: options.direction,
      nodes: /* @__PURE__ */ new Map(),
      edges: []
    };
    raw.nodes.set(rootId, toGraphNode(rootItem, true, options.showArguments));
    const visited = /* @__PURE__ */ new Set();
    const edgeKeys = /* @__PURE__ */ new Set();
    await this.traverse(rootItem, rootId, 0, options, raw, visited, edgeKeys);
    return this.transformer.transform(raw);
  }
  /**
   * 再帰的に Call Hierarchy を辿り、ノードとエッジを `raw` に蓄積する。
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
   * @param raw 蓄積先の生データ（破壊的に更新される）
   * @param visited 既訪問ノード ID の集合（循環防止用）
   * @param edgeKeys 既登録エッジキー `from->to` の集合（重複防止用）
   */
  async traverse(item, itemId, depth, options, raw, visited, edgeKeys) {
    if (visited.has(itemId)) {
      return;
    }
    visited.add(itemId);
    if (options.maxDepth > 0 && depth >= options.maxDepth) {
      return;
    }
    if (options.direction === "outgoing") {
      const outgoing = await vscode.commands.executeCommand("vscode.provideOutgoingCalls", item);
      if (!outgoing) {
        return;
      }
      for (const call of outgoing) {
        const targetItem = call.to;
        const targetId = makeNodeId(targetItem);
        if (!raw.nodes.has(targetId)) {
          raw.nodes.set(targetId, toGraphNode(targetItem, false, options.showArguments));
        }
        const edgeKey = `${itemId}->${targetId}`;
        if (!edgeKeys.has(edgeKey)) {
          edgeKeys.add(edgeKey);
          raw.edges.push({ from: itemId, to: targetId });
        }
        await this.traverse(
          targetItem,
          targetId,
          depth + 1,
          options,
          raw,
          visited,
          edgeKeys
        );
      }
    } else {
      const incoming = await vscode.commands.executeCommand("vscode.provideIncomingCalls", item);
      if (!incoming) {
        return;
      }
      for (const call of incoming) {
        const callerItem = call.from;
        const callerId = makeNodeId(callerItem);
        if (!raw.nodes.has(callerId)) {
          raw.nodes.set(callerId, toGraphNode(callerItem, false, options.showArguments));
        }
        const edgeKey = `${callerId}->${itemId}`;
        if (!edgeKeys.has(edgeKey)) {
          edgeKeys.add(edgeKey);
          raw.edges.push({ from: callerId, to: itemId });
        }
        await this.traverse(
          callerItem,
          callerId,
          depth + 1,
          options,
          raw,
          visited,
          edgeKeys
        );
      }
    }
  }
};
function makeNodeId(item) {
  return `${item.uri.fsPath}::${item.name}::${item.range.start.line}:${item.range.start.character}`;
}
function toGraphNode(item, isRoot, showArguments) {
  return {
    id: makeNodeId(item),
    name: showArguments ? item.name : stripArguments(item.name),
    filePath: item.uri.fsPath,
    line: item.selectionRange.start.line,
    character: item.selectionRange.start.character,
    kind: vscode.SymbolKind[item.kind] ?? "Unknown",
    isRoot
  };
}
function stripArguments(name) {
  const idx = name.indexOf("(");
  return idx >= 0 ? name.substring(0, idx) : name;
}

// src/extension/transformer/GraphDataTransformer.ts
var GraphDataTransformer = class {
  /**
   * Provider の生データ（`Map` ベース）を Webview 用の `CallGraphData`（配列ベース）に正規化する。
   * 同時にファイル別のグループ情報 `files` を生成する。
   *
   * @param raw Provider が蓄積した生データ
   * @returns Webview に渡す `CallGraphData`
   */
  transform(raw) {
    const nodes = Array.from(raw.nodes.values());
    return {
      rootNodeId: raw.rootNodeId,
      direction: raw.direction,
      nodes,
      edges: raw.edges,
      files: this.groupByFile(nodes)
    };
  }
  /**
   * ノードを filePath をキーにファイル別グループへまとめる。
   * `displayName` は basename、`nodeIds` は同じファイルに属するノード ID の配列。
   *
   * @param nodes 全ノードの配列
   * @returns ファイルグループの配列
   */
  groupByFile(nodes) {
    const map = /* @__PURE__ */ new Map();
    for (const n of nodes) {
      const arr = map.get(n.filePath) ?? [];
      arr.push(n);
      map.set(n.filePath, arr);
    }
    return Array.from(map.entries()).map(([filePath, ns]) => ({
      filePath,
      displayName: basename(filePath),
      nodeIds: ns.map((n) => n.id)
    }));
  }
};
function basename(p) {
  const idx = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return idx >= 0 ? p.substring(idx + 1) : p;
}

// src/extension/WebviewPanelManager.ts
var vscode2 = __toESM(require("vscode"));
var path = __toESM(require("path"));
var fs = __toESM(require("fs"));
var WebviewPanelManager = class _WebviewPanelManager {
  /**
   * @param context 拡張機能コンテキスト（extensionPath と subscriptions の取得用）
   * @param onRequestGraphFromNode Webview から `requestGraphFromNode` メッセージが来た時のハンドラ
   */
  constructor(context, onRequestGraphFromNode) {
    this.context = context;
    this.onRequestGraphFromNode = onRequestGraphFromNode;
  }
  static {
    this.viewType = "CallGraphNavi.graph";
  }
  /**
   * コールグラフを WebviewPanel に表示する。
   * パネルが未生成なら新規作成し、既存パネルがあれば再利用して reveal する。
   * 毎回 `updateGraph` メッセージを postMessage してグラフを差し替える。
   *
   * @param data 表示する `CallGraphData`
   * @todo 責務分離
   */
  show(data) {
    const viewStyle = this.panel ? vscode2.ViewColumn.Active : vscode2.ViewColumn.Beside;
    this.panel = vscode2.window.createWebviewPanel(
      _WebviewPanelManager.viewType,
      "Call Graph Navi",
      viewStyle,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode2.Uri.file(path.join(this.context.extensionPath, "media")),
          vscode2.Uri.file(path.join(this.context.extensionPath, "out"))
        ]
      }
    );
    this.panel.webview.html = this.getHtml(this.panel.webview);
    this.panel.onDidDispose(() => {
      this.panel = void 0;
    });
    this.panel.webview.onDidReceiveMessage(async (message2) => {
      if (message2?.type === "nodeClick") {
        await this.openSource(
          message2.filePath,
          message2.line,
          message2.character
        );
      } else if (message2?.type === "requestGraphFromNode") {
        await this.onRequestGraphFromNode(message2);
      } else if (message2?.type === "exportPlantUml") {
        await vscode2.env.clipboard.writeText(message2.text);
        vscode2.window.showInformationMessage(
          "PlantUML copied to clipboard."
        );
      }
    });
    const message = { type: "updateGraph", data };
    this.panel.webview.postMessage(message);
  }
  /**
   * 指定位置のソースコードをエディタで開き、カーソルを合わせて中央にスクロールする。
   * Webview で `Shift+クリック` されたときの処理に使われる。
   *
   * @param filePath 開きたいファイルの絶対パス
   * @param line カーソルを合わせる行（0-origin）
   * @param character カーソルを合わせる桁（0-origin）
   */
  async openSource(filePath, line, character) {
    try {
      const uri = vscode2.Uri.file(filePath);
      const doc = await vscode2.workspace.openTextDocument(uri);
      const editor = await vscode2.window.showTextDocument(
        doc,
        vscode2.ViewColumn.One
      );
      const pos = new vscode2.Position(line, character);
      editor.selection = new vscode2.Selection(pos, pos);
      editor.revealRange(
        new vscode2.Range(pos, pos),
        vscode2.TextEditorRevealType.InCenter
      );
    } catch (err) {
      vscode2.window.showErrorMessage(
        `Failed to open ${filePath}: ${err.message}`
      );
    }
  }
  /**
   * Webview に読み込ませる HTML を生成する。
   * `media/graph.html` をテンプレートとして読み込み、CSS / JS の URI と CSP nonce を差し込む。
   *
   * @param webview 対象の `Webview`（リソース URI 変換と cspSource 取得に使う）
   * @returns プレースホルダが解決済みの完成 HTML 文字列
   */
  getHtml(webview) {
    const mediaPath = path.join(this.context.extensionPath, "media");
    const htmlPath = path.join(mediaPath, "graph.html");
    let html = fs.readFileSync(htmlPath, "utf8");
    const cssUri = webview.asWebviewUri(
      vscode2.Uri.file(path.join(mediaPath, "graph.css"))
    );
    const dagreUri = webview.asWebviewUri(
      vscode2.Uri.file(path.join(mediaPath, "dagre.min.js"))
    );
    const jsUri = webview.asWebviewUri(
      vscode2.Uri.file(path.join(mediaPath, "graph.js"))
    );
    const nonce = getNonce();
    html = html.replace(/{{cspSource}}/g, webview.cspSource).replace(/{{nonce}}/g, nonce).replace(/{{cssUri}}/g, cssUri.toString()).replace(/{{dagreUri}}/g, dagreUri.toString()).replace(/{{jsUri}}/g, jsUri.toString());
    return html;
  }
};
function getNonce() {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// src/extension/extension.ts
function activate(context) {
  const transformer = new GraphDataTransformer();
  const provider = new VSCodeAPIProvider(transformer);
  const panelManager = new WebviewPanelManager(
    context,
    async (message) => {
      await showGraphFromLocation(
        message.filePath,
        message.line,
        message.character,
        message.direction
      );
    }
  );
  const buildAndShowGraph = async (document, position, direction) => {
    const config = vscode3.workspace.getConfiguration("CallGraphNavi");
    const maxDepth = config.get("maxDepth", 0);
    const showArguments = config.get("showArguments", false);
    const options = { direction, maxDepth, showArguments };
    await vscode3.window.withProgress(
      {
        location: vscode3.ProgressLocation.Notification,
        title: `Building ${direction} call graph...`,
        cancellable: false
      },
      async () => {
        const data = await provider.getCallGraph(document, position, options);
        panelManager.show(data);
      }
    );
  };
  const showGraph = async (direction) => {
    const editor = vscode3.window.activeTextEditor;
    if (!editor) {
      vscode3.window.showWarningMessage("No active editor.");
      return;
    }
    try {
      await buildAndShowGraph(
        editor.document,
        editor.selection.active,
        direction
      );
    } catch (err) {
      vscode3.window.showErrorMessage(
        `Call Graph Navi: ${err.message}`
      );
    }
  };
  const showGraphFromLocation = async (filePath, line, character, direction) => {
    try {
      const uri = vscode3.Uri.file(filePath);
      const document = await vscode3.workspace.openTextDocument(uri);
      const position = new vscode3.Position(line, character);
      await buildAndShowGraph(document, position, direction);
    } catch (err) {
      vscode3.window.showErrorMessage(
        `Call Graph Navi: ${err.message}`
      );
    }
  };
  context.subscriptions.push(
    vscode3.commands.registerCommand(
      "CallGraphNavi.showOutgoing",
      () => showGraph("outgoing")
    ),
    vscode3.commands.registerCommand(
      "CallGraphNavi.showIncoming",
      () => showGraph("incoming")
    )
  );
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
