import { searchIndicator, searchInput } from '../core/dom';
import {
  clearSearchState,
  getSearchState,
  getViewModel,
  setSearchState,
} from '../core/state';
import type { GraphViewModel } from '../core/types';
import { centerOnNode } from '../core/viewport';
import { renderGraph } from './render';

type SearchDirection = 1 | -1;

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

  event.preventDefault();
  event.stopPropagation();

  const query = normalizeQuery(searchInput.value);
  if (!query) {
    clearSearchResults();
    return;
  }

  const direction: SearchDirection = event.shiftKey ? -1 : 1;
  const previous = getSearchState();
  if (query !== previous.query || previous.hitIds.length === 0) {
    runSearch(query, 0);
    return;
  }

  navigateSearch(direction);
}

/**
 * 検索「前へ」ボタン押下時の処理。
 * 直前のヒットへ移動する。クエリが変わっていれば再検索して末尾のヒットを選ぶ。
 */
export function handleSearchPrevClick(): void {
  handleSearchButtonClick(-1);
}

/**
 * 検索「次へ」ボタン押下時の処理。
 * 次のヒットへ移動する。クエリが変わっていれば再検索して先頭のヒットを選ぶ。
 */
export function handleSearchNextClick(): void {
  handleSearchButtonClick(1);
}

/**
 * 検索 UI の状態をリセットする。
 * ViewModel 再ロード時などに呼び出され、保持中のヒット情報を破棄し
 * インジケータを `0/0` 表示に戻す。
 */
export function resetSearchUiState(): void {
  clearSearchState();
  updateIndicator(-1, 0);
}

/**
 * 検索結果を完全にクリアする内部ヘルパー。
 * ハイライトを解除し、状態・インジケータ・current クラスを初期化する。
 * ハイライトに変化があった場合のみ再描画する。
 */
function clearSearchResults(): void {
  const vm = getViewModel();
  const highlightChanged = vm ? updateHighlightedNodes(vm, []) : false;

  clearSearchState();
  updateIndicator(-1, 0);
  updateCurrentMatchClass(undefined);

  if (highlightChanged) {
    renderGraph(false);
  }
}

/**
 * 「前へ/次へ」ボタン押下の共通処理。
 * 空クエリなら結果をクリア、クエリ変更時は再検索、それ以外は指定方向へ移動する。
 *
 * @param direction 移動方向（`1` = 次へ、`-1` = 前へ）
 */
function handleSearchButtonClick(direction: SearchDirection): void {
  const query = normalizeQuery(searchInput.value);
  if (!query) {
    clearSearchResults();
    return;
  }

  const previous = getSearchState();
  if (query !== previous.query || previous.hitIds.length === 0) {
    runSearch(query, direction === 1 ? 0 : 'last');
    return;
  }

  navigateSearch(direction);
}

/**
 * 新しいクエリで検索を実行し、初期選択位置を決めて表示を更新する。
 * ヒット 0 件の場合はハイライト解除のみを反映する。
 *
 * @param query 検索文字列（正規化済み、非空）
 * @param initialIndex 初期選択インデックス。`'last'` は末尾ヒットを選ぶ
 */
function runSearch(query: string, initialIndex: number | 'last'): void {
  const refreshed = refreshSearchResults(query);
  if (refreshed.hitIds.length === 0) {
    if (refreshed.shouldRender) {
      renderGraph(false);
    }
    return;
  }

  const targetIndex =
    initialIndex === 'last' ? refreshed.hitIds.length - 1 : 0;
  setSearchState({
    query,
    hitIds: refreshed.hitIds,
    currentIndex: targetIndex,
  });
  updateIndicator(targetIndex, refreshed.hitIds.length);

  if (refreshed.shouldRender) {
    renderGraph(false);
  }

  centerOnNode(refreshed.hitIds[targetIndex]);
  updateCurrentMatchClass(refreshed.hitIds[targetIndex]);
}

/**
 * 既存の検索結果内で前後のヒットへ移動する。
 * 折りたたみ等でノード集合が変わっている可能性があるためヒットを再計算し、
 * 現在ノードを基準に指定方向へラップ付きで進める。
 *
 * @param direction 移動方向（`1` = 次へ、`-1` = 前へ）
 */
function navigateSearch(direction: SearchDirection): void {
  const previous = getSearchState();
  const currentNodeId =
    previous.currentIndex >= 0 ? previous.hitIds[previous.currentIndex] : undefined;
  const refreshed = refreshSearchResults(previous.query, currentNodeId);

  if (refreshed.hitIds.length === 0) {
    if (refreshed.shouldRender) {
      renderGraph(false);
    }
    return;
  }

  const baseIndex =
    refreshed.currentIndex >= 0
      ? refreshed.currentIndex
      : direction === 1
        ? -1
        : refreshed.hitIds.length;
  const targetIndex = wrapIndex(
    baseIndex + direction,
    refreshed.hitIds.length
  );

  setSearchState({
    query: previous.query,
    hitIds: refreshed.hitIds,
    currentIndex: targetIndex,
  });
  updateIndicator(targetIndex, refreshed.hitIds.length);

  if (refreshed.shouldRender) {
    renderGraph(false);
  }

  centerOnNode(refreshed.hitIds[targetIndex]);
  updateCurrentMatchClass(refreshed.hitIds[targetIndex]);
}

/**
 * 現在の ViewModel から検索ヒットを再収集し、ハイライトと検索状態を更新する。
 * 再描画要否の判定材料として、ハイライト変更有無・ヒット集合変化有無を併せて返す。
 *
 * @param query 検索文字列
 * @param currentNodeId 現在選択中のノード ID。再計算後のヒット列での位置特定に使う
 * @returns 新しいヒット ID 列・その中での現在位置・再描画が必要か
 */
function refreshSearchResults(
  query: string,
  currentNodeId?: string
): {
  hitIds: string[];
  currentIndex: number;
  shouldRender: boolean;
} {
  const vm = getViewModel();
  if (!vm) {
    clearSearchState();
    updateIndicator(-1, 0);
    return { hitIds: [], currentIndex: -1, shouldRender: false };
  }

  const hitIds = collectHitIds(vm, query);
  const highlightChanged = updateHighlightedNodes(vm, hitIds);
  const previous = getSearchState();
  const hitsChanged =
    previous.query !== query || !areStringArraysEqual(previous.hitIds, hitIds);
  const currentIndex =
    currentNodeId !== undefined ? hitIds.indexOf(currentNodeId) : -1;

  setSearchState({
    query,
    hitIds,
    currentIndex,
  });
  updateIndicator(currentIndex, hitIds.length);

  return {
    hitIds,
    currentIndex,
    shouldRender: highlightChanged || hitsChanged,
  };
}

/**
 * ViewModel から検索ヒットとなるノード ID を収集する。
 * 可視ノードのみを対象に、ノード名の部分一致（大文字小文字無視）で判定する。
 *
 * @param vm 対象 ViewModel
 * @param query 検索文字列（正規化済み）
 * @returns ヒットしたノード ID 列
 */
function collectHitIds(vm: GraphViewModel, query: string): string[] {
  const normalizedQuery = query.toLowerCase();
  return vm.nodes
    .filter(
      (node) =>
        node.view.visibility === 'visible' &&
        node.name.toLowerCase().includes(normalizedQuery)
    )
    .map((node) => node.id);
}

/**
 * ViewModel 上の `highlighted` フラグをヒット集合に合わせて更新する。
 * 可視かつヒット対象のノードのみ `true` にする。
 *
 * @param vm 対象 ViewModel
 * @param hitIds ハイライトすべきノード ID 列
 * @returns いずれかのノードの `highlighted` が変化したら `true`
 */
function updateHighlightedNodes(
  vm: GraphViewModel,
  hitIds: string[]
): boolean {
  const hitSet = new Set(hitIds);
  let changed = false;

  for (const node of vm.nodes) {
    const highlighted =
      node.view.visibility === 'visible' && hitSet.has(node.id);
    if (node.view.highlighted !== highlighted) {
      node.view.highlighted = highlighted;
      changed = true;
    }
  }

  return changed;
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

/**
 * 2 つの文字列配列を順序込みで等値比較する。
 * ヒット集合の変化検出に用いる。
 *
 * @param a 比較対象 A
 * @param b 比較対象 B
 * @returns 長さも内容も等しければ `true`
 */
function areStringArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

/**
 * インデックスを `[0, length)` の範囲に循環させる。
 * 負値や `length` 以上でも正しく折り返す剰余計算。
 *
 * @param index 折り返し対象のインデックス
 * @param length 配列長（正の値を想定）
 * @returns 範囲内に正規化されたインデックス
 */
function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}
