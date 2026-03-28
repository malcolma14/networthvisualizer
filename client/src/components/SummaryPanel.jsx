import ConcentrationChart from './ConcentrationChart';

function formatCurrency(value) {
  if (value == null) return '$0';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function SummaryPanel({ data, filteredClasses }) {
  return (
    <div className="space-y-4">
      {/* Donut chart */}
      <div className="bg-white rounded-xl border border-ig-grey/10 p-5 print-break-avoid">
        <h3 className="text-sm font-bold text-ig-dark mb-4">Asset allocation</h3>
        <ConcentrationChart
          assetClasses={filteredClasses}
          grossAssets={data.grossAssets}
        />
      </div>

      {/* Net worth summary */}
      <div className="bg-white rounded-xl border border-ig-grey/10 p-5 print-break-avoid">
        <h3 className="text-sm font-bold text-ig-dark mb-3">Net worth summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-ig-grey">Gross assets</span>
            <span className="font-semibold text-ig-dark">
              {formatCurrency(data.grossAssets)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ig-grey">Total liabilities</span>
            <span className="font-semibold text-ig-red">
              ({formatCurrency(data.totalLiabilities)})
            </span>
          </div>
          <div className="h-px bg-ig-dark/10 my-1" />
          <div className="flex justify-between">
            <span className="font-bold text-ig-dark">Net worth</span>
            <span className="font-bold text-ig-dark text-lg">
              {formatCurrency(data.netWorth)}
            </span>
          </div>
        </div>
      </div>

      {/* Planning flags */}
      {data.planningFlags && data.planningFlags.length > 0 && (
        <div className="bg-white rounded-xl border border-ig-grey/10 p-5 print-break-avoid">
          <h3 className="text-sm font-bold text-ig-dark mb-3">Planning flags</h3>
          <ul className="space-y-1.5">
            {data.planningFlags.map((flag, i) => (
              <li key={i} className="text-xs text-ig-dark leading-relaxed">
                {flag}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Assumptions & notes */}
      {data.assumptionsAndNotes && data.assumptionsAndNotes.length > 0 && (
        <div className="bg-white rounded-xl border border-ig-grey/10 p-5 print-break-avoid">
          <h3 className="text-sm font-bold text-ig-dark mb-3">
            Assumptions &amp; notes
          </h3>
          <ul className="space-y-1.5">
            {data.assumptionsAndNotes.map((note, i) => (
              <li key={i} className="text-xs text-ig-grey leading-relaxed">
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
