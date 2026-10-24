import * as THREE from 'three';

// Paleta Azul Frio Bioluminescente
const PALETA_AZUL_FRIO = [
  new THREE.Color(0x9aaab0),
  new THREE.Color(0x9eabb0),
  new THREE.Color(0x94a4aa),
  new THREE.Color(0x8799a0),
  new THREE.Color(0xb5bdbe),
];

// Paleta Amarelo Dourado Quente
const PALETA_AMARELO_QUENTE = [
  new THREE.Color(0xb8ab86),
  new THREE.Color(0xb8aa86),
  new THREE.Color(0xb5a680),
  new THREE.Color(0xb7a77e),
  new THREE.Color(0xb2a582),
];

function pontoFibonacci(indice, total, raio) {
  const seguro = Math.max(total, 1);
  const offset = 2 / seguro;
  const incremento = Math.PI * (3 - Math.sqrt(5));

  const y = indice * offset - 1 + offset / 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const phi = indice * incremento;

  return new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r).multiplyScalar(raio);
}

export class PersonalitySphere {
  // ADICIONADO: onRightClick de volta ao construtor
  constructor(scene, { canvas, maxParticles = 180, reducedMotion = false, onHover, onSelect, onRightClick, onParticles } = {}) {
    this.canvas = canvas;
    this.maxParticles = maxParticles;
    this.reducedMotion = reducedMotion;
    this.onHover = onHover || (() => {});
    this.onSelect = onSelect || (() => {});
    this.onRightClick = onRightClick || (() => {}); // Ligação do Botão Direito restaurada
    this.onParticles = onParticles || (() => {});

    this.raio = 4.2;
    this.particulas = [];
    this.hoverIndex = null;
    this.nodeArrastado = null;
    this.velocidadeRotacao = { x: 0, y: 0 };

    this.grupo = new THREE.Group();
    scene.add(this.grupo);

    const geometriaCore = new THREE.IcosahedronGeometry(0.065, 2);
    const materialCore = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95 });
    this.instancedMesh = new THREE.InstancedMesh(geometriaCore, materialCore, maxParticles);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instancedMesh.count = 0;
    this.grupo.add(this.instancedMesh);

    this.linhasConstelacao = null;

    this.raycaster = new THREE.Raycaster();
    this.ponteiro = new THREE.Vector2();

    this.audioCtx = null;
    this.initDustSystem();
  }

  // ==========================================
  // SOM MANTIDO COMO VOCÊ PREFERIU
  // ==========================================
  playParticleSound(tipo = 'explode') {
    try {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
      }
      
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      const delayNode = ctx.createDelay();
      const feedbackNode = ctx.createGain();

      delayNode.delayTime.value = 0.12; 
      feedbackNode.gain.value = 0.25;

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      gainNode.connect(delayNode);
      delayNode.connect(feedbackNode);
      feedbackNode.connect(delayNode);
      delayNode.connect(ctx.destination);

      const agora = ctx.currentTime;
      
      if (tipo === 'implode') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, agora);
        osc.frequency.exponentialRampToValueAtTime(1200, agora + 0.1);
        gainNode.gain.setValueAtTime(0.0, agora);
        gainNode.gain.linearRampToValueAtTime(0.08, agora + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, agora + 0.2);
        osc.start(agora);
        osc.stop(agora + 0.2);
      } else if (tipo === 'explode' || tipo === 'move') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1500 + Math.random() * 500, agora);
        osc.frequency.exponentialRampToValueAtTime(300, agora + 0.15);
        gainNode.gain.setValueAtTime(0.1, agora);
        gainNode.gain.exponentialRampToValueAtTime(0.001, agora + 0.15);
        osc.start(agora);
        osc.stop(agora + 0.15);
      } else if (tipo === 'drag') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2000 + Math.random() * 1000, agora);
        gainNode.gain.setValueAtTime(0.01, agora);
        gainNode.gain.exponentialRampToValueAtTime(0.001, agora + 0.05);
        osc.start(agora);
        osc.stop(agora + 0.05);
      }
    } catch (e) {}
  }

  // ==========================================
  // SISTEMA DE MINI-PARTÍCULAS
  // ==========================================
  initDustSystem() {
    this.maxDust = 2000;
    this.dustIndex = 0;
    
    this.dustGeometry = new THREE.BufferGeometry();
    this.dustPositions = new Float32Array(this.maxDust * 3);
    this.dustColors = new Float32Array(this.maxDust * 3);
    this.dustVelocities = new Float32Array(this.maxDust * 3);
    this.dustLifes = new Float32Array(this.maxDust);

    for (let i = 0; i < this.maxDust; i++) {
      this.dustPositions[i * 3] = 9999; 
      this.dustLifes[i] = 0;
    }

    this.dustGeometry.setAttribute('position', new THREE.BufferAttribute(this.dustPositions, 3));
    this.dustGeometry.setAttribute('color', new THREE.BufferAttribute(this.dustColors, 3));

    // Aumentei o tamanho das partículas (de 0.04 para 0.08) para serem mais visíveis
    const material = new THREE.PointsMaterial({
      size: 0.045,
      vertexColors: true,
      transparent: true,
      opacity: 0.48,
      blending: THREE.NormalBlending,
      depthWrite: false
    });

    this.dustPoints = new THREE.Points(this.dustGeometry, material);
    this.grupo.add(this.dustPoints);
  }

  emitDust(pos, colorBase, count, mode = 'explode') {
    const c = colorBase || new THREE.Color(0x9eabb0);
    
    for (let i = 0; i < count; i++) {
      let idx = this.dustIndex % this.maxDust;
      this.dustIndex++;

      const i3 = idx * 3;
      this.dustColors[i3] = c.r;
      this.dustColors[i3 + 1] = c.g;
      this.dustColors[i3 + 2] = c.b;

      if (mode === 'explode' || mode === 'drag') {
        this.dustPositions[i3] = pos.x;
        this.dustPositions[i3 + 1] = pos.y;
        this.dustPositions[i3 + 2] = pos.z;

        const velocidade = mode === 'drag' ? 0.2 : 0.8;
        this.dustVelocities[i3] = (Math.random() - 0.5) * velocidade;
        this.dustVelocities[i3 + 1] = (Math.random() - 0.5) * velocidade;
        this.dustVelocities[i3 + 2] = (Math.random() - 0.5) * velocidade;
        
        this.dustLifes[idx] = mode === 'drag' ? 0.3 + Math.random() * 0.2 : 0.6 + Math.random() * 0.4;

      } else if (mode === 'implode') {
        const raioNascimento = 0.5 + Math.random() * 0.5;
        const dirX = (Math.random() - 0.5);
        const dirY = (Math.random() - 0.5);
        const dirZ = (Math.random() - 0.5);
        
        const normal = new THREE.Vector3(dirX, dirY, dirZ).normalize();
        
        this.dustPositions[i3] = pos.x + normal.x * raioNascimento;
        this.dustPositions[i3 + 1] = pos.y + normal.y * raioNascimento;
        this.dustPositions[i3 + 2] = pos.z + normal.z * raioNascimento;

        const tempoVida = 0.6 + Math.random() * 0.4;
        this.dustVelocities[i3] = (-normal.x * raioNascimento) / tempoVida;
        this.dustVelocities[i3 + 1] = (-normal.y * raioNascimento) / tempoVida;
        this.dustVelocities[i3 + 2] = (-normal.z * raioNascimento) / tempoVida;
        
        this.dustLifes[idx] = tempoVida;
      }
    }
  }

  setParticles(particulasNovas) {
    const identificadoresNovos = new Set(particulasNovas.map((p) => p.id || p.label));
    
    const oldMap = new Map();
    this.particulas.forEach(p => oldMap.set(p.id || p.label, p));

    this.particulas = this.particulas.filter((p) => {
      const mantida = identificadoresNovos.has(p.id || p.label);
      if (!mantida) {
        this.emitDust(p.posicaoAtual, p.corAtual, 50, 'explode');
        this.playParticleSound('explode');
      }
      return mantida;
    });

    const paisECentros = [];
    const notasPorPasta = new Map();

    particulasNovas.forEach((p) => {
      if (p.isNote && p.folderRef) {
        const key = p.folderRef.id || p.folderRef.label;
        if (!notasPorPasta.has(key)) notasPorPasta.set(key, []);
        notasPorPasta.get(key).push(p);
      } else {
        paisECentros.push(p);
      }
    });

    const totalCentros = paisECentros.length;

    paisECentros.forEach((dado, idx) => {
      const destinoBase = pontoFibonacci(idx, totalCentros, this.raio);
      const keyPasta = dado.id || dado.label;

      let existente = this.particulas.find((p) => (p.id && p.id === dado.id) || p.label === dado.label);
      if (!existente && this.particulas.length < this.maxParticles) {
        const posInit = destinoBase.clone().normalize().multiplyScalar(this.raio * 2.5);
        const idxCor = this.particulas.length;
        const corAzul = PALETA_AZUL_FRIO[idxCor % PALETA_AZUL_FRIO.length];
        const corAmarelo = PALETA_AMARELO_QUENTE[idxCor % PALETA_AMARELO_QUENTE.length];

        existente = {
          label: dado.label,
          id: dado.id,
          strength: dado.strength ?? 0.8,
          isFolder: dado.isFolder,
          isNote: false,
          folderRef: null,
          corAzul,
          corAmarelo,
          corAtual: corAzul.clone(),
          posicaoAtual: posInit,
          destino: destinoBase.clone(),
          offsetArrasto: new THREE.Vector3(0, 0, 0),
          fase: Math.random() * Math.PI * 2,
          chegou: false,
          position: posInit.clone(),
        };
        this.particulas.push(existente);
        
        this.emitDust(existente.posicaoAtual, existente.corAtual, 50, 'implode');
        this.playParticleSound('implode');

      } else if (existente) {
        existente.destino.copy(destinoBase);
        existente.chegou = false; 
        
        const eraNota = existente.isNote;
        existente.isFolder = dado.isFolder;
        existente.isNote = false;
        existente.folderRef = null;

        if (eraNota) {
          this.emitDust(existente.posicaoAtual, existente.corAtual, 30, 'move');
          this.playParticleSound('move');
        }
      }

      if (dado.isFolder && notasPorPasta.has(keyPasta)) {
        const filhas = notasPorPasta.get(keyPasta);
        const normal = destinoBase.clone().normalize();
        let up = new THREE.Vector3(0, 1, 0);
        if (Math.abs(normal.y) > 0.9) up = new THREE.Vector3(1, 0, 0);
        const t1 = new THREE.Vector3().crossVectors(normal, up).normalize();
        const t2 = new THREE.Vector3().crossVectors(normal, t1).normalize();

        const raioConstelacao = 1.0;

        filhas.forEach((notaDado, nIdx) => {
          const angulo = (nIdx / filhas.length) * Math.PI * 2 + 0.3;
          const posRelativa = t1
            .clone()
            .multiplyScalar(Math.cos(angulo) * raioConstelacao)
            .add(t2.clone().multiplyScalar(Math.sin(angulo) * raioConstelacao));

          const destinoNota = destinoBase.clone().add(posRelativa);

          let existenteNota = this.particulas.find((p) => (p.id && p.id === notaDado.id) || p.label === notaDado.label);
          if (!existenteNota && this.particulas.length < this.maxParticles) {
            const posInitNota = destinoNota.clone().normalize().multiplyScalar(this.raio * 2.5);
            const idxCorNota = this.particulas.length;
            const corAzul = PALETA_AZUL_FRIO[idxCorNota % PALETA_AZUL_FRIO.length];
            const corAmarelo = PALETA_AMARELO_QUENTE[idxCorNota % PALETA_AMARELO_QUENTE.length];

            existenteNota = {
              label: notaDado.label,
              id: notaDado.id,
              strength: notaDado.strength ?? 0.5,
              isFolder: false,
              isNote: true,
              folderRef: existente,
              corAzul,
              corAmarelo,
              corAtual: corAzul.clone(),
              posicaoAtual: posInitNota,
              destino: destinoNota,
              offsetArrasto: new THREE.Vector3(0, 0, 0),
              fase: Math.random() * Math.PI * 2,
              chegou: false,
              position: posInitNota.clone(),
            };
            this.particulas.push(existenteNota);
            
            this.emitDust(existenteNota.posicaoAtual, existenteNota.corAtual, 50, 'implode');
            this.playParticleSound('implode');

          } else if (existenteNota) {
            existenteNota.destino.copy(destinoNota);
            existenteNota.chegou = false; 
            
            const antigaPastaId = existenteNota.folderRef ? existenteNota.folderRef.id : null;
            
            existenteNota.isFolder = false;
            existenteNota.isNote = true;
            existenteNota.folderRef = existente;

            if (antigaPastaId !== existente.id) {
              this.emitDust(existenteNota.posicaoAtual, existenteNota.corAtual, 30, 'move');
              this.playParticleSound('move');
            }
          }
        });
      }
    });

    this.instancedMesh.count = this.particulas.length;
    this.reconstruirLinhasConstelacao();
    this.onParticles(this.particulas);
  }

  reconstruirLinhasConstelacao() {
    if (this.linhasConstelacao) {
      this.grupo.remove(this.linhasConstelacao);
      this.linhasConstelacao.geometry?.dispose();
      this.linhasConstelacao.material?.dispose();
      this.linhasConstelacao = null;
    }

    let totalLinhas = 0;
    this.particulas.forEach((p) => {
      if (p.isNote && p.folderRef) totalLinhas++;
    });

    if (totalLinhas > 0) {
      const posicoes = new Float32Array(totalLinhas * 2 * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(posicoes, 3));

      const mat = new THREE.LineDashedMaterial({
        color: 0x9eabb0,
        transparent: true,
        opacity: 0.35,
        dashSize: 0.08,
        gapSize: 0.06,
        scale: 1,
        blending: THREE.NormalBlending,
      });

      this.linhasConstelacao = new THREE.LineSegments(geo, mat);
      this.grupo.add(this.linhasConstelacao);
      this.atualizarPosicoesLinhas();
    }
  }

  atualizarPosicoesLinhas() {
    if (!this.linhasConstelacao) return;

    const attrPosicao = this.linhasConstelacao.geometry.attributes.position;
    if (!attrPosicao) return;

    let idx = 0;
    this.particulas.forEach((p) => {
      if (p.isNote && p.folderRef && p.folderRef.position && p.position) {
        attrPosicao.setXYZ(idx++, p.folderRef.position.x, p.folderRef.position.y, p.folderRef.position.z);
        attrPosicao.setXYZ(idx++, p.position.x, p.position.y, p.position.z);
      }
    });

    attrPosicao.needsUpdate = true;
    this.linhasConstelacao.computeLineDistances();
  }

  rotateBy(deltaX, deltaY) {
    const velocidade = 0.005;
    this.grupo.rotation.y += deltaX * velocidade;
    this.grupo.rotation.x += deltaY * velocidade;
  }

  setInertia(deltaX, deltaY) {
    this.velocidadeRotacao = { x: deltaY * 0.002, y: deltaX * 0.012 };
  }

  hitTest(event, camera) {
    if (!this.canvas || !this.instancedMesh) return null;

    const rect = this.canvas.getBoundingClientRect();
    this.ponteiro.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.ponteiro.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.grupo.updateMatrixWorld(true);
    this.instancedMesh.updateMatrixWorld(true);

    this.raycaster.setFromCamera(this.ponteiro, camera);
    const intersecoes = this.raycaster.intersectObject(this.instancedMesh);

    return intersecoes.length > 0 ? intersecoes[0].instanceId : null;
  }

  hover(indice) {
    this.hoverIndex = indice;
    this.onHover(indice !== null && indice !== undefined ? this.particulas[indice] : null);
  }

  select(indice) {
    if (indice === null || indice === undefined || !this.particulas[indice]) return;
    this.onSelect(this.particulas[indice]);
  }

  // ADICIONADO: Função para gerir o Clique Direito no nó
  rightClick(indice) {
    if (indice === null || indice === undefined || !this.particulas[indice]) return;
    this.onRightClick(this.particulas[indice]);
  }

  focus(indice) {
    this.hover(indice);
  }

  setReducedMotion(valor) {
    this.reducedMotion = valor;
  }

  update(delta) {
    this.grupo.rotation.y += this.velocidadeRotacao.y;
    this.grupo.rotation.x += this.velocidadeRotacao.x;
    this.velocidadeRotacao.x *= 0.92;
    this.velocidadeRotacao.y *= 0.92;

    const matriz = new THREE.Matrix4();
    const tempo = performance.now() / 1000;

    const tempoCiclo = (tempo % 24) / 24;
    let fatorGlobal = 0;

    if (tempoCiclo < 0.40) {
      fatorGlobal = 0;
    } else if (tempoCiclo < 0.50) {
      const t = (tempoCiclo - 0.40) / 0.10;
      fatorGlobal = t * t * (3 - 2 * t);
    } else if (tempoCiclo < 0.90) {
      fatorGlobal = 1;
    } else {
      const t = (tempoCiclo - 0.90) / 0.10;
      fatorGlobal = 1 - t * t * (3 - 2 * t);
    }

    if (this.linhasConstelacao && this.linhasConstelacao.material) {
      const corLinha = new THREE.Color(0x9eabb0).lerp(new THREE.Color(0xb8aa86), fatorGlobal);
      this.linhasConstelacao.material.color.copy(corLinha);
    }

    this.particulas.forEach((p, i) => {
      if (!p.offsetArrasto) p.offsetArrasto = new THREE.Vector3(0, 0, 0);

      if (this.nodeArrastado !== p && p.offsetArrasto.lengthSq() > 0.00001) {
        p.offsetArrasto.lerp(new THREE.Vector3(0, 0, 0), Math.min(delta * 10, 1));
        if (p.offsetArrasto.lengthSq() < 0.00001) {
          p.offsetArrasto.set(0, 0, 0);
        }
      }

      if (!p.chegou) {
        p.posicaoAtual.lerp(p.destino, this.reducedMotion ? 1 : Math.min(delta * 1.6, 1));
        if (p.posicaoAtual.distanceTo(p.destino) < 0.02) p.chegou = true;
      }

      const raioOrbita = 0.10;
      const velocidadeOrbita = 0.25;

      const offsetX = Math.sin(tempo * velocidadeOrbita + p.fase) * raioOrbita;
      const offsetY = Math.cos(tempo * (velocidadeOrbita * 1.2) + p.fase) * raioOrbita;
      const offsetZ = Math.sin(tempo * (velocidadeOrbita * 1.8) + p.fase) * raioOrbita;

      const posLocalBase = p.posicaoAtual.clone().add(new THREE.Vector3(offsetX, offsetY, offsetZ));
      p.position = posLocalBase.clone().add(p.offsetArrasto);

      if (this.nodeArrastado === p) {
        if (Math.random() > 0.4) {
          this.emitDust(p.position, p.corAtual, 1, 'drag');
          if (Math.random() > 0.9) this.playParticleSound('drag'); 
        }
      }

      p.corAtual.copy(p.corAzul).lerp(p.corAmarelo, fatorGlobal);

      const corRender = p.corAtual.clone().multiplyScalar(1.05);
      if (this.hoverIndex === i || this.nodeArrastado === p) {
        corRender.multiplyScalar(1.12);
      }

      this.instancedMesh.setColorAt(i, corRender);

      matriz.compose(p.position, new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      this.instancedMesh.setMatrixAt(i, matriz);
    });

    if (this.instancedMesh.instanceColor) this.instancedMesh.instanceColor.needsUpdate = true;
    this.instancedMesh.instanceMatrix.needsUpdate = true;

    this.atualizarPosicoesLinhas();

    let dustAtiva = false;
    for (let i = 0; i < this.maxDust; i++) {
      if (this.dustLifes[i] > 0) {
        dustAtiva = true;
        this.dustLifes[i] -= delta;
        
        const i3 = i * 3;
        this.dustPositions[i3] += this.dustVelocities[i3] * delta;
        this.dustPositions[i3 + 1] += this.dustVelocities[i3 + 1] * delta;
        this.dustPositions[i3 + 2] += this.dustVelocities[i3 + 2] * delta;
        
        this.dustVelocities[i3] *= 0.95;
        this.dustVelocities[i3 + 1] *= 0.95;
        this.dustVelocities[i3 + 2] *= 0.95;

        if (this.dustLifes[i] <= 0) {
          this.dustPositions[i3] = 9999;
        }
      }
    }

    if (dustAtiva) {
      this.dustGeometry.attributes.position.needsUpdate = true;
      this.dustGeometry.attributes.color.needsUpdate = true;
    }
  }
}