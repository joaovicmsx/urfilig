import './windowChrome.js';
import './styles.css';
import { BACKEND_URL } from './authGuard.js';

document.addEventListener('DOMContentLoaded', () => {
  const formOnboarding = document.getElementById('form-onboarding');
  const msgErro = document.getElementById('mensagem-erro');
  const btnEnviar = document.getElementById('botao-enviar');

  // Preenche o nome caso já venha do Google
  const usuarioSalvo = localStorage.getItem('urfilig_usuario');
  if (usuarioSalvo) {
    try {
      const usuario = JSON.parse(usuarioSalvo);
      if (usuario.nome && formOnboarding?.nome) {
        formOnboarding.nome.value = usuario.nome;
      }
    } catch (e) {
      console.warn('Erro ao carregar dados locais do usuário:', e);
    }
  }

  formOnboarding?.addEventListener('submit', async (e) => {
    e.preventDefault();
    msgErro.textContent = '';
    btnEnviar.disabled = true;

    const token = localStorage.getItem('urfilig_token');
    const formData = new FormData(formOnboarding);
    const dados = Object.fromEntries(formData.entries());

    // Trata hobbies como array de strings
    if (dados.hobbies && typeof dados.hobbies === 'string') {
      dados.hobbies = dados.hobbies
        .split(',')
        .map((h) => h.trim())
        .filter((h) => h.length > 0);
    }

    if (dados.idade) {
      dados.idade = parseInt(dados.idade, 10);
    }

    try {
      const endpoint = `${BACKEND_URL.replace(/\/$/, '')}/api/usuario/onboarding`;
      
      const resposta = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(dados),
      });

      const contentType = resposta.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Rota não encontrada no backend (${resposta.status}). Verifique a rota no Express.`);
      }

      const resultado = await resposta.json();
      if (!resposta.ok) throw new Error(resultado.erro || 'Erro ao salvar onboarding');

      // Atualiza os dados locais do usuário com onboarding concluído
      if (resultado.usuario) {
        localStorage.setItem('urfilig_usuario', JSON.stringify(resultado.usuario));
      }

      // Redireciona para o HUD Principal
      window.location.href = './index.html';
    } catch (err) {
      msgErro.textContent = err.message || 'Erro ao guardar dados. Tente novamente.';
    } finally {
      btnEnviar.disabled = false;
    }
  });
});