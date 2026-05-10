export interface SearchState {
  query: string;
  hitIds: string[];
  currentIndex: number;
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
