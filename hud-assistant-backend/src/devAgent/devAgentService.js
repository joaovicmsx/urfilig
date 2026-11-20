import {
  configuracaoGitHubDisponivel,
  planoFallback,
} from './devAgentPolicy.js';

export async function gerarPlanoDevAgent({ repositorio, descricao }) {
  return planoFallback(descricao, 'Plano determinístico sem modelo generativo; execução permanece supervisionada.');
}

export function criarResumoExecucao(tarefa) {
  const plano = tarefa.plano || {};
  return {
    modo: 'SUPERVISIONADO',
    estado: tarefa.status,
    branchSugerida: `urfilig/dev-agent/${tarefa.id}`,
    integracaoGitHub: configuracaoGitHubDisponivel() ? 'configurada' : 'ainda não configurada',
    proximasAcoes: [
      'Após sua aprovação, criar uma branch temporária e um workspace isolado.',
      'Ler somente arquivos permitidos, gerar patch e executar checks permitidos.',
      'Exibir diff e resultado dos testes antes de qualquer push ou Pull Request.',
    ],
    bloqueadoPorDesign: [
      'push, Pull Request, merge, deploy e migrações',
      'arquivos .env, credenciais, chaves e diretório .git',
      'comandos destrutivos ou shell arbitrário',
    ],
    plano,
  };
}
