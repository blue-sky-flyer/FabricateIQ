export default function FileList({ files, onRemove }) {
  if (files.length === 0) return null;

  return (
    <div className="file-list">
      {files.map((file) => (
        <div key={file.id} className="file-item">
          {file.type === 'image' && file.previewUrl ? (
            <img src={file.previewUrl} alt={file.name} className="file-thumbnail" />
          ) : (
            <span className="file-thumbnail-icon">&#128196;</span>
          )}

          <span className="file-name" title={file.name}>
            {file.name}
          </span>

          {file.analyzing && <span className="file-spinner" />}

          {file.error && (
            <span className="file-error" role="alert" aria-label={file.error} title={file.error}>Error</span>
          )}

          <button
            className="file-remove-btn"
            onClick={() => onRemove(file.id)}
            title="Remove file"
          >
            &#10005;
          </button>
        </div>
      ))}
    </div>
  );
}
