const fs = require('node:fs/promises');

const PDF_SIGNATURE = Buffer.from('%PDF-');
const DOC_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const ZIP_END_SIGNATURE = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
const ZIP_DIRECTORY_SIGNATURE = 0x02014b50;
const MAX_ZIP_COMMENT_LENGTH = 0xffff;

function invalidFileType() {
  const error = new Error('O conteúdo não corresponde ao tipo de arquivo informado.');
  error.code = 'UNSUPPORTED_FILE_TYPE';
  return error;
}

async function hasDocxPackageEntries(fileHandle, fileSize) {
  const tailSize = Math.min(fileSize, 22 + MAX_ZIP_COMMENT_LENGTH);
  const tail = Buffer.alloc(tailSize);
  const tailRead = await fileHandle.read(tail, 0, tailSize, fileSize - tailSize);
  if (tailRead.bytesRead !== tailSize) return false;

  const endOffset = tail.lastIndexOf(ZIP_END_SIGNATURE);
  if (endOffset < 0 || endOffset + 22 > tail.length) return false;

  const commentLength = tail.readUInt16LE(endOffset + 20);
  if (endOffset + 22 + commentLength !== tail.length) return false;

  const diskNumber = tail.readUInt16LE(endOffset + 4);
  const directoryDiskNumber = tail.readUInt16LE(endOffset + 6);
  const diskEntryCount = tail.readUInt16LE(endOffset + 8);
  const totalEntryCount = tail.readUInt16LE(endOffset + 10);
  const directorySize = tail.readUInt32LE(endOffset + 12);
  const directoryOffset = tail.readUInt32LE(endOffset + 16);

  if (
    diskNumber !== 0
    || directoryDiskNumber !== 0
    || diskEntryCount !== totalEntryCount
    || totalEntryCount === 0xffff
    || directorySize === 0xffffffff
    || directoryOffset === 0xffffffff
    || directoryOffset + directorySize > fileSize
  ) {
    return false;
  }

  const directory = Buffer.alloc(directorySize);
  const directoryRead = await fileHandle.read(
    directory,
    0,
    directorySize,
    directoryOffset,
  );
  if (directoryRead.bytesRead !== directorySize) return false;

  const entries = new Set();
  let offset = 0;

  while (offset < directory.length) {
    if (
      offset + 46 > directory.length
      || directory.readUInt32LE(offset) !== ZIP_DIRECTORY_SIGNATURE
    ) {
      return false;
    }

    const nameLength = directory.readUInt16LE(offset + 28);
    const extraLength = directory.readUInt16LE(offset + 30);
    const entryCommentLength = directory.readUInt16LE(offset + 32);
    const entryLength = 46 + nameLength + extraLength + entryCommentLength;
    if (offset + entryLength > directory.length) return false;

    const name = directory
      .subarray(offset + 46, offset + 46 + nameLength)
      .toString('utf8');
    entries.add(name);
    offset += entryLength;
  }

  return entries.has('[Content_Types].xml') && entries.has('word/document.xml');
}

async function hasExpectedSignature(fileHandle, file) {
  const { size } = await fileHandle.stat();

  if (file.normalizedExtension === '.docx') {
    return hasDocxPackageEntries(fileHandle, size);
  }

  if (file.normalizedExtension === '.txt') {
    const content = await fs.readFile(file.path);
    if (content.includes(0)) return false;

    try {
      new TextDecoder('utf-8', { fatal: true }).decode(content);
      return true;
    } catch {
      return false;
    }
  }

  const bytesToRead = Math.min(size, 1024);
  const header = Buffer.alloc(bytesToRead);
  const result = await fileHandle.read(header, 0, bytesToRead, 0);
  const content = header.subarray(0, result.bytesRead);

  if (file.normalizedExtension === '.pdf') {
    return content.indexOf(PDF_SIGNATURE) >= 0;
  }

  if (file.normalizedExtension === '.doc') {
    return content.subarray(0, DOC_SIGNATURE.length).equals(DOC_SIGNATURE);
  }

  return false;
}

async function validateDocumentFile(file) {
  const fileHandle = await fs.open(file.path, 'r');

  try {
    if (!(await hasExpectedSignature(fileHandle, file))) {
      throw invalidFileType();
    }
  } finally {
    await fileHandle.close();
  }
}

module.exports = { validateDocumentFile };