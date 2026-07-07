import LineItemDetail from './LineItemDetail';

const SERVICE_CATEGORIES = [
  { label: 'Design & PM', amtKey: 'design_pm', pctKey: 'design_pm_percent', noteKey: 'design_pm_note', liKey: null },
  { label: 'Install & Dismantle', amtKey: 'install_dismantle', pctKey: 'install_dismantle_percent', liKey: 'install_dismantle_line_items' },
  { label: 'Logistics', amtKey: 'logistics', pctKey: 'logistics_percent', liKey: 'logistics_line_items' },
  { label: 'Storage', amtKey: 'storage', liKey: 'storage_line_items' }
];

export default function ServicesBreakdown({ services, formatCurrency, currency }) {
  return (
    <div className="breakdown-card">
      <div className="breakdown-title">Services</div>
      {SERVICE_CATEGORIES.map(svc => {
        const amount = services?.[svc.amtKey];
        if (!amount || amount <= 0) return null;
        const pct = svc.pctKey ? services?.[svc.pctKey] : null;
        return (
          <div key={svc.amtKey}>
            <div className="breakdown-item">
              <span className="breakdown-item-label">
                {svc.label} {pct ? `(${pct}%)` : ''}
              </span>
              <span className="breakdown-item-value">{formatCurrency(amount)}</span>
            </div>
            {svc.noteKey && services?.[svc.noteKey] && (
              <div className="service-note">{services[svc.noteKey]}</div>
            )}
            {svc.liKey && (
              <LineItemDetail currency={currency} lineItems={services?.[svc.liKey]} />
            )}
          </div>
        );
      })}
      <div className="breakdown-item breakdown-subtotal">
        <span className="breakdown-item-label">Subtotal</span>
        <span className="breakdown-item-value">{formatCurrency(services?.subtotal)}</span>
      </div>
    </div>
  );
}
