const commentsService = require('./comments.service');

async function listComments(req, res) {
  const comments = await commentsService.listComments(req.params.id, req.user);
  res.status(200).json(comments);
}

async function createComment(req, res) {
  const comment = await commentsService.createComment(req.params.id, req.body, req.user);
  res.status(201).json(comment);
}

async function createReply(req, res) {
  const reply = await commentsService.createReply(req.params.id, req.body, req.user);
  res.status(201).json(reply);
}

async function updateComment(req, res) {
  const result = await commentsService.updateComment(req.params.id, req.body, req.user);
  res.status(200).json(result);
}

async function deleteComment(req, res) {
  const result = await commentsService.deleteComment(req.params.id, req.user);
  res.status(200).json(result);
}

module.exports = {
  listComments,
  createComment,
  createReply,
  updateComment,
  deleteComment,
};

