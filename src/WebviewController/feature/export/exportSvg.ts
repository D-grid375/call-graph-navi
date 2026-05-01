import { vscode, svg } from '../../core/dom';
import { inlineStyles, fitToGraphBounds } from './exportUtil';

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
