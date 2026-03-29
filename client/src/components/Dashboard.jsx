import { useState, useMemo } from 'react';
import AssetGroup from './AssetGroup';
import SummaryPanel from './SummaryPanel';
import ExposurePanel from './ExposurePanel';
import PrintButton from './PrintButton';
import DashboardChat from './DashboardChat';
import { aggregateMember, aggregateGeneration, aggregateFamily } from '../lib/familyAggregator';
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

function fmtPrint(v) {
  if (v == null) return '$0';
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

function buildPrintDocument(data, fundResearch, viewLabel) {
  const exposure = calculateExposure(data, fundResearch, 'All');
  const { broadGroups, geographies, grossAssets } = exposure;

  const today = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  const clientName = data.clientName || 'Client';
  const prepDate = data.preparedDate || today;

  // Build bar row HTML
  function barRows(items, maxPct) {
    return items.map(item => {
      const barW = Math.min(item.percent, maxPct) / maxPct * 100;
      return `<tr>
        <td style="padding:3px 6px;white-space:nowrap;"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${item.color || '#7A99AC'};margin-right:6px;vertical-align:middle;"></span>${item.name}</td>
        <td style="padding:3px 6px;text-align:right;font-weight:600;">${fmtPrint(item.value)}</td>
        <td style="padding:3px 6px;text-align:right;color:#7A99AC;">${item.percent.toFixed(1)}%</td>
        <td style="padding:3px 6px;width:120px;"><div style="background:#F0F8FD;border-radius:3px;height:8px;overflow:hidden;"><div style="background:${item.color || '#7A99AC'};height:100%;width:${barW}%;border-radius:3px;"></div></div></td>
      </tr>`;
    }).join('');
  }

  const GEO_COLORS = { 'Canada': '#001E60', 'United States': '#0072CE', 'Europe': '#00966C', 'Japan': '#ED8B00', 'Asia ex-Japan': '#8DD0EF', 'Other/EM': '#7A99AC' };
  const geoItems = geographies.map(g => ({ ...g, color: GEO_COLORS[g.name] || '#7A99AC' }));

  // Holdings table rows
  let holdingsRows = '';
  for (const group of (data.assetClasses || [])) {
    let groupTotal = 0;
    const assetRows = (group.assets || []).map(a => {
      groupTotal += a.value || 0;
      const pct = grossAssets > 0 ? ((a.value || 0) / grossAssets * 100).toFixed(1) : '0.0';
      return `<tr>
        <td style="padding:2px 6px;padding-left:16px;">${a.name || ''}</td>
        <td style="padding:2px 6px;">${a.owner || ''}</td>
        <td style="padding:2px 6px;">${a.accountType || ''}</td>
        <td style="padding:2px 6px;text-align:right;font-weight:500;">${fmtPrint(a.value)}</td>
        <td style="padding:2px 6px;text-align:right;color:#7A99AC;">${pct}%</td>
      </tr>`;
    }).join('');
    const groupPct = grossAssets > 0 ? (groupTotal / grossAssets * 100).toFixed(1) : '0.0';
    holdingsRows += `<tr style="background:#F0F8FD;font-weight:700;">
      <td style="padding:3px 6px;" colspan="3">${group.name}</td>
      <td style="padding:3px 6px;text-align:right;">${fmtPrint(groupTotal)}</td>
      <td style="padding:3px 6px;text-align:right;">${groupPct}%</td>
    </tr>${assetRows}`;
  }

  // Liabilities
  let liabTotal = 0;
  let liabRows = '';
  for (const l of (data.liabilities || [])) {
    liabTotal += l.value || 0;
    liabRows += `<tr>
      <td style="padding:2px 6px;padding-left:16px;">${l.name || ''}</td>
      <td style="padding:2px 6px;">${l.owner || ''}</td>
      <td style="padding:2px 6px;"></td>
      <td style="padding:2px 6px;text-align:right;color:#D32E1A;font-weight:500;">(${fmtPrint(l.value)})</td>
      <td style="padding:2px 6px;"></td>
    </tr>`;
  }
  if (liabRows) {
    holdingsRows += `<tr style="background:#F0F8FD;font-weight:700;">
      <td style="padding:3px 6px;" colspan="3">Liabilities</td>
      <td style="padding:3px 6px;text-align:right;color:#D32E1A;">(${fmtPrint(liabTotal)})</td>
      <td style="padding:3px 6px;"></td>
    </tr>${liabRows}`;
  }

  // Net worth footer row
  holdingsRows += `<tr style="border-top:2px solid #001E60;font-weight:700;font-size:11pt;">
    <td style="padding:5px 6px;" colspan="3">Net Worth</td>
    <td style="padding:5px 6px;text-align:right;">${fmtPrint(data.netWorth)}</td>
    <td style="padding:5px 6px;"></td>
  </tr>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Net Worth Summary - ${clientName}</title>
<style>
  @page { size: letter landscape; margin: 0.4in; }
  body { font-family: 'Calibri', 'Segoe UI', sans-serif; font-size: 10pt; color: #001E60; margin: 0; padding: 0; }
  table { border-collapse: collapse; width: 100%; }
  .summary-num { font-size: 18pt; font-weight: 700; }
  .summary-label { font-size: 8pt; color: #7A99AC; text-transform: uppercase; letter-spacing: 0.5px; }
  .section-title { font-size: 10pt; font-weight: 700; color: #001E60; margin: 12px 0 4px; border-bottom: 1px solid #8DD0EF; padding-bottom: 2px; }
  .alloc-table td { font-size: 9pt; }
  .holdings-table td { font-size: 8.5pt; border-bottom: 1px solid #F0F8FD; }
  .footer { font-size: 7.5pt; color: #7A99AC; text-align: center; margin-top: 10px; padding-top: 6px; border-top: 1px solid #8DD0EF; }
</style></head><body>

<table style="width:100%;margin-bottom:8px;"><tr>
  <td style="vertical-align:top;">
    <div style="font-size:14pt;font-weight:700;color:#001E60;">IG Wealth Management</div>
    <div style="font-size:9pt;color:#7A99AC;">${clientName} &middot; ${prepDate}${viewLabel ? ' &middot; ' + viewLabel : ''}</div>
  </td>
  <td style="text-align:right;vertical-align:top;">
    <div style="font-size:11pt;font-weight:700;color:#001E60;">Net Worth Summary</div>
  </td>
</tr></table>

<table style="width:100%;margin-bottom:10px;background:#F0F8FD;border-radius:6px;"><tr>
  <td style="padding:10px 20px;text-align:center;width:33%;border-right:1px solid #8DD0EF;">
    <div class="summary-label">Gross Assets</div>
    <div class="summary-num">${fmtPrint(data.grossAssets)}</div>
  </td>
  <td style="padding:10px 20px;text-align:center;width:33%;border-right:1px solid #8DD0EF;">
    <div class="summary-label">Total Liabilities</div>
    <div class="summary-num" style="color:#D32E1A;">${fmtPrint(data.totalLiabilities)}</div>
  </td>
  <td style="padding:10px 20px;text-align:center;width:33%;">
    <div class="summary-label">Net Worth</div>
    <div class="summary-num">${fmtPrint(data.netWorth)}</div>
  </td>
</tr></table>

<table style="width:100%;"><tr>
  <td style="width:50%;vertical-align:top;padding-right:10px;">
    <div class="section-title">Asset Allocation</div>
    <table class="alloc-table">${barRows(broadGroups, 60)}</table>
  </td>
  <td style="width:50%;vertical-align:top;padding-left:10px;">
    <div class="section-title">Geographic Allocation</div>
    <table class="alloc-table">${barRows(geoItems, 60)}</table>
  </td>
</tr></table>

<div class="section-title">Holdings Summary</div>
<table class="holdings-table">
  <tr style="background:#001E60;color:white;font-size:8pt;font-weight:600;">
    <td style="padding:3px 6px;">Account</td>
    <td style="padding:3px 6px;">Owner</td>
    <td style="padding:3px 6px;">Type</td>
    <td style="padding:3px 6px;text-align:right;">Value</td>
    <td style="padding:3px 6px;text-align:right;">% of Total</td>
  </tr>
  ${holdingsRows}
</table>

<div class="footer">
  Prepared by Adam Malcolm, CFP, MFA-P &middot; IG Wealth Management &middot; ${today}<br>
  For discussion purposes only. Data as at ${prepDate}.<br>
  <em>This summary is prepared for discussion purposes only and does not constitute financial advice.</em>
</div>

</body></html>`;
}


export default function Dashboard({ data, fundResearch, familyTree, onReset }) {
  const [liveData, setLiveData] = useState(data);
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
      return { activeData: liveData, activeFundResearch: fundResearch, viewLabel: null };
    }

    if (viewMode === 'individual') {
      const member = allMembers[selectedMemberIdx];
      if (!member) return { activeData: liveData, activeFundResearch: fundResearch, viewLabel: null };
      const result = aggregateMember(member);
      return { activeData: result.analysisData, activeFundResearch: result.fundResearch, viewLabel: member.name };
    }

    if (viewMode === 'generation') {
      const gen = familyTree.generations[selectedGenIdx];
      if (!gen) return { activeData: liveData, activeFundResearch: fundResearch, viewLabel: null };
      const result = aggregateGeneration(gen);
      return { activeData: result.analysisData, activeFundResearch: result.fundResearch, viewLabel: gen.label };
    }

    // consolidated
    const result = aggregateFamily(familyTree);
    return { activeData: result.analysisData, activeFundResearch: result.fundResearch, viewLabel: familyTree.name };
  }, [isMultiMember, viewMode, selectedMemberIdx, selectedGenIdx, familyTree, allMembers, liveData, fundResearch]);

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

  function handlePrint() {
    const printWindow = window.open('', '_blank');
    const doc = buildPrintDocument(activeData, activeFundResearch, viewLabel);
    printWindow.document.write(doc);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }

  return (
    <div className="dashboard-container min-h-screen bg-ig-pale">
      {/* Top bar */}
      <div className="no-print bg-ig-dark text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-bold text-sm">Net Worth Dashboard</h1>
          <span className="text-ig-light text-xs">IG Wealth Management</span>
        </div>
        <div className="flex items-center gap-3">
          <PrintButton onClick={handlePrint} />
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

      {/* Chat panel — outside print area */}
      <DashboardChat
        currentData={activeData}
        onDataUpdate={(updated) => setLiveData(updated)}
      />
    </div>
  );
}
