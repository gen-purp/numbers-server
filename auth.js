import jwt from 'jsonwebtoken';

const jwtSecret = process.env.JWT_SECRET || 'dev_secret_change_me';

export function signToken(user) {
  return jwt.sign({ sub: user._id, uuid: user.uuid, email: user.email }, jwtSecret, { expiresIn: '7d' });
}

export function authMiddleware(req, _res, next) {
  const header = req.headers.authorization || '';
  const [, token] = header.split(' ');
  if (!token) return next();
  try { req.user = jwt.verify(token, jwtSecret); } catch {}
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}
