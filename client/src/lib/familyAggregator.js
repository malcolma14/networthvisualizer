/**
 * Family tree aggregation utilities.
 * Merge analysisData and fundResearch across members and generations.
 */

/**
 * Returns a single member's data as-is (identity transform).
 */
export function aggregateMember(member) {
  return {
    analysisData: member.analysisData,
    fundResearch: member.fundResearch,
  };
}

/**
 * Merges all members in a generation into a single analysisData + fundResearch.
 */
export function aggregateGeneration(generation) {
  const members = generation.members || [];
  if (members.length === 0) return { analysisData: emptyAnalysis(generation.label), fundResearch: {} };
  if (members.length === 1) return { ...aggregateMember(members[0]), analysisData: { ...members[0].analysisData, clientName: generation.label } };
  return mergeMembers(members, generation.label);
}

/**
 * Merges all members across all generations in a family tree.
 */
export function aggregateFamily(familyTree) {
  const allMembers = (familyTree.generations || []).flatMap((g) => g.members || []);
  if (allMembers.length === 0) return { analysisData: emptyAnalysis(familyTree.name), fundResearch: {} };
  if (allMembers.length === 1) return { ...aggregateMember(allMembers[0]), analysisData: { ...allMembers[0].analysisData, clientName: familyTree.name } };
  return mergeMembers(allMembers, familyTree.name);
}

function emptyAnalysis(name) {
  return {
    clientName: name,
    advisorName: '',
    preparedDate: '',
    grossAssets: 0,
    totalLiabilities: 0,
    netWorth: 0,
    owners: [],
    assetClasses: [],
    liabilities: [],
    clarifyingQuestions: [],
  };
}

function mergeMembers(members, label) {
  let grossAssets = 0;
  let totalLiabilities = 0;
  let netWorth = 0;
  const ownersSet = new Set();
  const assetClassMap = {};
  const allLiabilities = [];
  const allQuestions = [];
  const mergedFundResearch = {};

  for (const member of members) {
    const d = member.analysisData;
    if (!d) continue;

    grossAssets += d.grossAssets || 0;
    totalLiabilities += d.totalLiabilities || 0;
    netWorth += d.netWorth || 0;

    for (const owner of d.owners || []) {
      ownersSet.add(owner);
    }

    for (const cls of d.assetClasses || []) {
      if (!assetClassMap[cls.name]) {
        assetClassMap[cls.name] = {
          name: cls.name,
          totalValue: 0,
          percentOfTotal: 0,
          assets: [],
        };
      }
      assetClassMap[cls.name].totalValue += cls.totalValue || 0;
      assetClassMap[cls.name].assets.push(...(cls.assets || []));
    }

    for (const l of d.liabilities || []) {
      allLiabilities.push(l);
    }

    for (const q of d.clarifyingQuestions || []) {
      allQuestions.push({
        ...q,
        question: `[${member.name}] ${q.question}`,
      });
    }

    // Merge fund research, preferring higher confidence
    const fr = member.fundResearch || {};
    for (const [code, result] of Object.entries(fr)) {
      const existing = mergedFundResearch[code];
      if (!existing || confidenceRank(result.confidence) > confidenceRank(existing.confidence)) {
        mergedFundResearch[code] = result;
      }
    }
  }

  // Recalculate percentOfTotal for merged asset classes
  const assetClasses = Object.values(assetClassMap);
  for (const cls of assetClasses) {
    cls.percentOfTotal = grossAssets > 0 ? (cls.totalValue / grossAssets) * 100 : 0;
  }

  return {
    analysisData: {
      clientName: label,
      advisorName: members[0]?.analysisData?.advisorName || '',
      preparedDate: members[0]?.analysisData?.preparedDate || '',
      grossAssets,
      totalLiabilities,
      netWorth,
      owners: Array.from(ownersSet),
      assetClasses,
      liabilities: allLiabilities,
      clarifyingQuestions: allQuestions,
    },
    fundResearch: mergedFundResearch,
  };
}

const CONFIDENCE_RANKS = { High: 3, Medium: 2, Low: 1 };
function confidenceRank(c) {
  return CONFIDENCE_RANKS[c] || 0;
}
