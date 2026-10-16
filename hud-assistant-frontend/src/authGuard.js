/**
 * URL do backend. Trata o protocolo tauri:// para garantir 
 * que os pedidos vão para o servidor Express local.
 */
const hostname = window.location.hostname === 'tauri.localhost' || !window.location.hostname 
  ? 'localhost' 
  : window.location.hostname;

export const BACKEND_URL = `${window.location.protocol.startsWith('http') ? window.location.protocol : 'http:'}//${hostname}:3000`;

/**
 * Exige um token salvo antes de continuar carregando a página.
 */
export function exigirLogin() {
  const url = window.location.href;

  if (url.includes('access_token=')) {
    const params = window.location.hash || window.location.search;
    window.location.href = `./login.html${params}`;
    throw new Error('[authGuard] recebido token do Google — redirecionando para processamento no login');
  }

  const token = localStorage.getItem('urfilig_token');
  if (!token) {
    window.location.href = './login.html';
    throw new Error('[authGuard] sem sessão — redirecionando pro login');
  }
  return token;
}

/**
 * Busca o usuário atual no backend.
 */
export async function obterUsuarioAtual() {
  const token = localStorage.getItem('urfilig_token');
  const resposta = await fetch(`${BACKEND_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resposta.ok) throw new Error('sessão inválida');
  const { usuario } = await resposta.json();
  localStorage.setItem('urfilig_usuario', JSON.stringify(usuario));
  return usuario;
}

/**
 * Valida o token salvo contra o backend.
 */
export async function validarSessao() {
  try {
    const usuario = await obterUsuarioAtual();
    if (!usuario.onboardingConcluido) {
      window.location.href = './onboarding.html';
    }
  } catch {
    sair();
  }
}

export function sair() {
  localStorage.removeItem('urfilig_token');
  localStorage.removeItem('urfilig_usuario');
  window.location.href = './login.html';
}