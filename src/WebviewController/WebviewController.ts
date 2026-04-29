/**
 * @abstract
 * Webview制御：グラフのレンダリングとパネル操作によるイベントを処理する
 */

import {
  btnExportPlantUml,
  btnHideAll,
  btnReset,
  btnSearchNext,
  btnSearchPrev,
  btnShowAll,
  contextMenuIncoming,
  contextMenuOutgoing,
  contextMenuShowPathToRoot,
  searchInput,
  svg,
  viewport,
} from './core/dom';
import { updateExtensionOptions } from './core/state';
import {
  exportPlantUml,
  hideAllNodes,
  showAllNodes,
} from './feature/buttonActions';
import {
  handleViewportClick,
  handleViewportContextMenu,
} from './feature/nodeInteraction/nodeInteraction';
import {
  handleContextMenuIncomingClick,
  handleContextMenuOutgoingClick,
  handleContextMenuShowPathToRootClick,
  handleWindowClickForContextMenu,
  handleWindowKeyDownForContextMenu,
  hideNodeContextMenu,
} from './feature/nodeInteraction/nodeContextMenu';
import { handleFolderClick } from './feature/nodeInteraction/folderInteraction';
import { handleNodeRemoveClick } from './feature/nodeInteraction/nodeRemove';
import {
  handleSearchInputKeyDown,
  handleSearchNextClick,
  handleSearchPrevClick,
  resetSearchUiState,
} from './feature/nodeSearchInteraction';
import {
  handleSvgMouseDown,
  handleSvgWheel,
  handleViewportMouseDown,
  handleWindowMouseMove,
  handleWindowMouseUp,
} from './feature/panZoom';
import { renderGraph } from './feature/render';
import { restoreState, setViewModel } from './core/state';
import { applyTransform, resetView } from './core/viewport';
import { createGraphViewModel } from './feature/viewModel';

// ウィンドウ切り出し等で Webview が再生成された場合、前回の状態を復元する
if (restoreState()) {
  renderGraph(false);
  applyTransform();
}

// WebviewManagerからのイベント受信
window.addEventListener('message', (event) => {
  // グラフ描画イベント
  if (event.data && event.data.type === 'updateGraph') {
    updateExtensionOptions(event.data.extensionOptions);       // 拡張機能設定値更新：グラフ描画に設定値を参照するため先にコール必要
    setViewModel(createGraphViewModel(event.data.graphData));  // 生データからViewModelを生成
    hideNodeContextMenu();                                     // 前の画面で開いていたノードのコンテキストメニューが残っている可能性があるので閉じる
    renderGraph(true);                                         // ViewModelからグラフ描画
  }
});

// ボタン押下イベント
btnReset.addEventListener('click', resetView);
btnShowAll.addEventListener('click', showAllNodes);
btnHideAll.addEventListener('click', hideAllNodes);
btnExportPlantUml.addEventListener('click', exportPlantUml);

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

// パン・ズームイベント
viewport.addEventListener('mousedown', handleViewportMouseDown);
svg.addEventListener('mousedown', handleSvgMouseDown);
window.addEventListener('mousemove', handleWindowMouseMove);
window.addEventListener('mouseup', handleWindowMouseUp);
svg.addEventListener('wheel', handleSvgWheel, { passive: false });
