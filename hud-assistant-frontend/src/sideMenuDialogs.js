export function confirmarAcao(titulo, mensagem, textoConfirmar = 'Excluir', corConfirmar = '#f87171') {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(12px);
      z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 1.5rem;
      font-family: inherit;
    `;

    modal.innerHTML = `
      <div style="background: rgba(13, 17, 23, 0.95); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; width: 100%; max-width: 400px; overflow: hidden; box-shadow: 0 30px 60px rgba(0,0,0,0.9); box-sizing: border-box;">
        <div style="padding: 1.2rem 1.5rem; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
          <h4 style="color: #f0f6fc; font-size: 0.9rem; font-weight: 600; margin: 0; letter-spacing: 0.3px;">${titulo}</h4>
        </div>
        <div style="padding: 1.5rem; color: #c9d1d9; font-size: 0.88rem; line-height: 1.5;">
          <span id="mensagem-modal-confirmacao"></span>
        </div>
        <div style="padding: 1rem 1.5rem; border-top: 1px solid rgba(255, 255, 255, 0.05); display: flex; justify-content: flex-end; gap: 8px;">
          <button id="btn-modal-cancelar" type="button" style="background: transparent; border: none; color: #8b949e; padding: 8px 14px; font-size: 0.82rem; cursor: pointer;">Cancelar</button>
          <button id="btn-modal-confirmar" type="button" style="background: ${corConfirmar}; color: #ffffff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; font-size: 0.82rem; cursor: pointer;">${textoConfirmar}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('#mensagem-modal-confirmacao').textContent = mensagem;

    modal.querySelector('#btn-modal-cancelar').onclick = () => { modal.remove(); resolve(false); };
    modal.querySelector('#btn-modal-confirmar').onclick = () => { modal.remove(); resolve(true); };
  });
}

export function pedirTextoModal(titulo, labelInput, valorInicial = '') {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(12px);
      z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 1.5rem;
      font-family: inherit;
    `;

    modal.innerHTML = `
      <div style="background: rgba(13, 17, 23, 0.95); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; width: 100%; max-width: 400px; overflow: hidden; box-shadow: 0 30px 60px rgba(0,0,0,0.9); box-sizing: border-box;">
        <div style="padding: 1.2rem 1.5rem; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
          <h4 style="color: #f0f6fc; font-size: 0.9rem; font-weight: 600; margin: 0; letter-spacing: 0.3px;">${titulo}</h4>
        </div>
        <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 0.4rem;">
          <label style="font-size: 0.68rem; color: #8b949e; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase;">${labelInput}</label>
          <input id="input-modal-texto" type="text" style="background: transparent !important; border: none !important; border-bottom: 1px solid rgba(255, 255, 255, 0.15) !important; color: #f0f6fc !important; font-size: 0.95rem !important; padding: 8px 0 !important; border-radius: 0 !important; width: 100% !important; outline: none !important; font-family: inherit; box-sizing: border-box;" />
        </div>
        <div style="padding: 1rem 1.5rem; border-top: 1px solid rgba(255, 255, 255, 0.05); display: flex; justify-content: flex-end; gap: 8px;">
          <button id="btn-modal-cancelar" type="button" style="background: transparent; border: none; color: #8b949e; padding: 8px 14px; font-size: 0.82rem; cursor: pointer;">Cancelar</button>
          <button id="btn-modal-salvar" type="button" class="btn-dinamico-esfera" style="padding: 8px 18px; border-radius: 6px; font-weight: 600; font-size: 0.82rem; cursor: pointer;">Salvar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const input = modal.querySelector('#input-modal-texto');
    input.value = valorInicial;
    input.focus();
    input.select();

    const fechar = (val) => { modal.remove(); resolve(val); };

    modal.querySelector('#btn-modal-cancelar').onclick = () => fechar(null);
    modal.querySelector('#btn-modal-salvar').onclick = () => fechar(input.value.trim());
    input.onkeydown = (e) => {
      if (e.key === 'Enter') fechar(input.value.trim());
      if (e.key === 'Escape') fechar(null);
    };
  });
}

export function pedirSelecaoPastaModal(pastas, pastaAtual = null) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'folder-move-backdrop';
    modal.setAttribute('role', 'presentation');
    const card = document.createElement('section');
    card.className = 'folder-move-dialog';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'folder-move-title');
    const header = document.createElement('header');
    const title = document.createElement('h2');
    title.id = 'folder-move-title';
    title.textContent = 'Mover nota';
    const description = document.createElement('p');
    description.className = 'folder-move-description';
    description.textContent = 'Escolha a pasta onde esta nota deve ficar.';
    header.append(title, description);

    const list = document.createElement('fieldset');
    list.className = 'folder-move-options';
    list.setAttribute('aria-label', 'Pasta de destino');
    const options = [
      ...pastas.map((pasta) => ({ id: String(pasta.id), nome: pasta.nome || 'Pasta sem nome', semPasta: false })),
      { id: '__sem_pasta__', nome: 'Sem pasta', detalhe: 'Manter como nota solta', semPasta: true },
    ];
    let radioParaFocar = null;
    options.forEach((opcao, index) => {
      const row = document.createElement('label');
      row.className = 'folder-move-option';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'pasta-destino-nota';
      radio.value = opcao.id;
      // Uma nota solta começa sem destino selecionado para evitar confirmar
      // acidentalmente a mesma opção e parecer que a movimentação falhou.
      radio.checked = opcao.semPasta
        ? pastaAtual !== null && pastaAtual !== undefined && pastaAtual !== '' && String(pastaAtual) === '__sem_pasta__'
        : pastaAtual !== null && pastaAtual !== undefined && pastaAtual !== '' && String(pastaAtual) === opcao.id;
      const copy = document.createElement('span');
      copy.className = 'folder-move-option-copy';
      const name = document.createElement('strong');
      name.textContent = opcao.nome;
      copy.append(name);
      if (opcao.detalhe) {
        const detail = document.createElement('small');
        detail.textContent = opcao.detalhe;
        copy.append(detail);
      }
      row.append(radio, copy);
      list.append(row);
      if (!radioParaFocar && (!opcao.semPasta || options.length === 1)) radioParaFocar = radio;
    });

    const footer = document.createElement('footer');
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'folder-move-cancel';
    cancel.textContent = 'Cancelar';
    const move = document.createElement('button');
    move.type = 'button';
    move.className = 'folder-move-confirm';
    move.textContent = 'Mover nota';
    move.disabled = !list.querySelector('input:checked');
    footer.append(cancel, move);
    card.append(header, list, footer);
    modal.append(card);
    document.body.append(modal);

    const fechar = (valor) => {
      document.removeEventListener('keydown', aoTeclar);
      modal.remove();
      resolve(valor);
    };
    const aoTeclar = (event) => {
      if (event.key === 'Escape') fechar(undefined);
    };
    list.addEventListener('change', () => { move.disabled = !list.querySelector('input:checked'); });
    cancel.addEventListener('click', () => fechar(undefined));
    move.addEventListener('click', () => {
      const escolha = list.querySelector('input:checked');
      if (!escolha) return;
      fechar(escolha.value === '__sem_pasta__' ? null : escolha.value);
    });
    modal.addEventListener('click', (event) => { if (event.target === modal) fechar(undefined); });
    document.addEventListener('keydown', aoTeclar);
    (list.querySelector('input:checked') || radioParaFocar)?.focus();
  });
}

// =========================================================================
// MÓDULO MENU LATERAL & CÉREBRO
// =========================================================================
