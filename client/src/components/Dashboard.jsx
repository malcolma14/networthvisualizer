import { useState } from 'react';
import AssetGroup from './AssetGroup';
import SummaryPanel from './SummaryPanel';
import ExposurePanel from './ExposurePanel';
import PrintButton from './PrintButton';

function formatCurrency(value) {
  if (value == null) return '$0';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function Dashboard({ data, fundResearch, onReset }) {
  const [activeOwner, setActiveOwner] = useState('All');
  const owners = ['All', ...(data.owners || [])];

  function filterByOwner(assetClasses) {
    if (activeOwner === 'All') return assetClasses;
    return assetClasses
      .map((group) => {
        const filtered = group.assets.filter(
          (a) =>
            a.owner === activeOwner ||
            a.owner === 'Joint' ||
            a.owner?.toLowerCase() === activeOwner.toLowerCase()
        );
        if (filtered.length === 0) return null;
        const totalValue = filtered.reduce((sum, a) => sum + (a.value || 0), 0);
        return { ...group, assets: filtered, totalValue };
      })
      .filter(Boolean);
  }

  const filteredClasses = filterByOwner(data.assetClasses || []);

  const today = new Date().toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="dashboard-container min-h-screen bg-ig-pale">
      {/* Top bar */}
      <div className="no-print bg-ig-dark text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-bold text-sm">Net Worth Dashboard</h1>
          <span className="text-ig-light text-xs">IG Wealth Management</span>
        </div>
        <div className="flex items-center gap-3">
          <PrintButton />
          <button onClick={onReset} className="text-xs text-ig-light hover:text-white transition-colors">
            Start over
          </button>
        </div>
      </div>

      <div id="dashboard-print-area" className="max-w-[1400px] mx-auto px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-end justify-between mb-1">
            <div>
              <h2 className="text-2xl font-bold text-ig-dark">Net worth statement</h2>
              <p className="text-ig-grey text-sm">
                {data.clientName || 'Client'} &middot; {data.preparedDate || today}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-ig-grey">Total net worth</p>
              <p className="text-3xl font-bold text-ig-dark">{formatCurrency(data.netWorth)}</p>
            </div>
          </div>
          <div className="h-px bg-ig-dark/10 mt-3" />
        </div>

        {/* Owner filter */}
        <div className="no-print flex gap-2 mb-5 flex-wrap">
          {owners.map((owner) => (
            <button
              key={owner}
              onClick={() => setActiveOwner(owner)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                activeOwner === owner
                  ? 'bg-ig-dark text-white border-ig-dark'
                  : 'bg-white text-ig-dark border-ig-grey/30 hover:border-ig-mid'
              }`}
            >
              {owner}
            </button>
          ))}
        </div>

        {/* Two-column layout: Exposure (left, dominant) | Account details (right, compact) */}
        <div className="dashboard-grid grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          {/* LEFT — Wealth allocation, exposure, distributions, fees */}
          <ExposurePanel data={data} fundResearch={fundResearch} />

          {/* RIGHT — Account details + net worth summary */}
          <div className="space-y-3">
            <SummaryPanel data={data} />

            <div className="space-y-2">
              <h3 className="text-xs font-bold text-ig-grey uppercase tracking-wide px-1">Account details</h3>
              {filteredClasses.length > 0 ? (
                filteredClasses.map((group, i) => (
                  <AssetGroup
                    key={group.name || i}
                    group={group}
                    grossAssets={data.grossAssets}
                    fundResearch={fundResearch}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-ig-grey text-xs">
                  No assets found for this owner.
                </div>
              )}

              {/* Liabilities */}
              {data.liabilities && data.liabilities.length > 0 && (
                <div className="bg-white rounded-xl border border-ig-grey/10 overflow-hidden print-break-avoid">
                  <div className="px-4 py-2.5 bg-ig-grey/10 flex items-center justify-between">
                    <h3 className="font-bold text-ig-dark text-xs">Liabilities</h3>
                    <span className="text-xs font-semibold text-ig-red">
                      {formatCurrency(data.liabilities.reduce((s, l) => s + (l.value || 0), 0))}
                    </span>
                  </div>
                  <div className="divide-y divide-ig-pale">
                    {data.liabilities.map((l, i) => (
                      <div key={i} className="px-4 py-2 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-ig-dark">{l.name}</p>
                          <p className="text-[10px] text-ig-grey">{l.owner}</p>
                        </div>
                        <p className="text-xs font-semibold text-ig-red">{formatCurrency(l.value)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-ig-dark/10 text-xs text-ig-grey text-center">
          <p>Prepared by Adam Malcolm, CFP, MFA-P &middot; IG Wealth Management &middot; {today}</p>
          <p className="mt-0.5 italic">For discussion purposes only. Verify all data before client distribution.</p>
        </div>
      </div>
    </div>
  );
}
