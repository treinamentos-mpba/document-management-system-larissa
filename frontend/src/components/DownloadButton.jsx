export default function DownloadButton({ document, downloading, onDownload }) {
  return (
    <button
      className="button button--download"
      type="button"
      onClick={() => onDownload(document)}
      disabled={downloading}
      aria-label={`Baixar ${document.originalName}`}
    >
      {downloading ? 'Baixando...' : 'Baixar'}
    </button>
  );
}