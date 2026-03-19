import FileList from './FileList';

export default function FileUpload({ fileUpload, onError }) {
  const {
    files, description, setDescription, canAddMore, hasFiles,
    dragging, setDragging, fileInputRef,
    handleMultipleFiles, removeFile, clearAll
  } = fileUpload;

  const onDrop = async (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      try {
        await handleMultipleFiles(e.dataTransfer.files);
      } catch (err) {
        onError(err.message);
      }
    }
  };

  const onChange = async (e) => {
    if (e.target.files.length > 0) {
      try {
        await handleMultipleFiles(e.target.files);
      } catch (err) {
        onError(err.message);
      }
    }
    e.target.value = '';
  };

  return (
    <div className="upload-section">
      <label className="form-label">Upload (Optional)</label>

      {canAddMore && (
        <div
          className={`upload-zone ${dragging ? 'dragging' : ''}`}
          role="button"
          tabIndex={0}
          aria-label="Upload files — drop renderings or PDFs here, or click to browse"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            multiple
            onChange={onChange}
            style={{ display: 'none' }}
          />
          <div className="upload-icon">&#128196;</div>
          <p>Drop renderings or PDFs here</p>
          <p>Upload up to 3 files</p>
        </div>
      )}

      <FileList files={files} onRemove={removeFile} />

      {hasFiles && (
        <button className="btn-secondary upload-clear-btn" onClick={clearAll}>
          Clear All
        </button>
      )}

      <div className="form-group upload-description-group">
        <label className="form-label">Description (Optional)</label>
        <textarea
          className="description-input"
          placeholder="Describe the booth requirements or provide context about the uploaded files..."
          rows={3}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
    </div>
  );
}
