import { vscode, svg } from '../../core/dom';
import { getPngExportScale } from '../../core/state';
import { inlineStyles, fitToGraphBounds } from './exportUtil';

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
 * Webview ⇔ Extension 間は postMessage でしかやり取りができないため、
 * 画像データを送るために Canvas → 文字列 への変換を行いその文字列を送信している
 */
export function exportPngToFile(): void {
  // 画面表示中のSVGを壊さないようディープコピーで作業する
  const cloned = svg.cloneNode(true) as SVGSVGElement;

  // CSS変数を解決済みの色値としてインライン展開（外部CSS参照無しで完結させる）
  inlineStyles(cloned);

  // グラフ全体の素の描画範囲をオリジナルDOMから取得（transform適用前）
  fitToGraphBounds(cloned);

  // SVGを data: URL 化（blob: URLはWebviewのCSP(img-src)でブロックされるため使えない）※この関数内でSVGデータを渡すためだけのURL
  const serializer = new XMLSerializer();
  const svgText = serializer.serializeToString(cloned);
  const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);

  // <img>にSVGをロードしてCanvasに描画 → PNG dataURLに変換 → Extension Hostへ送信
  const img = new Image();
  img.onload = () => { // 画像読み込み時のコールバックを登録
    // 拡張機能設定からPNG解像度を取得
    const PNG_SCALE = getPngExportScale();

    // PNG_SCALE倍の高解像度Canvasを定義
    const canvas = document.createElement('canvas');
    canvas.width = Number(cloned.getAttribute('width')) * PNG_SCALE;
    canvas.height = Number(cloned.getAttribute('height')) * PNG_SCALE;

    // ソースのSVGをscaleしてから画像化
    const ctx = canvas.getContext('2d')!;
    ctx.scale(PNG_SCALE, PNG_SCALE);
    ctx.drawImage(img, 0, 0);

    // URLに変換してExtension側にpostする
    const pngDataUrl = canvas.toDataURL('image/png');
    vscode.postMessage({ type: 'exportPng', pngDataUrl });
  };
  img.onerror = (e) => {
    console.error('PNG export failed: image load error', e);
  };
  img.src = svgDataUrl; // URL経由で画像ソースのSVGが読み込まれ、↑のコールバックが処理される
}
