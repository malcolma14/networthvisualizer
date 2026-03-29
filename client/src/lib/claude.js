import Anthropic from '@anthropic-ai/sdk';
import {
  ANALYSIS_SYSTEM_PROMPT,
  CHAT_SYSTEM_PROMPT,
  buildAnalysisPrompt,
  buildChatPrompt,
} from './promptBuilder.js';
import { parseCSVData } from './csvParser.js';
import { classifyAndFlag } from './assetClassifier.js';
import FUND_LIBRARY from './fundLibrary.js';

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

if (!API_KEY) {
  throw new Error(
    'VITE_ANTHROPIC_API_KEY is not set. Add it as a GitHub Actions secret and redeploy.'
  );
}

let client = null;

export function initClient() {
  if (!client) {
    client = new Anthropic({
      apiKey: API_KEY,
      dangerouslyAllowBrowser: true,
    });
  }
}

export function isClientReady() {
  return client !== null;
}

const FUND_RESEARCH_MODEL = 'claude-sonnet-4-20250514';

function detectFundFamily(code) {
  const upper = code.toUpperCase();
  if (upper.startsWith('IGI') || upper.startsWith('IG') || upper.startsWith('IVY')) return 'ig';
  if (upper.startsWith('DFA')) return 'dfa';
  return 'other';
}

function buildSearchStrategy(code) {
  const family = detectFundFamily(code);
  if (family === 'ig') {
    return `Tier 1 — IG/Investors Group fund detected.
  Primary search: "${code} site:ig.ca"
  Secondary search: "${code} IG Wealth Management fund facts"
  These are PROPRIETARY IG Wealth Management funds — FundLibrary will NOT have them. Do NOT search FundLibrary for IG funds.`;
  }
  if (family === 'dfa') {
    return `Tier 2 — DFA fund detected.
  Primary search: "${code} site:dimensional.com"
  Secondary search: "${code} Dimensional Fund Advisors Canada fund facts"`;
  }
  return `Tier 3 — Third-party fund (Mackenzie, CI, Fidelity, AGF, etc.).
  Primary search: "${code} site:fundlibrary.com"
  Secondary search: "${code} fund facts sheet Canada SEDAR"`;
}

async function researchSingleFund(code, onStatus) {
  // Check static fund library first — no API call needed
  const staticEntry = FUND_LIBRARY[code] || FUND_LIBRARY[code.toUpperCase()];
  if (staticEntry && staticEntry.code) {
    onStatus?.(`${code} — found in fund library ✓`);
    return {
      ...staticEntry,
      verified: true,
      confidence: 'High',
    };
  }

  // Not in static library — fall through to web search
  onStatus?.(`Researching ${code} via web search…`);
  const searchStrategy = buildSearchStrategy(code);

  // ─── Phase 1: Identify the fund ───
  const phase1Prompt = `You are a Canadian investment fund research assistant. Use the web_search tool to look up fund code "${code}".

SEARCH STRATEGY — follow this order:
${searchStrategy}

If the primary search yields nothing useful, try the secondary search. If both fail, try a general search: "${code} fund Canada".

Return a JSON object with these fields:
- code: "${code}"
- fullName: Official fund name (null if uncertain)
- fundCompany: Fund manager/company (null if uncertain)
- cifscCategory: CIFSC category e.g. "Global Equity", "Canadian Equity" (null if uncertain)
- benchmarkIndex: The fund's benchmark index if found (e.g. "S&P/TSX Composite Index"), null if unknown
- riskRating: The fund's risk rating string (e.g. "Medium", "Low to Medium"), null if unknown
- mer: MER as a number e.g. 1.25 (null if unknown)
- distributionYield: Trailing 12-month yield as a number (null if unknown)
- distributionFrequency: "Monthly", "Quarterly", "Annually", or null
- dataAsAt: Date of data if known, else null
- confidence: "High", "Medium", or "Low"

CONFIDENCE RULES:
- "High": You found the exact fund page and extracted detailed data
- "Medium": You identified the fund name and CIFSC category but could not get full allocation tables. This is STILL VALID.
- "Low": You could not confidently identify the fund at all — set fullName to null

CRITICAL:
- NEVER guess a name with High confidence — better to say Medium or Low than be wrong
- Respond with JSON only — no markdown fences, no explanation`;

  try {
    const phase1Response = await client.messages.create({
      model: FUND_RESEARCH_MODEL,
      max_tokens: 1200,
      system: phase1Prompt,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      messages: [{ role: 'user', content: `Identify fund code "${code}" and return the JSON object.` }],
    });

    const phase1Text = phase1Response.content.filter((b) => b.type === 'text').pop()?.text || '';
    const phase1Match = phase1Text.match(/\{[\s\S]*\}/);
    if (!phase1Match) {
      onStatus?.(`${code} — not found`);
      return { code, verified: false, fullName: null, confidence: 'Low' };
    }

    const phase1 = JSON.parse(phase1Match[0]);
    const isVerified = (phase1.confidence === 'High' || phase1.confidence === 'Medium') && phase1.fullName;

    if (!isVerified) {
      onStatus?.(`${code} — not found`);
      return {
        code, verified: false, fullName: null,
        fundCompany: null, cifscCategory: phase1.cifscCategory || null,
        benchmarkIndex: null, riskRating: null,
        mer: null, distributionYield: null, distributionFrequency: null,
        assetAllocation: [], geographicAllocation: [],
        dataAsAt: null, confidence: 'Low', allocationMissing: true,
      };
    }

    // ─── Phase 2: Get holdings/allocation data ───
    onStatus?.(`Researching ${code} holdings…`);
    const fullName = phase1.fullName;
    const fundCompany = phase1.fundCompany || '';

    const phase2Prompt = `You are a Canadian investment fund research assistant. You have already identified the fund:
- Code: "${code}"
- Name: "${fullName}"
- Company: "${fundCompany}"

Now use the web_search tool to find the PORTFOLIO HOLDINGS and ASSET ALLOCATION data for this fund. Search specifically for the portfolio breakdown, NOT just the fund summary page.

Search queries to try in order:
1. "${fullName} portfolio holdings ${new Date().getFullYear()}"
2. "${fullName} fund facts asset allocation"
3. "${code} ${fundCompany} portfolio top holdings"

From whatever you find, extract:
- assetAllocation: Array of {name, percent} using these standard names ONLY: "Canadian equity", "US equity", "International equity", "Global equity", "Fixed income", "Cash & equivalents", "Real estate — listed", "Private alternatives", "Other"
- geographicAllocation: Array of {name, percent} using these standard names ONLY: "Canada", "United States", "Europe", "Japan", "Asia ex-Japan", "Other/EM"

If you cannot find specific allocation data, return empty arrays.
Return JSON only with fields: assetAllocation, geographicAllocation`;

    let assetAllocation = [];
    let geographicAllocation = [];

    try {
      const phase2Response = await client.messages.create({
        model: FUND_RESEARCH_MODEL,
        max_tokens: 1200,
        system: phase2Prompt,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }],
        messages: [{ role: 'user', content: `Find the portfolio holdings breakdown for "${fullName}" (${code}).` }],
      });

      const phase2Text = phase2Response.content.filter((b) => b.type === 'text').pop()?.text || '';
      const phase2Match = phase2Text.match(/\{[\s\S]*\}/);
      if (phase2Match) {
        const phase2 = JSON.parse(phase2Match[0]);
        assetAllocation = phase2.assetAllocation || [];
        geographicAllocation = phase2.geographicAllocation || [];
      }
    } catch (err) {
      console.error(`Phase 2 failed for ${code}:`, err.message);
    }

    const allocationMissing = assetAllocation.length === 0 && geographicAllocation.length === 0;
    const statusLabel = allocationMissing ? `${code} — verified (no allocation data)` : `${code} — verified`;
    onStatus?.(statusLabel);

    return {
      code,
      verified: true,
      fullName: phase1.fullName,
      fundCompany: phase1.fundCompany || null,
      cifscCategory: phase1.cifscCategory || null,
      benchmarkIndex: phase1.benchmarkIndex || null,
      riskRating: phase1.riskRating || null,
      mer: phase1.mer ?? null,
      distributionYield: phase1.distributionYield ?? null,
      distributionFrequency: phase1.distributionFrequency ?? null,
      assetAllocation,
      geographicAllocation,
      dataAsAt: phase1.dataAsAt || null,
      confidence: phase1.confidence || 'Medium',
      allocationMissing,
    };
  } catch (err) {
    console.error(`Fund research failed for ${code}:`, err.message);
    onStatus?.(`${code} — error`);
    return { code, verified: false, fullName: null, confidence: 'Low' };
  }
}

async function researchFunds(fundCodes, onStatus) {
  if (fundCodes.length === 0) return {};

  // Run sequentially so status messages are readable one at a time
  const fundResults = {};
  for (const code of fundCodes) {
    const result = await researchSingleFund(code, onStatus);
    fundResults[result.code] = result;
  }
  return fundResults;
}

export async function analyseCSV(csvData, onStatus) {
  if (!client) throw new Error('API key not set');

  onStatus?.('Parsing accounts and holdings…');
  const parsedData = parseCSVData(csvData);
  const classification = classifyAndFlag(parsedData);

  // Research fund codes via Claude web search
  onStatus?.('Researching holdings via web search…');
  const fundResults = await researchFunds(classification.fundCodes, onStatus);

  // Identify funds needing clarifying questions
  const questionableFunds = Object.entries(fundResults)
    .filter(([, r]) => !r.verified || r.allocationMissing)
    .map(([code, r]) => ({ code, verified: r.verified, allocationMissing: r.allocationMissing, fullName: r.fullName }));

  // Full analysis via Claude
  onStatus?.('Analyzing asset allocation…');
  const prompt = buildAnalysisPrompt(parsedData, classification);
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse Claude analysis response');

  const analysisResult = JSON.parse(jsonMatch[0]);

  // Merge fund research into holdings
  if (analysisResult.assetClasses) {
    for (const assetClass of analysisResult.assetClasses) {
      for (const asset of assetClass.assets || []) {
        for (const holding of asset.holdings || []) {
          if (holding.code && fundResults[holding.code]) {
            holding.researchResult = fundResults[holding.code];
          }
        }
      }
    }
  }

  // Add clarifying questions for unverified or allocation-missing funds
  if (!analysisResult.clarifyingQuestions) analysisResult.clarifyingQuestions = [];
  for (const { code, verified, allocationMissing, fullName } of questionableFunds) {
    // Mark the holding with unverifiedBadge if not verified
    if (!verified && analysisResult.assetClasses) {
      for (const assetClass of analysisResult.assetClasses) {
        for (const asset of assetClass.assets || []) {
          for (const holding of asset.holdings || []) {
            if (holding.code === code) {
              holding.unverifiedBadge = true;
            }
          }
        }
      }
    }

    const question = !verified
      ? `Fund code "${code}" couldn't be identified. Please upload the fund fact sheet PDF or paste the fund page URL.`
      : `Fund "${fullName}" (${code}) was identified but we couldn't find its underlying holdings breakdown. Please upload the fund fact sheet PDF so we can show the correct asset allocation.`;

    const context = !verified
      ? `Fund code ${code} could not be matched to a known fund with high confidence.`
      : `Fund ${code} was verified as "${fullName}" but detailed allocation data is missing.`;

    analysisResult.clarifyingQuestions.push({
      id: `fund_${code}`,
      question,
      context,
      relatedAssetId: null,
      type: 'fund_confirm',
    });
  }

  // Strip advisory language
  delete analysisResult.planningFlags;
  delete analysisResult.assumptionsAndNotes;

  if (!analysisResult.owners || analysisResult.owners.length === 0) {
    analysisResult.owners = parsedData.owners;
  }

  return { data: analysisResult, fundResearch: fundResults };
}

async function extractFundDataFromPDF(question, answer) {
  const content = [
    {
      type: 'document',
      source: {
        type: 'base64',
        media_type: answer.pdf.mediaType,
        data: answer.pdf.base64,
      },
    },
    {
      type: 'text',
      text: `This is a fund fact sheet PDF for the question: "${question.question}"
${answer.text ? 'Advisor note: ' + answer.text : ''}

Extract the following and return as JSON only:
- code: the fund code if visible
- fullName: official fund name
- fundCompany: fund manager/company
- cifscCategory: CIFSC category
- benchmarkIndex: benchmark index if shown
- riskRating: risk rating if shown
- mer: MER as a number (e.g. 1.25)
- distributionYield: trailing 12-month yield as a number
- distributionFrequency: "Monthly", "Quarterly", "Annually", or null
- assetAllocation: array of {name, percent} using: "Canadian equity", "US equity", "International equity", "Global equity", "Fixed income", "Cash & equivalents", "Real estate — listed", "Private alternatives", "Other"
- geographicAllocation: array of {name, percent} using: "Canada", "United States", "Europe", "Japan", "Asia ex-Japan", "Other/EM"
- dataAsAt: date of data if shown
- confidence: "High" if you can clearly read the data, "Medium" if partially legible

Return JSON only.`,
    },
  ];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{ role: 'user', content }],
  });

  const text = response.content[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  const result = JSON.parse(jsonMatch[0]);
  const isVerified = (result.confidence === 'High' || result.confidence === 'Medium') && result.fullName;
  return {
    code: result.code || null,
    verified: !!isVerified,
    fullName: isVerified ? result.fullName : null,
    fundCompany: isVerified ? result.fundCompany : null,
    cifscCategory: isVerified ? result.cifscCategory : (result.cifscCategory || null),
    benchmarkIndex: result.benchmarkIndex || null,
    riskRating: result.riskRating || null,
    mer: result.mer ?? null,
    distributionYield: result.distributionYield ?? null,
    distributionFrequency: result.distributionFrequency ?? null,
    assetAllocation: result.assetAllocation || [],
    geographicAllocation: result.geographicAllocation || [],
    dataAsAt: result.dataAsAt || null,
    confidence: result.confidence || 'Low',
  };
}

export async function submitChat(currentData, questions, answers) {
  if (!client) throw new Error('API key not set');

  // Process any PDF attachments first — extract fund data from each
  const pdfResults = {};
  for (let i = 0; i < questions.length; i++) {
    const answer = answers[i];
    if (answer && typeof answer === 'object' && answer.pdf) {
      try {
        const fundData = await extractFundDataFromPDF(questions[i], answer);
        if (fundData) {
          // Find the fund code this question relates to
          const codeMatch = questions[i].id?.match(/^fund_(.+)$/);
          const fundCode = codeMatch?.[1] || fundData.code;
          if (fundCode) {
            pdfResults[fundCode] = fundData;
          }
        }
      } catch (err) {
        console.error('PDF extraction failed:', err.message);
      }
    }
  }

  // Merge PDF fund results into currentData holdings
  if (Object.keys(pdfResults).length > 0) {
    for (const assetClass of currentData.assetClasses || []) {
      for (const asset of assetClass.assets || []) {
        for (const holding of asset.holdings || []) {
          if (holding.code && pdfResults[holding.code]) {
            holding.researchResult = pdfResults[holding.code];
            holding.unverifiedBadge = false;
          }
        }
      }
    }
  }

  // Build text-only answers for the main chat synthesis (exclude PDF objects)
  const textAnswers = answers.map((a) => {
    if (a && typeof a === 'object' && a.pdf) {
      return a.text ? `${a.text} [Fund fact sheet PDF was processed and data extracted]` : '[Fund fact sheet PDF was processed and data extracted]';
    }
    return a;
  });

  const prompt = buildChatPrompt(currentData, questions, textAnswers);
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: CHAT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    const updated = JSON.parse(jsonMatch[0]);
    delete updated.planningFlags;
    delete updated.assumptionsAndNotes;

    // Re-merge PDF fund results into updated data
    if (Object.keys(pdfResults).length > 0) {
      for (const assetClass of updated.assetClasses || []) {
        for (const asset of assetClass.assets || []) {
          for (const holding of asset.holdings || []) {
            if (holding.code && pdfResults[holding.code]) {
              holding.researchResult = pdfResults[holding.code];
              holding.unverifiedBadge = false;
            }
          }
        }
      }
    }

    return { data: updated };
  }

  return { data: currentData };
}
