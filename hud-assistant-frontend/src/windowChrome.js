import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

if (isTauri()) {
  const appWindow = getCurrentWindow();
  const chrome = document.createElement('div');
  chrome.className = 'window-chrome-minimal';
  chrome.setAttribute('aria-label', 'Controles da janela');
  chrome.innerHTML = `
    <div class="window-drag-zone" aria-hidden="true"></div>
    <div class="window-chrome-actions">
      <button type="button" data-window-action="minimize" aria-label="Minimizar" title="Minimizar">−</button>
      <button type="button" data-window-action="maximize" aria-label="Maximizar" title="Maximizar">□</button>
      <button type="button" data-window-action="close" aria-label="Fechar" title="Fechar">×</button>
    </div>`;

  document.body.append(chrome);
  chrome.querySelector('[data-window-action="minimize"]').addEventListener('click', () => appWindow.minimize());
  chrome.querySelector('[data-window-action="maximize"]').addEventListener('click', async (event) => {
    await appWindow.toggleMaximize();
    const button = event.currentTarget;
    const maximized = await appWindow.isMaximized();
    button.textContent = maximized ? '❐' : '□';
    button.title = maximized ? 'Restaurar' : 'Maximizar';
    button.setAttribute('aria-label', button.title);
  });
  chrome.querySelector('[data-window-action="close"]').addEventListener('click', () => appWindow.close());
  chrome.querySelector('.window-drag-zone').addEventListener('mousedown', (event) => {
    if (event.button === 0) appWindow.startDragging();
  });
  chrome.querySelector('.window-drag-zone').addEventListener('dblclick', () => appWindow.toggleMaximize());
}