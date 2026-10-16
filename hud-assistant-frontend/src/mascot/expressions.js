/**
 * Aplica uma expressão facial via morphTargetInfluences (shape keys do Blender).
 * Só funciona se o mesh tiver essa shape key exportada — se não tiver,
 * avisa no console em vez de quebrar.
 */
export function setExpression(mesh, shapeName, weight) {
  if (!mesh?.morphTargetDictionary) {
    console.warn('[expressions] este mesh não tem morph targets exportados ainda.');
    return;
  }

  const index = mesh.morphTargetDictionary[shapeName];
  if (index === undefined) {
    console.warn(`[expressions] shape key "${shapeName}" não existe neste mesh. Disponíveis:`, Object.keys(mesh.morphTargetDictionary));
    return;
  }

  mesh.morphTargetInfluences[index] = weight; // 0 a 1
}

/**
 * Procura, dentro da hierarquia do mascote, o primeiro mesh que tem
 * morph targets (geralmente é o mesh da cabeça/rosto).
 */
export function encontrarMeshComMorphTargets(mascote) {
  let encontrado = null;
  mascote.traverse((objeto) => {
    if (!encontrado && objeto.isMesh && objeto.morphTargetDictionary) {
      encontrado = objeto;
    }
  });
  return encontrado;
}
