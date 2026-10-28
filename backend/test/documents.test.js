const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const app = require('../src/app');
const documentsRepository = require('../src/repositories/documents.repository');

const storageDirectory = path.resolve(__dirname, '../storage');

async function startServer() {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  return server;
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function createUploadForm(name, content, mimeType = 'text/plain') {
  const form = new FormData();
  form.append('file', new Blob([content], { type: mimeType }), name);
  return form;
}

function calculateCrc32(content) {
  let crc = 0xffffffff;

  for (const byte of content) {
    crc ^= byte;
    for (let bitIndex = 0; bitIndex < 8; bitIndex += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const content = Buffer.from(entry.content);
    const crc = calculateCrc32(content);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(content.length, 18);
    localHeader.writeUInt32LE(content.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localParts.push(localHeader, name, content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(content.length, 20);
    centralHeader.writeUInt32LE(content.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(centralHeader, name);

    localOffset += localHeader.length + name.length + content.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(localOffset, 16);

  return Buffer.concat([...localParts, centralDirectory, endRecord]);
}

test('document endpoints upload, list and download only for the owner', async (t) => {
  await fs.mkdir(storageDirectory, { recursive: true });
  const existingFiles = new Set(await fs.readdir(storageDirectory));
  const server = await startServer();
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  t.after(async () => {
    await closeServer(server);
    const currentFiles = await fs.readdir(storageDirectory);
    await Promise.all(
      currentFiles
        .filter((fileName) => !existingFiles.has(fileName))
        .map((fileName) => fs.unlink(path.join(storageDirectory, fileName))),
    );
  });

  const missingUserResponse = await fetch(`${baseUrl}/documents`);
  assert.equal(missingUserResponse.status, 400);
  assert.deepEqual(await missingUserResponse.json(), {
    error: { code: 'INVALID_USER', message: 'O header X-User-Id é obrigatório.' },
  });

  const unsupportedResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'alice' },
    body: createUploadForm('image.png', 'not an accepted document', 'image/png'),
  });
  assert.equal(unsupportedResponse.status, 415);
  assert.equal((await unsupportedResponse.json()).error.code, 'UNSUPPORTED_FILE_TYPE');

  const spoofedTextResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'alice' },
    body: createUploadForm(
      'report.txt',
      new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x00]),
    ),
  });
  assert.equal(spoofedTextResponse.status, 415);
  assert.equal((await spoofedTextResponse.json()).error.code, 'UNSUPPORTED_FILE_TYPE');

  const missingFileResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'alice' },
  });
  assert.equal(missingFileResponse.status, 400);
  assert.equal((await missingFileResponse.json()).error.code, 'FILE_REQUIRED');

  const oversizedResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'alice' },
    body: createUploadForm(
      'large.txt',
      new Uint8Array(10 * 1024 * 1024 + 1),
    ),
  });
  assert.equal(oversizedResponse.status, 413);
  assert.equal((await oversizedResponse.json()).error.code, 'FILE_TOO_LARGE');

  const uploadResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'alice' },
    body: createUploadForm('notes.txt', 'document body'),
  });
  assert.equal(uploadResponse.status, 201);
  const { document } = await uploadResponse.json();
  assert.equal(document.originalName, 'notes.txt');
  assert.equal(document.owner, 'alice');
  assert.equal(document.size, Buffer.byteLength('document body'));
  assert.equal(document.mimeType, 'text/plain');
  assert.ok(Number.isFinite(Date.parse(document.uploadedAt)));
  assert.equal('storagePath' in document, false);
  assert.equal('storageName' in document, false);

  const docxMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const docxResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'alice' },
    body: createUploadForm(
      'report.docx',
      createStoredZip([
        { name: '[Content_Types].xml', content: '<Types />' },
        { name: 'word/document.xml', content: '<document />' },
      ]),
      docxMimeType,
    ),
  });
  assert.equal(docxResponse.status, 201);
  const { document: docxDocument } = await docxResponse.json();
  assert.equal(docxDocument.mimeType, docxMimeType);

  const storedFiles = (await fs.readdir(storageDirectory)).filter(
    (fileName) => !existingFiles.has(fileName),
  );
  assert.equal(storedFiles.length, 2);
  const storedTextFile = storedFiles.find((fileName) => fileName.endsWith('.txt'));
  assert.equal(await fs.readFile(path.join(storageDirectory, storedTextFile), 'utf8'), 'document body');

  const originalCreate = documentsRepository.create;
  documentsRepository.create = () => {
    const error = new Error('ENOSPC /private/storage/path');
    error.code = 'ENOSPC';
    throw error;
  };

  let failedRegistrationResponse;
  try {
    failedRegistrationResponse = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { 'X-User-Id': 'alice' },
      body: createUploadForm('orphan.txt', 'should be removed'),
    });
  } finally {
    documentsRepository.create = originalCreate;
  }

  assert.equal(failedRegistrationResponse.status, 500);
  assert.deepEqual(await failedRegistrationResponse.json(), {
    error: { code: 'UPLOAD_FAILED', message: 'Não foi possível salvar o documento.' },
  });
  assert.deepEqual(
    (await fs.readdir(storageDirectory)).filter((fileName) => !existingFiles.has(fileName)).sort(),
    storedFiles.sort(),
  );

  const originalMkdir = fs.mkdir;
  fs.mkdir = async () => {
    const error = new Error('ENOSPC /private/storage/path');
    error.code = 'ENOSPC';
    throw error;
  };

  let storageFailureResponse;
  try {
    storageFailureResponse = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { 'X-User-Id': 'alice' },
      body: createUploadForm('disk-error.txt', 'storage unavailable'),
    });
  } finally {
    fs.mkdir = originalMkdir;
  }

  assert.equal(storageFailureResponse.status, 500);
  assert.deepEqual(await storageFailureResponse.json(), {
    error: { code: 'UPLOAD_FAILED', message: 'Não foi possível salvar o documento.' },
  });

  const ownerListResponse = await fetch(`${baseUrl}/documents`, {
    headers: { 'X-User-Id': 'alice' },
  });
  assert.equal(ownerListResponse.status, 200);
  assert.deepEqual((await ownerListResponse.json()).documents, [document, docxDocument]);

  const otherUserListResponse = await fetch(`${baseUrl}/documents`, {
    headers: { 'X-User-Id': 'bob' },
  });
  assert.equal(otherUserListResponse.status, 200);
  assert.deepEqual((await otherUserListResponse.json()).documents, []);

  const forbiddenDownloadResponse = await fetch(
    `${baseUrl}/documents/${document.id}/download`,
    { headers: { 'X-User-Id': 'bob' } },
  );
  assert.equal(forbiddenDownloadResponse.status, 404);
  assert.deepEqual(await forbiddenDownloadResponse.json(), {
    error: {
      code: 'DOCUMENT_NOT_FOUND',
      message: 'Documento não encontrado.',
    },
  });

  const ownerDownloadResponse = await fetch(
    `${baseUrl}/documents/${document.id}/download`,
    { headers: { 'X-User-Id': 'alice' } },
  );
  assert.equal(ownerDownloadResponse.status, 200);
  assert.equal(ownerDownloadResponse.headers.get('content-type'), 'text/plain; charset=utf-8');
  assert.match(ownerDownloadResponse.headers.get('content-disposition'), /attachment/);
  assert.equal(await ownerDownloadResponse.text(), 'document body');
});
