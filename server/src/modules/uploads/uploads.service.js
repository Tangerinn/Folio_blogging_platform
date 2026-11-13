const { v2: cloudinary } = require('cloudinary');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');

const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

/**
 * Inspects leading magic bytes of a Buffer to verify real raster image format.
 */
function detectImageMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // GIF: GIF87a or GIF89a
  const header6 = buffer.subarray(0, 6).toString('ascii');
  if (header6 === 'GIF87a' || header6 === 'GIF89a') {
    return 'image/gif';
  }

  // WEBP: RIFF....WEBP
  const riff = buffer.subarray(0, 4).toString('ascii');
  const webp = buffer.subarray(8, 12).toString('ascii');
  if (riff === 'RIFF' && webp === 'WEBP') {
    return 'image/webp';
  }

  return null;
}

function streamToCloudinary(buffer) {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Image upload service is not configured.');
  }

  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'folio/posts', resource_type: 'image' },
      (err, result) => {
        if (err || !result) {
          return reject(new AppError(502, 'UPLOAD_FAILED', 'Image upload failed. Please try again.'));
        }
        return resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
        });
      }
    );
    stream.end(buffer);
  });
}

async function uploadImage(file) {
  if (!file || !file.buffer) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Please attach an image file in the "image" field.');
  }

  if (!ALLOWED_MIMES.has(file.mimetype)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Only PNG, JPEG, WebP, and GIF images are allowed.');
  }

  const detectedMime = detectImageMime(file.buffer);
  if (!detectedMime || detectedMime !== file.mimetype) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid or corrupted image file.');
  }

  return module.exports.streamToCloudinary(file.buffer);
}

module.exports = {
  detectImageMime,
  streamToCloudinary,
  uploadImage,
};

