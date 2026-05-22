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
import { persistState, restoreState } from '../snapshot/snapshot';
import { updateExtensionOptions } from '../settings/settings';
import {
  exportPlantUml,
  hideAllNodes,
  showAllNodes,
} from '../interaction/buttonInteraction/buttonActions';
import { exportSvgToFile } from '../interaction/buttonInteraction/export/exportSvg';
import { exportPngToFile } from '../interaction/buttonInteraction/export/exportPng';
import {
  handleWindowClickForExportMenu,
  handleWindowKeyDownForExportMenu,
  hideExportMenu,
  toggleExportMenu,
} from '../interaction/buttonInteraction/export/exportMenu';
import { handleViewportClick } from '../interaction/nodeInteraction/nodeClick';
import { handleViewportContextMenu } from '../interaction/nodeInteraction/nodeContextMenu';
import {
  handleContextMenuIncomingClick,
  handleContextMenuOutgoingClick,
  handleContextMenuShowPathToRootClick,
  handleWindowClickForContextMenu,
  handleWindowKeyDownForContextMenu,
} from '../interaction/nodeInteraction/nodeContextMenu';
import { handleFolderClick } from '../interaction/nodeInteraction/nodeClick';
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
} from '../interaction/nodeSearchInteraction';
import {
  handleSvgMouseDown,
  handleSvgWheel,
  handleViewportMouseDown,
  handleWindowMouseMove,
  handleWindowMouseUp,
} from '../interaction/panZoom';
import { renderViewport, setRenderPersistStateCallback } from '../viewport/render';
import {
  resetView,
  setTransformPersistStateCallback,
} from '../transformUI/viewport';
import {
  createGraphViewModel,
  setViewModel,
  setViewModelPersistStateCallback,
} from '../viewmodel/viewModel';


setViewModelPersistStateCallback(persistState);
setTransformPersistStateCallback(persistState);
setRenderPersistStateCallback(persistState);

// info パネルのアコーディオントグル初期化
setupInfoTreeToggle();

// ウィンドウ切り出し等で Webview が再生成された場合、前回の状態を復元する
if (restoreState()) {
  renderViewport(false);
}

// WebviewManagerからのイベント受信
window.addEventListener('message', (event) => {
  // グラフ描画イベント
  if (event.data && event.data.type === 'updateGraph') {
    updateExtensionOptions(event.data.extensionOptions);       // 拡張機能設定値更新：グラフ描画に設定値を参照するため先にコール必要
    setViewModel(createGraphViewModel(event.data.graphData));  // 生データからViewModelを生成
    renderViewport(true);                                         // ViewModelからグラフ描画
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
