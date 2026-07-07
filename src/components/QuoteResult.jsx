import MaterialsBreakdown from './MaterialsBreakdown';
import ServicesBreakdown from './ServicesBreakdown';
import QuoteSummary from './QuoteSummary';

export default function QuoteResult({ quote, formatCurrency, currency, onDownload }) {
  return (
    <div className="card">
      <div className="quote-result">
        <span className="quote-badge ai">AI-Powered Quote</span>
        <div className="quote-total">{formatCurrency(quote.total)}</div>
        <div className="quote-label">
          Estimated total including {((quote.tax_rate || 0) * 100).toFixed(1)}% tax
        </div>
        <span className={`confidence-badge ${quote.confidence || 'medium'}`}>
          {quote.confidence === 'high' ? '\u2713' : quote.confidence === 'low' ? '!' : '~'}
          {' '}{(quote.confidence || 'medium').charAt(0).toUpperCase() + (quote.confidence || 'medium').slice(1)} Confidence
        </span>
      </div>

      <div className="breakdown-section">
        <div className="breakdown-grid">
          <MaterialsBreakdown materials={quote.materials} formatCurrency={formatCurrency} currency={currency} />
          <ServicesBreakdown services={quote.services} formatCurrency={formatCurrency} currency={currency} />
        </div>

        <QuoteSummary quote={quote} formatCurrency={formatCurrency} />

        {quote.notes?.length > 0 && (
          <div className="notes-section">
            <div className="notes-title">Notes & Assumptions</div>
            <ul className="notes-list">
              {quote.notes.map((note, i) => <li key={i}>{note}</li>)}
            </ul>
          </div>
        )}
      </div>

      <button className="btn-secondary" onClick={onDownload} style={{ marginTop: 24 }}>
        Download Excel (.xlsx)
      </button>
    </div>
  );
}
