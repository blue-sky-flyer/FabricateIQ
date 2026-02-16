export default function QuoteSummary({ quote, formatCurrency }) {
  return (
    <div style={{ marginTop: 24 }}>
      {quote.contingency > 0 && (
        <div className="summary-row">
          <span>Contingency</span>
          <span>{formatCurrency(quote.contingency)}</span>
        </div>
      )}
      <div className="summary-row">
        <span>Subtotal</span>
        <span>{formatCurrency(quote.subtotal_before_tax)}</span>
      </div>
      <div className="summary-row">
        <span>Tax ({((quote.tax_rate || 0) * 100).toFixed(2)}%)</span>
        <span>{formatCurrency(quote.tax_amount)}</span>
      </div>
      <div className="summary-row total">
        <span>Total</span>
        <span>{formatCurrency(quote.total)}</span>
      </div>
    </div>
  );
}
