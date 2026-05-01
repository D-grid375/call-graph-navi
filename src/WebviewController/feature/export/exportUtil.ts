import { svg, viewport } from '../../core/dom';

const EXPORT_PADDING = 20;

/**
 * クローンSVGをグラフ全体が収まるサイズ・viewBoxに調整する。
 *
 * オリジナルの `<g id="viewport">` には現在のパン・ズーム状態が `transform` として
 * 設定されているため、クローン側のtransformを削除した上で、
 * `viewport.getBBox()` で取得した素のグラフ範囲（transform適用前の座標）を
 * viewBox / width / height として設定することでグラフ全体を表示させる。
 * width,heightはviewportの親のSVGのパラメータへの設定値。これはSVG出力には不要だが、PNG出力では必須
 *
 * `getBBox()` はオリジナルDOM上の要素から呼ぶ必要がある（クローンはDOMに挿入されておらず
 * レイアウトが計算されないため）。読み取り専用なので画面側に副作用は出ない。
 *
 * @param cloned 調整対象のクローンSVG要素
 */
export function fitToGraphBounds(cloned: SVGSVGElement): void {
    // グラフ全体の素の描画範囲をオリジナルDOMから取得（transform適用前）
    const bbox = viewport.getBBox(); // viewport 配下の全描画要素を囲む最小のバウンディングボックス（transform 適用前の座標ベース）
    const x = bbox.x - EXPORT_PADDING;          // viewBox x座標始点
    const y = bbox.y - EXPORT_PADDING;          // viewBox y座標始点
    const w = bbox.width + EXPORT_PADDING * 2;  // viewBox x方向幅
    const h = bbox.height + EXPORT_PADDING * 2; // viewBox y方向幅

    // クローン側のパン・ズーム状態を解除（bboxはransform適用前の座標であるためこれが必要）
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
 * オリジナルのSVGは `graph.css` の `--vscode-*` CSS変数を使ってスタイル付けされているため、
 * `getComputedStyle` でCSS変数を解決済みの具体値として
 * 取得し、各要素の `style` 属性にインラインで書き込んでから画像化する。
 *
 * `getComputedStyle` はDOMにアタッチされた要素でないと値が取れないため、
 * クローン元（オリジナルDOM上の要素）から値を読む必要がある。
 *
 * @param cloned スタイルをインライン展開する対象のクローンSVG要素
 */
export function inlineStyles(cloned: SVGSVGElement): void {
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
