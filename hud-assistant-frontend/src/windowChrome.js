import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

if (isTauri()) {
  const appWindow = getCurrentWindow();
  const titlebar = document.createElement('header');
  titlebar.className = 'cartoon-windowbar';
  titlebar.innerHTML =
    '<div class="cartoon-windowbar-titulo" data-tauri-drag-region>' +
      '<span class="cartoon-windowbar-selo" aria-hidden="true">✦</span><span>Urfilig</span>' +
    '</div><div class="cartoon-windowbar-acoes">' +
      '<button type="button" class="minimizar" aria-label="Minimizar janela" title="Minimizar">−</button>' +
      '<button type="button" class="maximizar" aria-label="Maximizar janela" title="Maximizar">□</button>' +
      '<button type="button" class="fechar" aria-label="Fechar janela" title="Fechar">×</button>' +
    '</div>';

  document.body.prepend(titlebar);
  titlebar.querySelector('.minimizar').addEventListener('click', () => appWindow.minimize());
  titlebar.querySelector('.maximizar').addEventListener('click', async () => {
    await appWindow.toggleMaximize();
    const maximizada = await appWindow.isMaximized();
    const botao = titlebar.querySelector('.maximizar');
    botao.textContent = maximizada ? '❐' : '□';
    botao.title = maximizada ? 'Restaurar' : 'Maximizar';
    botao.setAttribute('aria-label', botao.title + ' janela');
  });
  titlebar.querySelector('.fechar').addEventListener('click', () => appWindow.close());
  titlebar.addEventListener('mousedown', (event) => {
    if (event.button === 0 && !event.target.closest('button')) appWindow.startDragging();
  });
  titlebar.addEventListener('dblclick', (event) => {
    if (!event.target.closest('button')) appWindow.toggleMaximize();
  });
}

