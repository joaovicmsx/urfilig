import { prisma } from '../db/client.js';

/**
 * Monta a base do prompt usando os dados reais do usuário logado — nome,
 * e o perfil coletado no Onboarding (idade, localização, profissão,
 * hobbies). É esse perfil que forma o "cérebro de contexto
 * individualizado" pedido no Passo 2 do fluxo SaaS: a Urfilig sabe quem é
 * a pessoa antes mesmo da primeira interação de verdade.
 */
function montarBase(usuario) {
  const referenciaAoUsuario = usuario?.nome ? `de ${usuario.nome}` : 'do usuário';
  let base = `Você é a Urfilig, o assistente pessoal ${referenciaAoUsuario}, rodando localmente.
Responda sempre em português, de forma direta e curta (2-4 frases no máximo).`;

  const fatosPerfil = [];
  if (usuario?.idade) fatosPerfil.push(`${usuario.idade} anos`);
  if (usuario?.localizacao) fatosPerfil.push(`mora em ${usuario.localizacao}`);
  if (usuario?.profissao) fatosPerfil.push(`trabalha com ${usuario.profissao}`);
  if (usuario?.hobbies) fatosPerfil.push(`hobbies: ${usuario.hobbies}`);

  if (fatosPerfil.length > 0) {
    base += `\n\nSobre a pessoa que você atende (coletado no onboarding, use como contexto — não repita isso de volta como se fosse novidade): ${fatosPerfil.join(', ')}.`;
  }

  return base;
}

/**
 * Lê o estado atual da personalidade (temperamento + bordões) + o cofre-IA
 * (diretrizes ativas + reflexões recentes) — TUDO filtrado pelo usuário
 * logado — e monta o System Prompt pra essa requisição. Chamado a cada
 * mensagem — é essa leitura que "força" o modelo a interpretar o
 * personagem e as regras que ele mesmo construiu, em vez de ter uma
 * persona fixa hardcoded.
 *
 * Isso é o "RAG leve" do cofre-IA: sem embeddings, sem busca vetorial —
 * só um filtro simples (diretrizes ativas, reflexões mais recentes) e
 * injeção direta no prompt. Migrar pra embeddings de verdade é um passo
 * futuro, só vale a pena quando o volume de diretrizes/reflexões crescer
 * o bastante pra esse filtro simples não dar conta mais.
 */
export async function montarSystemPrompt(usuarioId, { sentimento, prioridade }) {
  const [usuario, tracos, bordoes, diretrizes, reflexoes] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: usuarioId } }),
    prisma.temperamento.findMany({ where: { usuarioId, ativo: true }, orderBy: { intensidade: 'desc' }, take: 5 }),
    prisma.bordao.findMany({ where: { usuarioId }, orderBy: { createdAt: 'desc' }, take: 8 }),
    prisma.diretriz.findMany({ where: { usuarioId, ativo: true }, orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.reflexao.findMany({ where: { usuarioId }, orderBy: { data: 'desc' }, take: 3 }),
  ]);

  let prompt = montarBase(usuario);

  if (diretrizes.length > 0) {
    const listaDiretrizes = diretrizes.map((d) => `- ${d.conteudo}`).join('\n');
    prompt += `\n\nDiretrizes de comportamento que você mesmo consolidou (cofre-IA — siga como regra, não como sugestão):\n${listaDiretrizes}`;
  }

  if (reflexoes.length > 0) {
    const listaReflexoes = reflexoes.map((r) => `- (${r.data.toISOString().slice(0, 10)}) ${r.conteudo}`).join('\n');
    prompt += `\n\nSuas reflexões mais recentes sobre a rotina do usuário (contexto, não repita literalmente):\n${listaReflexoes}`;
  }

  if (tracos.length > 0) {
    const listaTracos = tracos.map((t) => `- ${t.traco} (intensidade ${t.intensidade}/5)`).join('\n');
    prompt += `\n\nSeu temperamento atual, construído com base nas suas próprias observações da rotina do usuário:\n${listaTracos}\nInterprete esse temperamento nas suas respostas, sem exagerar a ponto de atrapalhar a informação.`;
  }

  if (bordoes.length > 0) {
    const listaBordoes = bordoes.map((b) => `- (${b.situacao}) "${b.texto}"`).join('\n');
    prompt += `\n\nBordões que você mesmo já criou em interações passadas (use quando a situação combinar, não force):\n${listaBordoes}`;
  }

  if (prioridade === 'suporte_real') {
    prompt += `\n\nIMPORTANTE — override de personalidade: a pessoa pode estar passando por um momento
sério, não só uma frustração técnica comum. Deixe de lado ironia, bordões ou
qualquer traço de temperamento agora. Responda com acolhimento genuíno e,
se fizer sentido, sugira conversar com alguém de confiança ou buscar apoio
profissional. Não minimize o que ela disse.`;
  } else if (prioridade === 'ajuste_de_tom') {
    prompt += `\n\nA pessoa parece estar sentindo "${sentimento}" nessa mensagem. Ajuste o tom
dessa resposta especificamente pra isso (mais acolhedor se for algo pesado,
mais comemorativo se for entusiasmo) — isso é sobre o tom da resposta, não
uma mudança permanente de personagem.`;
  }

  return prompt;
}

/**
 * Registra a interação emocional detectada, pra alimentar depois a
 * evolução autônoma de temperamento (ver evolutionJob.js). Sinais de
 * alerta (prioridade 'suporte_real') também são registrados, mas o
 * objetivo ali é dar contexto de frequência pro usuário mesmo revisar
 * depois — não pra IA "aprender" a lidar sozinha com esse tipo de sinal.
 */
export async function registrarInteracaoEmocional(usuarioId, { sentimento, contexto, respostaDada }) {
  if (sentimento === 'neutro') return;

  await prisma.registroEmocional.create({
    data: { usuarioId, sentimentoDetectado: sentimento, contexto, respostaDada },
  });
}
