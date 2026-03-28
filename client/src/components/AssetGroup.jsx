import { useState } from 'react';
import AssetCard from './AssetCard';

function formatCurrency(value) {
  if (value == null) return '$0';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const CLASS_COLORS = {
  'Public equity': '#0072CE',
  'Private equity': '#001E60',
  'Cash': '#00966C',
  'Fixed income': '#7A99AC',
  'Real estate': '#ED8B00',
  'Insurance': '#8DD0EF',
  'Physical assets': '#7A99AC',
  'Other': '#7A99AC',
};

export default function AssetGroup({ group, grossAssets, fundResearch }) {
  const [expanded, setExpanded] = useState(true);

  const color = CLASS_COLORS[group.name] || CLASS_COLORS['Other'];
  const pct = grossAssets > 0 ? ((group.totalValue / grossAssets) * 100).toFixed(1) : '0.0';

  const flagBorder =
    group.concentrationFlag === 'high'
      ? 'border-l-ig-red'
      : group.concentrationFlag === 'moderate'
      ? 'border-l-ig-amber'
      : 'border-l-transparent';

  return (
    <div className={`bg-white rounded-xl border border-ig-grey/10 overflow-hidden print-break-avoid border-l-4 ${flagBorder}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-ig-pale/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          <h3 className="font-bold text-ig-dark text-sm">{group.name}</h3>
          {group.concentrationFlag === 'high' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-ig-red/10 text-ig-red font-semibold">
              🔴 High
            </span>
          )}
          {group.concentrationFlag === 'moderate' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-ig-amber/10 text-ig-amber font-semibold">
              🟡 Moderate
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-ig-dark">
            {formatCurrency(group.totalValue)}
          </span>
          <span className="text-xs text-ig-grey">{pct}%</span>
          <svg
            className={`w-4 h-4 text-ig-grey transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="asset-group-content divide-y divide-ig-pale">
          {(group.assets || []).map((asset, i) => (
            <AssetCard
              key={asset.id || i}
              asset={asset}
              grossAssets={grossAssets}
              fundResearch={fundResearch}
            />
          ))}
        </div>
      )}
    </div>
  );
}
