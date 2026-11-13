const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/folio_test';
process.env.JWT_ACCESS_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.REFRESH_TOKEN_EXPIRES_DAYS = '7';
process.env.CORS_ORIGIN = 'http://localhost:5173';

const User = require('../src/models/User');
const uploadsService = require('../src/modules/uploads/uploads.service');
const app = require('../src/app');

let activeUser;
let token;

User.findById = (id) => {
  if (activeUser && id.toString() === activeUser._id.toString()) {
    return Promise.resolve(activeUser);
  }
  return Promise.resolve(null);
};

function postUpload(path, { token: authToken, fieldName = 'image', filename = 'test.png', mime = 'image/png', buffer } = {}) {
  return new Promise((resolve, reject) => {
    const boundary = '----FolioTestBoundary123456';
    const parts = [];
    if (buffer !== undefined) {
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`,
          'utf8'
        ),
        buffer,
        Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
      );
    } else {
      parts.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));
    }
    const payload = Buffer.concat(parts);

    const reqSocket = new PassThrough();
    reqSocket.remoteAddress = '127.0.0.1';
    const resSocket = new PassThrough();

    const req = new http.IncomingMessage(reqSocket);
    req.method = 'POST';
    req.url = `/api${path}`;
    req.headers = {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'content-length': String(payload.length),
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
    };

    const res = new http.ServerResponse(req);
    const chunks = [];
    const origWrite = res.write.bind(res);
    const origEnd = res.end.bind(res);
    res.assignSocket(resSocket);

    res.write = (chunk, encoding, cb) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      return origWrite(chunk, encoding, cb);
    };
    res.end = (chunk, encoding, cb) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      const result = origEnd(chunk, encoding, cb);
      const full = Buffer.concat(chunks).toString('utf8');
      const sep = full.indexOf('\r\n\r\n');
      const text = sep !== -1 ? full.slice(sep + 4) : full;
      let json = null;
      if (text) {
        try { json = JSON.parse(text); } catch { json = text; }
      }
      resolve({ status: res.statusCode, body: json });
      return result;
    };

    res.on('error', reject);
    app(req, res);

    // Feed body once async auth middleware yields to multer
    setImmediate(() => {
      req.push(payload);
      req.complete = true;
      req.push(null);
    });
  });
}

describe('Image Uploads integration suite', () => {
  beforeEach(() => {
    activeUser = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Uploader',
      email: 'u@example.com',
      role: 'student',
      status: 'active',
    };
    token = jwt.sign({ sub: activeUser._id.toString(), role: 'student' }, process.env.JWT_ACCESS_SECRET, {
      expiresIn: '15m',
    });
    uploadsService.streamToCloudinary = async () => ({
      url: 'https://res.cloudinary.com/demo/image/upload/v1/folio/posts/sample.png',
      publicId: 'folio/posts/sample',
      width: 100,
      height: 100,
    });
  });

  it('requires authentication and rejects missing files, SVGs, spoofed magic bytes, and oversized files', async () => {
    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);

    const unauth = await postUpload('/uploads/image', { buffer: validPng });
    assert.equal(unauth.status, 401);

    const noFile = await postUpload('/uploads/image', { token });
    assert.equal(noFile.status, 400);
    assert.equal(noFile.body.error.code, 'VALIDATION_ERROR');

    const svgRes = await postUpload('/uploads/image', {
      token,
      filename: 'xss.svg',
      mime: 'image/svg+xml',
      buffer: Buffer.from('<svg onload="alert(1)"></svg>', 'utf8'),
    });
    assert.equal(svgRes.status, 400);
    assert.equal(svgRes.body.error.code, 'VALIDATION_ERROR');

    const spoofedPng = await postUpload('/uploads/image', {
      token,
      filename: 'fake.png',
      mime: 'image/png',
      buffer: Buffer.from('<html><script>alert(1)</script></html>', 'utf8'),
    });
    assert.equal(spoofedPng.status, 400);
    assert.equal(spoofedPng.body.error.code, 'VALIDATION_ERROR');

    const oversized = await postUpload('/uploads/image', {
      token,
      filename: 'huge.png',
      mime: 'image/png',
      buffer: Buffer.concat([validPng, Buffer.alloc(5 * 1024 * 1024 + 10)]),
    });
    assert.equal(oversized.status, 400);
    assert.equal(oversized.body.error.code, 'VALIDATION_ERROR');
  });

  it('accepts valid PNG/JPEG/WEBP/GIF magic bytes and returns Cloudinary metadata', async () => {
    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const resPng = await postUpload('/uploads/image', { token, mime: 'image/png', buffer: validPng });
    assert.equal(resPng.status, 201);
    assert.equal(resPng.body.url, 'https://res.cloudinary.com/demo/image/upload/v1/folio/posts/sample.png');

    const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const resJpeg = await postUpload('/uploads/image', { token, filename: 'a.jpg', mime: 'image/jpeg', buffer: validJpeg });
    assert.equal(resJpeg.status, 201);

    const validWebp = Buffer.from('RIFF\x00\x00\x00\x00WEBP', 'binary');
    const resWebp = await postUpload('/uploads/image', { token, filename: 'a.webp', mime: 'image/webp', buffer: validWebp });
    assert.equal(resWebp.status, 201);

    const validGif = Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00', 'binary');
    const resGif = await postUpload('/uploads/image', { token, filename: 'a.gif', mime: 'image/gif', buffer: validGif });
    assert.equal(resGif.status, 201);
  });
});
