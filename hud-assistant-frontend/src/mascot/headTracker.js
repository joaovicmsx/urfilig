import * as THREE from 'three';

/**
 * Faz um osso (cabeça ou olho) do mascote olhar sutilmente na direção do
 * mouse, com um ângulo máximo de desvio (pra não girar loucamente quando o
 * cursor vai pra borda da tela) e interpolação suave (slerp) pra ficar
 * fluido em vez de "grudar" no alvo instantaneamente.
 *
 * ⚠️ Não testado visualmente (sem ambiente gráfico aqui) — a orientação de
 * repouso do osso no seu rig pode fazer isso parecer estranho de início.
 * Se a cabeça girar pro lado errado ou longe demais, os números pra
 * ajustar são `maxAngleRad` (quanto pode desviar) e `lerpSpeed` (quão
 * rápido acompanha).
 */
class OssoRastreado {
  constructor(osso, { maxAngleRad, lerpSpeed }) {
    this.osso = osso;
    this.maxAngleRad = maxAngleRad;
    this.lerpSpeed = lerpSpeed;
    this.quaternionRepouso = osso.quaternion.clone();
  }

  atualizar(pontoAlvoMundial, delta) {
    const posicaoMundial = new THREE.Vector3();
    this.osso.getWorldPosition(posicaoMundial);

    const matrizLookAt = new THREE.Matrix4().lookAt(posicaoMundial, pontoAlvoMundial, this.osso.up);
    const quaternionMundialDesejado = new THREE.Quaternion().setFromRotationMatrix(matrizLookAt);

    // Converte de rotação mundial pra rotação local (relativa ao pai do osso)
    const quaternionPaiMundial = new THREE.Quaternion();
    this.osso.parent.getWorldQuaternion(quaternionPaiMundial);
    const quaternionLocalDesejado = quaternionPaiMundial.invert().multiply(quaternionMundialDesejado);

    // Limita o desvio em relação à pose de repouso — evita a cabeça girar
    // além do razoável quando o mouse está numa borda extrema da tela
    const anguloDesvio = this.quaternionRepouso.angleTo(quaternionLocalDesejado);
    const quaternionAlvo =
      anguloDesvio > this.maxAngleRad
        ? this.quaternionRepouso.clone().slerp(quaternionLocalDesejado, this.maxAngleRad / anguloDesvio)
        : quaternionLocalDesejado;

    this.osso.quaternion.slerp(quaternionAlvo, Math.min(delta * this.lerpSpeed, 1));
  }

  voltarAoRepouso(delta) {
    this.osso.quaternion.slerp(this.quaternionRepouso, Math.min(delta * this.lerpSpeed, 1));
  }
}

export class HeadTracker {
  constructor(mascote, {
    nomesOssos = { cabeca: 'cabeca', olhoEsquerdo: 'olho.L', olhoDireito: 'olho.R' },
    distanciaAlvo = 8, // o quão "à frente" no raio do mouse o alvo 3D fica
  } = {}) {
    this.distanciaAlvo = distanciaAlvo;
    this.pontoAlvo = new THREE.Vector3();
    this.ativo = false;

    this.cabeca = this._tentarRastrear(mascote, nomesOssos.cabeca, {
      maxAngleRad: THREE.MathUtils.degToRad(22),
      lerpSpeed: 4,
    });
    this.olhoEsquerdo = this._tentarRastrear(mascote, nomesOssos.olhoEsquerdo, {
      maxAngleRad: THREE.MathUtils.degToRad(12),
      lerpSpeed: 8,
    });
    this.olhoDireito = this._tentarRastrear(mascote, nomesOssos.olhoDireito, {
      maxAngleRad: THREE.MathUtils.degToRad(12),
      lerpSpeed: 8,
    });

    this.ativo = Boolean(this.cabeca || this.olhoEsquerdo || this.olhoDireito);
    if (!this.ativo) {
      console.warn(
        '[headTracker] não encontrei nenhum osso de cabeça/olhos no mascote ' +
        '(esperado: "cabeca", "olho.L", "olho.R") — rastreamento de mouse desativado.'
      );
    }
  }

  _tentarRastrear(mascote, nome, opcoes) {
    const normalizar = (valor) => valor.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    let osso = mascote.getObjectByName(nome);
    if (!osso) {
      const chave = normalizar(nome);
      const cabeca = chave.includes('cab') || chave.includes('head');
      const aliases = cabeca ? /head|cabeca|cabeza|cranium/ : /eye|olho|ojo/;
      mascote.traverse((objeto) => {
        if (osso || !objeto.isBone) return;
        const rotulo = normalizar(objeto.name || '');
        const ladoCorreto = chave.includes('esquerdo') || chave.endsWith('l')
          ? /left|esquerdo|l$/.test(rotulo)
          : chave.includes('direito') || chave.endsWith('r')
            ? /right|direito|r$/.test(rotulo)
            : true;
        if (aliases.test(rotulo) && ladoCorreto) osso = objeto;
      });
    }
    if (osso && !osso.parent) return null;
    return osso ? new OssoRastreado(osso, opcoes) : null;
  }

  /** Chamado a cada movimento do mouse — recalcula o ponto-alvo em 3D. */
  atualizarAlvoComRaycaster(raycaster) {
    this.pontoAlvo
      .copy(raycaster.ray.origin)
      .addScaledVector(raycaster.ray.direction, this.distanciaAlvo);
  }

  /** Chamado a cada frame de animação. */
  update(delta, mousePresente) {
    if (!this.ativo) return;
    [this.cabeca, this.olhoEsquerdo, this.olhoDireito].forEach((osso) => {
      if (!osso) return;
      if (mousePresente) osso.atualizar(this.pontoAlvo, delta);
      else osso.voltarAoRepouso(delta);
    });
  }
}
