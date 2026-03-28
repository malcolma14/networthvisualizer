import { useState } from 'react';

function formatCurrency(value) {
  if (value == null) return '$0';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function AssetCard({ asset, grossAssets, fundResearch }) {
  const [holdingsExpanded, setHoldingsExpanded] = useState(false);
  const pct = grossAssets > 0 ? ((asset.value / grossAssets) * 100).toFixed(1) : '0.0';
  const hasHoldings = asset.holdings && asset.holdings.length > 0;

  return (
    <div className="px-5 py-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-ig-dark truncate">{asset.name}</p>
            {asset.subClass && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-ig-pale text-ig-mid font-medium">
                {asset.subClass}
              </span>
            )}
          </div>
          <p className="text-xs text-ig-grey mt-0.5">
            {asset.owner} &middot; {asset.accountType}
          </p>
        </div>
        <div className="text-right ml-4 shrink-0">
          <p className="text-sm font-semibold text-ig-dark">{formatCurrency(asset.value)}</p>
          <p className="text-xs text-ig-grey">{pct}%</p>
        </div>
      </div>

      {/* Holdings */}
      {hasHoldings && (
        <div className="mt-2">
          <button
            onClick={() => setHoldingsExpanded(!holdingsExpanded)}
            className="text-xs text-ig-mid hover:text-ig-dark transition-colors flex items-center gap-1"
          >
            <svg
              className={`w-3 h-3 transition-transform ${holdingsExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {asset.holdings.length} holding{asset.holdings.length !== 1 ? 's' : ''}
          </button>

          {holdingsExpanded && (
            <div className="mt-2 ml-4 space-y-2">
              {asset.holdings.map((h, i) => {
                const research =
                  h.researchResult || (h.code && fundResearch?.[h.code]) || null;
                const isVerified = research?.verified;
                return (
                  <div
                    key={i}
                    className="p-2.5 bg-ig-pale rounded-lg text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-ig-dark">
                        {h.code || 'Unknown'}
                      </span>
                      <span className="font-semibold text-ig-dark">
                        {formatCurrency(h.value)}
                      </span>
                    </div>
                    {research && isVerified && research.fullName && (
                      <div className="mt-1.5 space-y-0.5">
                        <p className="text-ig-dark">
                          <span className="font-medium">{research.fullName}</span>
                          {research.fundCompany && (
                            <span className="text-ig-grey"> — {research.fundCompany}</span>
                          )}
                        </p>
                        {research.cifscCategory && (
                          <p className="text-ig-grey">{research.cifscCategory}</p>
                        )}
                        {research.dataAsAt && (
                          <p className="text-ig-grey">Data as at {research.dataAsAt}</p>
                        )}
                      </div>
                    )}
                    {(!research || !isVerified) && (
                      <p className="mt-1 text-ig-amber text-xs font-medium">
                        Unverified — confirm with advisor
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
