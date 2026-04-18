import * as vscode from 'vscode';
import { VSCodeAPIProvider } from './providers/VSCodeAPIProvider';
import { GraphDataTransformer } from './transformer/GraphDataTransformer';
import { WebviewPanelManager } from './WebviewPanelManager';
import { CallGraphOptions } from '../shared/types';
import type { RequestGraphFromNodeMessage } from '../shared/webviewMessages';

/**
 * 拡張機能のエントリポイント。
 * Provider / Transformer / WebviewPanelManager を組み立て、
 * `CallGraphNavi.showOutgoing` / `CallGraphNavi.showIncoming` コマンドを登録する。
 *
 * @param context VS Code から渡される拡張機能コンテキスト（subscriptions に登録したものが自動 dispose される）
 */
export function activate(context: vscode.ExtensionContext) {
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

  /**
   * 指定された document / position を起点にコールグラフを構築して WebviewPanel に表示する。
   * 設定値（maxDepth, showArguments）を読み出し、進捗通知を出しながら
   * Provider で取得 → PanelManager で表示、までを一括で行う。
   *
   * @param document 起点関数が含まれるテキストドキュメント
   * @param position 起点関数のカーソル位置
   * @param direction 'outgoing' = 呼び出し先方向 / 'incoming' = 呼び出し元方向
   */
  const buildAndShowGraph = async (
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
        const data = await provider.getCallGraph(document, position, options);
        panelManager.show(data);
      }
    );
  };

  /**
   * コマンド実行時のエントリ関数。
   * アクティブなエディタのカーソル位置を起点として {@link buildAndShowGraph} を呼ぶ。
   * アクティブエディタがなければ警告、構築中の例外はエラーメッセージで通知する。
   *
   * @param direction 'outgoing' / 'incoming'（呼び出し先／呼び出し元方向）
   */
  const showGraph = async (direction: 'outgoing' | 'incoming') => {
    // 展開中のコードエディタを取得
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor.');
      return;
    }

    try {
      await buildAndShowGraph(
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
   * 指定ファイルを開き `Position` を作成してから {@link buildAndShowGraph} に委譲する。
   *
   * @param filePath 起点関数が含まれるファイルの絶対パス
   * @param line 起点関数のカーソル行（0-origin）
   * @param character 起点関数のカーソル桁（0-origin）
   * @param direction 'outgoing' / 'incoming'（呼び出し先／呼び出し元方向）
   */
  const showGraphFromLocation = async (
    filePath: string,
    line: number,
    character: number,
    direction: RequestGraphFromNodeMessage['direction']
  ) => {
    try {
      const uri = vscode.Uri.file(filePath);
      const document = await vscode.workspace.openTextDocument(uri);
      const position = new vscode.Position(line, character);
      await buildAndShowGraph(document, position, direction);
    } catch (err) {
      vscode.window.showErrorMessage(
        `Call Graph Navi: ${(err as Error).message}`
      );
    }
  };

  // コマンド実行時のエントリ関数登録
  context.subscriptions.push(
    vscode.commands.registerCommand('CallGraphNavi.showOutgoing', () =>
      showGraph('outgoing')
    ),
    vscode.commands.registerCommand('CallGraphNavi.showIncoming', () =>
      showGraph('incoming')
    )
  );
}

/**
 * 拡張機能の無効化時に呼ばれる後片付け関数。
 * 現状特にリソース解放は不要なため no-op。
 */
export function deactivate() {}
