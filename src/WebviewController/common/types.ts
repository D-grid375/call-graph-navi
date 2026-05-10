export interface VsCodeApi {
  postMessage(message: unknown): void;
  setState<T>(state: T): void;
  getState<T = unknown>(): T | undefined;
}

declare global {
  function acquireVsCodeApi(): VsCodeApi;
}

export const vscode: VsCodeApi = acquireVsCodeApi();
