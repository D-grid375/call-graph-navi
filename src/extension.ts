/**
 * @abstract
 * グラフ描画のエントリー管理
 *
 * @description
 * 責務
 * - 拡張機能の初期化：エントリーとコールバックの登録
 * - グラフ描画要求に対する更新処理
 * 
 * グラフ描画要求は以下のパターンが存在
 * - エディタ上のコンテクストメニューからのグラフ描画
 * - WebviewPanelのノードからのグラフ描画
 */

import * as vscode from 'vscode';
import { VSCodeAPIProvider } from './VSCodeAPIProvider';
import { WebviewManager } from './WebviewManager';
import { CallGraphOptions } from './shared/types';
import type { RequestGraphFromNodeMessage } from './shared/webviewMessages';

/**
 * 拡張機能のエントリポイント。
 * Provider / Transformer / WebviewPanelManager を組み立て、
 * `CallGraphNavi.showOutgoing` / `CallGraphNavi.showIncoming` コマンドを登録する。
 *
 * @param context VS Code から渡される拡張機能コンテキスト（subscriptions に登録したものが自動 dispose される）
 */
export function activate(context: vscode.ExtensionContext) {
  const provider = new VSCodeAPIProvider();
  const webviewManager = new WebviewManager(
    context,
    async (message) => {
      await showGraphFromWebview( // webviewからのグラフ描画コールバック登録
        message.filePath,
        message.line,
        message.character,
        message.direction
      );
    }
  );

  // コマンド実行時のエントリ関数登録
  context.subscriptions.push(
    vscode.commands.registerCommand('CallGraphNavi.showOutgoing', () =>
      showGraphFromEditer('outgoing')
    ),
    vscode.commands.registerCommand('CallGraphNavi.showIncoming', () =>
      showGraphFromEditer('incoming')
    )
  );

  /**
   * コマンド実行時のエントリ関数。
   * アクティブなエディタのカーソル位置を起点として {@link showGraphCommon} を呼ぶ。
   * アクティブエディタがなければ警告、構築中の例外はエラーメッセージで通知する。
   *
   * @param direction 'outgoing' / 'incoming'（呼び出し先／呼び出し元方向）
   */
  const showGraphFromEditer = async (direction: 'outgoing' | 'incoming') => {
    // 展開中のコードエディタを取得
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor.');
      return;
    }

    try {
      await showGraphCommon(
        editor.document,
        editor.selection.active,
        direction
      );
    } catch (err) {
      vscode.window.showErrorMessage(
        `Call Graph Navi: ${(err as Error).message}`
      );
    }
  };

  /**
   * Webview からのコンテキストメニュー操作で、任意のノードを起点に再度コールグラフを再構築するためのエントリ。
   * 指定ファイルを開き `Position` を作成してから {@link showGraphCommon} に委譲する。
   *
   * @param filePath 起点関数が含まれるファイルの絶対パス
   * @param line 起点関数のカーソル行（0-origin）
   * @param character 起点関数のカーソル桁（0-origin）
   * @param direction 'outgoing' / 'incoming'（呼び出し先／呼び出し元方向）
   */
  const showGraphFromWebview = async (
    filePath: string,
    line: number,
    character: number,
    direction: RequestGraphFromNodeMessage['direction']
  ) => {
    try {
      const uri = vscode.Uri.file(filePath);
      const document = await vscode.workspace.openTextDocument(uri);
      const position = new vscode.Position(line, character);
      await showGraphCommon(document, position, direction);
    } catch (err) {
      vscode.window.showErrorMessage(
        `Call Graph Navi: ${(err as Error).message}`
      );
    }
  };

  /**
   * 指定された document / position を起点にコールグラフを構築して WebviewPanel に表示する。
   * 設定値（maxDepth, showArguments）を読み出し、進捗通知を出しながら
   * Provider で取得 → PanelManager で表示、までを一括で行う。
   *
   * @param document 起点関数が含まれるテキストドキュメント
   * @param position 起点関数のカーソル位置
   * @param direction 'outgoing' = 呼び出し先方向 / 'incoming' = 呼び出し元方向
   */
  const showGraphCommon = async (
    document: vscode.TextDocument,
    position: vscode.Position,
    direction: 'outgoing' | 'incoming'
  ) => {
    const config = vscode.workspace.getConfiguration('CallGraphNavi');
    const maxDepth = config.get<number>('maxDepth', 0);
    const showArguments = config.get<boolean>('showArguments', false);
    const options: CallGraphOptions = { direction, maxDepth, showArguments };

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Building ${direction} call graph...`,
        cancellable: false,
      },
      async () => {
        // グラフデータ取得
        const data = await provider.getCallGraphData(document, position, options);
        // データをManagerに渡してグラフ更新
        webviewManager.updateWebview(data);
      }
    );
  };
}

/**
 * 拡張機能の無効化時に呼ばれる後片付け関数。
 * 現状特にリソース解放は不要なため no-op。
 */
export function deactivate() { }
