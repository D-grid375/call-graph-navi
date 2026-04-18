import * as vscode from 'vscode';
import { CallGraphData, CallGraphOptions } from '../../shared/types';

/**
 * コールグラフのデータ取得を抽象化するインターフェース。
 * 将来的に Doxygen 等の別データソース実装を差し替えられるようにする。
 */
export interface ICallGraphDataProvider {
  /**
   * 指定位置にある関数を起点にコールグラフを構築して返す。
   *
   * @param document 起点関数が含まれるテキストドキュメント
   * @param position 起点関数のカーソル位置
   * @param options 探索方向 / 最大深さ / 引数表示の有無
   * @returns Webview 描画用に正規化済みの {@link CallGraphData}
   */
  getCallGraph(
    document: vscode.TextDocument,
    position: vscode.Position,
    options: CallGraphOptions
  ): Promise<CallGraphData>;
}
