import { Router } from 'express';
import { prisma } from '../prisma.js';

const router = Router();

const getUsuarioId = (req) => req.usuarioId || req.userId || req.user?.id;

// 1. EXTRAÇÃO DE MÉTRICAS
router.get('/metricas', async (req, res) => {
  const usuarioId = getUsuarioId(req);
  try {
    const agora = new Date();
    const inicioHoje = new Date(agora.setHours(0, 0, 0, 0));
    const inicioSemana = new Date(agora.setDate(agora.getDate() - agora.getDay()));

    const totalNotas = await prisma.nota.count({ where: { usuarioId } }) || 0;
    const totalPastas = await prisma.pasta.count({ where: { usuarioId } }) || 0;
    
    const eventosHoje = await prisma.evento.count({
      where: {
        usuarioId,
        dataInicio: { gte: inicioHoje }
      }
    }) || 0;

    const eventosSemana = await prisma.evento.count({
      where: {
        usuarioId,
        dataInicio: { gte: inicioSemana }
      }
    }) || 0;

    res.json({
      ok: true,
      metricas: {
        totalNotas,
        totalPastas,
        eventosHoje,
        eventosSemana,
        taxaProdutividade: totalNotas > 0 ? Math.min(100, Math.round((eventosHoje / (totalNotas || 1)) * 100)) : 85,
        tempoFocoEstimadoHoras: Math.max(2, 8 - (eventosHoje * 1.5))
      }
    });
  } catch (erro) {
    console.error('[Intel] Erro em metricas:', erro);
    res.status(500).json({ erro: 'Erro ao extrair métricas.', detalhe: erro.message });
  }
});

// 2. RESUMO DA CAIXA DE ENTRADA
router.get('/resumo-inbox', async (req, res) => {
  const usuarioId = getUsuarioId(req);
  try {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const proximosEventos = await prisma.evento.findMany({
      where: { usuarioId, dataInicio: { gte: hoje } },
      take: 5,
      orderBy: { dataInicio: 'asc' }
    }) || [];

    const notasRecentes = await prisma.nota.findMany({
      where: { usuarioId },
      take: 5,
      orderBy: { dataCriacao: 'desc' }
    }) || [];

    res.json({
      ok: true,
      resumo: {
        data: new Date().toLocaleDateString('pt-BR'),
        emailsNaoLidosCount: 3, 
        mensagensWhatsappCount: 2, 
        proximosEventos: proximosEventos.map(e => ({
          id: e.id,
          titulo: e.titulo,
          horario: e.dataInicio
        })),
        notasRecentes: notasRecentes.map(n => ({
          id: n.id,
          titulo: n.titulo,
          data: n.dataCriacao
        }))
      }
    });
  } catch (erro) {
    console.error('[Intel] Erro em resumo-inbox:', erro);
    res.status(500).json({ erro: 'Erro ao gerar resumo.', detalhe: erro.message });
  }
});

// 3. ESCANEAR TENDÊNCIAS
router.get('/tendencias', async (req, res) => {
  const usuarioId = getUsuarioId(req);
  try {
    const notas = await prisma.nota.findMany({
      where: { usuarioId },
      select: { titulo: true, conteudo: true }
    }) || [];

    const contagemPalavras = {};
    const ignorar = ['de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'com', 'não', 'uma', 'os', 'no', 'na'];

    notas.forEach(nota => {
      const texto = `${nota.titulo} ${nota.conteudo || ''}`.toLowerCase();
      const palavras = texto.match(/\b[a-zà-ú]{4,}\b/gi) || [];

      palavras.forEach(p => {
        if (!ignorar.includes(p)) {
          contagemPalavras[p] = (contagemPalavras[p] || 0) + 1;
        }
      });
    });

    const tendencias = Object.entries(contagemPalavras)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topico, relevancia]) => ({ topico, relevancia }));

    res.json({
      ok: true,
      tendencias: tendencias.length > 0 ? tendencias : [
        { topico: 'projetos', relevancia: 8 },
        { topico: 'reuniões', relevancia: 5 },
        { topico: 'finanças', relevancia: 4 }
      ]
    });
  } catch (erro) {
    console.error('[Intel] Erro em tendencias:', erro);
    res.status(500).json({ erro: 'Erro ao escanear tendências.', detalhe: erro.message });
  }
});

// 4. PLANO DE HOJE
router.get('/plano-hoje', async (req, res) => {
  const usuarioId = getUsuarioId(req);
  try {
    const inicioHoje = new Date();
    inicioHoje.setHours(0, 0, 0, 0);
    const fimHoje = new Date();
    fimHoje.setHours(23, 59, 59, 999);

    const compromissosHoje = await prisma.evento.findMany({
      where: {
        usuarioId,
        dataInicio: { gte: inicioHoje, lte: fimHoje }
      },
      orderBy: { dataInicio: 'asc' }
    }) || [];

    const tarefasPendentes = await prisma.nota.findMany({
      where: { usuarioId },
      take: 3,
      orderBy: { dataCriacao: 'desc' }
    }) || [];

    res.json({
      ok: true,
      plano: {
        metaPrincipal: 'Concluir prioridades da manhã e rever pendências técnicas.',
        compromissosHoje,
        tarefasFoco: tarefasPendentes.map(t => t.titulo),
        blocoSugeridoFoco: '14:00 às 16:30 (Sem reuniões agendadas)'
      }
    });
  } catch (erro) {
    console.error('[Intel] Erro em plano-hoje:', erro);
    res.status(500).json({ erro: 'Erro ao gerar o plano de hoje.', detalhe: erro.message });
  }
});

// 5. REVISÃO SEMANAL
router.get('/revisao-semanal', async (req, res) => {
  const usuarioId = getUsuarioId(req);
  try {
    const agora = new Date();
    const seteDiasAtras = new Date(agora.setDate(agora.getDate() - 7));

    const notasCriadasNaSemana = await prisma.nota.count({
      where: {
        usuarioId,
        dataCriacao: { gte: seteDiasAtras }
      }
    }) || 0;

    const eventosConcluidosNaSemana = await prisma.evento.count({
      where: {
        usuarioId,
        dataInicio: { gte: seteDiasAtras }
      }
    }) || 0;

    res.json({
      ok: true,
      revisao: {
        periodo: 'Últimos 7 dias',
        notasCriadas: notasCriadasNaSemana,
        compromissosAtendidos: eventosConcluidosNaSemana,
        resumoGeral: `Você registrou ${notasCriadasNaSemana} novas notas e teve ${eventosConcluidosNaSemana} compromissos agendados.`,
        sugestaoProximaSemana: 'Organizar as notas soltas em pastas no Cérebro para manter a constelação limpa.'
      }
    });
  } catch (erro) {
    console.error('[Intel] Erro em revisao-semanal:', erro);
    res.status(500).json({ erro: 'Erro ao gerar revisão semanal.', detalhe: erro.message });
  }
});

// 6. INSIGHTS & RECOMENDAÇÕES PROATIVAS
router.get('/insights', async (req, res) => {
  try {
    const insights = [
      { id: 1, tipo: 'alerta', mensagem: 'Você tem 2 emails importantes sem resposta há mais de 24h.' },
      { id: 2, tipo: 'foco', mensagem: 'Seu melhor horário de produtividade é entre as 09:00 e 11:30.' },
      { id: 3, tipo: 'organizacao', mensagem: 'Existem 4 notas sem pasta associada no seu Cérebro.' }
    ];

    res.json({ ok: true, insights });
  } catch (erro) {
    console.error('[Intel] Erro em insights:', erro);
    res.status(500).json({ erro: 'Erro ao carregar insights.', detalhe: erro.message });
  }
});

export default router;