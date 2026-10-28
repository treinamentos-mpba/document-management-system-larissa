const path = require('node:path');
const { STORAGE_DIRECTORY } = require('../config/storage');

const documents = new Map();

function toPublicDocument(document) {
  const { storageName, ...publicDocument } = document;
  return publicDocument;
}

function create(document) {
  documents.set(document.id, document);
  return toPublicDocument(document);
}

function findAllByOwner(owner) {
  return Array.from(documents.values())
    .filter((document) => document.owner === owner)
    .map(toPublicDocument);
}

function findByIdAndOwner(id, owner) {
  const document = documents.get(id);
  return document && document.owner === owner ? { ...document } : null;
}

function resolveStoragePath(storageName) {
  if (!storageName || path.basename(storageName) !== storageName) {
    throw new Error('Invalid internal storage name');
  }

  const storagePath = path.resolve(STORAGE_DIRECTORY, storageName);
  const relativePath = path.relative(STORAGE_DIRECTORY, storagePath);

  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Storage path is outside the configured directory');
  }

  return storagePath;
}

module.exports = {
  create,
  findAllByOwner,
  findByIdAndOwner,
  resolveStoragePath,
};