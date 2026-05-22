import { vscode } from '../../common/vscodeAPI';
import {
  getViewModel,
  hideFile,
  hideUnreachableNodes,
  type GraphViewModel,
  type NodeVM,
} from '../../viewmodel/viewModel';
import { renderViewport } from '../../viewport/render';
import { hideNodeContextMenu } from './nodeContextMenu';
import { resolveNodeFromEventTarget } from './nodeInteraction';

/**
 * viewport 上の click イベントをノードクリックとして処理する委譲ハンドラ。
 * `main.ts` が viewport に 1 つだけ登録する想定で、イベントの target から対象ノードを解決し
 * {@link handleNodeClick} に振り分ける。ノード外クリックなら何もしない。
 *
 * @param event DOM の `click` イベント
 */
export function handleViewportClick(event: MouseEvent): void {
  const resolved = resolveNodeFromEventTarget(event.target);
  if (!resolved) {
    return;
  }
  handleNodeClick(resolved.vm, resolved.node, event);
}

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

/**
 * ファイルグループヘッダの × ボタン押下（フォルダ閉じ）時のハンドラ。
 *
 * 対象ファイルに属するノードをすべて `hidden` にし、ルートからグラフ方向に到達できなくなった
 * ノード・エッジも合わせて `hidden` にしたうえで再描画する。
 * ルートが含まれるファイルは閉じられないため何もしない。
 *
 * @param event DOM の `click` イベント（× ボタン または `.file-remove-button` の子要素）
 */
export function handleFolderClick(event: MouseEvent): void {
  const target = event.target as Element | null;
  const button = target?.closest('.file-remove-button') as HTMLElement | null;
  if (!button) {
    return;
  }

  const filePath =
    button.dataset.filePath ??
    button.closest('.file-group')?.getAttribute('data-file-path');
  if (!filePath) {
    return;
  }

  event.stopPropagation();
  hideNodeContextMenu();
  const vm = getViewModel();
  if (!vm) {
    return;
  }

  hideFile(vm, filePath);
  hideUnreachableNodes(vm);
  renderViewport(false);
}
