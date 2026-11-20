import jwt from 'jsonwebtoken';

/**
 * Middleware que exige um token JWT válido no header Authorization
 * (formato "Bearer <token>") e associa a requisição ao usuário autenticado.
 * Rotas com dados pessoais devem aplicá-lo antes de consultar o Prisma.
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
