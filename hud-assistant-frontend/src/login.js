import './styles.css';
import { BACKEND_URL } from './authGuard.js';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_DESKTOP_CLIENT_ID = import.meta.env.VITE_GOOGLE_DESKTOP_CLIENT_ID;

const form = document.querySelector('#form-login');
const mensagemErro = document.querySelector('#mensagem-erro');
const botaoAlternar = document.querySelector('#alternar-modo');
const campoNome = document.querySelector('#campo-nome');
const tituloForm = document.querySelector('#titulo-form');
const botaoEnviar = document.querySelector('#botao-enviar');

let modoRegistro = false;

// --- CAPTURA O TOKEN DO GOOGLE NA URL E REDIRECIONA COM O TOKEN ---
async function verificarTokenGoogleNaUrl() {
  const urlAtual = window.location.href;
  let accessToken = null;

  if (urlAtual.includes('access_token=')) {
    const fragmento = urlAtual.includes('#') ? urlAtual.split('#')[1] : urlAtual.split('?')[1];
    const params = new URLSearchParams(fragmento);
    accessToken = params.get('access_token');
  }

  if (accessToken) {
    // 1. Guarda o token de acesso no localStorage
    localStorage.setItem('google_access_token', accessToken);

    const redirectDestino = localStorage.getItem('redirect_after_login');

    // 2. Se a requisição veio dos e-mails, regressa repassando o token na URL
    if (redirectDestino) {
      localStorage.removeItem('redirect_after_login');
      window.location.href = `./${redirectDestino}#access_token=${accessToken}`;
      return;
    }

    if (mensagemErro) {
      mensagemErro.style.color = '#a5f3fc';
      mensagemErro.textContent = 'A autenticar com o Google...';
    }
    
    try {
      const resposta = await fetch(`${BACKEND_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          credential: accessToken,
          access_token: accessToken 
        }),
      });
      
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || 'Falha ao autenticar com o Google');
      
      window.history.replaceState({}, document.title, window.location.pathname);
      finalizarLogin(dados);
    } catch (erro) {
      if (mensagemErro) {
        mensagemErro.style.color = '#f87171';
        mensagemErro.textContent = erro.message;
      }
    }
  } else if (localStorage.getItem('urfilig_token')) {
    const redirectDestino = localStorage.getItem('redirect_after_login');
    if (redirectDestino) {
      localStorage.removeItem('redirect_after_login');
      window.location.href = `./${redirectDestino}`;
      return;
    }
    window.location.href = './index.html';
  }
}

window.addEventListener('DOMContentLoaded', verificarTokenGoogleNaUrl);

form?.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  if (mensagemErro) mensagemErro.textContent = '';
  if (botaoEnviar) botaoEnviar.disabled = true;

  const email = form.email.value.trim();
  const senha = form.senha.value;
  const nome = form.nome?.value?.trim();

  const rota = modoRegistro ? '/api/auth/registrar' : '/api/auth/login';
  const corpo = modoRegistro ? { email, senha, nome } : { email, senha };

  try {
    const resposta = await fetch(BACKEND_URL + rota, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || 'Falha ao autenticar');
    finalizarLogin(dados);
  } catch (erro) {
    if (mensagemErro) mensagemErro.textContent = erro.message;
  } finally {
    if (botaoEnviar) botaoEnviar.disabled = false;
  }
});

botaoAlternar?.addEventListener('click', () => {
  modoRegistro = !modoRegistro;
  if (campoNome) campoNome.hidden = !modoRegistro;
  if (tituloForm) tituloForm.textContent = modoRegistro ? 'Criar conta na Urfilig' : 'Entrar na Urfilig';
  if (botaoEnviar) botaoEnviar.textContent = modoRegistro ? 'Criar conta' : 'Entrar';
  if (botaoAlternar) botaoAlternar.textContent = modoRegistro ? 'Já tenho conta' : 'Criar uma conta';
  if (mensagemErro) mensagemErro.textContent = '';
});

function finalizarLogin({ token, usuario }) {
  localStorage.setItem('urfilig_token', token);
  localStorage.setItem('urfilig_usuario', JSON.stringify(usuario));

  const redirectDestino = localStorage.getItem('redirect_after_login');
  if (redirectDestino) {
    localStorage.removeItem('redirect_after_login');
    window.location.href = `./${redirectDestino}`;
    return;
  }

  window.location.href = usuario.onboardingConcluido ? './index.html' : './onboarding.html';
}

const estaNoTauri = window.__TAURI_INTERNALS__ !== undefined || window.__TAURI__ !== undefined;

window.handleCredentialResponse = async (response) => {
  if (mensagemErro) mensagemErro.textContent = '';
  try {
    const resposta = await fetch(`${BACKEND_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential }),
    });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || 'Falha ao autenticar com o Google');
    finalizarLogin(dados);
  } catch (erro) {
    if (mensagemErro) mensagemErro.textContent = erro.message;
  }
};

function inicializarGoogle(tentativas = 0) {
  if (!GOOGLE_CLIENT_ID) {
    if (!estaNoTauri) console.warn('[login] VITE_GOOGLE_CLIENT_ID não configurado.');
  }

  const containerBtn = document.querySelector('#google-signin-button');
  if (!containerBtn) return;

  if (estaNoTauri) {
    if (!GOOGLE_DESKTOP_CLIENT_ID) {
      if (mensagemErro) mensagemErro.textContent = 'O login Google Desktop não está configurado nesta versão.';
      return;
    }
    containerBtn.innerHTML = `
      <button type="button" id="btn-google-tauri" style="width: 100%; max-width: 300px; padding: 10px; border-radius: 24px; background: #fff; color: #3c4043; border: 1px solid #dadce0; cursor: pointer; font-family: 'Google Sans', arial, sans-serif; font-size: 14px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 10px; margin: 0 auto;">
        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Continuar com o Google
      </button>
    `;

    document.querySelector('#btn-google-tauri')?.addEventListener('click', async () => {
      const botao = document.querySelector('#btn-google-tauri');
      if (botao) botao.disabled = true;
      if (mensagemErro) {
        mensagemErro.style.color = '#a5f3fc';
        mensagemErro.textContent = 'A abrir o Google no navegador...';
      }
      try {
        const inicio = await fetch(`${BACKEND_URL}/api/auth/google/desktop/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: GOOGLE_DESKTOP_CLIENT_ID }),
        });
        const sessao = await inicio.json();
        if (!inicio.ok) throw new Error(sessao.erro || 'Não foi possível iniciar o login Google.');

        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('abrir_url_externa', { url: sessao.authUrl });
        if (mensagemErro) mensagemErro.textContent = 'Conclua o login no navegador. Aguardando retorno...';

        const limite = Date.now() + 5 * 60 * 1000;
        while (Date.now() < limite) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const resposta = await fetch(`${BACKEND_URL}/api/auth/google/desktop/status?state=${encodeURIComponent(sessao.state)}`);
          const resultado = await resposta.json();
          if (resultado.status === 'complete') {
            finalizarLogin(resultado);
            return;
          }
          if (resultado.status === 'error') throw new Error(resultado.erro || 'Falha no login Google.');
        }
        throw new Error('O tempo para concluir o login expirou. Tente novamente.');
      } catch (erro) {
        if (mensagemErro) {
          mensagemErro.style.color = '#f87171';
          mensagemErro.textContent = erro.message;
        }
      } finally {
        if (botao) botao.disabled = false;
      }
    });
    return;
  }

  if (!GOOGLE_CLIENT_ID) return;

  if (!window.google?.accounts?.id) {
    if (tentativas > 20) return; 
    setTimeout(() => inicializarGoogle(tentativas + 1), 300);
    return;
  }

  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: window.handleCredentialResponse,
  });
  window.google.accounts.id.renderButton(containerBtn, {
    theme: 'filled_black',
    size: 'large',
    shape: 'pill',
    text: 'continue_with',
    width: 300,
  });
}

inicializarGoogle();
