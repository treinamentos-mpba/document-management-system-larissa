import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ApiError,
  downloadDocument,
  listDocuments,
  uploadDocument,
} from '../src/services/documentsApi.js';

function mockFetch(t, implementation) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = implementation;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
}

test('documents API sends the user header and multipart requests through /api', async (t) => {
  const requests = [];
  mockFetch(t, async (input, options = {}) => {
    requests.push({ input, options });

    if (input.endsWith('/documents')) {
      return new Response(JSON.stringify({ documents: [{ id: 'doc-1' }] }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (input.endsWith('/upload')) {
      return new Response(JSON.stringify({ document: { id: 'doc-2' } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(new Blob(['file contents']), { status: 200 });
  });

  assert.deepEqual(await listDocuments(' alice '), [{ id: 'doc-1' }]);
  assert.deepEqual(
    await uploadDocument(new Blob(['notes'], { type: 'text/plain' }), 'alice'),
    { id: 'doc-2' },
  );
  const downloadedFile = await downloadDocument('doc/3', 'alice');
  assert.equal(await downloadedFile.text(), 'file contents');

  assert.deepEqual(requests.map(({ input }) => input), [
    '/api/documents',
    '/api/upload',
    '/api/documents/doc%2F3/download',
  ]);
  assert.ok(requests.every(({ options }) => options.headers.get('X-User-Id') === 'alice'));
  assert.equal(requests[1].options.body instanceof FormData, true);
  assert.equal(requests[1].options.body.has('file'), true);
  assert.equal(requests[1].options.headers.has('Content-Type'), false);
});

test('documents API returns the public API error without leaking transport details', async (t) => {
  mockFetch(t, async () => new Response(
    JSON.stringify({
      error: { code: 'FILE_TOO_LARGE', message: 'O arquivo excede o limite.' },
    }),
    { status: 413, headers: { 'Content-Type': 'application/json' } },
  ));

  await assert.rejects(
    uploadDocument(new Blob(['notes'], { type: 'text/plain' }), 'alice'),
    (error) => {
      assert.equal(error instanceof ApiError, true);
      assert.equal(error.status, 413);
      assert.equal(error.code, 'FILE_TOO_LARGE');
      assert.equal(error.message, 'O arquivo excede o limite.');
      return true;
    },
  );
});