import { vscode } from '../../common/vscodeAPI';
import type { GraphViewModel, NodeVM } from '../../viewmodel/viewModel';

/**
 * ノードクリック時の挙動ディスパッチ。
 *
 * - 通常クリック:`nodeClick` メッセージを Extension Host に送り、ソースジャンプを要求する
 *
 * @param vm 現在の `GraphViewModel`
 * @param node クリックされたノードの ViewModel
 * @param event DOM の `click` イベント
 */
export function handleNodeClick(
  vm: GraphViewModel,
  node: NodeVM,
  event: MouseEvent
): void {
  event.stopPropagation();

  if (event.shiftKey) {
    /* do nothing */
  } else {
    /* 通常クリック時処理 */
      vscode.postMessage({
      type: 'nodeClick',
      filePath: node.filePath,
      line: node.line,
      character: node.character,
    });
  }
}
