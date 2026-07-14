import * as authService from './auth.service.js';

export async function registerHandler(req, res) {
  const data = await authService.register(req.body);
  res.status(201).json({ data });
}

export async function loginHandler(req, res) {
  const data = await authService.login(req.body);
  res.json({ data });
}

export async function profileHandler(req, res) {
  const data = await authService.getProfile(req.user.id);
  res.json({ data });
}
