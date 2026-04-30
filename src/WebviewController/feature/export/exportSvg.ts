import { vscode, svg, viewport } from '../../core/dom';

const EXPORT_PADDING = 20;

/**
 * 現在表示中のグラフをSVG文字列に変換し、Extension Hostに送信する。
 *
 * SVGはCSSクラスベースでスタイルが定義されており、また `--vscode-*` というCSS変数を
 * 多用しているため、SVG要素を `outerHTML` でそのままシリアライズしても外部参照が
 * 解決できず真っ黒になってしまう。そのため、SVGをディープコピーした上で
 * 各要素にインラインstyleを展開してからシリアライズする。
 *
 * またパン・ズーム状態がそのまま反映されるとグラフが見切れてしまうため、
 * クローン側のviewport transform を解除し、グラフ全体が収まるviewBoxに調整する。
 *
 * 送信先では `vscode.workspace.fs.writeFile` でユーザーが選択したパスにファイル保存する。
 */
export function exportSvgToFile(): void {
  // 画面表示中のSVGを壊さないようディープコピーで作業する
  const cloned = svg.cloneNode(true) as SVGSVGElement;

  // CSS変数を解決済みの色値としてインライン展開（外部CSS参照無しで完結させる）
  inlineStyles(cloned);

  // パン・ズーム状態を解除し、グラフ全体が収まるサイズに調整
  fitToGraphBounds(cloned);

  // SVG文字列にシリアライズしてExtension Hostへ送信
  const serializer = new XMLSerializer();
  const svgText = serializer.serializeToString(cloned);
  vscode.postMessage({ type: 'exportSvg', svgText });
}

/**
 * クローンSVGをグラフ全体が収まるサイズ・viewBoxに調整する。
 *
 * オリジナルの `<g id="viewport">` には現在のパン・ズーム状態が `transform` として
 * 設定されているため、クローン側のtransformを削除した上で、
 * `viewport.getBBox()` で取得した素のグラフ範囲（transform適用前の座標）を
 * viewBox / width / height として設定することでグラフ全体を表示させる。
 *
 * `getBBox()` はオリジナルDOM上の要素から呼ぶ必要がある（クローンはDOMに挿入されておらず
 * レイアウトが計算されないため）。読み取り専用なので画面側に副作用は出ない。
 *
 * @param cloned 調整対象のクローンSVG要素
 */
function fitToGraphBounds(cloned: SVGSVGElement): void {
  // グラフ全体の素の描画範囲をオリジナルDOMから取得（transform適用前）
  const bbox = viewport.getBBox(); // viewport 配下の全描画要素を囲む最小のバウンディングボックス（transform 適用前の座標ベース）
  const x = bbox.x - EXPORT_PADDING;
  const y = bbox.y - EXPORT_PADDING;
  const w = bbox.width + EXPORT_PADDING * 2;
  const h = bbox.height + EXPORT_PADDING * 2;

  // クローン側のパン・ズーム状態を解除（bboxにはransform適用前の座標であるためこれが必要）
  const clonedViewport = cloned.querySelector('#viewport');
  if (clonedViewport) {
    clonedViewport.removeAttribute('transform');
  }

  // グラフ全体が収まるviewBox / width / heightを設定
  cloned.setAttribute('viewBox', `${x} ${y} ${w} ${h}`); // viewBox:表示する内部座標範囲を指定するSVG標準属性
  cloned.setAttribute('width', String(w));
  cloned.setAttribute('height', String(h));
}

/**
 * CSSクラスベースのスタイルをSVG要素にインライン展開する。
 *
 * オリジナルのSVGは `graph.css` の `--vscode-*` CSS変数を使ってスタイル付けされており、
 * SVG文字列をエクスポートしてもそれらの参照は解決できない。そのため、
 * `getComputedStyle` でCSS変数を解決済みの具体値として取得し、各要素の
 * `style` 属性にインラインで書き込んでから出力する。
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
