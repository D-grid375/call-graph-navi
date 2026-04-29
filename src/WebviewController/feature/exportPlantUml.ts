import { vscode } from '../core/dom';
import { getViewModel, getGraphOrientation } from '../core/state';
import type { GraphViewModel, NodeVM } from '../core/types';

/**
 * 現在表示中のグラフを PlantUML テキストに変換し、Extension Host に送信する。
 *
 * 送信先では `vscode.env.clipboard.writeText` でクリップボードに書き込み、
 * 通知を表示する（Webview 直の clipboard API は権限・フォーカス依存なので避ける）。
 * ViewModel 未ロード時は何もしない。
 */
export function exportPlantUmlToClipboard(): void {
  const vm = getViewModel();
  if (!vm) {
    return;
  }
  const text = buildPlantUmlText(vm);
  vscode.postMessage({ type: 'exportPlantUml', text });
}

/**
 * `GraphViewModel` から PlantUML のテキスト表現を組み立てる。
 *
 * 識別子衝突を完全に避けるため、package には `<basename>_p<N>`、
 * rectangle には `<funcName>_r<N>` という「元名 + 連番サフィックス」の alias を割り当てる。
 * 表示ラベルは元のファイル名・関数名をそのまま使うので、読みやすさも保てる。
 *
 * - `visible` なノード／エッジ／ファイルのみを対象にする
 * - ファイル毎に `package "<basename>" as <basename>_p<N> { ... }` ブロックを出力
 * - ノードは `rectangle "funcA" as funcA_r<N>` 形式で宣言し、アローも alias で参照する
 * - ルートノードには `#LightBlue` の色指定を付ける
 * - どのファイルにも属さないノードはトップレベルに並べる
 *
 * @param vm 対象 ViewModel
 * @returns `@startuml` / `@enduml` で包まれた PlantUML テキスト
 */
function buildPlantUmlText(vm: GraphViewModel): string {
  const visibleNodes = vm.nodes.filter((n) => n.view.visibility === 'visible');
  const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = vm.edges.filter(
    (e) =>
      e.view.visibility === 'visible' &&
      visibleNodeIds.has(e.from) &&
      visibleNodeIds.has(e.to)
  );

  const aliasByNodeId = new Map<string, string>();
  visibleNodes.forEach((node, index) => {
    aliasByNodeId.set(node.id, `${node.name}_r${index + 1}`);
  });

  const nodesByFile = new Map<string, NodeVM[]>();
  for (const node of visibleNodes) {
    const arr = nodesByFile.get(node.filePath) ?? [];
    arr.push(node);
    nodesByFile.set(node.filePath, arr);
  }

  const lines: string[] = ['@startuml'];

  const graphOrientation = getGraphOrientation();
  if (graphOrientation == 'TB') {
    // do nothing
  } else if (graphOrientation == 'LR') {
    lines.push('left to right direction');
  }

  let packageIndex = 1;
  for (const file of vm.files) {
    const nodes = nodesByFile.get(file.filePath);
    if (!nodes || nodes.length === 0) {
      continue;
    }
    lines.push(
      `package "${escapeLabel(file.displayName)}" as ${escapeLabel(
        file.displayName
      )}_p${packageIndex++} {`
    );
    for (const node of nodes) {
      lines.push(`  ${renderNode(node, aliasByNodeId)}`);
    }
    lines.push('}');
    nodesByFile.delete(file.filePath);
  }

  for (const nodes of nodesByFile.values()) {
    for (const node of nodes) {
      lines.push(renderNode(node, aliasByNodeId));
    }
  }

  for (const edge of visibleEdges) {
    const from = aliasByNodeId.get(edge.from);
    const to = aliasByNodeId.get(edge.to);
    if (!from || !to) {
      continue;
    }
    lines.push(`${escapeLabel(from)} --> ${escapeLabel(to)}`);
  }

  lines.push('@enduml');
  return lines.join('\n');
}

/**
 * `NodeVM` 1 件分の PlantUML `rectangle` 宣言行を生成する。
 * ラベルには元の関数名、alias には `<funcName>_r<N>` 形式（連番サフィックス）を出力する。
 * ルートノードには `#LightBlue` を付けて強調する。
 *
 * @param node 対象ノード
 * @param aliasByNodeId ノード ID → alias のマップ
 * @returns `rectangle "funcA" as funcA_r1` 形式の 1 行
 */
function renderNode(node: NodeVM, aliasByNodeId: Map<string, string>): string {
  const alias = aliasByNodeId.get(node.id)!;
  const color = node.isRoot ? ' #LightBlue' : '';
  return `rectangle "${escapeLabel(node.name)}" as ${escapeLabel(alias)}${color}`;
}

/**
 * PlantUML のダブルクォート文字列内で使えるよう、特殊文字をエスケープする。
 *
 * @param text エスケープ前の文字列
 * @returns `"` と `\` を `\"` / `\\` に置換した文字列
 */
function escapeLabel(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
