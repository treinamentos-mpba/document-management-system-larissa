import { useEffect, useState } from 'react';
import DocumentList from './components/DocumentList.jsx';
import UploadComponent from './components/UploadComponent.jsx';
import {
  downloadDocument,
  listDocuments,
  uploadDocument,
} from './services/documentsApi.js';
import './App.css';

const DEFAULT_USER_ID = 'usuario-123';

export default function App() {
  const [userId, setUserId] = useState(DEFAULT_USER_ID);
  const [userIdDraft, setUserIdDraft] = useState(DEFAULT_USER_ID);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [listError, setListError] = useState('');
  const [actionError, setActionError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setListError('');

    listDocuments(userId)
      .then((items) => {
        if (active) setDocuments(items);
      })
      .catch((error) => {
        if (active) setListError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId, refreshVersion]);

  function applyUserId(event) {
    event.preventDefault();
    const nextUserId = userIdDraft.trim();

    if (!nextUserId) {
      setActionError('Informe um identificador de usuário.');
      return;
    }

    setActionError('');
    setStatusMessage('');
    setUserId(nextUserId);
  }

  async function handleUpload(file) {
    setActionError('');
    setStatusMessage('');
    setUploading(true);

    try {
      const uploadedDocument = await uploadDocument(file, userId);
      setStatusMessage(`${uploadedDocument.originalName} enviado.`);
      setRefreshVersion((version) => version + 1);
      return true;
    } catch (error) {
      setActionError(error.message);
      return false;
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(selectedDocument) {
    setActionError('');
    setStatusMessage('');
    setDownloadingId(selectedDocument.id);

    try {
      const file = await downloadDocument(selectedDocument.id, userId);
      const objectUrl = URL.createObjectURL(file);
      const link = window.document.createElement('a');
      link.href = objectUrl;
      link.download = selectedDocument.originalName;
      window.document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setStatusMessage(`${selectedDocument.originalName} baixado.`);
    } catch (error) {
      setActionError(error.message);
    } finally {
      setDownloadingId(null);
    }
  }

  function refreshDocuments() {
    setRefreshVersion((version) => version + 1);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__inner">
          <a className="brand" href="#main" aria-label="DMS, início">
            <span className="brand__mark" aria-hidden="true">D</span>
            <span className="brand__name">DMS</span>
          </a>
          <span className="storage-indicator">
            <span className="storage-indicator__dot" />
            ARMAZENAMENTO LOCAL
          </span>
        </div>
      </header>

      <main className="workspace" id="main">
        <div className="page-heading">
          <div>
            <p className="eyebrow">DOCUMENTOS / ESPAÇO DE TRABALHO</p>
            <h1>Seus documentos</h1>
          </div>

          <form className="user-switcher" onSubmit={applyUserId}>
            <label htmlFor="user-id">ID de usuário (sem autenticação)</label>
            <div className="user-switcher__controls">
              <input
                id="user-id"
                type="text"
                autoComplete="off"
                value={userIdDraft}
                onChange={(event) => setUserIdDraft(event.target.value)}
              />
              <button
                className="button button--quiet"
                type="submit"
                disabled={!userIdDraft.trim() || userIdDraft.trim() === userId}
              >
                Aplicar
              </button>
            </div>
          </form>
        </div>

        {(actionError || statusMessage) && (
          <div
            className={`notice ${actionError ? 'notice--error' : 'notice--success'}`}
            role={actionError ? 'alert' : 'status'}
          >
            {actionError || statusMessage}
          </div>
        )}

        <div className="workspace-grid">
          <UploadComponent onUpload={handleUpload} uploading={uploading} />
          <DocumentList
            documents={documents}
            downloadingId={downloadingId}
            error={listError}
            loading={loading}
            onDownload={handleDownload}
            onRefresh={refreshDocuments}
          />
        </div>
      </main>

      <footer className="page-footer">
        <span>DMS</span>
        <span>Metadados mantidos durante a sessão do servidor</span>
      </footer>
    </div>
  );
}
