const documentsRepository = require('../repositories/documents.repository');

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
  listDocuments,
  getDocumentForDownload,
};