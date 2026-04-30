import { vscode, svg, viewport } from '../core/dom';

const EXPORT_PADDING = 20;

export function exportSvgToFile(): void {
  const cloned = svg.cloneNode(true) as SVGSVGElement;
  inlineStyles(cloned);
  fitToGraphBounds(cloned);
  const serializer = new XMLSerializer();
  const svgText = serializer.serializeToString(cloned);
  vscode.postMessage({ type: 'exportSvg', svgText });
}

/**
 * クローンSVGをグラフ全体が収まるサイズ・viewBoxに調整する。
 * - クローン側の viewport の transform を消してパン・ズーム状態を解除
 * - オリジナルの viewport.getBBox() で取得した素のグラフ範囲（transform前）に
 *   パディングを足したものを viewBox / width / height として設定
 */
function fitToGraphBounds(cloned: SVGSVGElement): void {
  const bbox = viewport.getBBox();
  const x = bbox.x - EXPORT_PADDING;
  const y = bbox.y - EXPORT_PADDING;
  const w = bbox.width + EXPORT_PADDING * 2;
  const h = bbox.height + EXPORT_PADDING * 2;

  const clonedViewport = cloned.querySelector('#viewport');
  if (clonedViewport) {
    clonedViewport.removeAttribute('transform');
  }

  cloned.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
  cloned.setAttribute('width', String(w));
  cloned.setAttribute('height', String(h));
}

/**
 * CSSクラスベースのスタイルをSVG要素にインライン展開する。
 * getComputedStyle でCSS変数を解決済みの値として取得するため、
 * クローン元（元のDOM上の要素）から値を読む必要がある。
 */
function inlineStyles(cloned: SVGSVGElement): void {
  // クローン内の要素とオリジナルDOM上の対応要素をペアにして処理する
  const clonedEls = cloned.querySelectorAll('*');
  const originalEls = svg.querySelectorAll('*');

  const RECT_PROPS: (keyof CSSStyleDeclaration)[] = ['fill', 'stroke', 'strokeWidth'];
  const TEXT_PROPS: (keyof CSSStyleDeclaration)[] = ['fill', 'fontSize', 'fontFamily', 'fontWeight'];
  const PATH_PROPS: (keyof CSSStyleDeclaration)[] = ['fill', 'stroke', 'strokeWidth'];

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

  // arrow markerのパス（<defs>内）はquerySelectorAllに含まれないため個別処理
  const markerPath = cloned.querySelector('marker path');
  const originalMarkerPath = svg.querySelector('marker path');
  if (markerPath && originalMarkerPath) {
    const computed = getComputedStyle(originalMarkerPath);
    (markerPath as SVGElement).style.fill = computed.fill;
  }
}
