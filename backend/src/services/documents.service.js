const path = require('node:path');
const { randomUUID } = require('node:crypto');
const documentsRepository = require('../repositories/documents.repository');

function sanitizeOriginalName(originalName) {
  return path.posix
    .basename(originalName.replace(/\\/g, '/'))
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
}

async function createDocument(owner, file) {
  try {
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

function listDocuments(owner) {
  return documentsRepository.findAllByOwner(owner);
}

function getDocumentForDownload(id, owner) {
  const document = documentsRepository.findByIdAndOwner(id, owner);
  if (!document) return null;

  return {
    document,
    filePath: documentsRepository.resolveStoragePath(document.storageName),
  };
}

module.exports = {
  createDocument,
  listDocuments,
  getDocumentForDownload,
};