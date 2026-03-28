import { useState } from 'react';
import AssetGroup from './AssetGroup';
import SummaryPanel from './SummaryPanel';
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

  // Filter assets by owner
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
  const hasFlags =
    (data.planningFlags && data.planningFlags.length > 0) ||
    filteredClasses.some((g) => g.concentrationFlag !== 'none');

  const today = new Date().toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="dashboard-container min-h-screen bg-ig-pale">
      {/* Top bar (no-print) */}
      <div className="no-print bg-ig-dark text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-bold text-sm">Net Worth Dashboard</h1>
          <span className="text-ig-light text-xs">IG Wealth Management</span>
        </div>
        <div className="flex items-center gap-3">
          <PrintButton />
          <button
            onClick={onReset}
            className="text-xs text-ig-light hover:text-white transition-colors"
          >
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
                {data.clientName || 'Client'} &middot;{' '}
                {data.preparedDate || today}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-ig-grey">Total net worth</p>
              <p className="text-3xl font-bold text-ig-dark">
                {formatCurrency(data.netWorth)}
              </p>
            </div>
          </div>
          <div className="h-px bg-ig-dark/10 mt-3" />
        </div>

        {/* Alert bar */}
        {hasFlags && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-ig-amber/30">
            <p className="text-xs font-semibold text-ig-amber uppercase tracking-wide mb-1">
              Planning alerts
            </p>
            <ul className="text-sm text-ig-dark space-y-0.5">
              {(data.planningFlags || []).map((flag, i) => (
                <li key={i}>{flag}</li>
              ))}
            </ul>
          </div>
        )}

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

        {/* Two-column layout */}
        <div className="dashboard-grid grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Left column — asset breakdown */}
          <div className="space-y-3">
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
              <div className="text-center py-12 text-ig-grey">
                No assets found for this owner.
              </div>
            )}

            {/* Liabilities */}
            {data.liabilities && data.liabilities.length > 0 && (
              <div className="bg-white rounded-xl border border-ig-grey/10 overflow-hidden print-break-avoid">
                <div className="px-5 py-3 bg-ig-grey/10 flex items-center justify-between">
                  <h3 className="font-bold text-ig-dark text-sm">Liabilities</h3>
                  <span className="text-sm font-semibold text-ig-red">
                    {formatCurrency(
                      data.liabilities.reduce((s, l) => s + (l.value || 0), 0)
                    )}
                  </span>
                </div>
                <div className="divide-y divide-ig-pale">
                  {data.liabilities.map((l, i) => (
                    <div key={i} className="px-5 py-2.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-ig-dark">{l.name}</p>
                        <p className="text-xs text-ig-grey">{l.owner}</p>
                      </div>
                      <p className="text-sm font-semibold text-ig-red">
                        {formatCurrency(l.value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column — summary panel */}
          <SummaryPanel data={data} filteredClasses={filteredClasses} />
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-ig-dark/10 text-xs text-ig-grey text-center">
          <p>
            Prepared by Adam Malcolm, CFP, MFA-P &middot; IG Wealth Management &middot;{' '}
            {today}
          </p>
          <p className="mt-0.5 italic">
            For advisor use only. Verify before client distribution.
          </p>
        </div>
      </div>
    </div>
  );
}
