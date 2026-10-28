const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const app = require('../src/app');

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
  const storedFiles = (await fs.readdir(storageDirectory)).filter(
    (fileName) => !existingFiles.has(fileName),
  );
  assert.equal(storedFiles.length, 1);
  assert.equal(await fs.readFile(path.join(storageDirectory, storedFiles[0]), 'utf8'), 'document body');

  const ownerListResponse = await fetch(`${baseUrl}/documents`, {
    headers: { 'X-User-Id': 'alice' },
  });
  assert.equal(ownerListResponse.status, 200);
  assert.deepEqual((await ownerListResponse.json()).documents, [document]);

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
