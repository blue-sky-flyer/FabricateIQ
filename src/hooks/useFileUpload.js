import { useState, useRef } from 'react';
import { analyzeWithClaude } from '../services/api.js';

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
  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploadedPDF, setUploadedPDF] = useState(null);
  const [pdfText, setPdfText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleImageUpload = async (file) => {
    if (!file) return;
    setAnalyzing(true);
    setUploadedImage(URL.createObjectURL(file));

    try {
      const { base64, mediaType } = await resizeImageIfNeeded(file);
      const extracted = await analyzeWithClaude(base64, pdfText, mediaType);
      updateEstimates(extracted);
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePdfUpload = async (file) => {
    if (!file) return;
    setAnalyzing(true);
    setUploadedPDF(file.name);

    try {
      const text = await extractPdfText(file);
      setPdfText(text);
      const extracted = await analyzeWithClaude(null, text);
      updateEstimates(extracted);
    } catch {
      setUploadedPDF(null);
      setPdfText('');
      throw new Error('Error analyzing PDF');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileUpload = (file) => {
    if (!file) return;
    if (file.type === 'application/pdf') return handlePdfUpload(file);
    if (file.type.startsWith('image/')) return handleImageUpload(file);
    throw new Error('Please upload an image (JPG, PNG) or PDF file');
  };

  const clearPdf = () => {
    setUploadedPDF(null);
    setPdfText('');
  };

  return {
    uploadedImage,
    uploadedPDF,
    pdfText,
    analyzing,
    dragging, setDragging,
    fileInputRef,
    handleFileUpload,
    clearPdf
  };
}
