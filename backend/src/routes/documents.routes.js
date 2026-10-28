const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const multer = require('multer');
const { STORAGE_DIRECTORY } = require('../config/storage');
const documentsController = require('../controllers/documents.controller');

const router = express.Router();
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowedMimeTypes = {
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
  const expectedMimeType = allowedMimeTypes[extension];

  if (
    !expectedMimeType || file.mimetype.toLowerCase() !== expectedMimeType
  ) {
    const error = new Error('Formato de arquivo não permitido.');
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
router.use(documentsController.handleError);

module.exports = router;