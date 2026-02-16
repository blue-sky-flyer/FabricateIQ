export default function FileUpload({ fileUpload, onError }) {
  const { uploadedImage, uploadedPDF, analyzing, dragging, setDragging, fileInputRef, handleFileUpload, clearPdf } = fileUpload;

  const onDrop = async (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files[0]) {
      try {
        await handleFileUpload(e.dataTransfer.files[0]);
      } catch (err) {
        onError(err.message);
      }
    }
  };

  const onChange = async (e) => {
    if (e.target.files[0]) {
      try {
        await handleFileUpload(e.target.files[0]);
      } catch (err) {
        onError(err.message);
      }
    }
  };

  return (
    <div style={{ marginTop: 32 }}>
      <label className="form-label">Upload (Optional)</label>
      <div
        className={`upload-zone ${dragging ? 'dragging' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          onChange={onChange}
          style={{ display: 'none' }}
        />
        {analyzing ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p className="loading-text">Analyzing file...</p>
          </div>
        ) : (
          <>
            <div className="upload-icon">&#128196;</div>
            <p>Drop rendering or PDF here</p>
            <p>or click to browse</p>
          </>
        )}
      </div>

      {uploadedImage && (
        <img src={uploadedImage} alt="Booth rendering" className="preview-img" />
      )}

      {uploadedPDF && (
        <div className="pdf-badge">
          &#128196; {uploadedPDF}
          <button
            className="clear-pdf-btn"
            onClick={(e) => { e.stopPropagation(); clearPdf(); }}
            title="Clear PDF and edit manually"
          >
            &#10005;
          </button>
        </div>
      )}
    </div>
  );
}
