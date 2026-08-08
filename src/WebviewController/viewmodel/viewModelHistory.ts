/**
 * @abstract
 * ViewModel の履歴（Undo / Redo）を管理する。
 *
 * ViewModel は各操作で破壊的に更新されるため、記録時にディープコピーを取る。
 * コピーを取らないとリストの全要素が同じオブジェクトを指し、履歴が機能しない。
 */

import { getViewModel, setViewModel, type GraphViewModel } from './viewModel';

/** 保持する履歴の上限。超えた分は古いものから捨てる */
const HISTORY_LIMIT = 50;

/**
 * 履歴本体。`index` は現在位置を指す。
 * `index` より後ろは Redo 可能な未来の状態。
 */
let history: GraphViewModel[] = [];
let index = -1; // -1で履歴無し　履歴有の時、index=0が最古の履歴

/** 履歴の状態が変化したときに通知するコールバック（ボタンの活性制御用） */
let historyChangeCallback: (() => void) | undefined;

export function setHistoryChangeCallback(callback: () => void): void {
  historyChangeCallback = callback;
}

/** 履歴の内容が変化したときにスナップショットを更新させるコールバック */
let persistStateCallback: (() => void) | undefined;

export function setHistoryPersistStateCallback(callback: () => void): void {
  persistStateCallback = callback;
}

/** スナップショットに保存する履歴の状態 */
export interface HistoryState {
  history: GraphViewModel[];
  index: number;
}

/**
 * 現在の履歴の状態を返す。スナップショット保存用。
 */
export function getHistoryState(): HistoryState {
  return { history, index };
}

/**
 * スナップショットから履歴の状態を復元する。
 * ViewModel 自体の復元は `restoreState` 側で別途行う。
 */
export function setHistoryState(state: HistoryState | undefined): void {
  history = state?.history ?? [];
  index = state?.index ?? -1;
  historyChangeCallback?.();
}

/**
 * ViewModel をディープコピーする。
 * `structuredClone` は Chromium で利用可能で、関数を含まない純粋なデータのみの
 * ViewModel であれば問題なく複製できる。
 */
function cloneViewModel(vm: GraphViewModel): GraphViewModel {
  return structuredClone(vm);
}

/**
 * 2 つの ViewModel が同一内容かを判定する。
 * 差分の無いViewModelを記録させないために使用する。
 * 大規模グラフだと毎回の処理が重くなるので現状コールしていない。
 *
 * ViewModel は関数を含まない純粋なデータで、生成時のキー順も一定であるため
 * JSON 文字列の比較で十分に判定できる。
 */
function isSameViewModel(a: GraphViewModel, b: GraphViewModel): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * 現在の ViewModel を履歴に記録する。
 *
 * Undo で過去に戻っている状態で記録すると、それより後ろの Redo 分は破棄される
 * （一般的な Undo / Redo の挙動）。
 */
export function pushHistory(): void {
  const vm = getViewModel();
  if (!vm) {
    return;
  }

  history = history.slice(0, index + 1); // 新履歴記録時、未来の履歴は無効になるので切り捨てる（0~indexまでの履歴のみ残す）
  history.push(cloneViewModel(vm));      // 新履歴を配列に追加

  // 上限を超えたら古いものから捨てる
  if (history.length > HISTORY_LIMIT) {
    history.shift(); // 配列を1つ左にシフトする
  }

  index = history.length - 1;
  historyChangeCallback?.();
  persistStateCallback?.();
}

/**
 * 履歴を 1 つ前に戻し、その ViewModel を現在の状態に復元する。
 *
 * @returns 復元できたら `true`、これ以上戻れないなら `false`
 */
export function undoVM(): boolean {
  if (!canUndo()) {
    return false;
  }

  index -= 1;
  applyHistoryEntry();
  return true;
}

/**
 * 履歴を 1 つ先に進め、その ViewModel を現在の状態に復元する。
 *
 * @returns 復元できたら `true`、これ以上進めないなら `false`
 */
export function redoVM(): boolean {
  if (!canRedo()) {
    return false;
  }

  index += 1;
  applyHistoryEntry();
  return true;
}

/**
 * 現在位置の履歴を ViewModel に反映する。
 *
 * 履歴側もコピーを渡す。そのまま渡すと以降の操作で履歴内の
 * オブジェクトが破壊的に書き換えられてしまうため。
 */
function applyHistoryEntry(): void {
  const entry = history[index];
  if (!entry) {
    return;
  }
  setViewModel(cloneViewModel(entry));
  historyChangeCallback?.();
  persistStateCallback?.();
}

export function canUndo(): boolean {
  return index > 0;
}

export function canRedo(): boolean {
  return index >= 0 && index < history.length - 1;
}

/**
 * 履歴を全て破棄する。新しいグラフを読み込んだ際に使う。
 */
export function clearHistory(): void {
  history = [];
  index = -1;
  historyChangeCallback?.();
  persistStateCallback?.();
}
