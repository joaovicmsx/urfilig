const TRANSITIONS = {
  // IDLE → THINKING direto é permitido porque, até a Fase 4 (wake word)
  // existir, o comando chega via API sem passar por LISTENING antes.
  IDLE: ['LISTENING', 'THINKING'],
  LISTENING: ['THINKING', 'IDLE'],
  THINKING: ['SPEAKING', 'IDLE'],
  SPEAKING: ['IDLE'],
};

/**
 * Controla qual animação de corpo inteiro está tocando no mascote.
 * Ver a nota "State Machine do Mascote" no Obsidian pra explicação completa.
 *
 * Robusta a clipes faltando: se o .glb ainda não tem uma animação pro
 * estado pedido (comum na Fase 2, antes do rig estar completo), só
 * atualiza o estado lógico e avisa no console — não quebra o app.
 */
export class MascotStateMachine {
  constructor(mixer, clips) {
    this.mixer = mixer;
    this.clips = clips;
    this.current = 'IDLE';
    this.activeAction = null;

    const clipeInicial = clips.IDLE || Object.values(clips)[0];
    if (clipeInicial) {
      this.activeAction = mixer.clipAction(clipeInicial);
      this.activeAction.play();
    } else {
      console.warn('[stateMachine] nenhum clipe de animação disponível ainda — mascote fica parado, mas o resto do pipeline funciona normalmente.');
    }
  }

  transitionTo(nextState) {
    if (nextState === this.current) return; // já está nesse estado, não é erro

    if (!TRANSITIONS[this.current]?.includes(nextState)) {
      console.warn(`[stateMachine] transição inválida: ${this.current} → ${nextState}`);
      return;
    }

    const proximoClipe = this.clips[nextState];
    if (!proximoClipe) {
      console.warn(`[stateMachine] sem clipe de animação pro estado "${nextState}" ainda — só atualizando o estado lógico.`);
      this.current = nextState;
      atualizarUIDeEstado(nextState);
      return;
    }

    const nextAction = this.mixer.clipAction(proximoClipe);
    if (this.activeAction) {
      this.activeAction.crossFadeTo(nextAction, 0.3, true);
    }
    nextAction.play();
    this.activeAction = nextAction;
    this.current = nextState;
    atualizarUIDeEstado(nextState);
  }

  /**
   * Modo comportamental geral (distinto do estado IDLE/LISTENING/etc.) —
   * reservado pra quando a Persona Agêntica (backend) quiser influenciar
   * como as transições "soam" (ex: mais brusco se o temperamento atual for
   * "impaciente"). Por enquanto só guarda o valor.
   */
  setMode(modo) {
    this.modoComportamental = modo;
  }
}

function atualizarUIDeEstado(estado) {
  const el = document.querySelector('#hud-status-value');
  if (el) el.textContent = estado;
}
