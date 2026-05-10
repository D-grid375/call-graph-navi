import { infoSummaryText, tooltip, viewport } from '../dom/dom';
import { clearInfoTree, renderInfoTree } from '../interaction/infoTree';
import { getGraphOrientation } from '../settings/settings';
import {
  getViewModel,
  type GraphViewModel,
  type NodeVM,
} from '../viewmodel/viewModel';
import { makeEdgeId } from '../common/util';
import {
  applyTransform,
  resetView,
  setLayoutPositions,
} from '../transformUI/viewport';

interface DagreGraph {
  setGraph(opts: Record<string, unknown>): void;
  setDefaultEdgeLabel(fn: () => Record<string, unknown>): void;
  setNode(id: string, opts: Record<string, unknown>): void;
  setEdge(from: string, to: string): void;
  setParent(child: string, parent: string): void;
  node(id: string): { x: number; y: number; width: number; height: number } | undefined;
  edge(ref: { v: string; w: string }): { points: Array<{ x: number; y: number }> } | undefined;
  edges(): Array<{ v: string; w: string }>;
}

// dagre.min.js は graph.html でこのバンドルより先に読み込まれるため、
// import ではなく実行時のグローバル変数として存在する。
declare global {
  const dagre: {
    graphlib: {
      Graph: new (opts?: { compound?: boolean }) => DagreGraph;
    };
    layout(graph: DagreGraph): void;
  };
}

const PADDING = 20;
const NODE_HEIGHT = 28;
const FILE_REMOVE_BUTTON_SIZE = 16;
const FILE_REMOVE_BUTTON_MARGIN = 8;
const FILE_HEADER_EXTRA_GAP = 4;
const NODE_REMOVE_BUTTON_SIZE = 12;
const NODE_REMOVE_BUTTON_MARGIN_VERTICAL =
  (NODE_HEIGHT - NODE_REMOVE_BUTTON_SIZE) / 2;
const NODE_REMOVE_BUTTON_MARGIN_LEFT = 8;
const NODE_REMOVE_BUTTON_MARGIN_RIGHT = 0;
const NODE_REMOVE_BUTTON_AREA =
  NODE_REMOVE_BUTTON_MARGIN_LEFT +
  NODE_REMOVE_BUTTON_SIZE +
  NODE_REMOVE_BUTTON_MARGIN_RIGHT;
const NODE_LABEL_MARGIN_LEFT = 12;
const NODE_LABEL_MARGIN_RIGHT = 12;
let persistStateCallback: (() => void) | undefined;

export function setRenderPersistStateCallback(callback: () => void): void {
  persistStateCallback = callback;
}

function estimateWidth(text: string): number {
  return Math.max(
    80,
    text.length * 7 + NODE_LABEL_MARGIN_LEFT + NODE_LABEL_MARGIN_RIGHT
  );
}

function buildNodeClassName(node: NodeVM): string {
  const classNames = ['func-node'];
  if (node.isRoot) {
    classNames.push('root');
  }
  if (node.view.selected) {
    classNames.push('selected');
  }
  if (node.view.highlighted) {
    classNames.push('matched');
  }
  return classNames.join(' ');
}

function clearViewport(): void {
  while (viewport.firstChild) {
    viewport.removeChild(viewport.firstChild);
  }
  tooltip.classList.add('hidden');
}

function pointsToPath(points: Array<{ x: number; y: number }>): string {
  if (!points || points.length === 0) {
    return '';
  }

  if (points.length < 3) {
    let d = `M${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L${points[i].x},${points[i].y}`;
    }
    return d;
  }

  const R = 5;
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    const r = Math.min(R, len1 / 2, len2 / 2);
    const bx = curr.x - (dx1 / len1) * r;
    const by = curr.y - (dy1 / len1) * r;
    const ax = curr.x + (dx2 / len2) * r;
    const ay = curr.y + (dy2 / len2) * r;

    d += ` L${bx},${by} Q${curr.x},${curr.y} ${ax},${ay}`;
  }
  const last = points[points.length - 1];
  d += ` L${last.x},${last.y}`;
  return d;
}

/**
 * グラフ描画のメイン関数。グラフの新規描画・更新の際はこれをコールする。
 *
 * 現在の `GraphViewModel` を `state.ts` から取得して {@link render} に委譲する。
 * ViewModel 未設定の場合は情報ラベルをリセットして viewport をクリアするだけ。
 *
 * @param resetViewport true なら描画後にビューポート変換を初期化し、false なら現在の変換を維持する
 */
export function renderGraph(resetViewport: boolean): void {
  const vm = getViewModel();
  if (!vm) {
    infoSummaryText.textContent = 'No graph loaded.';
    clearInfoTree();
    clearViewport();
    setLayoutPositions(new Map());
    return;
  }
  render(vm, resetViewport);
  persistStateCallback?.();
}

/**
 * ViewModel を元に情報ラベル更新・dagre レイアウト計算・SVG 描画までを一括で行う。
 *
 * 手順:
 * 1. `visibility = 'visible'` なノード／エッジ／ファイルだけを抽出
 * 2. 情報ラベル（モード・方向・表示中要素数）を更新
 * 3. viewport をクリア
 * 4. `dagre.graphlib.Graph({ compound: true })` にファイルグループ（親）＋関数ノード（子）＋エッジを登録し `dagre.layout`
 * 5. ファイルグループ矩形・関数ノード矩形・エッジパスを SVG に描画
 * 6. `resetViewport` に応じて `resetView()` か `applyTransform()` を呼ぶ
 *
 * ルートを含まないファイルグループにのみ `×` 閉じボタンを描画する。
 *
 * @param viewModel 描画対象の `GraphViewModel`
 * @param resetViewport true なら描画後にビューポート変換を初期化する
 */
function render(viewModel: GraphViewModel, resetViewport: boolean): void {
  const visibleNodes = viewModel.nodes.filter(
    (node) => node.view.visibility === 'visible'
  );
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = viewModel.edges.filter(
    (edge) =>
      edge.view.visibility === 'visible' &&
      visibleNodeIds.has(edge.from) &&
      visibleNodeIds.has(edge.to)
  );
  const visibleFiles = viewModel.files.filter((file) =>
    file.nodeIds.some((nodeId) => visibleNodeIds.has(nodeId))
  );

  infoSummaryText.textContent =
    `Direction: ${viewModel.direction}  |  ` +
    `Visible Nodes: ${visibleNodes.length}/${viewModel.nodes.length}  |  ` +
    `Visible Files: ${visibleFiles.length}/${viewModel.files.length}`;

  renderInfoTree(viewModel);

  clearViewport();

  if (visibleNodes.length === 0) {
    setLayoutPositions(new Map());
    if (resetViewport) {
      resetView();
    } else {
      applyTransform();
    }
    return;
  }

  const graph = new dagre.graphlib.Graph({ compound: true });
  const graphOrientation = getGraphOrientation();
  graph.setGraph({
    rankdir: graphOrientation,
    nodesep: 30,
    ranksep: 60,
    marginx: PADDING,
    marginy: PADDING,
  });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const file of visibleFiles) {
    graph.setNode(file.filePath, {
      label: file.displayName,
      clusterLabelPos: 'top',
    });
  }

  for (const node of visibleNodes) {
    graph.setNode(node.id, {
      label: node.name,
      width:
        estimateWidth(node.name) + (node.isRoot ? 0 : NODE_REMOVE_BUTTON_AREA),
      height: NODE_HEIGHT,
    });
    graph.setParent(node.id, node.filePath);
  }

  for (const edge of visibleEdges) {
    graph.setEdge(edge.from, edge.to);
  }

  dagre.layout(graph);

  const positions = new Map<string, { x: number; y: number }>();
  for (const node of visibleNodes) {
    const layoutNode = graph.node(node.id);
    if (!layoutNode) {
      continue;
    }
    positions.set(node.id, { x: layoutNode.x, y: layoutNode.y });
  }
  setLayoutPositions(positions);

  for (const file of visibleFiles) {
    const layoutNode = graph.node(file.filePath);
    if (!layoutNode) {
      continue;
    }

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'file-group');
    (group as unknown as HTMLElement).dataset.filePath = file.filePath;

    const x = layoutNode.x - layoutNode.width / 2;
    const y = layoutNode.y - layoutNode.height / 2;
    const fileRectY = y - FILE_HEADER_EXTRA_GAP;
    const fileRectHeight = layoutNode.height + FILE_HEADER_EXTRA_GAP;
    const hasRemoveButton = !file.nodeIds.includes(viewModel.rootNodeId);
    const headerCenterY =
      fileRectY + FILE_REMOVE_BUTTON_MARGIN + FILE_REMOVE_BUTTON_SIZE / 2;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(fileRectY));
    rect.setAttribute('width', String(layoutNode.width));
    rect.setAttribute('height', String(fileRectHeight));
    group.appendChild(rect);

    if (hasRemoveButton) {
      const buttonGroup = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'g'
      );
      buttonGroup.setAttribute('class', 'file-remove-button');

      const buttonGroupEl = buttonGroup as unknown as HTMLElement;
      buttonGroupEl.dataset.filePath = file.filePath;

      const buttonX = x + FILE_REMOVE_BUTTON_MARGIN;
      const buttonY = fileRectY + FILE_REMOVE_BUTTON_MARGIN;

      const buttonRect = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'rect'
      );
      buttonRect.setAttribute('x', String(buttonX));
      buttonRect.setAttribute('y', String(buttonY));
      buttonRect.setAttribute('width', String(FILE_REMOVE_BUTTON_SIZE));
      buttonRect.setAttribute('height', String(FILE_REMOVE_BUTTON_SIZE));
      buttonGroup.appendChild(buttonRect);

      const buttonText = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'text'
      );
      buttonText.setAttribute(
        'x',
        String(buttonX + FILE_REMOVE_BUTTON_SIZE / 2)
      );
      buttonText.setAttribute(
        'y',
        String(headerCenterY)
      );
      buttonText.setAttribute('text-anchor', 'middle');
      buttonText.setAttribute('dominant-baseline', 'middle');
      buttonText.textContent = '\u00d7';
      buttonGroup.appendChild(buttonText);

      group.appendChild(buttonGroup);
    }

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute(
      'x',
      String(
        x +
          (hasRemoveButton
            ? FILE_REMOVE_BUTTON_MARGIN * 2 + FILE_REMOVE_BUTTON_SIZE
            : 10)
      )
    );
    text.setAttribute('y', String(headerCenterY));
    text.setAttribute('dominant-baseline', 'middle');
    text.textContent = file.displayName;
    group.appendChild(text);

    viewport.appendChild(group);
  }

  for (const node of visibleNodes) {
    const layoutNode = graph.node(node.id);
    if (!layoutNode) {
      continue;
    }

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', buildNodeClassName(node));
    const groupEl = group as unknown as HTMLElement;
    groupEl.dataset.nodeId = node.id;
    groupEl.dataset.filePath = node.filePath;

    const x = layoutNode.x - layoutNode.width / 2;
    const y = layoutNode.y - layoutNode.height / 2;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', String(layoutNode.width));
    rect.setAttribute('height', String(layoutNode.height));
    group.appendChild(rect);

    const textAreaLeft = node.isRoot
      ? x
      : x + NODE_REMOVE_BUTTON_AREA;
    const textAreaRight = x + layoutNode.width;
    const textX =
      (textAreaLeft + NODE_LABEL_MARGIN_LEFT + textAreaRight - NODE_LABEL_MARGIN_RIGHT) / 2;

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', String(textX));
    text.setAttribute('y', String(layoutNode.y + 4));
    text.setAttribute('text-anchor', 'middle');
    text.textContent = node.name;
    group.appendChild(text);

    group.addEventListener('mouseenter', () => {
      tooltip.textContent =
        `${node.name}  (${node.kind})\n` +
        `${node.filePath}:${node.line + 1}\n` +
        `Click: open source`;
      tooltip.style.whiteSpace = 'pre';
      tooltip.classList.remove('hidden');
    });

    group.addEventListener('mousemove', (event) => {
      tooltip.style.left = event.clientX + 12 + 'px';
      tooltip.style.top = event.clientY + 12 + 'px';
    });

    group.addEventListener('mouseleave', () => {
      tooltip.classList.add('hidden');
    });

    if (!node.isRoot) {
      const buttonGroup = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'g'
      );
      buttonGroup.setAttribute('class', 'node-remove-button');
      const buttonGroupEl = buttonGroup as unknown as HTMLElement;
      buttonGroupEl.dataset.nodeId = node.id;

      const buttonX = x + NODE_REMOVE_BUTTON_MARGIN_LEFT;
      const buttonY = y + NODE_REMOVE_BUTTON_MARGIN_VERTICAL;

      const buttonRect = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'rect'
      );
      buttonRect.setAttribute('x', String(buttonX));
      buttonRect.setAttribute('y', String(buttonY));
      buttonRect.setAttribute('width', String(NODE_REMOVE_BUTTON_SIZE));
      buttonRect.setAttribute('height', String(NODE_REMOVE_BUTTON_SIZE));
      buttonGroup.appendChild(buttonRect);

      const buttonText = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'text'
      );
      buttonText.setAttribute(
        'x',
        String(buttonX + NODE_REMOVE_BUTTON_SIZE / 2)
      );
      buttonText.setAttribute(
        'y',
        String(buttonY + NODE_REMOVE_BUTTON_SIZE / 2)
      );
      buttonText.setAttribute('text-anchor', 'middle');
      buttonText.setAttribute('dominant-baseline', 'middle');
      buttonText.textContent = '\u00d7';
      buttonGroup.appendChild(buttonText);

      group.appendChild(buttonGroup);
    }

    viewport.appendChild(group);
  }

  graph.edges().forEach((edgeRef) => {
    const layoutEdge = graph.edge(edgeRef);
    if (!layoutEdge || !layoutEdge.points) {
      return;
    }

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'edge');
    const groupEl = group as unknown as HTMLElement;
    groupEl.dataset.edgeId = makeEdgeId(edgeRef.v, edgeRef.w);
    groupEl.dataset.from = edgeRef.v;
    groupEl.dataset.to = edgeRef.w;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pointsToPath(layoutEdge.points));
    path.setAttribute('marker-end', 'url(#arrow)');
    group.appendChild(path);

    viewport.appendChild(group);
  });

  if (resetViewport) {
    resetView();
  } else {
    applyTransform();
  }
}
