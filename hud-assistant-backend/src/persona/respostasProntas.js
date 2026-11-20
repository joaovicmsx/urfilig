const VARIANTES = Object.freeze({
  saudacao: [
    (cumprimento) => `${cumprimento}! Sou a Urfilig. Posso conversar com você e ajudar a localizar o que já está nas suas notas. O que você tem em mente?`,
    (cumprimento) => `${cumprimento}! Posso ajudar a encontrar informações no seu cofre ou simplesmente conversar. Por onde começamos?`,
    (cumprimento) => `${cumprimento}! Estou aqui para conversar e ajudar com suas notas. O que você gostaria de ver?`,
  ],
  bemEstar: [
    () => 'Tudo bem por aqui, obrigada por perguntar. E você, como está?',
    () => 'Estou bem e pronta para conversar. Como você está hoje?',
    () => 'Tudo certo por aqui. E por aí, como vão as coisas?',
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
export function respostaDeConversaCasual(texto, random = Math.random) {
  const mensagem = String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
  if (!mensagem) return null;
  if (/\b(tudo bem|como voce esta|como vai voce|como voce vai)\b/.test(mensagem)) {
    return respostaProntaComSorteio('bemEstar', random);
  }
  const semSaudacao = mensagem
    .replace(/^(?:oi|ola|e ai|bom dia|boa tarde|boa noite)[,!.\s]*/u, '')
    .replace(/[?!.,\s]+$/u, '');
  if (!semSaudacao && /^(?:oi|ola|e ai|bom dia|boa tarde|boa noite)[!.\s]*$/u.test(mensagem)) {
    const cumprimento = mensagem.match(/^(bom dia|boa tarde|boa noite)/)?.[1] || (mensagem.startsWith('ola') ? 'Olá' : mensagem.startsWith('e ai') ? 'E aí' : 'Oi');
    return respostaProntaComSorteio('saudacao', random, cumprimento);
  }
  return null;
}
