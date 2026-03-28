import { useState, useMemo } from 'react';
import { calculateExposure } from '../lib/exposureCalculator';

function formatCurrency(value) {
  if (value == null) return '$0';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const ASSET_COLORS = {
  'Canadian equity': '#001E60',
  'US equity': '#0072CE',
  'International equity': '#8DD0EF',
  'Global equity': '#7A99AC',
  'Fixed income': '#00966C',
  'Real estate — private': '#ED8B00',
  'Real estate — listed': '#D4A843',
  'Cash & equivalents': '#A8C4D4',
  'Private alternatives': '#5B2C6F',
  'Other': '#BCBCBC',
};

const GEO_COLORS = {
  'Canada': '#001E60',
  'United States': '#0072CE',
  'Europe': '#00966C',
  'Japan': '#ED8B00',
  'Asia ex-Japan': '#8DD0EF',
  'Other/EM': '#7A99AC',
};

const EQUITY_TYPES = new Set(['Canadian equity', 'US equity', 'International equity', 'Global equity']);

function BarRow({ name, value, percent, color, grossAssets, indent, sourceNote }) {
  const maxPct = 60; // visual cap for bar width
  const barWidth = Math.min(percent, maxPct) / maxPct * 100;

  return (
    <div className={`flex items-center gap-3 py-1.5 ${indent ? 'pl-5' : ''}`}>
      <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className={`text-xs ${indent ? 'text-ig-grey' : 'font-medium text-ig-dark'} truncate`}>
            {name}
          </span>
          <div className="flex items-center gap-3 shrink-0 ml-2">
            <span className="text-xs font-semibold text-ig-dark">{formatCurrency(value)}</span>
            <span className="text-xs text-ig-grey w-12 text-right">{percent.toFixed(1)}%</span>
          </div>
        </div>
        <div className="h-1.5 bg-ig-pale rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${barWidth}%`, backgroundColor: color }}
          />
        </div>
        {sourceNote && (
          <p className="text-[10px] text-ig-grey mt-0.5 truncate">{sourceNote}</p>
        )}
      </div>
    </div>
  );
}

export default function ExposurePanel({ data, fundResearch }) {
  const [activeTab, setActiveTab] = useState('asset');

  const exposure = useMemo(
    () => calculateExposure(data, fundResearch),
    [data, fundResearch]
  );

  const { assetClasses, geographies, equityTotal, summaryChips, sources } = exposure;

  // Group equity sub-types under a single header
  const equityItems = assetClasses.filter((a) => EQUITY_TYPES.has(a.name));
  const nonEquityItems = assetClasses.filter((a) => !EQUITY_TYPES.has(a.name));

  return (
    <div className="bg-white rounded-xl border border-ig-grey/10 overflow-hidden print-break-avoid">
      {/* Tab bar */}
      <div className="flex border-b border-ig-grey/10">
        <button
          onClick={() => setActiveTab('asset')}
          className={`flex-1 py-2.5 text-xs font-semibold text-center transition-colors ${
            activeTab === 'asset'
              ? 'text-ig-dark border-b-2 border-ig-mid'
              : 'text-ig-grey hover:text-ig-dark'
          }`}
        >
          Asset class
        </button>
        <button
          onClick={() => setActiveTab('geo')}
          className={`flex-1 py-2.5 text-xs font-semibold text-center transition-colors ${
            activeTab === 'geo'
              ? 'text-ig-dark border-b-2 border-ig-mid'
              : 'text-ig-grey hover:text-ig-dark'
          }`}
        >
          Geography
        </button>
      </div>

      <div className="p-5">
        {/* Asset class tab */}
        {activeTab === 'asset' && (
          <div className="space-y-0.5">
            {/* Equity group */}
            {equityItems.length > 0 && (
              <div className="mb-2">
                <div className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#0072CE' }} />
                    <span className="text-xs font-bold text-ig-dark">Public equity</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-ig-dark">{formatCurrency(equityTotal.value)}</span>
                    <span className="text-xs font-bold text-ig-grey w-12 text-right">{equityTotal.percent.toFixed(1)}%</span>
                  </div>
                </div>
                {equityItems.map((item) => (
                  <BarRow
                    key={item.name}
                    name={item.name}
                    value={item.value}
                    percent={item.percent}
                    color={ASSET_COLORS[item.name] || '#BCBCBC'}
                    grossAssets={data.grossAssets}
                    indent
                    sourceNote={
                      item.sources?.length > 0
                        ? item.sources.map((s) => `${s.code} ${s.pct}%`).join(' · ')
                        : null
                    }
                  />
                ))}
              </div>
            )}

            {/* Non-equity items */}
            {nonEquityItems.map((item) => (
              <BarRow
                key={item.name}
                name={item.name}
                value={item.value}
                percent={item.percent}
                color={ASSET_COLORS[item.name] || '#BCBCBC'}
                grossAssets={data.grossAssets}
                sourceNote={
                  item.sources?.length > 0
                    ? item.sources.map((s) => `${s.code} ${s.pct}%`).join(' · ')
                    : null
                }
              />
            ))}

            {assetClasses.length === 0 && (
              <p className="text-xs text-ig-grey text-center py-4">No exposure data available.</p>
            )}
          </div>
        )}

        {/* Geography tab */}
        {activeTab === 'geo' && (
          <div className="space-y-0.5">
            {geographies.map((item) => (
              <BarRow
                key={item.name}
                name={item.name}
                value={item.value}
                percent={item.percent}
                color={GEO_COLORS[item.name] || '#BCBCBC'}
                grossAssets={data.grossAssets}
              />
            ))}

            {geographies.length === 0 && (
              <p className="text-xs text-ig-grey text-center py-4">
                Geographic data requires verified fund lookups.
              </p>
            )}
          </div>
        )}

        {/* Summary chips */}
        {summaryChips.length > 0 && (
          <div className="mt-4 pt-3 border-t border-ig-grey/10 grid grid-cols-2 gap-2">
            {summaryChips.map((chip) => (
              <div key={chip.label} className="bg-ig-pale rounded-lg px-3 py-2 text-center">
                <p className="text-[10px] text-ig-grey uppercase tracking-wide">{chip.label}</p>
                <p className="text-sm font-bold text-ig-dark">{formatCurrency(chip.value)}</p>
                <p className="text-[10px] text-ig-grey">{chip.percent.toFixed(1)}% of gross</p>
              </div>
            ))}
          </div>
        )}

        {/* Source attribution */}
        {sources.length > 0 && (
          <div className="mt-3 pt-2 border-t border-ig-grey/10">
            <p className="text-[10px] text-ig-grey leading-relaxed">
              {sources.map((s) => {
                if (s.verified && s.dataAsAt) {
                  return `${s.code} as at ${s.dataAsAt}`;
                }
                if (s.verified) {
                  return `${s.code} (verified)`;
                }
                return `${s.code} (unverified)`;
              }).join(' · ')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
