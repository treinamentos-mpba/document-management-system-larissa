import DownloadButton from './DownloadButton.jsx';
import { formatFileSize } from '../utils/formatFileSize.js';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function getFileType(name) {
  const extension = name.split('.').pop();
  return extension && extension !== name ? extension.toUpperCase() : 'ARQUIVO';
}

export default function DocumentList({
  documents,
  downloadingId,
  error,
  loading,
  onDownload,
  onRefresh,
}) {
  const sortedDocuments = [...documents].sort(
    (first, second) => new Date(second.uploadedAt) - new Date(first.uploadedAt),
  );

  return (
    <section className="documents-panel" aria-labelledby="documents-heading">
      <div className="section-heading section-heading--list">
        <div>
          <p className="eyebrow">BIBLIOTECA</p>
          <h2 id="documents-heading">Documentos</h2>
        </div>
        <div className="list-tools">
          <span className="document-count">
            {documents.length} {documents.length === 1 ? 'item' : 'itens'}
          </span>
          <button
            className="button button--quiet"
            type="button"
            onClick={onRefresh}
            disabled={loading}
          >
            Atualizar
          </button>
        </div>
      </div>

      {error && <p className="list-message list-message--error" role="alert">{error}</p>}
      {!error && loading && (
        <p className="list-message" role="status">Carregando documentos...</p>
      )}
      {!error && !loading && documents.length === 0 && (
        <p className="list-message empty-state">Nenhum documento para este usuário.</p>
      )}
      {!error && !loading && documents.length > 0 && (
        <div className="table-scroll">
          <table className="document-table">
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">Tipo</th>
                <th scope="col">Tamanho</th>
                <th scope="col">Enviado em</th>
                <th scope="col"><span className="visually-hidden">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {sortedDocuments.map((document) => (
                <tr key={document.id}>
                  <td className="document-name" title={document.originalName}>
                    {document.originalName}
                  </td>
                  <td><span className="file-type">{getFileType(document.originalName)}</span></td>
                  <td>{formatFileSize(document.size)}</td>
                  <td>{formatDate(document.uploadedAt)}</td>
                  <td className="document-action">
                    <DownloadButton
                      document={document}
                      downloading={downloadingId === document.id}
                      onDownload={onDownload}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}