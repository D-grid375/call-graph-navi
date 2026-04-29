import { vscode, svg } from '../core/dom';

export function exportPngToFile(): void {
  const cloned = svg.cloneNode(true) as SVGSVGElement;
  inlineStyles(cloned);

  const { width, height } = svg.getBoundingClientRect();
  // クローンに明示的にwidth/height属性を設定（<img>のレンダリングサイズ確定のため）
  cloned.setAttribute('width', String(width));
  cloned.setAttribute('height', String(height));
  cloned.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const serializer = new XMLSerializer();
  const svgText = serializer.serializeToString(cloned);
  // blob: URLはWebviewのCSP(img-src)でブロックされるため、data: URLを使う
  const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
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
 * getComputedStyle でCSS変数を解決済みの値として取得するため、
 * クローン元（元のDOM上の要素）から値を読む必要がある。
 */
function inlineStyles(cloned: SVGSVGElement): void {
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

  const markerPath = cloned.querySelector('marker path');
  const originalMarkerPath = svg.querySelector('marker path');
  if (markerPath && originalMarkerPath) {
    const computed = getComputedStyle(originalMarkerPath);
    (markerPath as SVGElement).style.fill = computed.fill;
  }
}
