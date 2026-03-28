/**
 * Client-side asset classifier — identical logic to server version.
 */

export function classifyAndFlag(parsedData) {
  const { accounts, totals } = parsedData;
  const grossAssets = totals.grossAssets || 0;

  const assets = accounts.filter((a) => !a.isLiability);
  const liabilities = accounts.filter((a) => a.isLiability);

  const classGroups = {};
  for (const asset of assets) {
    const cls = asset.assetClass || 'Other';
    if (!classGroups[cls]) {
      classGroups[cls] = { name: cls, assets: [], totalValue: 0 };
    }
    classGroups[cls].assets.push(asset);
    classGroups[cls].totalValue += asset.totalValue;
  }

  const planningFlags = [];
  for (const group of Object.values(classGroups)) {
    group.percentOfTotal = grossAssets > 0 ? (group.totalValue / grossAssets) * 100 : 0;

    if (group.percentOfTotal > 40) {
      group.concentrationFlag = 'high';
      planningFlags.push(`🔴 High concentration: ${group.name} at ${group.percentOfTotal.toFixed(1)}% of gross assets`);
    } else if (group.percentOfTotal > 30) {
      group.concentrationFlag = 'moderate';
      planningFlags.push(`🟡 Moderate concentration: ${group.name} at ${group.percentOfTotal.toFixed(1)}% of gross assets`);
    } else {
      group.concentrationFlag = 'none';
    }

    for (const asset of group.assets) {
      asset.locationFlag = false;
      const cls = asset.assetClass?.toLowerCase() || '';
      if ((cls === 'cash' || cls === 'fixed income') && asset.accountType === 'Non-registered') {
        asset.locationFlag = true;
        planningFlags.push(`⚠ Tax location: ${asset.description} — ${asset.assetClass} held in non-registered account`);
      }
    }
  }

  for (const asset of assets) {
    if (grossAssets > 0 && (asset.totalValue / grossAssets) * 100 > 40) {
      planningFlags.push(`🔴 Single-entity risk: ${asset.description} at ${((asset.totalValue / grossAssets) * 100).toFixed(1)}% of gross assets`);
    }
  }

  const fundCodes = new Set();
  for (const asset of assets) {
    for (const holding of asset.holdings) {
      if (holding.fundCode) fundCodes.add(holding.fundCode);
    }
  }

  return {
    assetClasses: Object.values(classGroups),
    liabilities,
    planningFlags,
    fundCodes: [...fundCodes],
    grossAssets,
    totalLiabilities: totals.totalLiabilities || 0,
    netWorth: totals.netWorth || 0,
  };
}
