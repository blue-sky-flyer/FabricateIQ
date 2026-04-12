import { useState, useCallback } from 'react';
import Header from './components/Header';
import ErrorBanner from './components/ErrorBanner';
import BoothForm from './components/BoothForm';
import FileUpload from './components/FileUpload';
import QuoteResult from './components/QuoteResult';
import QuickEstimates from './components/QuickEstimates';
import ChatPanel from './components/ChatPanel';
import { useBoothForm } from './hooks/useBoothForm';
import { useQuote } from './hooks/useQuote';
import { useChat } from './hooks/useChat';
import { useFileUpload } from './hooks/useFileUpload';
import { downloadQuote } from './services/excelExport';
import { fetchVendors } from './services/api';

export default function App() {
  const [error, setError] = useState('');
  const form = useBoothForm();
  const { aiQuote, setAiQuote, loadingAiQuote, quoteVersions, setQuoteVersions, truncationWarning, getAIQuote } = useQuote();
  const chat = useChat(aiQuote, setAiQuote, setQuoteVersions);
  const fileUpload = useFileUpload(form.updateEstimates);

  const formatCurrency = useCallback((value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: form.getCurrency(),
      currencyDisplay: 'code',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  }, [form.getCurrency]);

  const handleGenerateQuote = async () => {
    setError('');
    try {
      await getAIQuote({
        pdfText: fileUpload.allPdfText,
        description: fileUpload.description,
        width: form.width,
        length: form.length,
        location: form.location,
        indoor: form.indoor,
        duration: form.duration,
        groundLevel: form.groundLevel,
        getCurrency: form.getCurrency
      });
      chat.resetChat();
    } catch (err) {
      setError('AI Quote failed: ' + err.message);
    }
  };

  const handleDownload = async () => {
    try {
      const sustainabilityData = aiQuote?.sustainability_enhancements?.length > 0
        ? { enhancements: aiQuote.sustainability_enhancements, summary: aiQuote.sustainability_summary }
        : null;
      const vendorData = await fetchVendors(form.location);
      await downloadQuote(aiQuote, {
        width: form.width,
        length: form.length,
        location: form.location,
        duration: form.duration,
        getCurrency: form.getCurrency,
        sustainabilityData,
        vendorData
      });
    } catch (err) {
      setError('Download failed: ' + err.message);
    }
  };

  return (
    <div className="container">
      <Header />
      <ErrorBanner message={error} />
      {truncationWarning && (
        <ErrorBanner message="Warning: PDF content was too large and some data may have been truncated." />
      )}

      <BoothForm form={form} fileUpload={fileUpload} />
      <FileUpload fileUpload={fileUpload} onError={setError} />

      <button
        className="btn-primary"
        onClick={handleGenerateQuote}
        disabled={loadingAiQuote}
        style={{ marginTop: 24, marginBottom: 24 }}
      >
        {loadingAiQuote ? 'Generating Quote...' : 'Generate AI Quote'}
      </button>

      {loadingAiQuote && (
        <div className="card">
          <div className="loading-state">
            <div className="spinner"></div>
            <p className="loading-text">AI is analyzing your specifications...</p>
          </div>
        </div>
      )}

      {aiQuote && !loadingAiQuote && (
        <QuoteResult
          quote={aiQuote}
          formatCurrency={formatCurrency}
          currency={form.getCurrency()}
          onDownload={handleDownload}
        />
      )}

      <QuickEstimates estimates={form.estimates} formatCurrency={formatCurrency} />

      {/* Chat FAB */}
      {aiQuote && !chat.showChat && (
        <button className="chat-fab" onClick={() => chat.setShowChat(true)}>
          &#128172; Adjust Quote
        </button>
      )}

      <ChatPanel chat={chat} quoteVersions={quoteVersions} />
    </div>
  );
}
