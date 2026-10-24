import './windowChrome.js';
import './styles.css';
import { BACKEND_URL } from './authGuard.js';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_DESKTOP_CLIENT_ID = import.meta.env.VITE_GOOGLE_DESKTOP_CLIENT_ID;
const GOOGLE_DESKTOP_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_DESKTOP_CLIENT_SECRET;

let writeTextFile, BaseDirectory;
void (async () => {
  try {
    const pkg = '@tauri-apps/plugin-fs';
    const tauriFs = await import(/* @vite-ignore */ pkg);
    writeTextFile = tauriFs.writeTextFile;
    BaseDirectory = tauriFs.BaseDirectory;
  } catch (e) {
    console.warn('[Email] Módulo Tauri FS indisponível no navegador web.');
  }
})();

const listaEmailsEl = document.getElementById('lista-emails');
const leitorAssunto = document.getElementById('leitor-assunto');
const leitorRemetente = document.getElementById('leitor-remetente');
const leitorData = document.getElementById('leitor-data');
const leitorCorpo = document.getElementById('leitor-corpo');

let btnSalvarTxt = document.getElementById('btn-salvar-txt');
let btnSalvarCerebro = document.getElementById('btn-salvar-cerebro');

const txtContaAtiva = document.getElementById('txt-conta-ativa');
const btnAlterarConta = document.getElementById('btn-alterar-conta');

const modalEmailPreview = document.getElementById('modal-email-preview');
const btnModalTrocar = document.getElementById('btn-modal-trocar');

let emailAbertoAtual = null;
let googleAccessToken = localStorage.getItem('google_access_token');

// --- INICIALIZAÇÃO E ADEQUAÇÃO DOS BOTÕES DE AÇÃO ---
function inicializarBotoesAcao() {
  btnSalvarTxt = document.getElementById('btn-salvar-txt');
  if (btnSalvarTxt) {
    btnSalvarTxt.textContent = 'Salvar em Texto (.txt) em seu computador';
  }

  btnSalvarCerebro = document.getElementById('btn-salvar-cerebro');
  
  // Se o botão do Cérebro ainda não existir no HTML, injeta automaticamente ao lado do botão TXT
  if (!btnSalvarCerebro && btnSalvarTxt && btnSalvarTxt.parentElement) {
    btnSalvarCerebro = document.createElement('button');
    btnSalvarCerebro.id = 'btn-salvar-cerebro';
    btnSalvarCerebro.textContent = 'Salvar no Cérebro da Urfilig';
    btnSalvarCerebro.disabled = true;
    btnSalvarCerebro.style.cssText = `
      background: rgba(56, 189, 248, 0.15);
      color: #38bdf8;
      border: 1px solid #38bdf8;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 500;
      margin-left: 8px;
    `;
    btnSalvarTxt.parentElement.appendChild(btnSalvarCerebro);
  }

  btnSalvarCerebro?.addEventListener('click', salvarNoCerebro);
}

function verificarTokenNaUrl() {
  const urlAtual = window.location.href;
  let accessToken = null;

  if (urlAtual.includes('access_token=')) {
    const fragmento = urlAtual.includes('#') ? urlAtual.split('#')[1] : urlAtual.split('?')[1];
    const params = new URLSearchParams(fragmento);
    accessToken = params.get('access_token');
  }

  if (accessToken) {
    localStorage.setItem('google_access_token', accessToken);
    googleAccessToken = accessToken;
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

function obterEmailDaSessao() {
  try {
    const usuario = JSON.parse(localStorage.getItem('urfilig_usuario') || '{}');
    return typeof usuario.email === 'string' ? usuario.email.trim() : '';
  } catch {
    return '';
  }
}
async function conectarContaGoogle() {
  const tauri = window.__TAURI_INTERNALS__ !== undefined || window.__TAURI__ !== undefined;
  if (tauri) {
    if (!GOOGLE_DESKTOP_CLIENT_ID) { exibirEstadoSemConexao('Esta versão não tem o cliente Google Desktop configurado.'); return; }
    try {
      const inicio = await fetch(`${BACKEND_URL}/api/auth/google/desktop/start`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ clientId:GOOGLE_DESKTOP_CLIENT_ID, clientSecret:GOOGLE_DESKTOP_CLIENT_SECRET || undefined, emailAccess:true, loginHint:obterEmailDaSessao() || undefined }) });
      const sessao = await inicio.json();
      if (!inicio.ok) throw new Error(sessao.erro || 'Não foi possível iniciar a conexão com o Google.');
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('abrir_url_externa', { url:sessao.authUrl });
      if (listaEmailsEl) listaEmailsEl.innerHTML = '<div class="email-vazio-msg">Conclua a autorização no navegador. Esta tela voltará automaticamente.</div>';
      const limite = Date.now() + 5 * 60 * 1000;
      while (Date.now() < limite) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const resposta = await fetch(`${BACKEND_URL}/api/auth/google/desktop/status?state=${encodeURIComponent(sessao.state)}`);
        const resultado = await resposta.json();
        if (resultado.status === 'complete') {
          if (!resultado.accessToken) throw new Error('O Google não retornou permissão para ler o Gmail.');
          localStorage.setItem('google_access_token', resultado.accessToken); googleAccessToken = resultado.accessToken;
          await verificarPerfilConta(); return;
        }
        if (resultado.status === 'error') throw new Error(resultado.erro || 'Não foi possível conectar a conta Google.');
      }
      throw new Error('O tempo para autorizar expirou. Clique em conectar e tente novamente.');
    } catch (erro) {
      console.error('[Email] Falha ao conectar Google:', erro);
      exibirEstadoSemConexao(erro.message || 'Não foi possível conectar a conta Google.');
    }
    return;
  }
  if (!GOOGLE_CLIENT_ID) { exibirEstadoSemConexao('O login Google para navegador não está configurado.'); return; }
  try {
    if (!window.google?.accounts?.oauth2) await new Promise((resolve,reject)=>{ const script=document.createElement('script'); script.src='https://accounts.google.com/gsi/client'; script.onload=resolve; script.onerror=()=>reject(new Error('Não foi possível carregar o serviço de login do Google.')); document.head.appendChild(script); });
    const tokenClient = window.google.accounts.oauth2.initTokenClient({ client_id:GOOGLE_CLIENT_ID, scope:'https://www.googleapis.com/auth/gmail.readonly', callback:async resultado=>{
      if (resultado.error || !resultado.access_token) { exibirEstadoSemConexao(resultado.error_description || resultado.error || 'Autorização do Gmail cancelada.'); return; }
      localStorage.setItem('google_access_token',resultado.access_token); googleAccessToken=resultado.access_token; await verificarPerfilConta();
    }, error_callback:erro=>exibirEstadoSemConexao(erro?.message || 'O Google bloqueou a janela de autorização. Permita pop-ups e tente novamente.') });
    tokenClient.requestAccessToken({prompt:'consent'});
  } catch (erro) { exibirEstadoSemConexao(erro.message || 'Não foi possível iniciar a autorização do Gmail.'); }
}
function decodeBase64URL(str) {
  if (!str) return '';
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(escape(atob(base64)));
  } catch (e) {
    try {
      return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    } catch {
      return str;
    }
  }
}

function extrairCorpoEmail(payload) {
  if (!payload) return '';
  if (payload.body && payload.body.data) {
    return decodeBase64URL(payload.body.data);
  }
  if (payload.parts && payload.parts.length > 0) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        return decodeBase64URL(part.body.data);
      }
      if (part.parts) {
        const sub = extrairCorpoEmail(part);
        if (sub) return sub;
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body && part.body.data) {
        const html = decodeBase64URL(part.body.data);
        return html.replace(/<[^>]*>/g, '');
      }
    }
  }
  return 'Conteúdo sem formato de texto legível.';
}

function exibirEstadoSemConexao(mensagemErro = 'Sessão do Gmail não encontrada ou expirada.') {
  if (txtContaAtiva) txtContaAtiva.textContent = 'Não conectada';
  if (listaEmailsEl) {
    listaEmailsEl.innerHTML = `
      <div class="email-vazio-msg" style="padding: 2rem 1rem;">
        <p style="margin-bottom: 1rem; color: #f87171; font-size: 0.85rem;">${mensagemErro}</p>
        <button id="btn-reconectar-google" style="background: #1e293b; color: #38bdf8; border: 1px solid #38bdf8; padding: 0.6rem 1rem; border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: 500;">
          Conectar Conta Google
        </button>
      </div>
    `;
    document.getElementById('btn-reconectar-google')?.addEventListener('click', conectarContaGoogle);
  }
}

async function verificarPerfilConta() {
  verificarTokenNaUrl();
  googleAccessToken = localStorage.getItem('google_access_token');

  if (!googleAccessToken) {
    exibirEstadoSemConexao('Sessão do Gmail não encontrada ou expirada.');
    return;
  }

  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${googleAccessToken}` }
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const detalheErro = errData.error?.message || `Erro ${res.status}`;
      throw new Error(detalheErro);
    }

    const perfil = await res.json();
    const emailConta = perfil.emailAddress;

    if (txtContaAtiva) txtContaAtiva.textContent = emailConta;
    if (modalEmailPreview) modalEmailPreview.textContent = emailConta;

    carregarEmails('INBOX');
  } catch (erro) {
    console.error('[Email] Erro ao validar perfil:', erro.message);
    exibirEstadoSemConexao(`Falha na conexão: ${erro.message}`);
  }
}

async function carregarEmails(pasta = 'INBOX') {
  if (!listaEmailsEl) return;
  listaEmailsEl.innerHTML = '<div class="email-vazio-msg">Carregando mensagens...</div>';
  
  try {
    const resLista = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=${pasta}&maxResults=15`, {
      headers: { Authorization: `Bearer ${googleAccessToken}` }
    });
    
    if (resLista.status === 401) {
      exibirEstadoSemConexao('Sessão expirada. Por favor, conecte novamente.');
      return;
    }
    
    const dadosLista = await resLista.json();
    listaEmailsEl.innerHTML = '';
    
    if (!dadosLista.messages || dadosLista.messages.length === 0) {
      listaEmailsEl.innerHTML = '<div class="email-vazio-msg">Nenhum e-mail encontrado nesta pasta.</div>';
      return;
    }

    for (const msg of dadosLista.messages) {
      const resDetalhe = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, {
        headers: { Authorization: `Bearer ${googleAccessToken}` }
      });
      const detalhe = await resDetalhe.json();
      
      const headers = detalhe.payload.headers || [];
      const assunto = headers.find(h => h.name.toLowerCase() === 'subject')?.value || 'Sem Assunto';
      const de = headers.find(h => h.name.toLowerCase() === 'from')?.value || 'Desconhecido';
      const dataStr = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';
      
      const div = document.createElement('div');
      div.className = 'email-item';
      div.innerHTML = `
        <div class="email-item-remetente">${de.split('<')[0].replace(/"/g, '')}</div>
        <div class="email-item-assunto">${assunto}</div>
        <div class="email-item-data">${dataStr ? new Date(dataStr).toLocaleDateString('pt-BR') : ''}</div>
      `;
      
      div.onclick = () => {
        document.querySelectorAll('.email-item').forEach(el => el.classList.remove('selecionado'));
        div.classList.add('selecionado');
        abrirEmail(msg.id, assunto, de, dataStr);
      };
      
      listaEmailsEl.appendChild(div);
    }
  } catch (erro) {
    console.error(erro);
    listaEmailsEl.innerHTML = '<div class="email-vazio-msg" style="color: #f87171;">Erro ao carregar mensagens. Tente recarregar a página.</div>';
  }
}

async function abrirEmail(id, assunto, remetente, dataStr) {
  if (!leitorAssunto || !leitorCorpo) return;
  leitorAssunto.textContent = 'Carregando...';
  leitorCorpo.textContent = '';
  if (btnSalvarTxt) btnSalvarTxt.disabled = true;
  if (btnSalvarCerebro) btnSalvarCerebro.disabled = true;
  
  try {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
      headers: { Authorization: `Bearer ${googleAccessToken}` }
    });
    const emailCompleto = await res.json();
    
    const corpoTexto = extrairCorpoEmail(emailCompleto.payload);
    emailAbertoAtual = { id, assunto, remetente, dataStr, corpo: corpoTexto };
    
    leitorAssunto.textContent = assunto;
    if (leitorRemetente) leitorRemetente.textContent = `De: ${remetente}`;
    if (leitorData) leitorData.textContent = `Data: ${dataStr ? new Date(dataStr).toLocaleString('pt-BR') : ''}`;
    leitorCorpo.textContent = corpoTexto;
    
    if (btnSalvarTxt) btnSalvarTxt.disabled = false;
    if (btnSalvarCerebro) btnSalvarCerebro.disabled = false;
  } catch (erro) {
    leitorAssunto.textContent = 'Erro ao carregar a mensagem.';
    console.error(erro);
  }
}

// --- FUNÇÃO PARA SALVAR NO CÉREBRO DA URFILIG ---
async function salvarNoCerebro() {
  if (!emailAbertoAtual) return;

  const tokenUrfilig = localStorage.getItem('urfilig_token');
  if (!tokenUrfilig) {
    alert('Sessão da Urfilig não encontrada. Faça login novamente.');
    return;
  }

  if (btnSalvarCerebro) {
    btnSalvarCerebro.textContent = 'Salvando no Cérebro...';
    btnSalvarCerebro.disabled = true;
  }

  try {
    const cabecalhos = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenUrfilig}`,
    };

    // 1. Busca pastas do Cérebro
    let pastas = [];
    const resPastas = await fetch(`${BACKEND_URL}/api/cerebro/pastas`, { headers: cabecalhos });
    if (resPastas.ok) {
      pastas = await resPastas.json();
    }

    // 2. Busca ou cria a pasta "E-mails"
    let pastaTarget = pastas.find(
      (p) => p.nome.toLowerCase() === 'e-mails' || p.nome.toLowerCase() === 'emails'
    );

    if (!pastaTarget) {
      const resCriarPasta = await fetch(`${BACKEND_URL}/api/cerebro/pastas`, {
        method: 'POST',
        headers: cabecalhos,
        body: JSON.stringify({ nome: 'E-mails' }),
      });

      if (resCriarPasta.ok) {
        pastaTarget = await resCriarPasta.json();
      } else if (pastas.length > 0) {
        pastaTarget = pastas[0];
      }
    }

    if (!pastaTarget) {
      throw new Error('Não foi possível criar/encontrar uma pasta no Cérebro.');
    }

    // 3. Monta e envia a nota para a pasta "E-mails"
    const titulo = emailAbertoAtual.assunto || 'E-mail sem assunto';
    const conteudo = `De: ${emailAbertoAtual.remetente}\nData: ${emailAbertoAtual.dataStr}\n\n${emailAbertoAtual.corpo}`;

    let resNota = await fetch(`${BACKEND_URL}/api/cerebro/pastas/${pastaTarget.id}/notas`, {
      method: 'POST',
      headers: cabecalhos,
      body: JSON.stringify({ titulo, conteudo }),
    });

    if (resNota.status === 404) {
      resNota = await fetch(`${BACKEND_URL}/api/cerebro/notas`, {
        method: 'POST',
        headers: cabecalhos,
        body: JSON.stringify({ titulo, conteudo, pastaId: pastaTarget.id }),
      });
    }

    if (!resNota.ok) {
      const errJson = await resNota.json().catch(() => ({}));
      throw new Error(errJson.erro || errJson.message || `Erro ${resNota.status}`);
    }

    alert('E-mail salvo com sucesso no Cérebro da Urfilig!');
  } catch (erro) {
    console.error('[Email] Erro ao salvar no Cérebro:', erro);
    alert(`Falha ao salvar no Cérebro: ${erro.message}`);
  } finally {
    if (btnSalvarCerebro) {
      btnSalvarCerebro.textContent = 'Salvar no Cérebro da Urfilig';
      btnSalvarCerebro.disabled = false;
    }
  }
}

document.querySelectorAll('#lista-pastas .email-pasta-item').forEach(item => {
  item.addEventListener('click', (e) => {
    document.querySelectorAll('#lista-pastas .email-pasta-item').forEach(el => el.classList.remove('ativo'));
    const target = e.currentTarget;
    target.classList.add('ativo');
    carregarEmails(target.dataset.folder);
  });
});

btnModalTrocar?.addEventListener('click', conectarContaGoogle);
btnAlterarConta?.addEventListener('click', conectarContaGoogle);

btnSalvarTxt?.addEventListener('click', async () => {
  if (!emailAbertoAtual) return;
  
  const b = btnSalvarTxt;
  b.textContent = 'Salvando...';
  b.disabled = true;

  const dataAtual = new Date().toISOString().split('T')[0];
  const nomeSeguro = emailAbertoAtual.assunto.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
  const nomeArquivo = `Email_${dataAtual}_${nomeSeguro}.txt`;
  
  const conteudoArquivo = `DOCUMENTO DE E-MAIL - URFILIG
Data do Registro: ${new Date().toLocaleString('pt-BR')}
Assunto: ${emailAbertoAtual.assunto}
Remetente: ${emailAbertoAtual.remetente}
Data Original: ${emailAbertoAtual.dataStr}
ID da Mensagem: ${emailAbertoAtual.id}
--------------------------------------------------

${emailAbertoAtual.corpo}
`;

  try {
    if (writeTextFile && BaseDirectory) {
      await writeTextFile(nomeArquivo, conteudoArquivo, { dir: BaseDirectory.Document });
      alert(`Arquivo salvo em Documentos com sucesso!\n\nNome: ${nomeArquivo}`);
    } else {
      const blob = new Blob([conteudoArquivo], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeArquivo;
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (erro) {
    console.error('Erro ao salvar texto:', erro);
    const blob = new Blob([conteudoArquivo], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    a.click();
    URL.revokeObjectURL(url);
  } finally {
    b.textContent = 'Salvar em Texto (.txt) em seu computador';
    b.disabled = false;
  }
});

inicializarBotoesAcao();
verificarPerfilConta();