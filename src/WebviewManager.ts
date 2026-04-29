/**
 * @abstract
 * Webview管理：パネル新規生成・更新とWebviewからのコールバックを処理
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CallGraphData } from './shared/types';
import { ExtensionOptions } from './shared/types';
import {
  RequestGraphFromNodeMessage,
  UpdateGraphMessage,
  WebviewToExtensionMessage,
} from './shared/webviewMessages';

/**
 * WebviewPanel のライフサイクル管理。
 * 同時に複数開けるのではなく、既存パネルがあれば再利用する。
 */
export class WebviewManager {
  private static readonly viewType = 'CallGraphNavi.graph';
  private panel: vscode.WebviewPanel | undefined;

  /**
   * @param context 拡張機能コンテキスト（extensionPath と subscriptions の取得用）
   * @param onRequestGraphFromNode Webview から `requestGraphFromNode` メッセージが来た時のハンドラ
   */
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly onRequestGraphFromNode: (message: RequestGraphFromNodeMessage) => Promise<void> // グラフ新規描画用コールバック
  ) { }

  /**
   * WebviewPanelを新規作成しグラフ描画を要求する。
   * パネルが未生成なら新規作成し、既存パネルがあれば再利用して reveal する。
   * 毎回 `updateGraph` メッセージを postMessage してグラフを差し替える。
   *
   * @param data 表示する `CallGraphData`
   */
  updateWebview(graphData: CallGraphData, extensionOptions: ExtensionOptions): void {
    // パネル初期化
    const viewStyle = this.panel ? vscode.ViewColumn.Active : vscode.ViewColumn.Beside; // パネル新規作成の場合はタブを右にスプリット、既存パネルがあればその隣にタブを開く
    this.panel = vscode.window.createWebviewPanel(
      WebviewManager.viewType,
      'Call Graph Navi', // TODO:タブ名改善
      viewStyle,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this.context.extensionPath, 'media')),
          vscode.Uri.file(path.join(this.context.extensionPath, 'out')),
        ],
      }
    );
    this.panel.webview.html = this.getHtml(this.panel.webview); // Webview描画（グラフは未描画）
    this.panel.onDidDispose(() => { this.panel = undefined; }); // パネルが閉じられたときのコールバック登録（タブを閉じるとthis.panel を undefined に戻す）

    // Webviewからのコールバック登録：Webviewはブラウザのサンドボックス内で動くため、VSCode APIが必要な処理はコールバック必要
    this.panel.webview.onDidReceiveMessage(async (message: WebviewToExtensionMessage) => {
      if (message?.type === 'requestGraphFromNode') {
        await this.onRequestGraphFromNode(message); // extensionにコールバック
      } else if (message?.type === 'nodeClick') {
        await this.openSource(message.filePath, message.line, message.character);
      } else if (message?.type === 'exportPlantUml') {
        await this.exportPlantUml(message.text);
      } else if (message?.type === 'exportSvg') {
        await this.exportSvg(message.svgText);
      }
    });

    // webviewにグラフデータと拡張機能設定値を渡して描画要求
    const updateGraphMessage: UpdateGraphMessage = { type: 'updateGraph', graphData, extensionOptions };
    this.panel.webview.postMessage(updateGraphMessage);
  }

  /**
   * Webviewからのコールバック処理：エディタ上での指定箇所の表示
   * 指定位置のソースコードをエディタで開き、カーソルを合わせて中央にスクロールする。
   * Webview で `Shift+クリック` されたときの処理に使われる。
   *
   * @param filePath 開きたいファイルの絶対パス
   * @param line カーソルを合わせる行（0-origin）
   * @param character カーソルを合わせる桁（0-origin）
   */
  private async openSource(filePath: string, line: number, character: number): Promise<void> {
    try {
      const uri = vscode.Uri.file(filePath);
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(
        doc,
        vscode.ViewColumn.One
      );
      const pos = new vscode.Position(line, character);
      editor.selection = new vscode.Selection(pos, pos);
      editor.revealRange(
        new vscode.Range(pos, pos),
        vscode.TextEditorRevealType.InCenter
      );
    } catch (err) {
      vscode.window.showErrorMessage(
        `Failed to open ${filePath}: ${(err as Error).message}`
      );
    }
  }

  private async exportSvg(svgText: string): Promise<void> {
    const uri = await vscode.window.showSaveDialog({
      filters: { 'SVG Image': ['svg'] },
      defaultUri: vscode.Uri.file('call-graph.svg'),
    });
    if (!uri) {
      return;
    }
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(svgText));
    vscode.window.showInformationMessage('SVG exported.');
  }

  /**
   * Webviewからのコールバック処理：PlantUMLテキストをクリップボードにコピーする
   *
   * @param umltext エクスポートするPlantUMLテキスト（Webview側で成形済み）
   */
  private async exportPlantUml(umltext: string): Promise<void> {
    await vscode.env.clipboard.writeText(umltext);
    vscode.window.showInformationMessage('PlantUML copied to clipboard.');
  }

  /**
   * Webview に読み込ませる HTML を生成する。
   * `media/graph.html` をテンプレートとして読み込み、CSS / JS の URI と CSP nonce を差し込む。
   *
   * @param webview 対象の `Webview`（リソース URI 変換と cspSource 取得に使う）
   * @returns プレースホルダが解決済みの完成 HTML 文字列
   */
  private getHtml(webview: vscode.Webview): string {
    const mediaPath = path.join(this.context.extensionPath, 'media');
    const htmlPath = path.join(mediaPath, 'graph.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    const cssUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(mediaPath, 'graph.css'))
    );
    const dagreUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(mediaPath, 'dagre.min.js'))
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(mediaPath, 'graph.js'))
    );
    const nonce = WebviewManager.getNonce();

    html = html
      .replace(/{{cspSource}}/g, webview.cspSource)
      .replace(/{{nonce}}/g, nonce)
      .replace(/{{cssUri}}/g, cssUri.toString())
      .replace(/{{dagreUri}}/g, dagreUri.toString())
      .replace(/{{jsUri}}/g, jsUri.toString());

    return html;
  }

  /**
   * CSP で使うランダムな nonce 文字列（英数 32 文字）を生成する。
   * Webview にロードされるインラインスクリプトの許可に使う。
   *
   * @returns 長さ 32 のランダム英数文字列
   */
  private static getNonce(): string {
    let text = '';
    const possible =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
