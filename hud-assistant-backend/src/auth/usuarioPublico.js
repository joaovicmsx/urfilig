/**
 * Formato público do Usuario — usado em toda resposta de auth/perfil.
 * Centralizado aqui pra authRouter.js e perfilRouter.js nunca ficarem
 * dessincronizados sobre quais campos expor.
 */
export function paraRespostaPublica(usuario) {
  return {
    id: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    idade: usuario.idade,
    localizacao: usuario.localizacao,
    profissao: usuario.profissao,
    hobbies: usuario.hobbies,
    onboardingConcluido: usuario.onboardingConcluido,
  };
}
