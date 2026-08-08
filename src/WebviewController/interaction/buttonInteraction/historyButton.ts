import { btnRedo, btnUndo } from '../../dom/dom';
import { renderViewport } from '../../renderViewport/render';
import { canRedo, canUndo, redoVM, undoVM } from '../../viewmodel/viewModelHistory';

/**
 * Undo ボタン押下時の処理。
 * 1 つ前の ViewModel を復元して再描画する。
 */
export function handleUndoClick(): void {
  if (undoVM()) {
    renderViewport(false);
  }
}

/**
 * Redo ボタン押下時の処理。
 * 1 つ先の ViewModel を復元して再描画する。
 */
export function handleRedoClick(): void {
  if (redoVM()) {
    renderViewport(false);
  }
}

/**
 * 履歴の状態に合わせて Undo / Redo ボタンの活性を切り替える。
 */
export function updateHistoryButtonState(): void {
  btnUndo.disabled = !canUndo();
  btnRedo.disabled = !canRedo();
}
