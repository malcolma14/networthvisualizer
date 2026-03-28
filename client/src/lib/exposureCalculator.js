/**
 * Calculates look-through exposure from fund allocation data.
 * Weights each fund's asset/geographic allocation by the account's dollar value.
 */

// Standard asset class buckets
const EQUITY_SUB_TYPES = ['Canadian equity', 'US equity', 'International equity', 'Global equity'];
const ASSET_CLASS_ORDER = [
  'Canadian equity', 'US equity', 'International equity', 'Global equity',
  'Fixed income', 'Real estate — private', 'Real estate — listed',
  'Cash & equivalents', 'Private alternatives', 'Other',
];
const GEO_ORDER = ['Canada', 'United States', 'Europe', 'Japan', 'Asia ex-Japan', 'Other/EM'];

// Map CIFSC / fund category strings to our standard buckets
function mapAssetClass(raw) {
  if (!raw) return 'Other';
  const l = raw.toLowerCase();
  if (l.includes('canadian equity') || l.includes('cdn equity')) return 'Canadian equity';
  if (l.includes('us equity') || l.includes('u.s. equity') || l.includes('american equity')) return 'US equity';
  if (l.includes('international equity') || l.includes('intl equity') || l.includes('european equity') || l.includes('asia') || l.includes('emerging')) return 'International equity';
  if (l.includes('global equity') || l.includes('world equity')) return 'Global equity';
  if (l.includes('fixed income') || l.includes('bond') || l.includes('income') || l.includes('mortgage')) return 'Fixed income';
  if (l.includes('real estate') || l.includes('reit')) return 'Real estate — listed';
  if (l.includes('money market') || l.includes('cash') || l.includes('savings') || l.includes('t-bill')) return 'Cash & equivalents';
  if (l.includes('balanced') || l.includes('asset allocation') || l.includes('target')) return 'Global equity'; // balanced → treat as blended equity
  if (l.includes('alternative') || l.includes('private')) return 'Private alternatives';
  return 'Other';
}

function mapGeography(raw) {
  if (!raw) return 'Other/EM';
  const l = raw.toLowerCase();
  if (l.includes('canada') || l.includes('canadian')) return 'Canada';
  if (l.includes('united states') || l.includes('u.s.') || l.includes('us') || l.includes('american')) return 'United States';
  if (l.includes('europe') || l.includes('uk') || l.includes('united kingdom') || l.includes('eurozone')) return 'Europe';
  if (l.includes('japan')) return 'Japan';
  if (l.includes('asia') || l.includes('pacific') || l.includes('china') || l.includes('korea') || l.includes('australia')) return 'Asia ex-Japan';
  return 'Other/EM';
}

export function calculateExposure(analysisData, fundResearch) {
  const grossAssets = analysisData.grossAssets || 0;
  if (grossAssets <= 0) return { assetClasses: [], geographies: [], summaryChips: [], sources: [] };

  // Accumulators
  const assetBuckets = {};
  const geoBuckets = {};
  const sources = [];
  let unallocatedValue = 0;

  for (const cls of ASSET_CLASS_ORDER) assetBuckets[cls] = { name: cls, value: 0, sources: [] };
  for (const geo of GEO_ORDER) geoBuckets[geo] = { name: geo, value: 0 };

  const assetClasses = analysisData.assetClasses || [];
  for (const group of assetClasses) {
    for (const asset of group.assets || []) {
      const accountValue = asset.value || 0;
      if (accountValue <= 0) continue;

      const holdings = asset.holdings || [];
      let allocatedFromHoldings = false;

      for (const holding of holdings) {
        const code = holding.code;
        const holdingValue = holding.value || 0;
        if (holdingValue <= 0) continue;

        const research = holding.researchResult || (code && fundResearch?.[code]) || null;

        if (research && research.verified && research.assetAllocation) {
          allocatedFromHoldings = true;

          // Weight asset allocation by holding value
          for (const alloc of research.assetAllocation) {
            const bucket = mapAssetClass(alloc.name);
            const dollarValue = (alloc.percent / 100) * holdingValue;
            if (!assetBuckets[bucket]) assetBuckets[bucket] = { name: bucket, value: 0, sources: [] };
            assetBuckets[bucket].value += dollarValue;
            if (code && !assetBuckets[bucket].sources.some((s) => s.code === code && s.sleeve === alloc.name)) {
              assetBuckets[bucket].sources.push({ code, sleeve: alloc.name, pct: alloc.percent });
            }
          }

          // Weight geographic allocation by holding value
          if (research.geographicAllocation) {
            for (const geo of research.geographicAllocation) {
              const bucket = mapGeography(geo.name);
              const dollarValue = (geo.percent / 100) * holdingValue;
              if (!geoBuckets[bucket]) geoBuckets[bucket] = { name: bucket, value: 0 };
              geoBuckets[bucket].value += dollarValue;
            }
          }

          // Track source
          if (code && research.dataAsAt) {
            if (!sources.find((s) => s.code === code)) {
              sources.push({ code, dataAsAt: research.dataAsAt, verified: true });
            }
          }
        } else if (research && research.verified && research.cifscCategory) {
          // Fund was found but no allocation table — use CIFSC category as 100%
          allocatedFromHoldings = true;
          const bucket = mapAssetClass(research.cifscCategory);
          if (!assetBuckets[bucket]) assetBuckets[bucket] = { name: bucket, value: 0, sources: [] };
          assetBuckets[bucket].value += holdingValue;
          assetBuckets[bucket].sources.push({ code, sleeve: research.cifscCategory, pct: 100 });

          if (code && research.dataAsAt && !sources.find((s) => s.code === code)) {
            sources.push({ code, dataAsAt: research.dataAsAt, verified: true });
          }
        } else {
          // Unverified fund — fall back to parent asset class
          allocatedFromHoldings = true;
          const bucket = mapAssetClass(group.name);
          if (!assetBuckets[bucket]) assetBuckets[bucket] = { name: bucket, value: 0, sources: [] };
          assetBuckets[bucket].value += holdingValue;

          if (code) {
            sources.push({ code, dataAsAt: null, verified: false });
          }
        }
      }

      // If no holdings or holdings didn't cover value, classify by account-level asset class
      if (!allocatedFromHoldings) {
        const groupName = group.name || 'Other';
        const descLower = (asset.name || '').toLowerCase();

        if (descLower.includes('cash') || descLower.includes('hisa') || descLower.includes('savings') || descLower.includes('money market') || descLower.includes('tax holding') || descLower.includes('tax reserve')) {
          assetBuckets['Cash & equivalents'].value += accountValue;
        } else if (groupName === 'Real estate' || descLower.includes('real estate') || descLower.includes('property') || descLower.includes('home') || descLower.includes('condo') || descLower.includes('house')) {
          assetBuckets['Real estate — private'].value += accountValue;
          geoBuckets['Canada'].value += accountValue;
        } else if (groupName === 'Insurance' || groupName === 'Physical assets') {
          assetBuckets['Other'].value += accountValue;
        } else if (groupName === 'Private equity' || groupName === 'Corporations') {
          assetBuckets['Private alternatives'].value += accountValue;
          geoBuckets['Canada'].value += accountValue;
        } else {
          const bucket = mapAssetClass(groupName);
          if (!assetBuckets[bucket]) assetBuckets[bucket] = { name: bucket, value: 0, sources: [] };
          assetBuckets[bucket].value += accountValue;
        }
      }
    }
  }

  // Build sorted arrays, filter out zero values
  const assetClassList = ASSET_CLASS_ORDER
    .map((name) => {
      const b = assetBuckets[name];
      if (!b || b.value <= 0) return null;
      return {
        name: b.name,
        value: b.value,
        percent: (b.value / grossAssets) * 100,
        sources: b.sources || [],
        isEquitySub: EQUITY_SUB_TYPES.includes(name),
      };
    })
    .filter(Boolean);

  const geoList = GEO_ORDER
    .map((name) => {
      const b = geoBuckets[name];
      if (!b || b.value <= 0) return null;
      return {
        name: b.name,
        value: b.value,
        percent: (b.value / grossAssets) * 100,
      };
    })
    .filter(Boolean);

  // Calculate equity total for the grouped header
  const equityTotal = assetClassList
    .filter((a) => a.isEquitySub)
    .reduce((sum, a) => sum + a.value, 0);
  const equityPercent = grossAssets > 0 ? (equityTotal / grossAssets) * 100 : 0;

  // Summary chips
  const realEstateValue =
    (assetBuckets['Real estate — private']?.value || 0) +
    (assetBuckets['Real estate — listed']?.value || 0);
  const cashOtherValue =
    (assetBuckets['Cash & equivalents']?.value || 0) +
    (assetBuckets['Other']?.value || 0) +
    (assetBuckets['Private alternatives']?.value || 0);

  const summaryChips = [
    { label: 'Public equity', value: equityTotal, percent: equityPercent },
    { label: 'Real estate', value: realEstateValue, percent: grossAssets > 0 ? (realEstateValue / grossAssets) * 100 : 0 },
    { label: 'Fixed income', value: assetBuckets['Fixed income']?.value || 0, percent: grossAssets > 0 ? ((assetBuckets['Fixed income']?.value || 0) / grossAssets) * 100 : 0 },
    { label: 'Cash & other', value: cashOtherValue, percent: grossAssets > 0 ? (cashOtherValue / grossAssets) * 100 : 0 },
  ].filter((c) => c.value > 0);

  return {
    assetClasses: assetClassList,
    geographies: geoList,
    equityTotal: { value: equityTotal, percent: equityPercent },
    summaryChips,
    sources,
  };
}
