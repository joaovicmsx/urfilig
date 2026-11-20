function textoSeguro(valor, limite = 500) {
  return String(valor || '').trim().replace(/\s+/g, ' ').slice(0, limite);
}

/** Rascunho determinístico para revisão manual; não envia mensagens. */
export function criarRascunhoPadrao({ nome, categoria, endereco }) {
  const empresa = textoSeguro(nome, 140) || 'o negócio';
  const detalhe = textoSeguro(categoria, 120) || 'negócio local';
  const enderecoSeguro = textoSeguro(endereco, 350);
  const bairro = enderecoSeguro ? ` Vi o endereço público de vocês: ${enderecoSeguro.split(',').slice(0, 2).join(',')}.` : '';
  return `Oi, tudo bem? Encontrei ${empresa}, que atua no segmento de ${detalhe}.${bairro}
Eu crio sites simples para reunir serviços, informações e formas de contato em um só lugar. Posso te mostrar uma ideia rápida?`;
}
