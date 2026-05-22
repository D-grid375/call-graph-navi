import { infoSummaryText } from '../dom/dom';
import { setLayoutPositions } from '../transformUI/viewport';
import { getViewModel } from '../viewmodel/viewModel';
import { clearInfoTree } from './renderInfoTree';
import { clearViewport, renderGraph } from './renderGraph';

let persistStateCallback: (() => void) | undefined;

export function setRenderPersistStateCallback(callback: () => void): void {
  persistStateCallback = callback;
}

/**
 * グラフ描画のメイン関数。グラフの新規描画・更新の際はこれをコールする。
 *
 * 現在の `GraphViewModel` を `state.ts` から取得して {@link renderGraph} に委譲する。
 * ViewModel 未設定の場合は情報ラベルをリセットして viewport をクリアするだけ。
 *
 * @param resetViewport true なら描画後にビューポート変換を初期化し、false なら現在の変換を維持する
 */
export function renderViewport(resetViewport: boolean): void {
  const vm = getViewModel();
  if (!vm) {
    infoSummaryText.textContent = 'No graph loaded.';
    clearInfoTree();
    clearViewport();
    setLayoutPositions(new Map());
    return;
  }
  renderGraph(vm, resetViewport);
  persistStateCallback?.();
}
