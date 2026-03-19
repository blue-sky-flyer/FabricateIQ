import { useState, useRef, useMemo } from 'react';
import { analyzeWithClaude } from '../services/api.js';

const MAX_FILES = 3;

/**
 * Resize image if larger than maxSizeBytes (Claude 5MB limit).
 */
function resizeImageIfNeeded(file, maxSizeBytes = 4.5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      const base64Size = dataUrl.split(',')[1].length * 0.75;

      if (base64Size <= maxSizeBytes) {
        resolve({ base64: dataUrl.split(',')[1], mediaType: file.type || 'image/jpeg' });
        return;
      }

      const img = new Image();
      img.onload = () => {
        const scaleFactor = Math.sqrt(maxSizeBytes / base64Size) * 0.9;
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(img.width * scaleFactor);
        canvas.height = Math.floor(img.height * scaleFactor);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve({ base64: resizedDataUrl.split(',')[1], mediaType: 'image/jpeg' });
      };
      img.onerror = () => reject(new Error('Failed to load image for resizing'));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Extract text from all pages of a PDF using pdfjs-dist.
 */
async function extractPdfText(file) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/lib/pdf.worker.min.js';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    fullText += textContent.items.map(item => item.str).join(' ') + '\n';
  }

  return fullText;
}

export function useFileUpload(updateEstimates) {
  const [files, setFiles] = useState([]);
  const [description, setDescription] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  const allPdfText = useMemo(() =>
    files
      .filter(f => f.pdfText)
      .map(f => `--- ${f.name} ---\n${f.pdfText}`)
      .join('\n\n'),
    [files]
  );

  const hasFiles = files.length > 0;
  const anyAnalyzing = files.some(f => f.analyzing);
  const hasPdfText = files.some(f => f.pdfText);
  const canAddMore = files.length < MAX_FILES;

  const handleFileUpload = async (file) => {
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
      throw new Error('Please upload an image (JPG, PNG) or PDF file');
    }

    const id = crypto.randomUUID();
    const isImage = file.type.startsWith('image/');
    const entry = {
      id,
      name: file.name,
      type: isImage ? 'image' : 'pdf',
      previewUrl: isImage ? URL.createObjectURL(file) : null,
      pdfText: null,
      analyzing: true,
      error: null
    };

    setFiles(prev => [...prev, entry]);

    try {
      if (isImage) {
        const { base64, mediaType } = await resizeImageIfNeeded(file);
        const extracted = await analyzeWithClaude(base64, null, mediaType);
        setFiles(prev => prev.map(f =>
          f.id === id ? { ...f, analyzing: false } : f
        ));
        updateEstimates(extracted);
      } else {
        const text = await extractPdfText(file);
        const extracted = await analyzeWithClaude(null, text);
        setFiles(prev => prev.map(f =>
          f.id === id ? { ...f, pdfText: text, analyzing: false } : f
        ));
        updateEstimates(extracted);
      }
    } catch (err) {
      setFiles(prev => prev.map(f =>
        f.id === id ? { ...f, analyzing: false, error: err.message } : f
      ));
    }
  };

  const handleMultipleFiles = async (fileList) => {
    const incoming = Array.from(fileList);
    const available = MAX_FILES - files.length;

    if (available === 0) {
      throw new Error(`Maximum ${MAX_FILES} files already uploaded.`);
    }

    const toProcess = incoming.slice(0, available);
    const dropped = incoming.length - toProcess.length;

    const errors = [];
    for (const file of toProcess) {
      try {
        await handleFileUpload(file);
      } catch (err) {
        errors.push(err.message);
      }
    }

    if (dropped > 0) {
      const msg = `${dropped} file(s) skipped — maximum ${MAX_FILES} total.`;
      if (errors.length > 0) {
        throw new Error([...errors, msg].join('; '));
      }
      throw new Error(msg);
    }
    if (errors.length > 0) {
      throw new Error(errors.join('; '));
    }
  };

  const removeFile = (id) => {
    setFiles(prev => {
      const target = prev.find(f => f.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const clearAll = () => {
    files.forEach(f => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    setFiles([]);
    setDescription('');
  };

  return {
    files,
    description,
    setDescription,
    dragging,
    setDragging,
    fileInputRef,
    handleFileUpload,
    handleMultipleFiles,
    removeFile,
    clearAll,
    allPdfText,
    hasFiles,
    anyAnalyzing,
    hasPdfText,
    canAddMore
  };
}
