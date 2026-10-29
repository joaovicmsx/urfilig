export function showDialog({ title = 'Urfilig', message = '', confirm = false, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar' } = {}) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'urfilig-dialog-backdrop';
    backdrop.setAttribute('role', 'presentation');
    const dialog = document.createElement('section');
    dialog.className = 'urfilig-dialog-card';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    const heading = document.createElement('h2');
    heading.textContent = title;
    const body = document.createElement('p');
    body.textContent = message;
    const actions = document.createElement('div');
    actions.className = 'urfilig-dialog-actions';
    const finish = (value) => { backdrop.remove(); resolve(value); };
    if (confirm) {
      const cancel = document.createElement('button');
      cancel.type = 'button'; cancel.textContent = cancelLabel;
      cancel.addEventListener('click', () => finish(false));
      actions.append(cancel);
    }
    const ok = document.createElement('button');
    ok.type = 'button'; ok.textContent = confirm ? confirmLabel : 'Entendi';
    ok.dataset.primary = 'true';
    ok.addEventListener('click', () => finish(confirm ? true : undefined));
    actions.append(ok);
    dialog.append(heading, body, actions);
    backdrop.append(dialog);
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) finish(false); });
    backdrop.addEventListener('keydown', (event) => { if (event.key === 'Escape') finish(false); });
    document.body.append(backdrop);
    ok.focus();
  });
}

export const showAlert = (message, title = 'Urfilig') => showDialog({ title, message });
export const showConfirm = (message, title = 'Confirmar ação') => showDialog({ title, message, confirm: true });

export function showToast(message, duration = 3600) {
  const toast = document.createElement('div');
  toast.className = 'urfilig-toast';
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), duration);
}
