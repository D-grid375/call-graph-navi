import { btnExport, exportMenu } from '../../core/dom';

/**
 * Export ドロップダウンメニューの開閉を切り替える。
 * Export ボタンクリック時に呼び出される。
 *
 * @param event 発火元のクリックイベント（外側クリックハンドラとの混線を避けるため伝搬を止める）
 */
export function toggleExportMenu(event: MouseEvent): void {
  event.stopPropagation();
  exportMenu.classList.toggle('hidden');
}

/**
 * Export ドロップダウンメニューを閉じる。
 * メニュー項目がクリックされた直後や、メニュー外側クリック・Escキー押下時に呼び出される。
 */
export function hideExportMenu(): void {
  exportMenu.classList.add('hidden');
}

/**
 * window のクリックイベントを受け、メニューの外側がクリックされたらメニューを閉じる。
 * Export ボタン自身と、メニュー内（項目）のクリックは除外する。
 *
 * @param event 発火元のクリックイベント
 */
export function handleWindowClickForExportMenu(event: MouseEvent): void {
  const target = event.target as Node;
  if (btnExport.contains(target) || exportMenu.contains(target)) {
    return;
  }
  hideExportMenu();
}

/**
 * window のキー押下イベントを受け、Esc が押されたらメニューを閉じる。
 *
 * @param event 発火元のキーボードイベント
 */
export function handleWindowKeyDownForExportMenu(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    hideExportMenu();
  }
}
