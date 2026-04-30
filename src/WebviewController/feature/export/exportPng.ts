import { vscode, svg, viewport } from '../../core/dom';

const EXPORT_PADDING = 20;
const PNG_SCALE = 2;

/**
 * 現在表示中のグラフをPNG画像（base64 dataURL）に変換し、Extension Hostに送信する。
 *
 * PNG化はWebview側のCanvas APIで行う：
 *   1. SVGをディープコピーしてスタイルをインライン展開（exportSvgToFileと同様の前処理）
 *   2. パン・ズーム状態を解除し、グラフ全体が収まるviewBoxに調整
 *   3. SVG文字列を data: URL 化して `<img>` にロード（Webview CSPで blob: は禁止のため data: を使う）
 *   4. Canvasに描画して `toDataURL('image/png')` でPNG dataURLに変換
 *
 * 解像度はPNG_SCALE倍。Canvasサイズを倍率分拡大し、`ctx.scale` で
 * 等倍描画することで高解像度PNGを得る（SVGはベクターなので拡大しても劣化しない）。
 *
 * 送信先では base64デコードして `vscode.workspace.fs.writeFile` でファイル保存する。
 */
export function exportPngToFile(): void {
  // 画面表示中のSVGを壊さないようディープコピーで作業する
  const cloned = svg.cloneNode(true) as SVGSVGElement;

  // CSS変数を解決済みの色値としてインライン展開（外部CSS参照無しで完結させる）
  inlineStyles(cloned);

  // グラフ全体の素の描画範囲をオリジナルDOMから取得（transform適用前）
  const bbox = viewport.getBBox();
  const x = bbox.x - EXPORT_PADDING;
  const y = bbox.y - EXPORT_PADDING;
  const width = bbox.width + EXPORT_PADDING * 2;
  const height = bbox.height + EXPORT_PADDING * 2;

  // クローン側のパン・ズーム状態を解除し、グラフ全体が収まるサイズに調整
  const clonedViewport = cloned.querySelector('#viewport');
  if (clonedViewport) {
    clonedViewport.removeAttribute('transform');
  }
  cloned.setAttribute('width', String(width));
  cloned.setAttribute('height', String(height));
  cloned.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);

  // SVGを data: URL 化（blob: URLはWebviewのCSP(img-src)でブロックされるため使えない）
  const serializer = new XMLSerializer();
  const svgText = serializer.serializeToString(cloned);
  const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);

  // <img>にSVGをロードしてCanvasに描画 → PNG dataURLに変換 → Extension Hostへ送信
  const img = new Image();
  img.onload = () => {
    // PNG_SCALE倍の高解像度Canvasを用意し、scaleで等倍描画する
    const canvas = document.createElement('canvas');
    canvas.width = width * PNG_SCALE;
    canvas.height = height * PNG_SCALE;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(PNG_SCALE, PNG_SCALE);
    ctx.drawImage(img, 0, 0);
    const pngDataUrl = canvas.toDataURL('image/png');
    vscode.postMessage({ type: 'exportPng', pngDataUrl });
  };
  img.onerror = (e) => {
    console.error('PNG export failed: image load error', e);
  };
  img.src = svgDataUrl;
}

/**
 * CSSクラスベースのスタイルをSVG要素にインライン展開する。
 *
 * オリジナルのSVGは `graph.css` の `--vscode-*` CSS変数を使ってスタイル付けされており、
 * SVG文字列を `<img>` 経由で画像化してもそれらの参照は解決できない（外部スタイルシートが
 * 読み込まれないため）。そのため、`getComputedStyle` でCSS変数を解決済みの具体値として
 * 取得し、各要素の `style` 属性にインラインで書き込んでから画像化する。
 *
 * `getComputedStyle` はDOMにアタッチされた要素でないと値が取れないため、
 * クローン元（オリジナルDOM上の要素）から値を読む必要がある。
 *
 * @param cloned スタイルをインライン展開する対象のクローンSVG要素
 */
function inlineStyles(cloned: SVGSVGElement): void {
  // クローン内の要素とオリジナルDOM上の対応要素をペアにして処理する
  const clonedEls = cloned.querySelectorAll('*');
  const originalEls = svg.querySelectorAll('*');

  // タグ種別ごとにインライン化対象のCSSプロパティを定義
  const RECT_PROPS: (keyof CSSStyleDeclaration)[] = ['fill', 'stroke', 'strokeWidth'];
  const TEXT_PROPS: (keyof CSSStyleDeclaration)[] = ['fill', 'fontSize', 'fontFamily', 'fontWeight'];
  const PATH_PROPS: (keyof CSSStyleDeclaration)[] = ['fill', 'stroke', 'strokeWidth'];

  // 各要素について、オリジナル側で算出済みのスタイル値をクローン側にコピーする
  for (let i = 0; i < clonedEls.length; i++) {
    const clonedEl = clonedEls[i] as SVGElement;
    const originalEl = originalEls[i] as SVGElement;
    if (!originalEl) {
      continue;
    }

    const tag = clonedEl.tagName.toLowerCase();
    let props: (keyof CSSStyleDeclaration)[];
    if (tag === 'rect') {
      props = RECT_PROPS;
    } else if (tag === 'text') {
      props = TEXT_PROPS;
    } else if (tag === 'path') {
      props = PATH_PROPS;
    } else {
      continue;
    }

    const computed = getComputedStyle(originalEl);
    for (const prop of props) {
      const value = computed[prop] as string;
      if (value) {
        clonedEl.style[prop as never] = value;
      }
    }
  }

  // arrow markerのパス（<defs>内）は querySelectorAll('*') の対象に含まれないため個別処理
  const markerPath = cloned.querySelector('marker path');
  const originalMarkerPath = svg.querySelector('marker path');
  if (markerPath && originalMarkerPath) {
    const computed = getComputedStyle(originalMarkerPath);
    (markerPath as SVGElement).style.fill = computed.fill;
  }
}
