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
  constructor(osso, { maxAngleRad, lerpSpeed, frenteMundial, cimaMundial }) {
    this.osso = osso;
    this.maxAngleRad = maxAngleRad;
    this.lerpSpeed = lerpSpeed;
    this.quaternionRepouso = osso.quaternion.clone();
    const quaternionPai = new THREE.Quaternion();
    osso.parent.getWorldQuaternion(quaternionPai);
    quaternionPai.invert();
    const frente = frenteMundial.clone().applyQuaternion(quaternionPai).normalize();
    const cima = cimaMundial.clone().applyQuaternion(quaternionPai).normalize();
    const direita = cima.clone().cross(frente).normalize();
    cima.crossVectors(frente, direita).normalize();
    this.quadroFrontal = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(direita, cima, frente));
  }

  atualizar(pontoAlvoMundial, delta) {
    const posicaoMundial = new THREE.Vector3();
    this.osso.getWorldPosition(posicaoMundial);
    const direcaoLocal = pontoAlvoMundial.clone().sub(posicaoMundial).normalize();
    const quaternionPaiMundial = new THREE.Quaternion();
    this.osso.parent.getWorldQuaternion(quaternionPaiMundial);
    direcaoLocal.applyQuaternion(quaternionPaiMundial.invert()).normalize();
    const direcaoFrontal = direcaoLocal.applyQuaternion(this.quadroFrontal.clone().invert());
    const yaw = THREE.MathUtils.clamp(Math.atan2(direcaoFrontal.x, Math.max(.001, direcaoFrontal.z)), -this.maxAngleRad, this.maxAngleRad);
    const pitch = THREE.MathUtils.clamp(-Math.atan2(direcaoFrontal.y, Math.hypot(direcaoFrontal.x, direcaoFrontal.z)), -this.maxAngleRad * .72, this.maxAngleRad * .72);
    const desvioFrontal = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    const quadroFrontalInverso = this.quadroFrontal.clone().invert();
    const desvioLocal = this.quadroFrontal.clone().multiply(desvioFrontal).multiply(quadroFrontalInverso);
    const quaternionAlvo = desvioLocal.multiply(this.quaternionRepouso);

    const suavizacao = 1 - Math.exp(-this.lerpSpeed * Math.max(0, delta));
    this.osso.quaternion.slerp(quaternionAlvo, suavizacao);
  }

  voltarAoRepouso(delta) {
    const suavizacao = 1 - Math.exp(-this.lerpSpeed * Math.max(0, delta));
    this.osso.quaternion.slerp(this.quaternionRepouso, suavizacao);
  }
}

export class HeadTracker {
  constructor(mascote, {
    nomesOssos = { cabeca: 'cabeca', olhoEsquerdo: 'olho.L', olhoDireito: 'olho.R' },
    frenteModelo = new THREE.Vector3(-1, 0, 0),
    distanciaAlvo = 4,
  } = {}) {
    this.distanciaAlvo = distanciaAlvo;
    this.pontoAlvo = new THREE.Vector3();
    this.ativo = false;
    const quaternionMascote = mascote.getWorldQuaternion(new THREE.Quaternion());
    const frenteMundial = frenteModelo.clone().applyQuaternion(quaternionMascote).normalize();
    const cimaMundial = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternionMascote).normalize();

    this.cabeca = this._tentarRastrear(mascote, nomesOssos.cabeca, {
      maxAngleRad: THREE.MathUtils.degToRad(38),
      lerpSpeed: 12,
      frenteMundial,
      cimaMundial,
    });
    this.olhoEsquerdo = this._tentarRastrear(mascote, nomesOssos.olhoEsquerdo, {
      maxAngleRad: THREE.MathUtils.degToRad(12),
      lerpSpeed: 12,
      frenteMundial,
      cimaMundial,
    });
    this.olhoDireito = this._tentarRastrear(mascote, nomesOssos.olhoDireito, {
      maxAngleRad: THREE.MathUtils.degToRad(12),
      lerpSpeed: 12,
      frenteMundial,
      cimaMundial,
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
    const cabeca = this.cabeca?.osso || this.olhoEsquerdo?.osso || this.olhoDireito?.osso;
    if (cabeca) {
      const posicao = cabeca.getWorldPosition(new THREE.Vector3());
      // Use the camera plane so each screen position maps consistently to
      // the same direction, independent of the rig's parent-bone rotation.
      const normalCamera = raycaster.camera
        ? raycaster.camera.getWorldDirection(new THREE.Vector3())
        : new THREE.Vector3(0, 0, 1).applyQuaternion(cabeca.parent.getWorldQuaternion(new THREE.Quaternion()));
      const plano = new THREE.Plane().setFromNormalAndCoplanarPoint(
        normalCamera,
        posicao.clone().addScaledVector(normalCamera, -1.25),
      );
      if (raycaster.ray.intersectPlane(plano, this.pontoAlvo)) return;
    }
    this.pontoAlvo.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, this.distanciaAlvo);
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
