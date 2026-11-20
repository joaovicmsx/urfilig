const VARIANTES = Object.freeze({
  saudacao: [
    (cumprimento) => `${cumprimento}! Sou a Urfilig. Posso conversar e localizar informações nas suas notas.`,
    (cumprimento) => `${cumprimento} de novo! Espero que seu dia esteja indo bem.`,
    (cumprimento) => `${cumprimento}! Estou por aqui caso queira puxar algum assunto.`,
  ],
  bemEstar: [
    () => 'Tudo bem por aqui, obrigada por perguntar. E você, como está?',
    () => 'Por aqui tudo certo. Como vai seu dia?',
    () => 'Bem, obrigada. Espero que você também esteja bem.',
  ],
  evento: [
    (titulo, data) => `Anotei “${titulo}” no calendário para ${data}. Até o calendário já está mais organizado que a gente.`,
    (titulo, data) => `“${titulo}” ficou marcado para ${data}. Pronto, agora não vale esquecer.`,
    (titulo, data) => `Registrei “${titulo}” em ${data}. O calendário agradece.`,
  ],
  pasta: [
    (nome) => `Pasta “${nome}” criada. Seus arquivos já têm endereço.`,
    (nome) => `Criei a pasta “${nome}”. Organização: começando a acontecer.`,
    (nome) => `“${nome}” já está criada. Pode guardar as coisas sem suspense.`,
  ],
  notaEditada: [
    (titulo) => `Atualizei a nota “${titulo}”. Dessa vez, a versão certa ficou salva.`,
    (titulo) => `Nota “${titulo}” editada. Menos uma coisa para lembrar de cabeça.`,
    (titulo) => `Pronto, “${titulo}” foi atualizada.`,
  ],
  notaGuardada: [
    () => 'Guardei no cofre. Sua memória ganhou um reforço externo.',
    () => 'Anotado no cofre. Pode deixar essa lembrança comigo.',
    () => 'Já está salvo. Uma coisa a menos para tentar lembrar depois.',
  ],
});

export function respostaPronta(tipo, ...argumentos) {
  return respostaProntaComSorteio(tipo, Math.random, ...argumentos);
}

export function respostaProntaComSorteio(tipo, random = Math.random, ...argumentos) {
  const variantes = VARIANTES[tipo];
  if (!variantes) throw new TypeError(`Tipo de resposta pronta desconhecido: ${tipo}`);
  const indice = Math.min(variantes.length - 1, Math.max(0, Math.floor(random() * variantes.length)));
  return variantes[indice](...argumentos);
}

export function respostaQuandoNaoSabe() {
  return 'Isso eu ainda não sei. Anota no cofre ou pergunta de outro jeito.';
}

/** Responde saudações simples sem puxar assuntos que a pessoa não mencionou. */
function normalizarConversa(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
}

export function tipoConversaCasual(texto) {
  const mensagem = normalizarConversa(texto);
  if (!mensagem) return null;
  if (/\b(tudo bem|como voce esta|como vai voce|como voce vai)\b/.test(mensagem)) return 'bemEstar';
  const semSaudacao = mensagem
    .replace(/^(?:oi|ola|e ai|bom dia|boa tarde|boa noite)[,!\.\s]*/u, '')
    .replace(/[?!.,\s]+$/u, '');
  return !semSaudacao && /^(?:oi|ola|e ai|bom dia|boa tarde|boa noite)[!.\s]*$/u.test(mensagem)
    ? 'saudacao'
    : null;
}

export function respostaDeConversaCasual(texto, indiceVariacao = 0) {
  const mensagem = normalizarConversa(texto);
  const tipo = tipoConversaCasual(texto);
  if (!tipo) return null;
  if (tipo === 'bemEstar') {
    return VARIANTES.bemEstar[Math.abs(Math.trunc(indiceVariacao)) % VARIANTES.bemEstar.length]();
  }
  const cumprimento = mensagem.match(/^(bom dia|boa tarde|boa noite)/)?.[1] || (mensagem.startsWith('ola') ? 'Olá' : mensagem.startsWith('e ai') ? 'E aí' : 'Oi');
  const variante = VARIANTES.saudacao[Math.abs(Math.trunc(indiceVariacao)) % VARIANTES.saudacao.length];
  return variante(cumprimento);
}
