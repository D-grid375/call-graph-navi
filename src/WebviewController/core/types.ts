import type { CallGraphData, GraphNode, FileGroup } from '../../shared/types';

export type UiMode = 'normal';

export interface NodeViewState {
  visibility: 'visible' | 'hidden';
  selected: boolean;
  highlighted: boolean;
}

export interface SearchState {
  query: string;
  hitIds: string[];
  currentIndex: number;
}

export interface EdgeViewState {
  visibility: 'visible' | 'hidden';
}

export interface NodeVM extends GraphNode {
  view: NodeViewState;
}

export interface EdgeVM {
  id: string;
  from: string;
  to: string;
  view: EdgeViewState;
}

export type FileVM = FileGroup;

export interface GraphViewModel {
  rootNodeId: string;
  direction: CallGraphData['direction'];
  files: FileVM[];
  nodes: NodeVM[];
  edges: EdgeVM[];
}

export interface Transform {
  x: number;
  y: number;
  scale: number;
}

export interface UiState {
  mode: UiMode;
}

export interface VsCodeApi {
  postMessage(message: unknown): void;
  setState<T>(state: T): void;
  getState<T = unknown>(): T | undefined;
}

declare global {
  function acquireVsCodeApi(): VsCodeApi;
  const dagre: {
    graphlib: {
      Graph: new (opts?: { compound?: boolean }) => DagreGraph;
    };
    layout(graph: DagreGraph): void;
  };
}

export interface DagreGraph {
  setGraph(opts: Record<string, unknown>): void;
  setDefaultEdgeLabel(fn: () => Record<string, unknown>): void;
  setNode(id: string, opts: Record<string, unknown>): void;
  setEdge(from: string, to: string): void;
  setParent(child: string, parent: string): void;
  node(id: string): { x: number; y: number; width: number; height: number } | undefined;
  edge(ref: { v: string; w: string }): { points: Array<{ x: number; y: number }> } | undefined;
  edges(): Array<{ v: string; w: string }>;
}
