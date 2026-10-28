const API_BASE_PATH = '/api';

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt'];

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request(endpoint, userId, options = {}) {
  const headers = new Headers(options.headers);
  headers.set('X-User-Id', userId.trim());

  const response = await fetch(`${API_BASE_PATH}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let payload;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    throw new ApiError(
      payload?.error?.message || 'Não foi possível concluir a solicitação.',
      response.status,
      payload?.error?.code,
    );
  }

  return response;
}

export async function listDocuments(userId) {
  const response = await request('/documents', userId);
  const payload = await response.json();
  return payload.documents;
}

export async function uploadDocument(file, userId) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await request('/upload', userId, {
    method: 'POST',
    body: formData,
  });
  const payload = await response.json();
  return payload.document;
}

export async function downloadDocument(documentId, userId) {
  const response = await request(
    `/documents/${encodeURIComponent(documentId)}/download`,
    userId,
  );
  return response.blob();
}