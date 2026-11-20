const VARIANTES = Object.freeze({
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
