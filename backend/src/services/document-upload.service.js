const path = require('node:path');
const { randomUUID } = require('node:crypto');
const documentsRepository = require('../repositories/documents.repository');
const { validateDocumentFile } = require('./document-file-validator');

function sanitizeOriginalName(originalName) {
  return path.posix
    .basename(originalName.replace(/\\/g, '/'))
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
}

async function uploadDocument(owner, file) {
  try {
    await validateDocumentFile(file);

    return documentsRepository.create({
      id: randomUUID(),
      originalName: sanitizeOriginalName(file.originalname),
      size: file.size,
      mimeType: file.normalizedMimeType,
      uploadedAt: new Date().toISOString(),
      owner,
      storageName: file.filename,
    });
  } catch (error) {
    try {
      await documentsRepository.removeStorageFile(file.filename);
    } catch {
      error.cleanupFailed = true;
    }

    throw error;
  }
}

module.exports = { uploadDocument };