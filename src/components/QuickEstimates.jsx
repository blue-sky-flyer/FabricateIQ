import { useState } from 'react';

export default function QuickEstimates({ estimates, formatCurrency }) {
  const [showTemplates, setShowTemplates] = useState(false);

  if (!estimates) return null;

  return (
    <div className="card">
      <div className="collapsible-header" onClick={() => setShowTemplates(!showTemplates)}>
        <h3>Quick Estimates</h3>
        <span className={`collapsible-toggle ${showTemplates ? 'open' : ''}`}>&#9660;</span>
      </div>
      <div className={`collapsible-content ${showTemplates ? 'open' : ''}`}>
        <div className="template-estimates">
          <div className="template-card budget">
            <div className="template-tier">Budget</div>
            <div className="template-total">{formatCurrency(estimates.aggressive.total)}</div>
          </div>
          <div className="template-card standard">
            <div className="template-tier">Standard</div>
            <div className="template-total">{formatCurrency(estimates.middle.total)}</div>
          </div>
          <div className="template-card premium">
            <div className="template-tier">Premium</div>
            <div className="template-total">{formatCurrency(estimates.conservative.total)}</div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: '#86868b', textAlign: 'center' }}>
          Template-based estimates. Use AI Quote for detailed, calibrated pricing.
        </p>
      </div>
    </div>
  );
}
