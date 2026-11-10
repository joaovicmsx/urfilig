import { Router } from 'express';
import { prisma } from '../db/client.js';
import { criarResumoExecucao, gerarPlanoDevAgent } from './devAgentService.js';
import {
  STATUS_TAREFA,
  transicaoPermitida,
  validarCorpoCriarTarefa,
  validarIdTarefa,
} from './devAgentPolicy.js';

export const devAgentRouter = Router();

function serializarTarefa(tarefa) {
  return {
    id: tarefa.id,
    repositorio: tarefa.repositorio,
    descricao: tarefa.descricao,
    status: tarefa.status,
    plano: tarefa.plano,
    criadoEm: tarefa.createdAt,
    atualizadoEm: tarefa.updatedAt,
  };
}

function erroTransicao(res, { atual, proximo }) {
  return res.status(409).json({
    erro: `A tarefa não pode mudar de ${atual || 'seu estado atual'} para ${proximo}. Atualize a tela e tente novamente.`,
  });
}

async function buscarTarefaDoUsuario(id, usuarioId) {
  return prisma.devAgentTask.findFirst({ where: { id, usuarioId } });
}

async function transicionarTarefaAtomica({ id, usuarioId, origem, destino }) {
  if (!transicaoPermitida(origem, destino)) return { invalida: true, atual: origem };
  // A condição de status no updateMany elimina a janela entre leitura e escrita.
  const resultado = await prisma.devAgentTask.updateMany({
    where: { id, usuarioId, status: origem },
    data: { status: destino },
  });
  if (resultado.count !== 1) {
    const atual = await buscarTarefaDoUsuario(id, usuarioId);
    return { conflito: true, inexistente: !atual, atual: atual?.status };
  }
  const tarefa = await buscarTarefaDoUsuario(id, usuarioId);
  return { tarefa };
}

// Cria apenas um plano. Nenhum arquivo é lido ou modificado nesta etapa.
devAgentRouter.post('/tarefas', async (req, res) => {
  const corpo = validarCorpoCriarTarefa(req.body);
  if (corpo.erro) return res.status(400).json({ erro: corpo.erro });

  try {
    const { repositorio, descricao, provider } = corpo.valor;
    const plano = await gerarPlanoDevAgent({ repositorio, descricao, provider });
    const tarefa = await prisma.devAgentTask.create({
      data: {
        usuarioId: req.usuarioId,
        repositorio,
        descricao,
        status: STATUS_TAREFA.AGUARDANDO_APROVACAO,
        plano,
      },
    });
    return res.status(201).json({ ok: true, tarefa: serializarTarefa(tarefa), execucao: criarResumoExecucao(tarefa) });
  } catch (erro) {
    console.error('[dev-agent] falha ao criar plano:', erro?.code || erro?.name || 'erro interno');
    return res.status(500).json({ erro: 'Não foi possível preparar o plano do Dev Agent.' });
  }
});

devAgentRouter.get('/tarefas', async (req, res) => {
  try {
    const tarefas = await prisma.devAgentTask.findMany({
      where: { usuarioId: req.usuarioId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return res.json({ ok: true, tarefas: tarefas.map(serializarTarefa) });
  } catch (erro) {
    console.error('[dev-agent] falha ao listar tarefas:', erro?.code || erro?.name || 'erro interno');
    return res.status(500).json({ erro: 'Não foi possível carregar as tarefas do Dev Agent.' });
  }
});

devAgentRouter.get('/tarefas/:id', async (req, res) => {
  const id = validarIdTarefa(req.params.id);
  if (id.erro) return res.status(400).json({ erro: id.erro });
  try {
    const tarefa = await buscarTarefaDoUsuario(id.valor, req.usuarioId);
    if (!tarefa) return res.status(404).json({ erro: 'Tarefa não encontrada.' });
    return res.json({ ok: true, tarefa: serializarTarefa(tarefa), execucao: criarResumoExecucao(tarefa) });
  } catch (erro) {
    console.error('[dev-agent] falha ao consultar tarefa:', erro?.code || erro?.name || 'erro interno');
    return res.status(500).json({ erro: 'Não foi possível carregar a tarefa do Dev Agent.' });
  }
});

// Aprovação registrada, mas execução segue desativada até existir sandbox local/GitHub App.
devAgentRouter.post('/tarefas/:id/aprovar', async (req, res) => {
  const id = validarIdTarefa(req.params.id);
  if (id.erro) return res.status(400).json({ erro: id.erro });
  try {
    const resultado = await transicionarTarefaAtomica({
      id: id.valor,
      usuarioId: req.usuarioId,
      origem: STATUS_TAREFA.AGUARDANDO_APROVACAO,
      destino: STATUS_TAREFA.APROVADA,
    });
    if (resultado.inexistente) return res.status(404).json({ erro: 'Tarefa não encontrada.' });
    if (resultado.invalida || resultado.conflito) return erroTransicao(res, { atual: resultado.atual, proximo: STATUS_TAREFA.APROVADA });
    return res.json({
      ok: true,
      tarefa: serializarTarefa(resultado.tarefa),
      aviso: 'A aprovação foi registrada. A execução permanece bloqueada até a conexão segura com GitHub App e workspace isolado ser configurada.',
      execucao: criarResumoExecucao(resultado.tarefa),
    });
  } catch (erro) {
    console.error('[dev-agent] falha ao aprovar tarefa:', erro?.code || erro?.name || 'erro interno');
    return res.status(500).json({ erro: 'Não foi possível aprovar a tarefa do Dev Agent.' });
  }
});

devAgentRouter.post('/tarefas/:id/cancelar', async (req, res) => {
  const id = validarIdTarefa(req.params.id);
  if (id.erro) return res.status(400).json({ erro: id.erro });
  try {
    // Cancelar só é permitido antes da execução. A condição de status fica no UPDATE
    // para impedir que uma aprovação simultânea crie uma transição indevida.
    const resultado = await prisma.devAgentTask.updateMany({
      where: {
        id: id.valor,
        usuarioId: req.usuarioId,
        status: { in: [STATUS_TAREFA.AGUARDANDO_APROVACAO, STATUS_TAREFA.APROVADA] },
      },
      data: { status: STATUS_TAREFA.CANCELADA },
    });
    if (resultado.count !== 1) {
      const atual = await buscarTarefaDoUsuario(id.valor, req.usuarioId);
      if (!atual) return res.status(404).json({ erro: 'Tarefa não encontrada.' });
      return erroTransicao(res, { atual: atual.status, proximo: STATUS_TAREFA.CANCELADA });
    }
    const tarefaCancelada = await buscarTarefaDoUsuario(id.valor, req.usuarioId);
    return res.json({ ok: true, tarefa: serializarTarefa(tarefaCancelada) });
  } catch (erro) {
    console.error('[dev-agent] falha ao cancelar tarefa:', erro?.code || erro?.name || 'erro interno');
    return res.status(500).json({ erro: 'Não foi possível cancelar a tarefa do Dev Agent.' });
  }
});
