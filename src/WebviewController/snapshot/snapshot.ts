import type { ExtensionOptions } from '../../shared/types';
import { vscode } from '../common/types';
import { getExtensionOptions, updateExtensionOptions } from '../settings/settings';
import { getTransform, setTransform, type Transform } from '../transformUI/viewport';
import {
  getViewModel,
  setViewModel,
  type GraphViewModel,
} from '../viewmodel/viewModel';

interface PersistedState {
  viewModel: GraphViewModel | null;
  transform: Transform;
  options: ExtensionOptions;
}

export function persistState(): void {
  const snapshot: PersistedState = {
    viewModel: getViewModel(),
    transform: getTransform(),
    options: getExtensionOptions(),
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
  return true;
}
