import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { iniciarIndicadorCarregamento } from '../loadingIndicator.js';

/**
 * Carrega o .glb do mascote e monta o AnimationMixer + dicionário de clipes.
 * Se o modelo ainda não tiver todos os clipes (IDLE/LISTENING/THINKING/SPEAKING),
 * não tem problema — a stateMachine já lida com clipes faltando (Fase 2 é só
 * validar o pipeline, o rig completo pode vir depois).
 */
/**
 * Carrega o .glb do mascote, MEDE o tamanho real dele e escala/centraliza
 * automaticamente pra uma altura alvo conhecida. Isso evita ter que chutar
 * um número de escala fixo no código — modelos exportados do Blender podem
 * vir em unidades bem diferentes (metros, centímetros) dependendo da
 * configuração de export, então medir é mais confiável que adivinhar.
 *
 * Retorna um THREE.Group envolvendo o modelo já normalizado — é esse Group
 * que o resto do app (float.js, câmera) deve tratar como "o mascote".
 */
export function carregarMascote(caminho, scene, alturaAlvo = 1.6) {
  const loader = new GLTFLoader();
  const encerrarCarregamento = iniciarIndicadorCarregamento();

  return new Promise((resolve, reject) => {
    try {
      loader.load(
        caminho,
        (gltf) => {
          encerrarCarregamento();
          const modelo = gltf.scene;

          const caixaOriginal = new THREE.Box3().setFromObject(modelo);
          const tamanhoOriginal = new THREE.Vector3();
          caixaOriginal.getSize(tamanhoOriginal);

          const escala = tamanhoOriginal.y > 0 ? alturaAlvo / tamanhoOriginal.y : 1;
          modelo.scale.setScalar(escala);

        // Recalcula a caixa DEPOIS de escalar pra centralizar corretamente
          const caixaEscalada = new THREE.Box3().setFromObject(modelo);
          const centro = new THREE.Vector3();
          caixaEscalada.getCenter(centro);

          modelo.position.x -= 0.1;
          modelo.position.z -= centro.z;
          modelo.position.y -= caixaEscalada.min.y; // encosta a base no "chão" do grupo

          const grupo = new THREE.Group();
          grupo.add(modelo);
          scene.add(grupo);

          const mixer = new THREE.AnimationMixer(modelo);
          const clips = {};
          gltf.animations.forEach((clip) => {
            clips[clip.name] = clip;
          });

          console.log(`[mascote] carregado. Escala aplicada: ${escala.toFixed(4)}x (tamanho original: ${tamanhoOriginal.y.toFixed(2)} unidades de altura)`);
          console.log('[mascote] clipes de animação encontrados no .glb:', Object.keys(clips));
          if (Object.keys(clips).length === 0) {
            console.warn(
              '[mascote] nenhum clipe de animação veio no .glb — confirme se exportou ' +
              'a Action do Blender marcada como "Push Down" ou incluída no NLA antes de exportar.'
            );
          }

          resolve({ mascote: grupo, mixer, clips });
        },
        (progresso) => {
          if (progresso.total > 0) {
            const percentual = Math.round((progresso.loaded / progresso.total) * 100);
            console.log(`[mascote] carregando... ${percentual}%`);
          }
        },
        (erro) => {
          encerrarCarregamento();
          console.error('[mascote] erro ao carregar o .glb:', erro);
          reject(erro);
        }
      );
    } catch (erro) {
      encerrarCarregamento();
      reject(erro);
    }
  });
}
