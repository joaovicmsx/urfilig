import * as THREE from 'three';

const MODOS = {
  // Padrão atual do Urfilig: corpo parado, sem órbita nem flutuação —
  // só a cabeça/olhos (ver headTracker.js) se movem, acompanhando o mouse.
  fixo: { velocidadeOrbital: 0, velocidadeGiro: 0, amplitudeWobble: 0 },
  // Mantido pra uso futuro/opcional — não é mais o padrão.
  orbit: { velocidadeOrbital: 0.15, velocidadeGiro: 0.5, amplitudeWobble: 0.3 },
  flutuar: { velocidadeOrbital: 0, velocidadeGiro: 0.15, amplitudeWobble: 0.15 },
};

/**
 * Controla a posição do corpo do mascote. Desde a mudança pro estilo
 * "assistente fixo" (estilo Kimi), o modo padrão é `fixo`: a posição é
 * definida uma única vez (com `lookAt` pro ponto de referência, geralmente
 * a câmera) e nunca mais muda — todo o "movimento vivo" do personagem
 * passou a vir do `HeadTracker`, não daqui.
 */
export class MascotMotionController {
  constructor(mascote, {
    modo = 'fixo',
    posicaoFixa = new THREE.Vector3(0, 0.3, 10),
    pontoParaOlhar = new THREE.Vector3(0, 0.5, 14), // aproximadamente onde a câmera fica
    raioOrbita = 6.5,
    centroOrbita = new THREE.Vector3(0, 0.4, 0),
  } = {}) {
    this.mascote = mascote;
    this.modo = modo;
    this.posicaoFixa = posicaoFixa;
    this.pontoParaOlhar = pontoParaOlhar;
    this.raioOrbita = raioOrbita;
    this.centroOrbita = centroOrbita;
    this.anguloAtual = Math.random() * Math.PI * 2;

    this._aplicarPosicionamentoInicial();
  }

  _aplicarPosicionamentoInicial() {
    if (this.modo === 'fixo') {
      this.mascote.position.copy(this.posicaoFixa);
      this.mascote.lookAt(this.pontoParaOlhar);
    }
  }

  setMode(modo) {
    if (!MODOS[modo]) return;
    this.modo = modo;
    if (modo === 'fixo') this._aplicarPosicionamentoInicial();
  }

  update(tempo, delta) {
    if (this.modo === 'fixo') return; // posição e rotação do corpo já foram fixadas, nada a fazer por frame

    const config = MODOS[this.modo] || MODOS.orbit;
    this.anguloAtual += config.velocidadeOrbital * delta;

    const wobble = Math.sin(tempo * 0.5) * config.amplitudeWobble;
    const x = this.centroOrbita.x + Math.cos(this.anguloAtual) * this.raioOrbita;
    const z = this.centroOrbita.z + Math.sin(this.anguloAtual) * this.raioOrbita;
    const y = this.centroOrbita.y + wobble;

    this.mascote.position.set(x, y, z);

    if (config.velocidadeOrbital > 0) {
      const anguloFuturo = this.anguloAtual + 0.05;
      const xFuturo = this.centroOrbita.x + Math.cos(anguloFuturo) * this.raioOrbita;
      const zFuturo = this.centroOrbita.z + Math.sin(anguloFuturo) * this.raioOrbita;
      this.mascote.lookAt(xFuturo, y, zFuturo);
    }

    this.mascote.rotateY(config.velocidadeGiro * delta);
  }
}
