/**
 * @abstract
 * Webview制御：グラフのレンダリングとパネル操作によるイベントを処理する
 */

import {
  btnExport,
  btnExportPlantUml,
  btnExportSvg,
  btnExportPng,
  btnHideAll,
  btnRedo,
  btnReset,
  btnSearchNext,
  btnSearchPrev,
  btnShowAll,
  btnUndo,
  contextMenuIncoming,
  contextMenuOutgoing,
  contextMenuShowPathToRoot,
  infoToggle,
  infoTree,
  searchInput,
  svg,
  viewport,
} from '../dom/dom';
import { persistState, restoreState } from '../snapshot/snapshot';
import { updateExtensionOptions } from '../settings/settings';
import {
  exportPlantUml,
  hideAllNodes,
  showAllNodes,
} from '../interaction/buttonInteraction/button';
import {
  handleRedoClick,
  handleUndoClick,
  updateHistoryButtonState,
} from '../interaction/buttonInteraction/historyButton';
import { exportSvgToFile } from '../interaction/buttonInteraction/export/exportSvg';
import { exportPngToFile } from '../interaction/buttonInteraction/export/exportPng';
import {
  handleWindowClickForExportMenu,
  handleWindowKeyDownForExportMenu,
  hideExportMenu,
  toggleExportMenu,
} from '../interaction/buttonInteraction/export/exportMenu';
import {
  handleFolderClick,
  handleNodeRemoveClick,
  handleViewportClick,
} from '../interaction/graphInteraction/nodeClick';
import { handleViewportContextMenu } from '../interaction/graphInteraction/nodeContextMenu';
import {
  handleContextMenuIncomingClick,
  handleContextMenuOutgoingClick,
  handleContextMenuShowPathToRootClick,
  handleWindowClickForContextMenu,
  handleWindowKeyDownForContextMenu,
} from '../interaction/graphInteraction/nodeContextMenu';
import {
  handleInfoTreeFileClick,
  handleInfoTreeNodeClick,
  handleInfoTreeNodeNameClick,
  handleInfoTreeToggle,
} from '../interaction/infoInteraction';
import {
  handleSearchInputKeyDown,
  handleSearchNextClick,
  handleSearchPrevClick,
} from '../interaction/SearchInteraction';
import {
  handleSvgMouseDown,
  handleSvgWheel,
  handleViewportMouseDown,
  handleWindowMouseMove,
  handleWindowMouseUp,
} from '../interaction/viewCtrlInteraction';
import { renderViewport, setRenderPersistStateCallback } from '../renderViewport/render';
import {
  resetView,
  setTransformPersistStateCallback,
} from '../transformView/transformView';
import {
  createGraphViewModel,
  setViewModel,
  setViewModelPersistStateCallback,
} from '../viewmodel/viewModel';
import {
  clearHistory,
  pushHistory,
  setHistoryChangeCallback,
  setHistoryPersistStateCallback,
} from '../viewmodel/viewModelHistory';

// 各コンポーネント コールバック設定
setViewModelPersistStateCallback(persistState);
setTransformPersistStateCallback(persistState);
setRenderPersistStateCallback(persistState);
setHistoryChangeCallback(updateHistoryButtonState);
setHistoryPersistStateCallback(persistState);

// ウィンドウ切り出し等で Webview が再生成された場合、前回の状態を復元する
// 履歴も restoreState の中で復元されるため、ここでの記録は不要
if (restoreState()) {
  renderViewport(false);
}

// WebviewManagerからのイベント受信
window.addEventListener('message', (event) => {
  // グラフ描画イベント
  if (event.data && event.data.type === 'updateGraph') {
    updateExtensionOptions(event.data.extensionOptions);       // 拡張機能設定値更新：グラフ描画に設定値を参照するため先にコール必要
    setViewModel(createGraphViewModel(event.data.graphData));  // 生データからViewModelを生成
    clearHistory();                                            // 別グラフの履歴に Undo で戻らないようリセット
    pushHistory();                                             // 初期状態を履歴の起点にする
    renderViewport(true);                                      // ViewModelからグラフ描画
  }
});

// ボタン押下イベント
btnReset.addEventListener('click', resetView);
btnShowAll.addEventListener('click', showAllNodes);
btnHideAll.addEventListener('click', hideAllNodes);
btnUndo.addEventListener('click', handleUndoClick);
btnRedo.addEventListener('click', handleRedoClick);
btnExport.addEventListener('click', toggleExportMenu);
btnExportPlantUml.addEventListener('click', () => { exportPlantUml(); hideExportMenu(); });
btnExportSvg.addEventListener('click', () => { exportSvgToFile(); hideExportMenu(); });
btnExportPng.addEventListener('click', () => { exportPngToFile(); hideExportMenu(); });
window.addEventListener('click', handleWindowClickForExportMenu);
window.addEventListener('keydown', handleWindowKeyDownForExportMenu);

// 検索UIイベント
searchInput.addEventListener('keydown', handleSearchInputKeyDown);
btnSearchNext.addEventListener('click', handleSearchNextClick);
btnSearchPrev.addEventListener('click', handleSearchPrevClick);

// ノード左クリックイベント
viewport.addEventListener('click', handleViewportClick);
viewport.addEventListener('contextmenu', handleViewportContextMenu);

// ノード右クリックメニューイベント
contextMenuOutgoing.addEventListener('click', handleContextMenuOutgoingClick);
contextMenuIncoming.addEventListener('click', handleContextMenuIncomingClick);
contextMenuShowPathToRoot.addEventListener('click', handleContextMenuShowPathToRootClick);
window.addEventListener('click', handleWindowClickForContextMenu);
window.addEventListener('keydown', handleWindowKeyDownForContextMenu);

// フォルダ左クリックイベント
viewport.addEventListener('click', handleFolderClick);

// ノード×ボタン左クリックイベント
viewport.addEventListener('click', handleNodeRemoveClick);

// info ツリーのファイル／ノードクリックイベント
infoToggle.addEventListener('click', handleInfoTreeToggle);
infoTree.addEventListener('click', handleInfoTreeFileClick);
infoTree.addEventListener('click', handleInfoTreeNodeClick);
infoTree.addEventListener('click', handleInfoTreeNodeNameClick);

// パン・ズームイベント
viewport.addEventListener('mousedown', handleViewportMouseDown);
svg.addEventListener('mousedown', handleSvgMouseDown);
window.addEventListener('mousemove', handleWindowMouseMove);
window.addEventListener('mouseup', handleWindowMouseUp);
svg.addEventListener('wheel', handleSvgWheel, { passive: false });
