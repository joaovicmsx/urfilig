const BASE = (process.env.URFILIG_API_URL || 'http://127.0.0.1:8780').replace(/\/+$/, '');
const TOKEN = process.env.URFILIG_API_TOKEN || '';

async function call(path, body, timeoutMs = 30000) {
  const isPost = body !== undefined;

  const options = {
    method: isPost ? 'POST' : 'GET',
    headers: {
      ...(isPost ? { 'Content-Type': 'application/json' } : {}),
      ...(TOKEN ? { 'X-Urfilig-Token': TOKEN } : {}),
    },
    signal: AbortSignal.timeout(timeoutMs),
  };

  if (isPost) {
    options.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${BASE}${path}`, options);
  } catch (causa) {
    const erro = new Error('Falha de conexão com a API própria do Urfilig.');
    erro.code = 'URFILIG_API_ERROR';
    erro.causaTecnica = causa?.cause?.code || causa?.name || 'falha de rede';
    throw erro;
  }

  if (!res.ok) {
    const erro = new Error(`Urfilig API ${path} respondeu ${res.status}`);
    erro.status = res.status;
    erro.code = 'URFILIG_API_ERROR';
    erro.causaTecnica = `HTTP_${res.status}`;
    throw erro;
  }
  return res.json();
}

export async function askUrfilig(message, web = false, timeoutMs = 30000) {
  return call('/chat', { message, web }, timeoutMs);
}

export async function recallUrfilig(query) {
  return call('/recall', { query }, 15000);
}

export async function resetUrfilig() {
  return call('/reset', {}, 5000);
}

export async function urfiligHealth() {
  return call('/health', undefined, 5000);
}
