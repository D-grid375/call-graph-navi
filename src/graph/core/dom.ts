import type { VsCodeApi } from './types';

export const vscode: VsCodeApi = acquireVsCodeApi();

export const svg = document.getElementById('graph') as unknown as SVGSVGElement;
export const viewport = document.getElementById('viewport') as unknown as SVGGElement;
export const tooltip = document.getElementById('tooltip') as HTMLElement;
export const contextMenu = document.getElementById('node-context-menu') as HTMLDivElement;
export const contextMenuOutgoing = document.getElementById(
  'node-context-menu-outgoing'
) as HTMLButtonElement;
export const contextMenuIncoming = document.getElementById(
  'node-context-menu-incoming'
) as HTMLButtonElement;
export const contextMenuShowPathToRoot = document.getElementById(
  'node-context-menu-show-path-to-root'
) as HTMLButtonElement;
export const info = document.getElementById('info') as HTMLElement;
export const btnReset = document.getElementById('btn-reset') as HTMLButtonElement;
export const btnShowAll = document.getElementById('btn-show-all') as HTMLButtonElement;
export const btnHideAll = document.getElementById('btn-hide-all') as HTMLButtonElement;
export const btnExportPlantUml = document.getElementById('btn-export-plantuml') as HTMLButtonElement;
export const searchInput = document.getElementById('search-input') as HTMLInputElement;
export const btnSearchPrev = document.getElementById('btn-search-prev') as HTMLButtonElement;
export const btnSearchNext = document.getElementById('btn-search-next') as HTMLButtonElement;
export const searchIndicator = document.getElementById('search-indicator') as HTMLElement;
