const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const multer = require('multer');
const { STORAGE_DIRECTORY } = require('../config/storage');
const documentsController = require('../controllers/documents.controller');

const router = express.Router();
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowedTypes = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
};

const storage = multer.diskStorage({
  destination(request, file, callback) {
    fs.mkdir(STORAGE_DIRECTORY, { recursive: true })
      .then(() => callback(null, STORAGE_DIRECTORY), callback);
  },
  filename(request, file, callback) {
    callback(null, `${crypto.randomUUID()}${file.normalizedExtension}`);
  },
});

function filterFile(request, file, callback) {
  const originalName = file.originalname.replace(/\\/g, '/');
  const extension = path.posix.extname(originalName).toLowerCase();
  const expectedMimeType = allowedTypes[extension];

  if (!expectedMimeType || file.mimetype.toLowerCase() !== expectedMimeType) {
    const error = new Error('Tipo de arquivo não permitido.');
    error.code = 'UNSUPPORTED_FILE_TYPE';
    return callback(error);
  }

  file.normalizedExtension = extension;
  file.normalizedMimeType = expectedMimeType;
  return callback(null, true);
}

const uploadFile = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: filterFile,
});

router.post(
  '/upload',
  documentsController.requireUser,
  uploadFile.single('file'),
  documentsController.upload,
);
router.get('/documents', documentsController.requireUser, documentsController.list);
router.get(
  '/documents/:id/download',
  documentsController.requireUser,
  documentsController.download,
);

router.use((error, request, response, next) => {
  if (response.headersSent) return next(error);

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return documentsController.sendError(
        response,
        413,
        'FILE_TOO_LARGE',
        'O arquivo excede o limite de 10 MiB.',
      );
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return documentsController.sendError(
        response,
        400,
        'FILE_REQUIRED',
        'Envie um único arquivo no campo file.',
      );
    }
  }

  if (error.code === 'UNSUPPORTED_FILE_TYPE') {
    return documentsController.sendError(
      response,
      415,
      'UNSUPPORTED_FILE_TYPE',
      'Formato de arquivo não permitido. Envie PDF, DOC, DOCX ou TXT.',
    );
  }

  const routeErrors = {
    '/upload': ['UPLOAD_FAILED', 'Não foi possível salvar o documento.'],
    '/documents': ['LIST_FAILED', 'Não foi possível listar os documentos.'],
  };
  const [code, message] = routeErrors[request.path] || [
    'DOWNLOAD_FAILED',
    'Não foi possível baixar o documento.',
  ];

  return documentsController.sendError(
    response,
    error.statusCode || 500,
    error.code || code,
    error.statusCode ? error.message : message,
  );
});

module.exports = router;