import {
  contextMenu,
  tooltip,
  vscode,
} from '../../core/dom';
import type { NodeVM } from '../../core/types';
import type { GraphDirection } from '../../../shared/webviewMessages';
import { renderGraph } from '../render';
import { applyPathVisualization } from './pathVisualization';

let contextMenuNode: NodeVM | null = null;

/**
 * ノード右クリック時に表示するコンテキストメニューを開く。
 *
 * 対象ノードをモジュール内の `contextMenuNode` に保持し、
 * ツールチップを非表示にしてからマウス座標にメニューを配置する。
 * 画面外にはみ出さないよう、表示後にメニューの bounding rect を取って左上座標をクランプする。
 *
 * @param node 対象のノード（後続のメニュー操作で参照される）
 * @param event トリガとなった `contextmenu` イベント
 */
export function showNodeContextMenu(node: NodeVM, event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();

  contextMenuNode = node;
  tooltip.classList.add('hidden');

  contextMenu.style.left = `${event.clientX}px`;
  contextMenu.style.top = `${event.clientY}px`;
  contextMenu.classList.remove('hidden');

  const menuRect = contextMenu.getBoundingClientRect();
  const maxLeft = window.innerWidth - menuRect.width - 8;
  const maxTop = window.innerHeight - menuRect.height - 8;

  contextMenu.style.left = `${Math.max(8, Math.min(event.clientX, maxLeft))}px`;
  contextMenu.style.top = `${Math.max(8, Math.min(event.clientY, maxTop))}px`;
}

/**
 * コンテキストメニューを閉じ、保持している対象ノード参照をクリアする。
 * メニュー内のボタンにフォーカスが残っている場合は blur してからクラス付与で非表示にする。
 */
export function hideNodeContextMenu(): void {
  const activeElement = document.activeElement as HTMLElement | null;
  if (activeElement && contextMenu.contains(activeElement)) {
    activeElement.blur();
  }
  contextMenuNode = null;
  contextMenu.classList.add('hidden');
}

/**
 * コンテキストメニュー "Show Outgoing Calls From Here" 押下時のハンドラ。
 * 対象ノードを起点に outgoing 方向でグラフ再構築を要求する。
 *
 * @param event DOM の `click` イベント
 */
export function handleContextMenuOutgoingClick(event: MouseEvent): void {
  handleContextMenuRequest(event, 'outgoing');
  hideNodeContextMenu();
}

/**
 * コンテキストメニュー "Show Incoming Calls To Here" 押下時のハンドラ。
 * 対象ノードを起点に incoming 方向でグラフ再構築を要求する。
 *
 * @param event DOM の `click` イベント
 */
export function handleContextMenuIncomingClick(event: MouseEvent): void {
  handleContextMenuRequest(event, 'incoming');
  hideNodeContextMenu();
}

/**
 * コンテキストメニュー "Show Path to Root" 押下時のハンドラ。
 * 対象ノード～ルートノード間でパスを持つグラフを表示する（含まれないノードを非表示にする）
 *
 */
export function handleContextMenuShowPathToRootClick(): void {
  // コンテキストメニュー展開時にノードを取得しているため、それを参照する
  if (!contextMenuNode) {
    return;
  }
  applyPathVisualization(contextMenuNode.id);
  renderGraph(true);
  hideNodeContextMenu();
}

/**
 * window の click ハンドラ。
 * コンテキストメニュー外でクリックされた場合のみメニューを閉じる。
 *
 * @param event DOM の `click` イベント
 */
export function handleWindowClickForContextMenu(event: MouseEvent): void {
  const target = event.target as Element | null;
  if (target?.closest('#node-context-menu')) {
    return;
  }
  hideNodeContextMenu();
}

/**
 * window の keydown ハンドラ。Escape キーでコンテキストメニューを閉じる。
 *
 * @param event DOM の `keydown` イベント
 */
export function handleWindowKeyDownForContextMenu(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    hideNodeContextMenu();
  }
}

/**
 * 別グラフ描画共通処理。
 * 保持している対象ノードを起点に `requestGraphFromNode` メッセージを Extension Host に送り、
 * メニューを閉じる。対象ノードが無い場合（メニューが閉じた後など）は何もせず閉じる。
 *
 * @param event トリガイベント（preventDefault / stopPropagation のため）
 * @param direction 再構築したい探索方向
 */
function handleContextMenuRequest(event: MouseEvent, direction: GraphDirection): void {
  event.preventDefault();
  event.stopPropagation();

  if (!contextMenuNode) {
    hideNodeContextMenu();
    return;
  }

  vscode.postMessage({
    type: 'requestGraphFromNode',
    direction,
    filePath: contextMenuNode.filePath,
    line: contextMenuNode.line,
    character: contextMenuNode.character,
  });

  hideNodeContextMenu();
}