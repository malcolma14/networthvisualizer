import { useState, useMemo, useEffect } from 'react';
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

const GEO_COLORS = {
  'Canada': '#001E60',
  'United States': '#0072CE',
  'Europe': '#00966C',
  'Japan': '#ED8B00',
  'Asia ex-Japan': '#8DD0EF',
  'Other/EM': '#7A99AC',
};

const SUB_COLORS = {
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

/* ─── Donut Chart ─── */
function polarToCartesian(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function DonutChart({ slices, size = 220, onSliceClick, activeSlice, label }) {
  const cx = size / 2, cy = size / 2, outerR = size / 2 - 8, innerR = outerR * 0.58;
  let startAngle = 0;

  const paths = slices.map((s, i) => {
    const sweep = (s.percent / 100) * 360;
    if (sweep < 0.1) { startAngle += sweep; return null; }
    const os = polarToCartesian(cx, cy, outerR, startAngle);
    const oe = polarToCartesian(cx, cy, outerR, startAngle + sweep);
    const is_ = polarToCartesian(cx, cy, innerR, startAngle + sweep);
    const ie = polarToCartesian(cx, cy, innerR, startAngle);
    const la = sweep > 180 ? 1 : 0;
    const d = `M ${os.x} ${os.y} A ${outerR} ${outerR} 0 ${la} 1 ${oe.x} ${oe.y} L ${is_.x} ${is_.y} A ${innerR} ${innerR} 0 ${la} 0 ${ie.x} ${ie.y} Z`;
    const isActive = activeSlice === s.name;
    startAngle += sweep;
    return (
      <path
        key={i}
        d={d}
        fill={s.color}
        opacity={activeSlice && !isActive ? 0.35 : 1}
        className="cursor-pointer transition-opacity"
        onClick={() => onSliceClick?.(s.name)}
      />
    );
  });

  const labelLine1 = label?.[0] || 'Wealth';
  const labelLine2 = label?.[1] || 'allocation';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto transition-all duration-300">
      {paths}
      <text x={cx} y={cy - 6} textAnchor="middle" className="fill-ig-dark text-[10px] font-semibold">{labelLine1}</text>
      <text x={cx} y={cy + 8} textAnchor="middle" className="fill-ig-dark text-[10px] font-semibold">{labelLine2}</text>
    </svg>
  );
}

/* ─── Bar Row ─── */
function BarRow({ name, value, percent, color, indent }) {
  const maxPct = 60;
  const barWidth = Math.min(percent, maxPct) / maxPct * 100;
  return (
    <div className={`flex items-center gap-3 py-1.5 ${indent ? 'pl-6' : ''}`}>
      <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className={`text-xs ${indent ? 'text-ig-grey' : 'font-medium text-ig-dark'} truncate`}>{name}</span>
          <div className="flex items-center gap-3 shrink-0 ml-2">
            <span className="text-xs font-semibold text-ig-dark">{formatCurrency(value)}</span>
            <span className="text-xs text-ig-grey w-12 text-right">{percent.toFixed(1)}%</span>
          </div>
        </div>
        <div className="h-1.5 bg-ig-pale rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${barWidth}%`, backgroundColor: color }} />
        </div>
      </div>
    </div>
  );
}

/* ─── Main Panel ─── */
export default function ExposurePanel({ data, fundResearch, activeOwner = 'All' }) {
  const [activeTab, setActiveTab] = useState('asset');
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [drillDownView, setDrillDownView] = useState('fund'); // 'fund' | 'asset'

  useEffect(() => { setExpandedGroup(null); }, [activeOwner]);

  const exposure = useMemo(() => calculateExposure(data, fundResearch, activeOwner), [data, fundResearch, activeOwner]);
  const { grossAssets, unverifiedValue, broadGroups, geographies, summaryChips, sources, distributions, fees } = exposure;

  const donutSlices = broadGroups.map((g) => ({ name: g.name, percent: g.percent, color: g.color }));

  // When drilling down, recalculate percentages relative to the parent group total
  const activeSlices = expandedGroup
    ? (() => {
        const group = broadGroups.find(g => g.name === expandedGroup);
        if (!group) return donutSlices;
        if (drillDownView === 'fund' && group.funds && group.funds.length > 0) {
          // Fund-level slices
          const groupTotal = group.value;
          const FUND_COLORS = ['#001E60', '#0072CE', '#8DD0EF', '#00966C', '#ED8B00', '#D4A843', '#7A99AC', '#5B2C6F', '#A8C4D4', '#BCBCBC'];
          return group.funds.map((fund, i) => ({
            name: fund.name,
            percent: groupTotal > 0 ? (fund.value / groupTotal) * 100 : 0,
            color: FUND_COLORS[i % FUND_COLORS.length],
            value: fund.value,
          }));
        }
        // Asset class sub-type slices
        const groupTotal = group.value;
        return (group.children ?? []).map(child => ({
          name: child.name,
          percent: groupTotal > 0 ? (child.value / groupTotal) * 100 : 0,
          color: SUB_COLORS[child.name] || '#BCBCBC',
          value: child.value,
        }));
      })()
    : donutSlices;

  const donutLabel = expandedGroup
    ? [expandedGroup.length > 12 ? expandedGroup.slice(0, 12) + '…' : expandedGroup, 'breakdown']
    : null;

  function handleSliceClick(name) {
    if (expandedGroup) {
      // Already in drill-down — clicks on child slices do nothing
      return;
    }
    setExpandedGroup((prev) => (prev === name ? null : name));
    setActiveTab('asset');
  }

  return (
    <div className="space-y-4">
      {/* Donut chart card */}
      <div className="bg-white rounded-xl border border-ig-grey/10 p-5 print-break-avoid">
        <h3 className="text-sm font-bold text-ig-dark mb-4">Wealth allocation</h3>
        <DonutChart slices={activeSlices} onSliceClick={handleSliceClick} activeSlice={expandedGroup ? null : expandedGroup} label={donutLabel} />
        {expandedGroup && (
          <button
            onClick={() => setExpandedGroup(null)}
            className="block mx-auto mt-2 text-xs text-ig-mid hover:text-ig-dark transition-colors"
          >
            ← All asset classes
          </button>
        )}

        {/* Legend */}
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1">
          {broadGroups.map((g) => (
            <button
              key={g.name}
              onClick={() => handleSliceClick(g.name)}
              className={`flex items-center gap-1.5 text-xs py-0.5 text-left transition-opacity ${expandedGroup && expandedGroup !== g.name ? 'opacity-40' : ''}`}
            >
              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: g.color }} />
              <span className="text-ig-dark truncate">{g.name}</span>
              <span className="text-ig-grey font-medium ml-auto">{g.percent.toFixed(1)}%</span>
            </button>
          ))}
        </div>

        {/* Summary chips */}
        {summaryChips.length > 0 && (
          <div className="mt-4 pt-3 border-t border-ig-grey/10 grid grid-cols-2 gap-2">
            {summaryChips.map((chip) => (
              <div key={chip.label} className="bg-ig-pale rounded-lg px-3 py-2 text-center">
                <p className="text-[10px] text-ig-grey uppercase tracking-wide">{chip.label}</p>
                <p className="text-sm font-bold text-ig-dark">{formatCurrency(chip.value)}</p>
                <p className="text-[10px] text-ig-grey">{chip.percent.toFixed(1)}%</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabbed detail: Asset class / Geography */}
      <div className="bg-white rounded-xl border border-ig-grey/10 overflow-hidden print-break-avoid">
        <div className="flex border-b border-ig-grey/10">
          {['asset', 'geo'].map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setExpandedGroup(null); }}
              className={`flex-1 py-2.5 text-xs font-semibold text-center transition-colors ${
                activeTab === tab ? 'text-ig-dark border-b-2 border-ig-mid' : 'text-ig-grey hover:text-ig-dark'
              }`}
            >
              {tab === 'asset' ? 'Asset class' : 'Geography'}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === 'asset' && (
            <div className="space-y-0.5">
              {broadGroups.map((group) => {
                const isExpanded = expandedGroup === group.name;
                const hasFunds = group.funds && group.funds.length > 0;
                const hasAssetChildren = group.children.length > 1;
                const canExpand = hasFunds || hasAssetChildren;
                const groupTotal = group.value;
                const FUND_COLORS = ['#001E60', '#0072CE', '#8DD0EF', '#00966C', '#ED8B00', '#D4A843', '#7A99AC', '#5B2C6F', '#A8C4D4', '#BCBCBC'];
                return (
                  <div key={group.name}>
                    <button
                      onClick={() => canExpand && handleSliceClick(group.name)}
                      className={`w-full ${canExpand ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <BarRow name={group.name} value={group.value} percent={group.percent} color={group.color} />
                    </button>
                    {isExpanded && canExpand && (
                      <div className="mb-2">
                        {/* Toggle between fund and asset class views */}
                        {hasFunds && hasAssetChildren && (
                          <div className="flex gap-1 px-6 py-1.5 mb-1">
                            <button
                              onClick={() => setDrillDownView('fund')}
                              className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-colors ${
                                drillDownView === 'fund' ? 'bg-ig-mid text-white' : 'bg-ig-pale text-ig-grey hover:text-ig-dark'
                              }`}
                            >
                              By fund
                            </button>
                            <button
                              onClick={() => setDrillDownView('asset')}
                              className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-colors ${
                                drillDownView === 'asset' ? 'bg-ig-mid text-white' : 'bg-ig-pale text-ig-grey hover:text-ig-dark'
                              }`}
                            >
                              By asset class
                            </button>
                          </div>
                        )}
                        {drillDownView === 'fund' && hasFunds ? (
                          group.funds.map((fund, i) => (
                            <BarRow
                              key={fund.code || fund.name}
                              name={fund.name}
                              value={fund.value}
                              percent={groupTotal > 0 ? (fund.value / groupTotal) * 100 : 0}
                              color={FUND_COLORS[i % FUND_COLORS.length]}
                              indent
                            />
                          ))
                        ) : (
                          group.children.map((child) => (
                            <BarRow
                              key={child.name}
                              name={child.name}
                              value={child.value}
                              percent={groupTotal > 0 ? (child.value / groupTotal) * 100 : 0}
                              color={SUB_COLORS[child.name] || '#BCBCBC'}
                              indent
                            />
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {unverifiedValue > 0 && (
                <div className="mt-2 px-3 py-2 bg-amber-50 border border-ig-amber/20 rounded-lg flex items-center gap-2 text-xs text-ig-amber">
                  <span>⚠</span>
                  <span>{formatCurrency(unverifiedValue)} in unverified holdings excluded from allocation — see badges below</span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'geo' && (
            <div className="space-y-0.5">
              {geographies.map((item) => (
                <BarRow key={item.name} name={item.name} value={item.value} percent={item.percent} color={GEO_COLORS[item.name] || '#BCBCBC'} />
              ))}
              {geographies.length === 0 && (
                <p className="text-xs text-ig-grey text-center py-4">Geographic data requires verified fund lookups.</p>
              )}
            </div>
          )}
        </div>

        {/* Source attribution */}
        {sources.length > 0 && (
          <div className="px-4 pb-3 border-t border-ig-grey/10 pt-2">
            <div className="flex flex-wrap gap-x-2 gap-y-1 text-[10px] leading-relaxed">
              {sources.map((s) =>
                s.verified ? (
                  <span key={s.code} className="text-ig-grey">
                    {s.code}{s.dataAsAt ? ` as at ${s.dataAsAt}` : ''}
                  </span>
                ) : (
                  <span key={s.code} className="inline-flex items-center gap-0.5">
                    <span className="text-ig-grey">{s.code}</span>
                    <span className="text-[9px] text-ig-amber font-medium">⚠ Unverified</span>
                  </span>
                )
              )}
            </div>
            <p className="text-[9px] text-ig-grey mt-1 italic">Allocation data sourced from FundLibrary via web search</p>
          </div>
        )}
      </div>

      {/* Distributions & Fees */}
      {(distributions.holdings.length > 0 || fees.holdings.length > 0) && (
        <DistributionsFeesPanel distributions={distributions} fees={fees} grossAssets={grossAssets} />
      )}
    </div>
  );
}

/* ─── Distributions & Fees Sub-panel ─── */
function DistributionsFeesPanel({ distributions, fees, grossAssets }) {
  const [expanded, setExpanded] = useState(null); // 'dist' | 'fees' | null

  return (
    <div className="bg-white rounded-xl border border-ig-grey/10 overflow-hidden print-break-avoid">
      {/* Distributions header */}
      <button
        onClick={() => setExpanded((p) => (p === 'dist' ? null : 'dist'))}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-ig-pale/50 transition-colors border-b border-ig-grey/10"
      >
        <span className="text-sm font-bold text-ig-dark">Expected distributions</span>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-ig-green">{formatCurrency(distributions.total)}/yr</span>
          {grossAssets > 0 && (
            <span className="text-xs text-ig-grey">{((distributions.total / grossAssets) * 100).toFixed(2)}%</span>
          )}
          <svg className={`w-4 h-4 text-ig-grey transition-transform ${expanded === 'dist' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded === 'dist' && (
        <div className="px-5 py-2 divide-y divide-ig-pale">
          {distributions.holdings.map((h, i) => (
            <div key={i} className="py-2 flex items-center justify-between text-xs">
              <div>
                <p className="font-medium text-ig-dark">{h.name}</p>
                <p className="text-ig-grey">
                  {h.isPrivate
                    ? `Gross: ${formatCurrency(h.grossRent)} — Exp: ${formatCurrency(h.expenses)}`
                    : `${h.yield.toFixed(2)}% yield · ${h.frequency}`}
                </p>
              </div>
              <span className="font-semibold text-ig-green">{formatCurrency(h.annualDist)}/yr</span>
            </div>
          ))}
          {distributions.holdings.length === 0 && (
            <p className="py-3 text-xs text-ig-grey text-center">No distribution data available.</p>
          )}
        </div>
      )}

      {/* Fees header */}
      <button
        onClick={() => setExpanded((p) => (p === 'fees' ? null : 'fees'))}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-ig-pale/50 transition-colors"
      >
        <span className="text-sm font-bold text-ig-dark">Expected fees (MER)</span>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-ig-red">{formatCurrency(fees.total)}/yr</span>
          {fees.weightedMER > 0 && (
            <span className="text-xs text-ig-grey">{fees.weightedMER.toFixed(2)}% wtd avg</span>
          )}
          <svg className={`w-4 h-4 text-ig-grey transition-transform ${expanded === 'fees' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded === 'fees' && (
        <div className="px-5 py-2 divide-y divide-ig-pale">
          {fees.holdings.map((h, i) => (
            <div key={i} className="py-2 flex items-center justify-between text-xs">
              <div>
                <p className="font-medium text-ig-dark">{h.name}</p>
                <p className="text-ig-grey">MER: {h.mer.toFixed(2)}% · on {formatCurrency(h.value)}</p>
              </div>
              <span className="font-semibold text-ig-red">{formatCurrency(h.annualFee)}/yr</span>
            </div>
          ))}
          {fees.holdings.length === 0 && (
            <p className="py-3 text-xs text-ig-grey text-center">No MER data available.</p>
          )}
        </div>
      )}
    </div>
  );
}
