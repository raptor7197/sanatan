import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Missing or invalid authorization header', 'UNAUTHORIZED'));
  }

  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return next(
        new ApiError(403, `Only ${role.toLowerCase()}s can perform this action`, 'FORBIDDEN'),
      );
    }
    next();
  };
}
