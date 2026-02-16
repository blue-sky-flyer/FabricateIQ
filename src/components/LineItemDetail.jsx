import { useState } from 'react';

export default function LineItemDetail({ lineItems, currency }) {
  const [open, setOpen] = useState(false);
  if (!lineItems || lineItems.length === 0) return null;

  const fmt = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'CAD',
    currencyDisplay: 'code',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

  return (
    <div>
      <button className="line-items-toggle" onClick={() => setOpen(!open)}>
        <span className={`arrow ${open ? 'open' : ''}`}>&#9654;</span>
        {open ? 'Hide' : 'Show'} {lineItems.length} line item{lineItems.length !== 1 ? 's' : ''}
      </button>
      {open && (
        <table className="line-items-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Dimensions</th>
              <th>Unit Price</th>
              <th>Conf</th>
              <th>Extended</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((li, i) => (
              <tr key={i}>
                <td>{li.item}</td>
                <td>{li.qty || ''}</td>
                <td>{li.dimensions || ''}</td>
                <td>{li.unit_price || ''}</td>
                <td>{li.confidence ? <span className={`conf-badge ${li.confidence}`}>{li.confidence}</span> : ''}</td>
                <td>{fmt.format(li.extended || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
