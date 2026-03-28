import { useState, useMemo } from 'react';
import AssetGroup from './AssetGroup';
import SummaryPanel from './SummaryPanel';
import ExposurePanel from './ExposurePanel';
import PrintButton from './PrintButton';
import { aggregateMember, aggregateGeneration, aggregateFamily } from '../lib/familyAggregator';

function formatCurrency(value) {
  if (value == null) return '$0';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function Dashboard({ data, fundResearch, familyTree, onReset }) {
  const [activeOwner, setActiveOwner] = useState('All');
  const isMultiMember = !!familyTree && familyTree.generations?.some((g) => g.members?.length > 0);

  // View mode: 'individual' | 'generation' | 'consolidated'
  const [viewMode, setViewMode] = useState(isMultiMember ? 'consolidated' : 'individual');
  const [selectedMemberIdx, setSelectedMemberIdx] = useState(0);
  const [selectedGenIdx, setSelectedGenIdx] = useState(0);

  // Flat list of all members for Individual view tabs
  const allMembers = useMemo(() => {
    if (!familyTree) return [];
    return familyTree.generations.flatMap((g) => g.members || []);
  }, [familyTree]);

  // Compute active data + fundResearch based on view mode
  const { activeData, activeFundResearch, viewLabel } = useMemo(() => {
    if (!isMultiMember) {
      return { activeData: data, activeFundResearch: fundResearch, viewLabel: null };
    }

    if (viewMode === 'individual') {
      const member = allMembers[selectedMemberIdx];
      if (!member) return { activeData: data, activeFundResearch: fundResearch, viewLabel: null };
      const result = aggregateMember(member);
      return { activeData: result.analysisData, activeFundResearch: result.fundResearch, viewLabel: member.name };
    }

    if (viewMode === 'generation') {
      const gen = familyTree.generations[selectedGenIdx];
      if (!gen) return { activeData: data, activeFundResearch: fundResearch, viewLabel: null };
      const result = aggregateGeneration(gen);
      return { activeData: result.analysisData, activeFundResearch: result.fundResearch, viewLabel: gen.label };
    }

    // consolidated
    const result = aggregateFamily(familyTree);
    return { activeData: result.analysisData, activeFundResearch: result.fundResearch, viewLabel: familyTree.name };
  }, [isMultiMember, viewMode, selectedMemberIdx, selectedGenIdx, familyTree, allMembers, data, fundResearch]);

  const owners = ['All', ...(activeData.owners || [])];
  const showOwnerFilter = !isMultiMember || viewMode === 'individual';

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

  const filteredClasses = filterByOwner(activeData.assetClasses || []);

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
                {activeData.clientName || 'Client'} &middot; {activeData.preparedDate || today}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-ig-grey">Total net worth</p>
              <p className="text-3xl font-bold text-ig-dark">{formatCurrency(activeData.netWorth)}</p>
            </div>
          </div>
          <div className="h-px bg-ig-dark/10 mt-3" />
        </div>

        {/* View mode selector (multi-member only) */}
        {isMultiMember && (
          <div className="no-print mb-4">
            <div className="flex gap-1 bg-white rounded-lg border border-ig-grey/10 p-1 w-fit">
              {[
                { mode: 'individual', label: 'Individual' },
                { mode: 'generation', label: 'Generation' },
                { mode: 'consolidated', label: 'Consolidated' },
              ].map(({ mode, label }) => (
                <button
                  key={mode}
                  onClick={() => { setViewMode(mode); setActiveOwner('All'); }}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    viewMode === mode
                      ? 'bg-ig-dark text-white'
                      : 'text-ig-grey hover:text-ig-dark'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Sub-tabs based on view mode */}
            {viewMode === 'individual' && allMembers.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {allMembers.map((m, idx) => (
                  <button
                    key={m.id || idx}
                    onClick={() => { setSelectedMemberIdx(idx); setActiveOwner('All'); }}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                      selectedMemberIdx === idx
                        ? 'bg-ig-mid text-white border-ig-mid'
                        : 'bg-white text-ig-dark border-ig-grey/30 hover:border-ig-mid'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            )}

            {viewMode === 'generation' && familyTree.generations.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {familyTree.generations.map((g, idx) => (
                  <button
                    key={g.id || idx}
                    onClick={() => { setSelectedGenIdx(idx); setActiveOwner('All'); }}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                      selectedGenIdx === idx
                        ? 'bg-ig-mid text-white border-ig-mid'
                        : 'bg-white text-ig-dark border-ig-grey/30 hover:border-ig-mid'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Print-only view label */}
        {viewLabel && (
          <p className="print-only hidden text-xs text-ig-grey mb-3 italic">View: {viewLabel}</p>
        )}

        {/* Print-only filter label */}
        {activeOwner !== 'All' && (
          <p className="print-only hidden text-xs text-ig-grey mb-3 italic">Filtered view: {activeOwner}</p>
        )}

        {/* Print-only family legend (consolidated/generation view) */}
        {isMultiMember && (viewMode === 'consolidated' || viewMode === 'generation') && (
          <div className="print-only hidden mb-4 p-3 bg-ig-pale rounded-lg border border-ig-grey/10">
            <p className="text-[10px] font-semibold text-ig-grey uppercase tracking-wide mb-1">Included members</p>
            {(viewMode === 'consolidated' ? familyTree.generations : [familyTree.generations[selectedGenIdx]]).filter(Boolean).map((gen) => (
              <div key={gen.id} className="mb-1">
                <p className="text-[10px] font-semibold text-ig-dark">{gen.label}</p>
                <p className="text-[10px] text-ig-grey">
                  {gen.members.map((m) => m.name).join(', ')}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Owner filter (only in individual/single-profile mode) */}
        {showOwnerFilter && (
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
        )}

        {/* Two-column layout: Exposure (left, dominant) | Account details (right, compact) */}
        <div className="dashboard-grid grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          {/* LEFT — Wealth allocation, exposure, distributions, fees */}
          <ExposurePanel data={activeData} fundResearch={activeFundResearch} activeOwner={showOwnerFilter ? activeOwner : 'All'} />

          {/* RIGHT — Account details + net worth summary */}
          <div className="space-y-3">
            <SummaryPanel data={activeData} />

            <div className="space-y-2">
              <h3 className="text-xs font-bold text-ig-grey uppercase tracking-wide px-1">Account details</h3>
              {filteredClasses.length > 0 ? (
                filteredClasses.map((group, i) => (
                  <AssetGroup
                    key={group.name || i}
                    group={group}
                    grossAssets={activeData.grossAssets}
                    fundResearch={activeFundResearch}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-ig-grey text-xs">
                  No assets found for this owner.
                </div>
              )}

              {/* Liabilities */}
              {activeData.liabilities && activeData.liabilities.length > 0 && (
                <div className="bg-white rounded-xl border border-ig-grey/10 overflow-hidden print-break-avoid">
                  <div className="px-4 py-2.5 bg-ig-grey/10 flex items-center justify-between">
                    <h3 className="font-bold text-ig-dark text-xs">Liabilities</h3>
                    <span className="text-xs font-semibold text-ig-red">
                      {formatCurrency(activeData.liabilities.reduce((s, l) => s + (l.value || 0), 0))}
                    </span>
                  </div>
                  <div className="divide-y divide-ig-pale">
                    {activeData.liabilities.map((l, i) => (
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
