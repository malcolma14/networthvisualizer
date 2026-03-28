function formatCurrency(value) {
  if (value == null) return '$0';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function SummaryPanel({ data }) {
  return (
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
  );
}
