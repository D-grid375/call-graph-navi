import type { ExtensionOptions } from '../../shared/types';

let currentOptions: ExtensionOptions;

export function updateExtensionOptions(options: ExtensionOptions): void {
  currentOptions = options;
}

export function getExtensionOptions(): ExtensionOptions {
  return currentOptions;
}

export function getGraphOrientation(): string {
  const option = getExtensionOptions().graphOrientation;

  if (option != null) {
    return option;
  } else {
    return 'TB';
  }
}

export function getPngExportScale(): number {
  const PNG_EXPORT_SCALE_DEFAULT = 4;
  const PNG_EXPORT_SCALE_MAP: Record<string, number> = {
    '1x': 1,
    '2x': 2,
    '4x': 4,
    '8x': 8,
  };

  const option = getExtensionOptions().pngExportScale;

  return PNG_EXPORT_SCALE_MAP[option] ?? PNG_EXPORT_SCALE_DEFAULT;
}
