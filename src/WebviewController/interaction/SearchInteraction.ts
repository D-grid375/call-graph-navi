import { searchIndicator, searchInput } from '../dom/dom';
import {
  clearSearchState,
  getSearchState,
  updateHitState,
  runSearch as searchNewWord,
  SearchDirection,
  type SearchResult,
} from '../serach/search';
import { centerOnNode } from '../transformView/transformView';
import { renderViewport } from '../renderViewport/render';
import { getViewModel, updateHighlightedNodes } from '../viewmodel/viewModel';

/**
 * 検索結果を完全にクリアする内部ヘルパー。
 * ハイライトを解除し、状態・インジケータ・current クラスを初期化する。
 * ハイライトに変化があった場合のみ再描画する。
 */
/**
 * 検索結果クリア時に applySearchResultToView へ渡す定数。
 * 空ヒット・未選択を表す。
 */
const EMPTY_SEARCH_RESULT: SearchResult = {
  hitIds: [],
  currentIndex: -1,
  totalHits: 0,
  currentNodeId: undefined,
  hitsOrHighlightChanged: false,
};

/**
 * 検索「前へ」ボタン押下時の処理。
 * 直前のヒットへ移動する。クエリが変わっていれば再検索して末尾のヒットを選ぶ。
 */
export function handleSearchPrevClick(): void {
  searchMain(SearchDirection.Backward);
}

/**
 * 検索「次へ」ボタン押下時の処理。
 * 次のヒットへ移動する。クエリが変わっていれば再検索して先頭のヒットを選ぶ。
 */
export function handleSearchNextClick(): void {
  searchMain(SearchDirection.Forward);
}

/**
 * 検索入力欄の keydown ハンドラ。
 * Enter で検索を実行し、同一クエリでの再 Enter は次ヒットへ、
 * Shift+Enter は前ヒットへ移動する。空クエリなら結果をクリアする。
 *
 * @param event キー入力イベント
 */
export function handleSearchInputKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Enter') {
    return;
  }
  // Enterキー押下が他のハンドラに拾われないようにするためのガード
  event.preventDefault();
  event.stopPropagation();

  const direction: SearchDirection = event.shiftKey ? SearchDirection.Backward : SearchDirection.Forward;
  searchMain(direction);
}

/**
 * 検索メイン処理
 * 検索ボックスの文字列に対して検索実行・表示するヒットノードの更新を行う。
 *
 * @param direction 検索更新方向
 */
function searchMain(direction: SearchDirection) {
  // 検索ボックスの文字列からクエリ生成
  const query = normalizeQuery(searchInput.value);

  if (!query) {
    // 検索文字列無し：検索状態クリア
    clearSearchState();
    applySearchResultToView(EMPTY_SEARCH_RESULT);
  } else {
    // 検索文字列有り：検索処理
    const previous = getSearchState();
    const vm = getViewModel();
    if (!vm) return;
    const result =
      query !== previous.query || previous.hitIds.length === 0
        ? searchNewWord(query, 0, vm)
        : updateHitState(direction, vm);
    applySearchResultToView(result);
  }
}

/**
 * 検索結果に応じて UI を更新する。
 * ハイライト反映・インジケータ更新・必要なら再描画・中央寄せ・current クラス付与を行う。
 */
function applySearchResultToView(result: SearchResult): void {
  const vm = getViewModel();
  const highlightChanged = vm
    ? updateHighlightedNodes(vm, result.hitIds)
    : false;
  updateIndicator(result.currentIndex, result.totalHits);
  updateCurrentMatchClass(result.currentNodeId);

  if (result.hitsOrHighlightChanged || highlightChanged) {
    renderViewport(false);
  }
  if (result.currentNodeId !== undefined) {
    centerOnNode(result.currentNodeId);
  }
}

/**
 * DOM 上の `search-current` クラスを張り替える。
 * 既存の付与先から一旦剥がし、指定ノードがあればその要素に付け直す。
 *
 * @param nodeId 現在一致ノードの ID。`undefined` なら付与しない
 */
function updateCurrentMatchClass(nodeId: string | undefined): void {
  document
    .querySelectorAll('.func-node.search-current')
    .forEach((el) => el.classList.remove('search-current'));

  if (nodeId === undefined) {
    return;
  }

  const target = document.querySelector(
    `.func-node[data-node-id="${CSS.escape(nodeId)}"]`
  );
  target?.classList.add('search-current');
}

/**
 * 検索ヒット数インジケータの表示を更新する。
 * ヒット 0 件時や未選択時は `0/0` を表示する。
 *
 * @param currentIndex 現在選択中のヒットインデックス（0 始まり、未選択は負値）
 * @param totalHits ヒット総数
 */
function updateIndicator(currentIndex: number, totalHits: number): void {
  if (currentIndex < 0 || totalHits === 0) {
    searchIndicator.textContent = '0/0';
    return;
  }

  searchIndicator.textContent = `${currentIndex + 1}/${totalHits}`;
}

/**
 * 入力欄の生文字列を検索クエリとして正規化する。
 * 現状は前後の空白除去のみ。
 *
 * @param value 入力欄の生文字列
 * @returns 正規化済みクエリ
 */
function normalizeQuery(value: string): string {
  return value.trim();
}
