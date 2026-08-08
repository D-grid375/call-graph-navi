import type { ExtensionOptions } from '../../shared/types';
import { vscode } from '../common/vscodeAPI';
import { getExtensionOptions, updateExtensionOptions } from '../settings/settings';
import { getTransform, setTransform, type Transform } from '../transformView/transformView';
import {
  getViewModel,
  setViewModel,
  type GraphViewModel,
} from '../viewmodel/viewModel';
import {
  getHistoryState,
  setHistoryState,
  type HistoryState,
} from '../viewmodel/viewModelHistory';

interface PersistedState {
  viewModel: GraphViewModel | null;
  transform: Transform;
  options: ExtensionOptions;
  history: HistoryState;
}

export function persistState(): void {
  const snapshot: PersistedState = {
    viewModel: getViewModel(),
    transform: getTransform(),
    options: getExtensionOptions(),
    history: getHistoryState(),
  };
  vscode.setState(snapshot);
}

export function restoreState(): boolean {
  const snapshot = vscode.getState<PersistedState>();
  if (!snapshot || !snapshot.viewModel) {
    return false;
  }
  setViewModel(snapshot.viewModel);
  setTransform(snapshot.transform);
  updateExtensionOptions(snapshot.options);
  setHistoryState(snapshot.history);
  return true;
}
