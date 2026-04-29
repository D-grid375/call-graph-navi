import { vscode } from './dom';
import type { GraphViewModel, SearchState, Transform, UiState } from './types';
import { ExtensionOptions } from '../../shared/types';

let currentGraphViewModel: GraphViewModel | null = null;
let currentTransform: Transform = { x: 0, y: 0, scale: 1 };
const uiState: UiState = { mode: 'normal' };
let layoutPositions: Map<string, { x: number; y: number }> = new Map();
let searchState: SearchState = { query: '', hitIds: [], currentIndex: -1 };
let currentOptions: ExtensionOptions;

interface PersistedState {
  viewModel: GraphViewModel | null;
  transform: Transform;
  uiState: UiState;
  options: ExtensionOptions;
}

/**
 * 現在の ViewModel / Transform / UiState を Webview 永続ストレージ
 * (`vscode.setState`) に書き出す。Webview が破棄・再生成された際
 * (タブの別ウィンドウ切り出し等) に {@link restoreState} で復元される。
 */
export function persistState(): void {
  const snapshot: PersistedState = {
    viewModel: currentGraphViewModel,
    transform: currentTransform,
    uiState: { ...uiState },
    options: currentOptions
  };
  vscode.setState(snapshot);
}

/**
 * `vscode.getState` に保存された直近のスナップショットを読み出し、
 * モジュール内の各状態を復元する。
 *
 * @returns 復元できた場合は true、保存データが無ければ false
 */
export function restoreState(): boolean {
  const snapshot = vscode.getState<PersistedState>();
  if (!snapshot || !snapshot.viewModel) {
    return false;
  }
  currentGraphViewModel = snapshot.viewModel;
  currentTransform = snapshot.transform;
  uiState.mode = snapshot.uiState.mode;
  currentOptions = snapshot.options;
  return true;
}

/**
 * 現在表示中の `GraphViewModel` を取得する。
 * 未初期化（updateGraph 未受信）の場合は null を返す。
 *
 * @returns 現在の `GraphViewModel`、未設定なら null
 */
export function getViewModel(): GraphViewModel | null {
  return currentGraphViewModel;
}

/**
 * 表示対象の `GraphViewModel` を差し替える。
 * 通常は `updateGraph` メッセージ受信時に新しい ViewModel を設定する。
 *
 * @param vm 新しく設定する `GraphViewModel`、またはクリアするなら null
 */
export function setViewModel(vm: GraphViewModel | null): void {
  currentGraphViewModel = vm;
  persistState();
}

/**
 * 現在のビューポート変換行列（パン・ズーム状態）を取得する。
 *
 * @returns `{ x, y, scale }` 形式の現在の変換
 */
export function getTransform(): Transform {
  return currentTransform;
}

/**
 * ビューポート変換行列（パン・ズーム状態）を更新する。
 * 実際に SVG に反映するには別途 `applyTransform` を呼ぶ必要がある。
 *
 * @param t 新しい変換状態
 */
export function setTransform(t: Transform): void {
  currentTransform = t;
  persistState();
}

/**
 * UI 状態（`mode` など）のオブジェクトを取得する。
 * 返されるオブジェクトは内部で保持している参照そのものなので、
 * フィールドへの破壊的更新で状態が変化する。
 *
 * @returns 共有されている `UiState` オブジェクト
 */
export function getUiState(): UiState {
  return uiState;
}

/**
 * 指定ノードのレイアウト中心座標（dagre が計算した SVG 座標系）を取得する。
 * `centerOnNode` などセンタリング処理で参照する。
 *
 * @param nodeId 対象ノード ID
 * @returns `{ x, y }`、未登録なら undefined
 */
export function getLayoutPosition(nodeId: string): { x: number; y: number } | undefined {
  return layoutPositions.get(nodeId);
}

/**
 * 描画時に算出したノードのレイアウト座標を一括登録する。
 * `render` 完了後に呼ばれ、以降の検索ジャンプ等で参照される。
 *
 * @param positions `nodeId -> {x, y}` のマップ
 */
export function setLayoutPositions(positions: Map<string, { x: number; y: number }>): void {
  layoutPositions = positions;
}

/**
 * 現在の検索状態（クエリ・ヒット ID 配列・カレント index）を取得する。
 *
 * @returns `SearchState` オブジェクト
 */
export function getSearchState(): SearchState {
  return searchState;
}

/**
 * 検索状態を差し替える。
 *
 * @param state 新しい検索状態
 */
export function setSearchState(state: SearchState): void {
  searchState = state;
}

/**
 * 検索状態を初期値にリセットする。
 * グラフ更新時などに呼び出す。
 */
export function clearSearchState(): void {
  searchState = { query: '', hitIds: [], currentIndex: -1 };
}

/**
 * Managerから取得した拡張設定で内部設定を更新する
 */
export function updateExtensionOptions(options: ExtensionOptions): void {
  currentOptions = options;
}

/**
 * 現在の内部設定を返す
 */
export function getExtensionOptions(): ExtensionOptions {
  return currentOptions;
}

/**
 * グラフ方向設定を返す
 */
export function getGraphOrientation(): string {
  // 現在設定値取得
  const option = getExtensionOptions().graphOrientation;

  // 一応Nullチェックしてから返す
  if (option != null) {
    return option;
  } else {
    return 'TB'; // Nullの時はデフォルト値
  }
}