const EVOLUCAO_ATIVADA = process.env.PERSONA_EVOLUTION_ENABLED === 'true';

function registrarEstadoEvolucao(usuarioId) {
  if (!EVOLUCAO_ATIVADA) {
    console.info(`[persona] evolução desativada para usuário ${usuarioId}; PERSONA_EVOLUTION_ENABLED=false.`);
  } else {
    console.info(`[persona] evolução não executada para usuário ${usuarioId}; não há modelo generativo configurado.`);
  }
}

/** Não cria traços, bordões ou diretrizes sem um modelo generativo. */
export async function evoluirPersonalidadeDoUsuario(usuarioId) {
  registrarEstadoEvolucao(usuarioId);
}

/** Mantém o ponto de entrada do cron sem consultar ou alterar dados de personalidade. */
export async function evoluirPersonalidadeDeTodos() {
  registrarEstadoEvolucao('todos');
}
