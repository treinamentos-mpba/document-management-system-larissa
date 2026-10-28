const documentsService = require('../services/documents.service');
const documentUploadService = require('../services/document-upload.service');

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

async function upload(request, response, next) {
  if (!request.file) {
    return sendError(response, 400, 'FILE_REQUIRED', 'Envie um arquivo no campo file.');
  }

  try {
    const document = await documentUploadService.uploadDocument(request.userId, request.file);
    return response.status(201).json({ document });
  } catch (error) {
    return next(error);
  }
}

function list(request, response, next) {
  try {
    return response.status(200).json({
      documents: documentsService.listDocuments(request.userId),
    });
  } catch (error) {
    return next(error);
  }
}

function download(request, response, next) {
  let download;

  try {
    download = documentsService.getDocumentForDownload(request.params.id, request.userId);
    if (!download) {
      return sendError(response, 404, 'DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
    }
  } catch (error) {
    return next(error);
  }

  response.type(download.document.mimeType);
  return response.download(download.filePath, download.document.originalName, (error) => {
    if (!error) return;

    if (error.code === 'ENOENT' && !response.headersSent) {
      return sendError(response, 404, 'DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
    }

    if (response.headersSent) return next(error);

    return next(error);
  });
}

function handleError(error, request, response, next) {
  if (response.headersSent) return next(error);

  if (error.code === 'LIMIT_FILE_SIZE') {
    return sendError(response, 413, 'FILE_TOO_LARGE', 'O arquivo excede o limite de 10 MiB.');
  }

  if (error.code === 'UNSUPPORTED_FILE_TYPE') {
    return sendError(
      response,
      415,
      'UNSUPPORTED_FILE_TYPE',
      'Formato ou conteúdo de arquivo não permitido.',
    );
  }

  if (error.code?.startsWith('LIMIT_')) {
    return sendError(response, 400, 'INVALID_MULTIPART', 'A requisição de upload é inválida.');
  }

  if (request.path === '/upload' && request.is('multipart/form-data') && !error.code) {
    return sendError(response, 400, 'INVALID_MULTIPART', 'A requisição de upload é inválida.');
  }

  const routeErrors = {
    '/upload': ['UPLOAD_FAILED', 'Não foi possível salvar o documento.'],
    '/documents': ['LIST_FAILED', 'Não foi possível listar os documentos.'],
  };
  const [code, message] = routeErrors[request.path] || [
    'DOWNLOAD_FAILED',
    'Não foi possível baixar o documento.',
  ];

  return sendError(response, 500, code, message);
}

module.exports = { requireUser, upload, list, download, sendError, handleError };