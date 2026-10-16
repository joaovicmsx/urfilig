import jwt from 'jsonwebtoken';

/**
 * Middleware que exige um token JWT válido no header Authorization
 * (formato "Bearer <token>"). Ainda não está aplicado nas rotas existentes
 * (comando, leads, persona) — isso é proposital, ver a pendência de
 * isolamento de dados por usuário na nota do Obsidian. Quando essa
 * pendência for resolvida, é só importar e usar isso como middleware nas
 * rotas que precisam de dono.
 */
export function exigirAutenticacao(req, res, next) {
  const cabecalho = req.headers.authorization;
  const token = cabecalho?.startsWith('Bearer ') ? cabecalho.slice(7) : null;

  if (!token) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuarioId = payload.sub;
    next();
  } catch {
    res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}
