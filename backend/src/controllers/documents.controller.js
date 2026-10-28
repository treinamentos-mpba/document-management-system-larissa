const documentsService = require('../services/documents.service');

function sendError(response, status, code, message) {
  return response.status(status).json({ error: { code, message } });
}

function requireUser(request, response, next) {
  const owner = request.get('X-User-Id')?.trim();

  if (!owner) {
    return sendError(response, 400, 'INVALID_USER', 'O header X-User-Id é obrigatório.');
  }

  request.userId = owner;
  return next();
}

function upload(request, response, next) {
  if (!request.file) {
    return sendError(response, 400, 'FILE_REQUIRED', 'Envie um arquivo no campo file.');
  }

  try {
    const document = documentsService.createDocument(request.userId, request.file);
    return response.status(201).json({ document });
  } catch (error) {
    error.statusCode = 500;
    error.code = 'UPLOAD_FAILED';
    error.message = 'Não foi possível salvar o documento.';
    return next(error);
  }
}

function list(request, response, next) {
  try {
    return response.status(200).json({
      documents: documentsService.listDocuments(request.userId),
    });
  } catch (error) {
    error.statusCode = 500;
    error.code = 'LIST_FAILED';
    error.message = 'Não foi possível listar os documentos.';
    return next(error);
  }
}

function download(request, response, next) {
  let document;
  let filePath;

  try {
    document = documentsService.findDocumentForDownload(request.params.id, request.userId);
    if (!document) {
      return sendError(response, 404, 'DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
    }

    filePath = documentsService.getDocumentPath(document);
  } catch (error) {
    error.statusCode = 500;
    error.code = 'DOWNLOAD_FAILED';
    error.message = 'Não foi possível baixar o documento.';
    return next(error);
  }

  response.type(document.mimeType);
  return response.download(filePath, document.originalName, (error) => {
    if (!error) return;

    if (error.code === 'ENOENT' && !response.headersSent) {
      return sendError(response, 404, 'DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
    }

    if (response.headersSent) return next(error);

    error.statusCode = 500;
    error.code = 'DOWNLOAD_FAILED';
    error.message = 'Não foi possível baixar o documento.';
    return next(error);
  });
}

module.exports = { requireUser, upload, list, download, sendError };