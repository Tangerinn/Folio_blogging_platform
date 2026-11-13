const uploadsService = require('./uploads.service');

async function uploadImage(req, res) {
  const result = await uploadsService.uploadImage(req.file);
  res.status(201).json(result);
}

module.exports = { uploadImage };

