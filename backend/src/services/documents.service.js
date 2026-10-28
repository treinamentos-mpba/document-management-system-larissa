const path = require('node:path');
const { randomUUID } = require('node:crypto');
const documentsRepository = require('../repositories/documents.repository');

function sanitizeOriginalName(originalName) {
  return path.posix
    .basename(originalName.replace(/\\/g, '/'))
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
}

function createDocument(owner, file) {
  return documentsRepository.create({
    id: randomUUID(),
    originalName: sanitizeOriginalName(file.originalname),
    size: file.size,
    mimeType: file.normalizedMimeType,
    uploadedAt: new Date().toISOString(),
    owner,
    storageName: file.filename,
  });
}

function listDocuments(owner) {
  return documentsRepository.findAllByOwner(owner);
}

function findDocumentForDownload(id, owner) {
  return documentsRepository.findByIdAndOwner(id, owner);
}

function getDocumentPath(document) {
  return documentsRepository.resolveStoragePath(document.storageName);
}

module.exports = {
  createDocument,
  listDocuments,
  findDocumentForDownload,
  getDocumentPath,
};