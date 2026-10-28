import { useId, useRef, useState } from 'react';
import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
} from '../services/documentsApi.js';
import { formatFileSize } from '../utils/formatFileSize.js';

export default function UploadComponent({ onUpload, uploading }) {
  const inputId = useId();
  const inputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [validationError, setValidationError] = useState('');

  function selectFile(event) {
    const file = event.target.files?.[0];
    setValidationError('');
    setSelectedFile(null);

    if (!file) return;

    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setValidationError('Formato não permitido. Escolha PDF, DOC, DOCX ou TXT.');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setValidationError('O arquivo deve ter no máximo 10 MiB.');
      return;
    }

    setSelectedFile(file);
  }

  async function submitUpload(event) {
    event.preventDefault();
    if (!selectedFile || uploading) return;

    const uploaded = await onUpload(selectedFile);
    if (!uploaded) return;

    setSelectedFile(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <section className="upload-panel" aria-labelledby="upload-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">ADICIONAR</p>
          <h2 id="upload-heading">Enviar documento</h2>
        </div>
      </div>

      <form className="upload-form" onSubmit={submitUpload}>
        <label className="file-picker" htmlFor={inputId}>
          <input
            ref={inputRef}
            id={inputId}
            className="file-picker__input"
            type="file"
            accept={ALLOWED_EXTENSIONS.join(',')}
            onChange={selectFile}
            disabled={uploading}
          />
          <span className="file-picker__icon" aria-hidden="true">+</span>
          <span className="file-picker__label">
            {selectedFile ? 'Alterar arquivo' : 'Selecionar arquivo'}
          </span>
          <span className="file-picker__detail">
            {selectedFile ? selectedFile.name : 'PDF, DOC, DOCX ou TXT'}
          </span>
        </label>

        {selectedFile && (
          <p className="file-meta">
            <span>{selectedFile.name}</span>
            <span>{formatFileSize(selectedFile.size)}</span>
          </p>
        )}

        <p className="upload-limit">Tamanho máximo: 10 MiB</p>

        {validationError && (
          <p className="field-error" role="alert">{validationError}</p>
        )}

        <button
          className="button button--primary upload-submit"
          type="submit"
          disabled={!selectedFile || uploading}
        >
          {uploading ? 'Enviando...' : 'Enviar documento'}
        </button>
      </form>
    </section>
  );
}