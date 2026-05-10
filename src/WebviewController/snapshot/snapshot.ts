import type { ExtensionOptions } from '../../shared/types';
import { vscode } from '../common/types';
import { getExtensionOptions, updateExtensionOptions } from '../settings/settings';
import { getTransform, restoreTransform, type Transform } from '../transformUI/viewport';
import {
  getViewModel,
  restoreViewModel,
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
  restoreViewModel(snapshot.viewModel);
  restoreTransform(snapshot.transform);
  updateExtensionOptions(snapshot.options);
  return true;
}
