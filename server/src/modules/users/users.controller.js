const usersService = require('./users.service');

async function getMe(req, res) {
  res.status(200).json(req.user.toJSON());
}

async function updateMe(req, res) {
  const updatedUser = await usersService.updateProfile(req.body, req.user);
  res.status(200).json(updatedUser);
}

async function getUserProfile(req, res) {
  const result = await usersService.getUserProfile(req.params.id, req.user);
  res.status(200).json(result);
}

module.exports = {
  getMe,
  updateMe,
  getUserProfile,
};
