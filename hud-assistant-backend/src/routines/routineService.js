 import { prisma } from '../db/client.js';
 import { emitirParaUsuario } from '../socket/index.js';
 import { prepararLoteProspeccao } from './localProspectingService.js';
 const DIAS_UTEIS = [1, 2, 3, 4, 5];
 const DIAS_SEMANA = { domingo: 0, dom: 0, segunda: 1, 'segunda-feira': 1, seg: 1, terca: 2, 'terça-feira': 2, 'terca-feira': 2, ter: 2, quarta: 3, 'quarta-feira': 3, qua: 3, quinta: 4, 'quinta-feira': 4, qui: 4, sexta: 5, 'sexta-feira': 5, sex: 5, sabado: 6, sábado: 6, sab: 6 };
 function normalizar(texto = '') { return String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
 function horaParaMinutos(valor) {
   const match = String(valor || '').match(/^(\d{1,2})(?::(\d{2}))?$/);
   if (!match) return null;
   const hora = Number(match[1]);
   const minuto = Number(match[2] || 0);
   if (hora > 23 || minuto > 59) return null;
   return hora * 60 + minuto;
 }
 function minutosParaHora(minutos) {
   return String(Math.floor(minutos / 60)).padStart(2, '0') + ':' + String(minutos % 60).padStart(2, '0');
 }
 function extrairDias(texto) {
   const normalizado = normalizar(texto);
   if (/segunda\s*(?:a|ate)\s*sexta|dias\s+uteis/.test(normalizado)) return DIAS_UTEIS;
   const encontrados = Object.entries(DIAS_SEMANA)
     .filter(([nome]) => new RegExp('\\b' + nome.replace('-', '[ -]?') + '\\b').test(normalizado))
     .map(([, dia]) => dia);
   return [...new Set(encontrados)].sort((a, b) => a - b);
 }
 export function extrairRotinaProspeccao(texto) {
   const original = String(texto || '');
   const normalizado = normalizar(original);
   const pediuRotina = /\b(cria|criar|crie|nova|adiciona|adicionar|agende|agendar)\b[^.]{0,90}\brotina\b|\brotina\b[^.]{0,90}\b(cria|criar|nova|adiciona|agende)\b/.test(normalizado);
   const eProspeccao = /\b(procurar|buscar|pesquisar|prospectar|prospeccao|empresas|negocios|negocios locais)\b/.test(normalizado);
   if (!pediuRotina || !eProspeccao) return null;
   const quantidadeMatch = normalizado.match(/\b(\d{1,3})\s*(?:empresas|negocios|leads)\b/);
   const quantidadePedida = quantidadeMatch ? Number(quantidadeMatch[1]) : 15;
   if (!Number.isInteger(quantidadePedida) || quantidadePedida < 1 || quantidadePedida > 50) return { erro: 'A quantidade precisa ficar entre 1 e 50 empresas por rodada.' };
   const quantidade = Math.min(quantidadePedida, 15);
   const intervaloMatch = normalizado.match(/(?:de\s*)?(\d{1,2})\s*em\s*\1\s*(?:horas?|h)\b|(?:a\s+cada\s+)(\d{1,2})\s*(?:horas?|h)\b/);
   const intervaloHoras = intervaloMatch ? Number(intervaloMatch[1] || intervaloMatch[2]) : 2;
   const intervaloMinutos = intervaloHoras * 60;
   if (!Number.isInteger(intervaloMinutos) || intervaloMinutos < 30 || intervaloMinutos > 720) return { erro: 'O intervalo precisa ficar entre 30 minutos e 12 horas.' };
   const faixas = [...normalizado.matchAll(/(?:das?|de)\s*(\d{1,2}(?::\d{2})?)\s*(?:h)?\s*(?:as|a|ate)\s*(\d{1,2}(?::\d{2})?)\s*h?/g)];
   const faixa = faixas.at(-1);
   const inicioMinutos = horaParaMinutos(faixa?.[1] || '09:00');
   const fimMinutos = horaParaMinutos(faixa?.[2] || '18:00');
   if (inicioMinutos === null || fimMinutos === null || inicioMinutos >= fimMinutos) return { erro: 'Informe uma faixa válida, por exemplo: das 09h às 18h.' };
   const diasSemana = extrairDias(original);
   if (!diasSemana.length) return { erro: 'Diga os dias da rotina, por exemplo: de segunda a sexta.' };
   return {
     nome: 'Prospecção de até ' + quantidade + ' empresas',
     objetivo: 'Pesquisar até ' + quantidade + ' empresas locais por rodada, gerar rascunhos e aguardar aprovação antes de qualquer envio.',
     quantidade,
     intervaloMinutos,
    diasSemana,
     horarioInicio: minutosParaHora(inicioMinutos),
     horarioFim: minutosParaHora(fimMinutos),
     timezone: 'America/Sao_Paulo',
   };
 }
 export function descreverAgenda(rotina) {
  const dias = Array.isArray(rotina.diasSemana) ? rotina.diasSemana.join(',') : rotina.diasSemana;
   const nomes = { '1': 'seg', '2': 'ter', '3': 'qua', '4': 'qui', '5': 'sex', '6': 'sáb', '0': 'dom' };
   return String(dias).split(',').map((dia) => nomes[dia]).join(', ') + ', a cada ' + (rotina.intervaloMinutos / 60) + 'h, das ' + rotina.horarioInicio + ' às ' + rotina.horarioFim;
 }
 function partesLocais(data, timezone) {
   const partes = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(data).reduce((resultado, parte) => ({ ...resultado, [parte.type]: parte.value }), {});
   const dias = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
   return { dia: dias[partes.weekday], minutos: Number(partes.hour) * 60 + Number(partes.minute) };
 }
 function deveExecutar(rotina, agora) {
   const { dia, minutos } = partesLocais(agora, rotina.timezone);
   const dias = String(rotina.diasSemana).split(',').map(Number);
   const inicio = horaParaMinutos(rotina.horarioInicio);
   const fim = horaParaMinutos(rotina.horarioFim);
   if (!dias.includes(dia) || minutos < inicio || minutos > fim) return false;
   return (minutos - inicio) % rotina.intervaloMinutos === 0;
 }
 export async function executarRotinasPendentes(agora = new Date()) {
   const rotinas = await prisma.rotina.findMany({ where: { ativa: true } });
   const resultados = [];
   for (const rotina of rotinas) {
     if (!deveExecutar(rotina, agora)) continue;
     const janelaInicio = new Date(agora.getTime() - 59000);
     const jaExecutou = await prisma.execucaoRotina.findFirst({ where: { rotinaId: rotina.id, criadaEm: { gte: janelaInicio } }, select: { id: true } });
     if (jaExecutou) continue;
     const execucao = await prisma.execucaoRotina.create({ data: { rotinaId: rotina.id, status: 'PESQUISANDO', quantidadeSolicitada: Math.min(rotina.quantidade, 15) } });
     try {
       const lote = await prepararLoteProspeccao({ usuarioId: rotina.usuarioId, execucao, quantidade: rotina.quantidade });
       resultados.push({ rotina, execucao, lote });
     } catch (erro) {
       console.error('[rotinas] prospecção falhou para ' + rotina.id + ':', erro.message);
       await prisma.execucaoRotina.update({ where: { id: execucao.id }, data: { status: 'FALHOU', concluidaEm: new Date() } });
       emitirParaUsuario(rotina.usuarioId, 'prospeccao:erro', { rotinaId: rotina.id, mensagem: 'Não foi possível preparar os leads desta rodada. Verifique a chave de busca e tente na próxima execução.' });
     }
   }
   return resultados;
 }
 export async function iniciarAgendadorRotinas() {
   setInterval(() => { executarRotinasPendentes().catch((erro) => console.error('[rotinas] falha ao executar:', erro?.message)); }, 60000).unref();
    }