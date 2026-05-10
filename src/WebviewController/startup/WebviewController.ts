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
  btnReset,
  btnSearchNext,
  btnSearchPrev,
  btnShowAll,
  contextMenuIncoming,
  contextMenuOutgoing,
  contextMenuShowPathToRoot,
  infoTree,
  searchInput,
  svg,
  viewport,
} from '../dom/dom';
import {
  restoreState,
  setViewModel,
  updateExtensionOptions,
} from '../common/state';
import {
  exportPlantUml,
  hideAllNodes,
  showAllNodes,
} from '../interaction/buttonActions';
import { exportSvgToFile } from '../interaction/export/exportSvg';
import { exportPngToFile } from '../interaction/export/exportPng';
import {
  handleWindowClickForExportMenu,
  handleWindowKeyDownForExportMenu,
  hideExportMenu,
  toggleExportMenu,
} from '../interaction/export/exportMenu';
import {
  handleViewportClick,
  handleViewportContextMenu,
} from '../interaction/nodeInteraction/nodeInteraction';
import {
  handleContextMenuIncomingClick,
  handleContextMenuOutgoingClick,
  handleContextMenuShowPathToRootClick,
  handleWindowClickForContextMenu,
  handleWindowKeyDownForContextMenu,
  hideNodeContextMenu,
} from '../interaction/nodeInteraction/nodeContextMenu';
import { handleFolderClick } from '../interaction/nodeInteraction/folderInteraction';
import { handleNodeRemoveClick } from '../interaction/nodeInteraction/nodeRemove';
import {
  handleInfoTreeFileClick,
  handleInfoTreeNodeClick,
  setupInfoTreeToggle,
} from '../interaction/infoTree';
import {
  handleSearchInputKeyDown,
  handleSearchNextClick,
  handleSearchPrevClick,
  resetSearchUiState,
} from '../interaction/nodeSearchInteraction';
import {
  handleSvgMouseDown,
  handleSvgWheel,
  handleViewportMouseDown,
  handleWindowMouseMove,
  handleWindowMouseUp,
} from '../interaction/panZoom';
import { renderGraph } from '../viewport/render';
import { applyTransform, resetView } from '../transformUI/viewport';
import { createGraphViewModel } from '../viewmodel/viewModel';

// info パネルのアコーディオントグル初期化
setupInfoTreeToggle();

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
    renderGraph(true);                                         // ViewModelからグラフ描画
  }
});

// ボタン押下イベント
btnReset.addEventListener('click', resetView);
btnShowAll.addEventListener('click', showAllNodes);
btnHideAll.addEventListener('click', hideAllNodes);
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
infoTree.addEventListener('click', handleInfoTreeFileClick);
infoTree.addEventListener('click', handleInfoTreeNodeClick);

// パン・ズームイベント
viewport.addEventListener('mousedown', handleViewportMouseDown);
svg.addEventListener('mousedown', handleSvgMouseDown);
window.addEventListener('mousemove', handleWindowMouseMove);
window.addEventListener('mouseup', handleWindowMouseUp);
svg.addEventListener('wheel', handleSvgWheel, { passive: false });
