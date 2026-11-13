const postsService = require('./posts.service');

async function listPosts(req, res) {
  const { posts, pagination } = await postsService.listPosts(req.validatedQuery, req.user);
  res.set({
    'X-Total-Count': String(pagination.total),
    'X-Page': String(pagination.page),
    'X-Limit': String(pagination.limit),
    'X-Total-Pages': String(pagination.totalPages),
  });
  res.status(200).json(posts);
}

async function getPostById(req, res) {
  const post = await postsService.getPostById(req.params.id, req.user);
  res.status(200).json(post);
}

async function createPost(req, res) {
  const post = await postsService.createPost(req.body, req.user);
  res.status(201).json(post);
}

async function updatePost(req, res) {
  const post = await postsService.updatePost(req.params.id, req.body, req.user);
  res.status(200).json(post);
}

async function deletePost(req, res) {
  const result = await postsService.deletePost(req.params.id, req.user);
  res.status(200).json(result);
}

module.exports = { listPosts, getPostById, createPost, updatePost, deletePost };

