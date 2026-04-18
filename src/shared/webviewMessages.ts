import type { CallGraphData } from './types';

export type GraphDirection = CallGraphData['direction'];

export interface UpdateGraphMessage {
  type: 'updateGraph';
  data: CallGraphData;
}

export interface NodeClickMessage {
  type: 'nodeClick';
  filePath: string;
  line: number;
  character: number;
}

export interface RequestGraphFromNodeMessage {
  type: 'requestGraphFromNode';
  direction: GraphDirection;
  filePath: string;
  line: number;
  character: number;
}

export interface ExportPlantUmlMessage {
  type: 'exportPlantUml';
  text: string;
}

export type WebviewToExtensionMessage =
  | NodeClickMessage
  | RequestGraphFromNodeMessage
  | ExportPlantUmlMessage;

export type ExtensionToWebviewMessage = UpdateGraphMessage;
