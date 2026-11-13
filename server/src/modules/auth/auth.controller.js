const authService = require('./auth.service');

async function register(req, res) {
  const user = await authService.register(req.body);
  res.status(201).json(user);
}

async function login(req, res) {
  const result = await authService.login(req.body);
  res.status(200).json(result);
}

async function refresh(req, res) {
  const tokens = await authService.refresh(req.body);
  res.status(200).json(tokens);
}

async function logout(req, res) {
  await authService.logout(req.body);
  res.status(204).send();
}

module.exports = { register, login, refresh, logout };

