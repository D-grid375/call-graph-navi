import { type GraphViewModel } from '../viewmodel/viewModel';

export interface SearchState {
  query: string;
  hitIds: string[];
  currentIndex: number;
}

export const SearchDirection = {
  Forward: 1,
  Backward: -1,
} as const;
export type SearchDirection = (typeof SearchDirection)[keyof typeof SearchDirection];

/**
 * 検索ロジックの結果。UI 更新（再描画・インジケータ・ハイライト反映）に
 * 必要な情報のみを返し、DOM/描画は呼び出し側が担う。
 */
export interface SearchResult {
  hitIds: string[];
  currentIndex: number;
  totalHits: number;
  currentNodeId: string | undefined;
  hitsOrHighlightChanged: boolean;
}

let searchState: SearchState = { query: '', hitIds: [], currentIndex: -1 };

export function getSearchState(): SearchState {
  return searchState;
}

export function setSearchState(state: SearchState): void {
  searchState = state;
}

export function clearSearchState(): void {
  searchState = { query: '', hitIds: [], currentIndex: -1 };
}

/**
 * 新しいクエリで検索を実行し、初期選択位置を決めて検索状態を更新する。
 *
 * @param query 検索文字列（正規化済み、非空）
 * @param initialIndex 初期選択インデックス。`'last'` は末尾ヒットを選ぶ
 */
export function runSearch(
  query: string,
  initialIndex: number | 'last',
  vm: GraphViewModel
): SearchResult {
  const refreshed = refreshSearchResults(query, vm);
  if (refreshed.hitIds.length === 0) {
    return {
      hitIds: [],
      currentIndex: -1,
      totalHits: 0,
      currentNodeId: undefined,
      hitsOrHighlightChanged: refreshed.hitsOrHighlightChanged,
    };
  }

  const targetIndex =
    initialIndex === 'last' ? refreshed.hitIds.length - 1 : 0;
  setSearchState({
    query,
    hitIds: refreshed.hitIds,
    currentIndex: targetIndex,
  });

  return {
    hitIds: refreshed.hitIds,
    currentIndex: targetIndex,
    totalHits: refreshed.hitIds.length,
    currentNodeId: refreshed.hitIds[targetIndex],
    hitsOrHighlightChanged: refreshed.hitsOrHighlightChanged,
  };
}

/**
 * 既存の検索結果内で前後のヒットへ移動する。
 * 折りたたみ等でノード集合が変わっている可能性があるためヒットを再計算し、
 * 現在ノードを基準に指定方向へラップ付きで進める。
 *
 * @param direction 移動方向（`1` = 次へ、`-1` = 前へ）
 */
export function updateHitState(direction: SearchDirection, vm: GraphViewModel): SearchResult {
  const previous = getSearchState();
  const currentNodeId =
    previous.currentIndex >= 0
      ? previous.hitIds[previous.currentIndex]
      : undefined;
  const refreshed = refreshSearchResults(previous.query, vm, currentNodeId);

  if (refreshed.hitIds.length === 0) {
    return {
      hitIds: [],
      currentIndex: -1,
      totalHits: 0,
      currentNodeId: undefined,
      hitsOrHighlightChanged: refreshed.hitsOrHighlightChanged,
    };
  }

  const baseIndex =
    refreshed.currentIndex >= 0
      ? refreshed.currentIndex
      : direction === SearchDirection.Forward
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

  return {
    hitIds: refreshed.hitIds,
    currentIndex: targetIndex,
    totalHits: refreshed.hitIds.length,
    currentNodeId: refreshed.hitIds[targetIndex],
    hitsOrHighlightChanged: refreshed.hitsOrHighlightChanged,
  };
}

/**
 * 現在の ViewModel から検索ヒットを再収集し、検索状態を更新する。
 * 呼び出し側でハイライト反映・インジケータ更新を行うため、
 * ヒット集合に変化があったかも併せて返す。
 *
 * @param query 検索文字列
 * @param currentNodeId 現在選択中のノード ID。再計算後のヒット列での位置特定に使う
 */
function refreshSearchResults(
  query: string,
  vm: GraphViewModel,
  currentNodeId?: string
): {
  hitIds: string[];
  currentIndex: number;
  hitsOrHighlightChanged: boolean;
} {
  if (!vm) {
    clearSearchState();
    return { hitIds: [], currentIndex: -1, hitsOrHighlightChanged: false };
  }

  const hitIds = collectHitIds(vm, query);
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

  return {
    hitIds,
    currentIndex,
    hitsOrHighlightChanged: hitsChanged,
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
