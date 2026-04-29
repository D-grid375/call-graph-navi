"use strict";
(() => {
  // src/WebviewController/core/dom.ts
  var vscode = acquireVsCodeApi();
  var svg = document.getElementById("graph");
  var viewport = document.getElementById("viewport");
  var tooltip = document.getElementById("tooltip");
  var contextMenu = document.getElementById("node-context-menu");
  var contextMenuOutgoing = document.getElementById(
    "node-context-menu-outgoing"
  );
  var contextMenuIncoming = document.getElementById(
    "node-context-menu-incoming"
  );
  var contextMenuShowPathToRoot = document.getElementById(
    "node-context-menu-show-path-to-root"
  );
  var info = document.getElementById("info");
  var btnReset = document.getElementById("btn-reset");
  var btnShowAll = document.getElementById("btn-show-all");
  var btnHideAll = document.getElementById("btn-hide-all");
  var btnExportPlantUml = document.getElementById("btn-export-plantuml");
  var btnExportSvg = document.getElementById("btn-export-svg");
  var btnExportPng = document.getElementById("btn-export-png");
  var searchInput = document.getElementById("search-input");
  var btnSearchPrev = document.getElementById("btn-search-prev");
  var btnSearchNext = document.getElementById("btn-search-next");
  var searchIndicator = document.getElementById("search-indicator");

  // src/WebviewController/core/state.ts
  var currentGraphViewModel = null;
  var currentTransform = { x: 0, y: 0, scale: 1 };
  var uiState = { mode: "normal" };
  var layoutPositions = /* @__PURE__ */ new Map();
  var searchState = { query: "", hitIds: [], currentIndex: -1 };
  var currentOptions;
  function persistState() {
    const snapshot = {
      viewModel: currentGraphViewModel,
      transform: currentTransform,
      uiState: { ...uiState },
      options: currentOptions
    };
    vscode.setState(snapshot);
  }
  function restoreState() {
    const snapshot = vscode.getState();
    if (!snapshot || !snapshot.viewModel) {
      return false;
    }
    currentGraphViewModel = snapshot.viewModel;
    currentTransform = snapshot.transform;
    uiState.mode = snapshot.uiState.mode;
    currentOptions = snapshot.options;
    return true;
  }
  function getViewModel() {
    return currentGraphViewModel;
  }
  function setViewModel(vm) {
    currentGraphViewModel = vm;
    persistState();
  }
  function getTransform() {
    return currentTransform;
  }
  function setTransform(t) {
    currentTransform = t;
    persistState();
  }
  function getUiState() {
    return uiState;
  }
  function getLayoutPosition(nodeId) {
    return layoutPositions.get(nodeId);
  }
  function setLayoutPositions(positions) {
    layoutPositions = positions;
  }
  function getSearchState() {
    return searchState;
  }
  function setSearchState(state) {
    searchState = state;
  }
  function clearSearchState() {
    searchState = { query: "", hitIds: [], currentIndex: -1 };
  }
  function updateExtensionOptions(options) {
    currentOptions = options;
  }
  function getExtensionOptions() {
    return currentOptions;
  }
  function getGraphOrientation() {
    const option = getExtensionOptions().graphOrientation;
    if (option != null) {
      return option;
    } else {
      return "TB";
    }
  }

  // src/WebviewController/core/util.ts
  var NODE_LABEL_MARGIN_LEFT = 12;
  var NODE_LABEL_MARGIN_RIGHT = 12;
  function makeEdgeId(from, to) {
    return `${from}->${to}`;
  }
  function estimateWidth(text) {
    return Math.max(80, text.length * 7 + NODE_LABEL_MARGIN_LEFT + NODE_LABEL_MARGIN_RIGHT);
  }
  function buildNodeClassName(node) {
    const classNames = ["func-node"];
    if (node.isRoot) {
      classNames.push("root");
    }
    if (node.view.selected) {
      classNames.push("selected");
    }
    if (node.view.highlighted) {
      classNames.push("matched");
    }
    return classNames.join(" ");
  }
  function clearViewport() {
    while (viewport.firstChild) {
      viewport.removeChild(viewport.firstChild);
    }
    tooltip.classList.add("hidden");
  }
  function pointsToPath(points) {
    if (!points || points.length === 0) {
      return "";
    }
    if (points.length < 3) {
      let d2 = `M${points[0].x},${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        d2 += ` L${points[i].x},${points[i].y}`;
      }
      return d2;
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
      const bx = curr.x - dx1 / len1 * r;
      const by = curr.y - dy1 / len1 * r;
      const ax = curr.x + dx2 / len2 * r;
      const ay = curr.y + dy2 / len2 * r;
      d += ` L${bx},${by} Q${curr.x},${curr.y} ${ax},${ay}`;
    }
    const last = points[points.length - 1];
    d += ` L${last.x},${last.y}`;
    return d;
  }

  // src/WebviewController/core/viewport.ts
  function applyTransform() {
    const t = getTransform();
    viewport.setAttribute(
      "transform",
      `translate(${t.x},${t.y}) scale(${t.scale})`
    );
  }
  function resetView() {
    setTransform({ x: 0, y: 0, scale: 1 });
    applyTransform();
  }
  function centerOnNode(nodeId) {
    const pos = getLayoutPosition(nodeId);
    if (!pos) {
      return;
    }
    const rect = svg.getBoundingClientRect();
    const { scale } = getTransform();
    setTransform({
      x: rect.width / 2 - pos.x * scale,
      y: rect.height / 2 - pos.y * scale,
      scale
    });
    applyTransform();
  }

  // src/WebviewController/feature/render.ts
  var PADDING = 20;
  var NODE_HEIGHT = 28;
  var FILE_REMOVE_BUTTON_SIZE = 16;
  var FILE_REMOVE_BUTTON_MARGIN = 8;
  var FILE_HEADER_EXTRA_GAP = 4;
  var NODE_REMOVE_BUTTON_SIZE = 12;
  var NODE_REMOVE_BUTTON_MARGIN_VERTICAL = (NODE_HEIGHT - NODE_REMOVE_BUTTON_SIZE) / 2;
  var NODE_REMOVE_BUTTON_MARGIN_LEFT = 8;
  var NODE_REMOVE_BUTTON_MARGIN_RIGHT = 0;
  var NODE_REMOVE_BUTTON_AREA = NODE_REMOVE_BUTTON_MARGIN_LEFT + NODE_REMOVE_BUTTON_SIZE + NODE_REMOVE_BUTTON_MARGIN_RIGHT;
  function renderGraph(resetViewport) {
    const vm = getViewModel();
    if (!vm) {
      info.textContent = "No graph loaded.";
      clearViewport();
      setLayoutPositions(/* @__PURE__ */ new Map());
      return;
    }
    render(vm, resetViewport);
    persistState();
  }
  function render(viewModel, resetViewport) {
    const uiState2 = getUiState();
    const visibleNodes = viewModel.nodes.filter(
      (node) => node.view.visibility === "visible"
    );
    const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
    const visibleEdges = viewModel.edges.filter(
      (edge) => edge.view.visibility === "visible" && visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to)
    );
    const visibleFiles = viewModel.files.filter(
      (file) => file.nodeIds.some((nodeId) => visibleNodeIds.has(nodeId))
    );
    info.textContent = // `Mode: ${formatModeLabel(uiState.mode)} | ` +
    `Direction: ${viewModel.direction}  |  Visible Nodes: ${visibleNodes.length}/${viewModel.nodes.length}  |  Visible Files: ${visibleFiles.length}/${viewModel.files.length}`;
    clearViewport();
    if (visibleNodes.length === 0) {
      setLayoutPositions(/* @__PURE__ */ new Map());
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
      marginy: PADDING
    });
    graph.setDefaultEdgeLabel(() => ({}));
    for (const file of visibleFiles) {
      graph.setNode(file.filePath, {
        label: file.displayName,
        clusterLabelPos: "top"
      });
    }
    for (const node of visibleNodes) {
      graph.setNode(node.id, {
        label: node.name,
        width: estimateWidth(node.name) + (node.isRoot ? 0 : NODE_REMOVE_BUTTON_AREA),
        height: NODE_HEIGHT
      });
      graph.setParent(node.id, node.filePath);
    }
    for (const edge of visibleEdges) {
      graph.setEdge(edge.from, edge.to);
    }
    dagre.layout(graph);
    const positions = /* @__PURE__ */ new Map();
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
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("class", "file-group");
      group.dataset.filePath = file.filePath;
      const x = layoutNode.x - layoutNode.width / 2;
      const y = layoutNode.y - layoutNode.height / 2;
      const fileRectY = y - FILE_HEADER_EXTRA_GAP;
      const fileRectHeight = layoutNode.height + FILE_HEADER_EXTRA_GAP;
      const hasRemoveButton = !file.nodeIds.includes(viewModel.rootNodeId);
      const headerCenterY = fileRectY + FILE_REMOVE_BUTTON_MARGIN + FILE_REMOVE_BUTTON_SIZE / 2;
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", String(x));
      rect.setAttribute("y", String(fileRectY));
      rect.setAttribute("width", String(layoutNode.width));
      rect.setAttribute("height", String(fileRectHeight));
      group.appendChild(rect);
      if (hasRemoveButton) {
        const buttonGroup = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "g"
        );
        buttonGroup.setAttribute("class", "file-remove-button");
        const buttonGroupEl = buttonGroup;
        buttonGroupEl.dataset.filePath = file.filePath;
        const buttonX = x + FILE_REMOVE_BUTTON_MARGIN;
        const buttonY = fileRectY + FILE_REMOVE_BUTTON_MARGIN;
        const buttonRect = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect"
        );
        buttonRect.setAttribute("x", String(buttonX));
        buttonRect.setAttribute("y", String(buttonY));
        buttonRect.setAttribute("width", String(FILE_REMOVE_BUTTON_SIZE));
        buttonRect.setAttribute("height", String(FILE_REMOVE_BUTTON_SIZE));
        buttonGroup.appendChild(buttonRect);
        const buttonText = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "text"
        );
        buttonText.setAttribute(
          "x",
          String(buttonX + FILE_REMOVE_BUTTON_SIZE / 2)
        );
        buttonText.setAttribute(
          "y",
          String(headerCenterY)
        );
        buttonText.setAttribute("text-anchor", "middle");
        buttonText.setAttribute("dominant-baseline", "middle");
        buttonText.textContent = "\xD7";
        buttonGroup.appendChild(buttonText);
        group.appendChild(buttonGroup);
      }
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute(
        "x",
        String(
          x + (hasRemoveButton ? FILE_REMOVE_BUTTON_MARGIN * 2 + FILE_REMOVE_BUTTON_SIZE : 10)
        )
      );
      text.setAttribute("y", String(headerCenterY));
      text.setAttribute("dominant-baseline", "middle");
      text.textContent = file.displayName;
      group.appendChild(text);
      viewport.appendChild(group);
    }
    for (const node of visibleNodes) {
      const layoutNode = graph.node(node.id);
      if (!layoutNode) {
        continue;
      }
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("class", buildNodeClassName(node));
      const groupEl = group;
      groupEl.dataset.nodeId = node.id;
      groupEl.dataset.filePath = node.filePath;
      const x = layoutNode.x - layoutNode.width / 2;
      const y = layoutNode.y - layoutNode.height / 2;
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", String(x));
      rect.setAttribute("y", String(y));
      rect.setAttribute("width", String(layoutNode.width));
      rect.setAttribute("height", String(layoutNode.height));
      group.appendChild(rect);
      const textAreaLeft = node.isRoot ? x : x + NODE_REMOVE_BUTTON_AREA;
      const textAreaRight = x + layoutNode.width;
      const textX = (textAreaLeft + NODE_LABEL_MARGIN_LEFT + textAreaRight - NODE_LABEL_MARGIN_RIGHT) / 2;
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", String(textX));
      text.setAttribute("y", String(layoutNode.y + 4));
      text.setAttribute("text-anchor", "middle");
      text.textContent = node.name;
      group.appendChild(text);
      group.addEventListener("mouseenter", () => {
        tooltip.textContent = `${node.name}  (${node.kind})
${node.filePath}:${node.line + 1}
Click: open source`;
        tooltip.style.whiteSpace = "pre";
        tooltip.classList.remove("hidden");
      });
      group.addEventListener("mousemove", (event) => {
        tooltip.style.left = event.clientX + 12 + "px";
        tooltip.style.top = event.clientY + 12 + "px";
      });
      group.addEventListener("mouseleave", () => {
        tooltip.classList.add("hidden");
      });
      if (!node.isRoot) {
        const buttonGroup = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "g"
        );
        buttonGroup.setAttribute("class", "node-remove-button");
        const buttonGroupEl = buttonGroup;
        buttonGroupEl.dataset.nodeId = node.id;
        const buttonX = x + NODE_REMOVE_BUTTON_MARGIN_LEFT;
        const buttonY = y + NODE_REMOVE_BUTTON_MARGIN_VERTICAL;
        const buttonRect = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect"
        );
        buttonRect.setAttribute("x", String(buttonX));
        buttonRect.setAttribute("y", String(buttonY));
        buttonRect.setAttribute("width", String(NODE_REMOVE_BUTTON_SIZE));
        buttonRect.setAttribute("height", String(NODE_REMOVE_BUTTON_SIZE));
        buttonGroup.appendChild(buttonRect);
        const buttonText = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "text"
        );
        buttonText.setAttribute(
          "x",
          String(buttonX + NODE_REMOVE_BUTTON_SIZE / 2)
        );
        buttonText.setAttribute(
          "y",
          String(buttonY + NODE_REMOVE_BUTTON_SIZE / 2)
        );
        buttonText.setAttribute("text-anchor", "middle");
        buttonText.setAttribute("dominant-baseline", "middle");
        buttonText.textContent = "\xD7";
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
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("class", "edge");
      const groupEl = group;
      groupEl.dataset.edgeId = makeEdgeId(edgeRef.v, edgeRef.w);
      groupEl.dataset.from = edgeRef.v;
      groupEl.dataset.to = edgeRef.w;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", pointsToPath(layoutEdge.points));
      path.setAttribute("marker-end", "url(#arrow)");
      group.appendChild(path);
      viewport.appendChild(group);
    });
    if (resetViewport) {
      resetView();
    } else {
      applyTransform();
    }
  }

  // src/WebviewController/feature/exportPlantUml.ts
  function exportPlantUmlToClipboard() {
    const vm = getViewModel();
    if (!vm) {
      return;
    }
    const text = buildPlantUmlText(vm);
    vscode.postMessage({ type: "exportPlantUml", text });
  }
  function buildPlantUmlText(vm) {
    const visibleNodes = vm.nodes.filter((n) => n.view.visibility === "visible");
    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
    const visibleEdges = vm.edges.filter(
      (e) => e.view.visibility === "visible" && visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to)
    );
    const aliasByNodeId = /* @__PURE__ */ new Map();
    visibleNodes.forEach((node, index) => {
      aliasByNodeId.set(node.id, `${node.name}_r${index + 1}`);
    });
    const nodesByFile = /* @__PURE__ */ new Map();
    for (const node of visibleNodes) {
      const arr = nodesByFile.get(node.filePath) ?? [];
      arr.push(node);
      nodesByFile.set(node.filePath, arr);
    }
    const lines = ["@startuml"];
    const graphOrientation = getGraphOrientation();
    if (graphOrientation == "TB") {
    } else if (graphOrientation == "LR") {
      lines.push("left to right direction");
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
      lines.push("}");
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
    lines.push("@enduml");
    return lines.join("\n");
  }
  function renderNode(node, aliasByNodeId) {
    const alias = aliasByNodeId.get(node.id);
    const color = node.isRoot ? " #LightBlue" : "";
    return `rectangle "${escapeLabel(node.name)}" as ${escapeLabel(alias)}${color}`;
  }
  function escapeLabel(text) {
    return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  // src/WebviewController/feature/buttonActions.ts
  function showAllNodes() {
    const vm = getViewModel();
    if (!vm) {
      return;
    }
    setAllVisibility("visible");
    renderGraph(false);
  }
  function hideAllNodes() {
    const vm = getViewModel();
    if (!vm) {
      return;
    }
    setAllHiddenExceptRoot();
    renderGraph(false);
  }
  function exportPlantUml() {
    const vm = getViewModel();
    if (!vm) {
      return;
    }
    exportPlantUmlToClipboard();
  }
  function setAllVisibility(visibility) {
    const vm = getViewModel();
    if (!vm) {
      return;
    }
    for (const node of vm.nodes) {
      node.view.visibility = visibility;
    }
    for (const edge of vm.edges) {
      edge.view.visibility = visibility;
    }
  }
  function setAllHiddenExceptRoot() {
    const vm = getViewModel();
    if (!vm) {
      return;
    }
    for (const node of vm.nodes) {
      node.view.visibility = node.id === vm.rootNodeId ? "visible" : "hidden";
    }
    for (const edge of vm.edges) {
      edge.view.visibility = "hidden";
    }
  }

  // src/WebviewController/feature/exportSvg.ts
  function exportSvgToFile() {
    const cloned = svg.cloneNode(true);
    inlineStyles(cloned);
    const serializer = new XMLSerializer();
    const svgText = serializer.serializeToString(cloned);
    vscode.postMessage({ type: "exportSvg", svgText });
  }
  function inlineStyles(cloned) {
    const clonedEls = cloned.querySelectorAll("*");
    const originalEls = svg.querySelectorAll("*");
    const RECT_PROPS = ["fill", "stroke", "strokeWidth"];
    const TEXT_PROPS = ["fill", "fontSize", "fontFamily", "fontWeight"];
    const PATH_PROPS = ["fill", "stroke", "strokeWidth"];
    for (let i = 0; i < clonedEls.length; i++) {
      const clonedEl = clonedEls[i];
      const originalEl = originalEls[i];
      if (!originalEl) {
        continue;
      }
      const tag = clonedEl.tagName.toLowerCase();
      let props;
      if (tag === "rect") {
        props = RECT_PROPS;
      } else if (tag === "text") {
        props = TEXT_PROPS;
      } else if (tag === "path") {
        props = PATH_PROPS;
      } else {
        continue;
      }
      const computed = getComputedStyle(originalEl);
      for (const prop of props) {
        const value = computed[prop];
        if (value) {
          clonedEl.style[prop] = value;
        }
      }
    }
    const markerPath = cloned.querySelector("marker path");
    const originalMarkerPath = svg.querySelector("marker path");
    if (markerPath && originalMarkerPath) {
      const computed = getComputedStyle(originalMarkerPath);
      markerPath.style.fill = computed.fill;
    }
    const { width, height } = svg.getBoundingClientRect();
    cloned.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }

  // src/WebviewController/feature/exportPng.ts
  function exportPngToFile() {
    const cloned = svg.cloneNode(true);
    inlineStyles2(cloned);
    const { width, height } = svg.getBoundingClientRect();
    cloned.setAttribute("width", String(width));
    cloned.setAttribute("height", String(height));
    cloned.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const serializer = new XMLSerializer();
    const svgText = serializer.serializeToString(cloned);
    const svgDataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgText);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const pngDataUrl = canvas.toDataURL("image/png");
      vscode.postMessage({ type: "exportPng", pngDataUrl });
    };
    img.onerror = (e) => {
      console.error("PNG export failed: image load error", e);
    };
    img.src = svgDataUrl;
  }
  function inlineStyles2(cloned) {
    const clonedEls = cloned.querySelectorAll("*");
    const originalEls = svg.querySelectorAll("*");
    const RECT_PROPS = ["fill", "stroke", "strokeWidth"];
    const TEXT_PROPS = ["fill", "fontSize", "fontFamily", "fontWeight"];
    const PATH_PROPS = ["fill", "stroke", "strokeWidth"];
    for (let i = 0; i < clonedEls.length; i++) {
      const clonedEl = clonedEls[i];
      const originalEl = originalEls[i];
      if (!originalEl) {
        continue;
      }
      const tag = clonedEl.tagName.toLowerCase();
      let props;
      if (tag === "rect") {
        props = RECT_PROPS;
      } else if (tag === "text") {
        props = TEXT_PROPS;
      } else if (tag === "path") {
        props = PATH_PROPS;
      } else {
        continue;
      }
      const computed = getComputedStyle(originalEl);
      for (const prop of props) {
        const value = computed[prop];
        if (value) {
          clonedEl.style[prop] = value;
        }
      }
    }
    const markerPath = cloned.querySelector("marker path");
    const originalMarkerPath = svg.querySelector("marker path");
    if (markerPath && originalMarkerPath) {
      const computed = getComputedStyle(originalMarkerPath);
      markerPath.style.fill = computed.fill;
    }
  }

  // src/WebviewController/feature/nodeInteraction/visibilityOps.ts
  function hideNodes(vm, nodeIds) {
    for (const node of vm.nodes) {
      if (nodeIds.has(node.id)) {
        node.view.visibility = "hidden";
        node.view.selected = false;
      }
    }
    for (const edge of vm.edges) {
      if (nodeIds.has(edge.from) || nodeIds.has(edge.to)) {
        edge.view.visibility = "hidden";
      }
    }
  }
  function pruneUnreachableFromRoot(vm) {
    const rootNode = vm.nodes.find((node) => node.id === vm.rootNodeId);
    if (!rootNode || rootNode.view.visibility !== "visible") {
      return;
    }
    const reachableNodeIds = collectReachableFromRoot(vm);
    for (const node of vm.nodes) {
      if (!reachableNodeIds.has(node.id)) {
        node.view.visibility = "hidden";
        node.view.selected = false;
      }
    }
    for (const edge of vm.edges) {
      if (!reachableNodeIds.has(edge.from) || !reachableNodeIds.has(edge.to)) {
        edge.view.visibility = "hidden";
      }
    }
  }
  function collectReachableFromRoot(vm) {
    const visibleNodeIds = new Set(
      vm.nodes.filter((node) => node.view.visibility === "visible").map((node) => node.id)
    );
    const visibleEdges = vm.edges.filter(
      (edge) => edge.view.visibility === "visible" && visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to)
    );
    const adjacency = buildAdjacencyMap(
      visibleEdges,
      vm.direction === "incoming" ? "reverse" : "forward"
    );
    return collectReachable(vm.rootNodeId, adjacency);
  }
  function buildAdjacencyMap(edges, direction) {
    const adjacency = /* @__PURE__ */ new Map();
    for (const edge of edges) {
      const from = direction === "forward" ? edge.from : edge.to;
      const to = direction === "forward" ? edge.to : edge.from;
      if (!adjacency.has(from)) {
        adjacency.set(from, []);
      }
      adjacency.get(from).push(to);
    }
    return adjacency;
  }
  function buildAdjacencyMaps(edges) {
    return {
      adjacency: buildAdjacencyMap(edges, "forward"),
      reverseAdjacency: buildAdjacencyMap(edges, "reverse")
    };
  }
  function collectReachable(startId, adjacency) {
    const visited = /* @__PURE__ */ new Set();
    const stack = [startId];
    while (stack.length > 0) {
      const current = stack.pop();
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);
      const neighbors = adjacency.get(current) ?? [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }
    return visited;
  }

  // src/WebviewController/feature/nodeInteraction/pathVisualization.ts
  function applyPathVisualization(clickedNodeId) {
    const vm = getViewModel();
    if (!vm) {
      return;
    }
    const { sourceId, targetId } = getPathEndpoints(vm, clickedNodeId);
    if (sourceId === targetId) {
      for (const node of vm.nodes) {
        node.view.visibility = node.id === sourceId ? "visible" : "hidden";
      }
      for (const edge of vm.edges) {
        edge.view.visibility = "hidden";
      }
      return;
    }
    const { adjacency, reverseAdjacency } = buildAdjacencyMaps(vm.edges);
    const reachableFromSource = collectReachable(sourceId, adjacency);
    const canReachTarget = collectReachable(targetId, reverseAdjacency);
    const pathNodeIds = /* @__PURE__ */ new Set();
    const pathEdgeIds = /* @__PURE__ */ new Set();
    for (const node of vm.nodes) {
      if (reachableFromSource.has(node.id) && canReachTarget.has(node.id)) {
        pathNodeIds.add(node.id);
      }
    }
    for (const edge of vm.edges) {
      if (reachableFromSource.has(edge.from) && canReachTarget.has(edge.to)) {
        pathEdgeIds.add(edge.id);
      }
    }
    if (pathNodeIds.size === 0) {
      pathNodeIds.add(vm.rootNodeId);
      pathNodeIds.add(clickedNodeId);
    }
    for (const node of vm.nodes) {
      node.view.visibility = pathNodeIds.has(node.id) ? "visible" : "hidden";
    }
    for (const edge of vm.edges) {
      edge.view.visibility = pathEdgeIds.has(edge.id) ? "visible" : "hidden";
    }
  }
  function getPathEndpoints(vm, clickedNodeId) {
    if (vm.direction === "incoming") {
      return { sourceId: clickedNodeId, targetId: vm.rootNodeId };
    }
    return { sourceId: vm.rootNodeId, targetId: clickedNodeId };
  }

  // src/WebviewController/feature/nodeInteraction/nodeContextMenu.ts
  var contextMenuNode = null;
  function showNodeContextMenu(node, event) {
    event.preventDefault();
    event.stopPropagation();
    contextMenuNode = node;
    tooltip.classList.add("hidden");
    contextMenu.style.left = `${event.clientX}px`;
    contextMenu.style.top = `${event.clientY}px`;
    contextMenu.classList.remove("hidden");
    const menuRect = contextMenu.getBoundingClientRect();
    const maxLeft = window.innerWidth - menuRect.width - 8;
    const maxTop = window.innerHeight - menuRect.height - 8;
    contextMenu.style.left = `${Math.max(8, Math.min(event.clientX, maxLeft))}px`;
    contextMenu.style.top = `${Math.max(8, Math.min(event.clientY, maxTop))}px`;
  }
  function hideNodeContextMenu() {
    const activeElement = document.activeElement;
    if (activeElement && contextMenu.contains(activeElement)) {
      activeElement.blur();
    }
    contextMenuNode = null;
    contextMenu.classList.add("hidden");
  }
  function handleContextMenuOutgoingClick(event) {
    handleContextMenuRequest(event, "outgoing");
    hideNodeContextMenu();
  }
  function handleContextMenuIncomingClick(event) {
    handleContextMenuRequest(event, "incoming");
    hideNodeContextMenu();
  }
  function handleContextMenuShowPathToRootClick() {
    if (!contextMenuNode) {
      return;
    }
    applyPathVisualization(contextMenuNode.id);
    renderGraph(true);
    hideNodeContextMenu();
  }
  function handleWindowClickForContextMenu(event) {
    const target = event.target;
    if (target?.closest("#node-context-menu")) {
      return;
    }
    hideNodeContextMenu();
  }
  function handleWindowKeyDownForContextMenu(event) {
    if (event.key === "Escape") {
      hideNodeContextMenu();
    }
  }
  function handleContextMenuRequest(event, direction) {
    event.preventDefault();
    event.stopPropagation();
    if (!contextMenuNode) {
      hideNodeContextMenu();
      return;
    }
    vscode.postMessage({
      type: "requestGraphFromNode",
      direction,
      filePath: contextMenuNode.filePath,
      line: contextMenuNode.line,
      character: contextMenuNode.character
    });
    hideNodeContextMenu();
  }

  // src/WebviewController/feature/nodeInteraction/nodeClick.ts
  function handleNodeClick(vm, node, event) {
    event.stopPropagation();
    if (event.shiftKey) {
    } else {
      vscode.postMessage({
        type: "nodeClick",
        filePath: node.filePath,
        line: node.line,
        character: node.character
      });
    }
  }

  // src/WebviewController/feature/nodeInteraction/nodeInteraction.ts
  function handleViewportClick(event) {
    const resolved = resolveNodeFromEventTarget(event.target);
    if (!resolved) {
      return;
    }
    handleNodeClick(resolved.vm, resolved.node, event);
  }
  function handleViewportContextMenu(event) {
    const resolved = resolveNodeFromEventTarget(event.target);
    if (!resolved) {
      return;
    }
    showNodeContextMenu(resolved.node, event);
  }
  function resolveNodeFromEventTarget(target) {
    const element = target;
    if (element?.closest(".node-remove-button")) {
      return null;
    }
    const group = element?.closest(".func-node");
    if (!group) {
      return null;
    }
    const nodeId = group.dataset.nodeId;
    if (!nodeId) {
      return null;
    }
    const vm = getViewModel();
    if (!vm) {
      return null;
    }
    const node = vm.nodes.find((item) => item.id === nodeId);
    if (!node) {
      return null;
    }
    return { vm, node };
  }

  // src/WebviewController/feature/nodeInteraction/folderInteraction.ts
  function handleFolderClick(event) {
    const target = event.target;
    const button = target?.closest(".file-remove-button");
    if (!button) {
      return;
    }
    const filePath = button.dataset.filePath ?? button.closest(".file-group")?.getAttribute("data-file-path");
    if (!filePath) {
      return;
    }
    const vm = getViewModel();
    if (!vm) {
      return;
    }
    const removedNodeIds = collectRemovedNodeIds(vm, filePath);
    if (removedNodeIds.size === 0 || removedNodeIds.has(vm.rootNodeId)) {
      return;
    }
    event.stopPropagation();
    hideNodeContextMenu();
    hideNodes(vm, removedNodeIds);
    pruneUnreachableFromRoot(vm);
    renderGraph(false);
  }
  function collectRemovedNodeIds(vm, filePath) {
    const file = vm.files.find((item) => item.filePath === filePath);
    if (file) {
      return new Set(file.nodeIds);
    }
    return new Set(
      vm.nodes.filter((node) => node.filePath === filePath).map((node) => node.id)
    );
  }

  // src/WebviewController/feature/nodeInteraction/nodeRemove.ts
  function handleNodeRemoveClick(event) {
    const target = event.target;
    const button = target?.closest(".node-remove-button");
    if (!button) {
      return;
    }
    const nodeId = button.dataset.nodeId;
    if (!nodeId) {
      return;
    }
    const vm = getViewModel();
    if (!vm) {
      return;
    }
    if (nodeId === vm.rootNodeId) {
      return;
    }
    event.stopPropagation();
    hideNodeContextMenu();
    hideNodes(vm, /* @__PURE__ */ new Set([nodeId]));
    pruneUnreachableFromRoot(vm);
    renderGraph(false);
  }

  // src/WebviewController/feature/nodeSearchInteraction.ts
  function handleSearchInputKeyDown(event) {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const query = normalizeQuery(searchInput.value);
    if (!query) {
      clearSearchResults();
      return;
    }
    const direction = event.shiftKey ? -1 : 1;
    const previous = getSearchState();
    if (query !== previous.query || previous.hitIds.length === 0) {
      runSearch(query, 0);
      return;
    }
    navigateSearch(direction);
  }
  function handleSearchPrevClick() {
    handleSearchButtonClick(-1);
  }
  function handleSearchNextClick() {
    handleSearchButtonClick(1);
  }
  function clearSearchResults() {
    const vm = getViewModel();
    const highlightChanged = vm ? updateHighlightedNodes(vm, []) : false;
    clearSearchState();
    updateIndicator(-1, 0);
    updateCurrentMatchClass(void 0);
    if (highlightChanged) {
      renderGraph(false);
    }
  }
  function handleSearchButtonClick(direction) {
    const query = normalizeQuery(searchInput.value);
    if (!query) {
      clearSearchResults();
      return;
    }
    const previous = getSearchState();
    if (query !== previous.query || previous.hitIds.length === 0) {
      runSearch(query, direction === 1 ? 0 : "last");
      return;
    }
    navigateSearch(direction);
  }
  function runSearch(query, initialIndex) {
    const refreshed = refreshSearchResults(query);
    if (refreshed.hitIds.length === 0) {
      if (refreshed.shouldRender) {
        renderGraph(false);
      }
      return;
    }
    const targetIndex = initialIndex === "last" ? refreshed.hitIds.length - 1 : 0;
    setSearchState({
      query,
      hitIds: refreshed.hitIds,
      currentIndex: targetIndex
    });
    updateIndicator(targetIndex, refreshed.hitIds.length);
    if (refreshed.shouldRender) {
      renderGraph(false);
    }
    centerOnNode(refreshed.hitIds[targetIndex]);
    updateCurrentMatchClass(refreshed.hitIds[targetIndex]);
  }
  function navigateSearch(direction) {
    const previous = getSearchState();
    const currentNodeId = previous.currentIndex >= 0 ? previous.hitIds[previous.currentIndex] : void 0;
    const refreshed = refreshSearchResults(previous.query, currentNodeId);
    if (refreshed.hitIds.length === 0) {
      if (refreshed.shouldRender) {
        renderGraph(false);
      }
      return;
    }
    const baseIndex = refreshed.currentIndex >= 0 ? refreshed.currentIndex : direction === 1 ? -1 : refreshed.hitIds.length;
    const targetIndex = wrapIndex(
      baseIndex + direction,
      refreshed.hitIds.length
    );
    setSearchState({
      query: previous.query,
      hitIds: refreshed.hitIds,
      currentIndex: targetIndex
    });
    updateIndicator(targetIndex, refreshed.hitIds.length);
    if (refreshed.shouldRender) {
      renderGraph(false);
    }
    centerOnNode(refreshed.hitIds[targetIndex]);
    updateCurrentMatchClass(refreshed.hitIds[targetIndex]);
  }
  function refreshSearchResults(query, currentNodeId) {
    const vm = getViewModel();
    if (!vm) {
      clearSearchState();
      updateIndicator(-1, 0);
      return { hitIds: [], currentIndex: -1, shouldRender: false };
    }
    const hitIds = collectHitIds(vm, query);
    const highlightChanged = updateHighlightedNodes(vm, hitIds);
    const previous = getSearchState();
    const hitsChanged = previous.query !== query || !areStringArraysEqual(previous.hitIds, hitIds);
    const currentIndex = currentNodeId !== void 0 ? hitIds.indexOf(currentNodeId) : -1;
    setSearchState({
      query,
      hitIds,
      currentIndex
    });
    updateIndicator(currentIndex, hitIds.length);
    return {
      hitIds,
      currentIndex,
      shouldRender: highlightChanged || hitsChanged
    };
  }
  function collectHitIds(vm, query) {
    const normalizedQuery = query.toLowerCase();
    return vm.nodes.filter(
      (node) => node.view.visibility === "visible" && node.name.toLowerCase().includes(normalizedQuery)
    ).map((node) => node.id);
  }
  function updateHighlightedNodes(vm, hitIds) {
    const hitSet = new Set(hitIds);
    let changed = false;
    for (const node of vm.nodes) {
      const highlighted = node.view.visibility === "visible" && hitSet.has(node.id);
      if (node.view.highlighted !== highlighted) {
        node.view.highlighted = highlighted;
        changed = true;
      }
    }
    return changed;
  }
  function updateCurrentMatchClass(nodeId) {
    document.querySelectorAll(".func-node.search-current").forEach((el) => el.classList.remove("search-current"));
    if (nodeId === void 0) {
      return;
    }
    const target = document.querySelector(
      `.func-node[data-node-id="${CSS.escape(nodeId)}"]`
    );
    target?.classList.add("search-current");
  }
  function updateIndicator(currentIndex, totalHits) {
    if (currentIndex < 0 || totalHits === 0) {
      searchIndicator.textContent = "0/0";
      return;
    }
    searchIndicator.textContent = `${currentIndex + 1}/${totalHits}`;
  }
  function normalizeQuery(value) {
    return value.trim();
  }
  function areStringArraysEqual(a, b) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }
  function wrapIndex(index, length) {
    return (index % length + length) % length;
  }

  // src/WebviewController/feature/panZoom.ts
  var isPanning = false;
  var panStart = { x: 0, y: 0 };
  var panOriginal = { x: 0, y: 0 };
  function handleViewportMouseDown(event) {
    const target = event.target;
    if (target?.closest(".func-node, .file-remove-button, .node-remove-button")) {
      event.stopPropagation();
    }
  }
  function handleSvgMouseDown(event) {
    isPanning = true;
    panStart = { x: event.clientX, y: event.clientY };
    const t = getTransform();
    panOriginal = { x: t.x, y: t.y };
  }
  function handleWindowMouseMove(event) {
    if (!isPanning) {
      return;
    }
    const t = getTransform();
    setTransform({
      x: panOriginal.x + (event.clientX - panStart.x),
      y: panOriginal.y + (event.clientY - panStart.y),
      scale: t.scale
    });
    applyTransform();
  }
  function handleWindowMouseUp() {
    isPanning = false;
  }
  function handleSvgWheel(event) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    const rect = svg.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const t = getTransform();
    const newScale = Math.max(0.1, Math.min(5, t.scale * delta));
    const factor = newScale / t.scale;
    setTransform({
      x: mx - (mx - t.x) * factor,
      y: my - (my - t.y) * factor,
      scale: newScale
    });
    applyTransform();
  }

  // src/WebviewController/feature/viewModel.ts
  function createGraphViewModel(data) {
    return {
      rootNodeId: data.rootNodeId,
      direction: data.direction,
      files: data.files.map((file) => ({ ...file })),
      nodes: data.nodes.map((node) => ({
        ...node,
        view: {
          visibility: "visible",
          selected: false,
          highlighted: false
        }
      })),
      edges: data.edges.map((edge) => ({
        id: makeEdgeId(edge.from, edge.to),
        from: edge.from,
        to: edge.to,
        view: {
          visibility: "visible"
        }
      }))
    };
  }

  // src/WebviewController/WebviewController.ts
  if (restoreState()) {
    renderGraph(false);
    applyTransform();
  }
  window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "updateGraph") {
      updateExtensionOptions(event.data.extensionOptions);
      setViewModel(createGraphViewModel(event.data.graphData));
      hideNodeContextMenu();
      renderGraph(true);
    }
  });
  btnReset.addEventListener("click", resetView);
  btnShowAll.addEventListener("click", showAllNodes);
  btnHideAll.addEventListener("click", hideAllNodes);
  btnExportPlantUml.addEventListener("click", exportPlantUml);
  btnExportSvg.addEventListener("click", exportSvgToFile);
  btnExportPng.addEventListener("click", exportPngToFile);
  searchInput.addEventListener("keydown", handleSearchInputKeyDown);
  btnSearchNext.addEventListener("click", handleSearchNextClick);
  btnSearchPrev.addEventListener("click", handleSearchPrevClick);
  viewport.addEventListener("click", handleViewportClick);
  viewport.addEventListener("contextmenu", handleViewportContextMenu);
  contextMenuOutgoing.addEventListener("click", handleContextMenuOutgoingClick);
  contextMenuIncoming.addEventListener("click", handleContextMenuIncomingClick);
  contextMenuShowPathToRoot.addEventListener("click", handleContextMenuShowPathToRootClick);
  window.addEventListener("click", handleWindowClickForContextMenu);
  window.addEventListener("keydown", handleWindowKeyDownForContextMenu);
  viewport.addEventListener("click", handleFolderClick);
  viewport.addEventListener("click", handleNodeRemoveClick);
  viewport.addEventListener("mousedown", handleViewportMouseDown);
  svg.addEventListener("mousedown", handleSvgMouseDown);
  window.addEventListener("mousemove", handleWindowMouseMove);
  window.addEventListener("mouseup", handleWindowMouseUp);
  svg.addEventListener("wheel", handleSvgWheel, { passive: false });
})();
