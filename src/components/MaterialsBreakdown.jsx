import LineItemDetail from './LineItemDetail';

const MATERIAL_CATEGORIES = [
  { key: 'walls', label: 'Walls/Fabrication', liKey: 'walls_line_items' },
  { key: 'flooring', label: 'Flooring', liKey: 'flooring_line_items' },
  { key: 'graphics', label: 'Graphics', liKey: 'graphics_line_items' },
  { key: 'av_lighting', label: 'AV & Lighting', liKey: 'av_lighting_line_items' },
  { key: 'furniture', label: 'Furniture', liKey: 'furniture_line_items' },
  { key: 'other', label: 'Other', liKey: 'other_line_items' }
];

export default function MaterialsBreakdown({ materials, formatCurrency, currency }) {
  return (
    <div className="breakdown-card">
      <div className="breakdown-title">Materials</div>
      {MATERIAL_CATEGORIES.map(cat => {
        const amount = materials?.[cat.key];
        if (!amount || amount <= 0) return null;
        return (
          <div key={cat.key}>
            <div className="breakdown-item">
              <span className="breakdown-item-label">{cat.label}</span>
              <span className="breakdown-item-value">{formatCurrency(amount)}</span>
            </div>
            <LineItemDetail currency={currency} lineItems={materials[cat.liKey]} />
          </div>
        );
      })}
      <div className="breakdown-item breakdown-subtotal">
        <span className="breakdown-item-label">Subtotal</span>
        <span className="breakdown-item-value">{formatCurrency(materials?.subtotal)}</span>
      </div>
    </div>
  );
}
