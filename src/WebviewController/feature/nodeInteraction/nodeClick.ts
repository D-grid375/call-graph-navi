import { vscode } from '../../core/dom';
import { applyPathVisualization } from './pathVisualization';
import { renderGraph } from '../render';
import { getUiState } from '../../core/state';
import type { GraphViewModel, NodeVM } from '../../core/types';

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
    /* モード別処理は無効化中 */
    /*
    // モード共通処理
    selectNode(vm, node.id);
    // モード別処理
    const mode = getUiState().mode;
    if (mode === 'normal') {
      renderGraph(false);
    }
    */
  }
}

/**
 * 指定 ID のノードだけを選択状態（`view.selected = true`）にし、それ以外を非選択にする。
 *
 * @param vm 対象の `GraphViewModel`
 * @param selectedNodeId 選択したいノードの ID
 */
function selectNode(vm: GraphViewModel, selectedNodeId: string): void {
  // 選択ノードのみselected=true、それ以外はfalseにする
  for (const node of vm.nodes) {
    node.view.selected = node.id === selectedNodeId;
  }
}
