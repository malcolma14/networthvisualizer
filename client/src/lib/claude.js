import Anthropic from '@anthropic-ai/sdk';
import {
  ANALYSIS_SYSTEM_PROMPT,
  CHAT_SYSTEM_PROMPT,
  buildAnalysisPrompt,
  buildChatPrompt,
} from './promptBuilder.js';
import { parseCSVData } from './csvParser.js';
import { classifyAndFlag } from './assetClassifier.js';

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

async function researchSingleFund(code) {
  const searchStrategy = buildSearchStrategy(code);

  const systemPrompt = `You are a Canadian investment fund research assistant. Use the web_search tool to look up fund code "${code}".

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
- assetAllocation: Array of {name, percent} using these standard names ONLY: "Canadian equity", "US equity", "International equity", "Global equity", "Fixed income", "Cash & equivalents", "Real estate — listed", "Private alternatives", "Other"
- geographicAllocation: Array of {name, percent} using these standard names ONLY: "Canada", "United States", "Europe", "Japan", "Asia ex-Japan", "Other/EM"
- dataAsAt: Date of data if known, else null
- confidence: "High", "Medium", or "Low"

CONFIDENCE RULES:
- "High": You found the exact fund page and extracted detailed data
- "Medium": You identified the fund name and CIFSC category but could not get full allocation tables. This is STILL VALID — set verified fields.
- "Low": You could not confidently identify the fund at all — set fullName to null

CRITICAL:
- NEVER guess a name with High confidence — better to say Medium or Low than be wrong
- A fund identified by name + CIFSC category (even without full allocation data) should be "Medium" confidence, NOT "Low"
- Respond with JSON only — no markdown fences, no explanation`;

  try {
    const response = await client.messages.create({
      model: FUND_RESEARCH_MODEL,
      max_tokens: 1200,
      system: systemPrompt,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
      messages: [{ role: 'user', content: `Look up fund code "${code}" and return the JSON object.` }],
    });

    const textBlock = response.content.filter((b) => b.type === 'text').pop();
    const text = textBlock?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { code, verified: false, fullName: null, confidence: 'Low' };
    }

    const result = JSON.parse(jsonMatch[0]);
    const isVerified = (result.confidence === 'High' || result.confidence === 'Medium') && result.fullName;

    return {
      code,
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
  } catch (err) {
    console.error(`Fund research failed for ${code}:`, err.message);
    return { code, verified: false, fullName: null, confidence: 'Low' };
  }
}

async function researchFunds(fundCodes) {
  if (fundCodes.length === 0) return {};

  const results = await Promise.all(fundCodes.map((code) => researchSingleFund(code)));

  const fundResults = {};
  for (const result of results) {
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
  const fundResults = await researchFunds(classification.fundCodes);

  // Identify unverified funds to add as clarifying questions later
  const unverifiedFunds = Object.entries(fundResults)
    .filter(([, r]) => !r.verified)
    .map(([code]) => code);

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

  // Add clarifying questions for unverified funds
  if (!analysisResult.clarifyingQuestions) analysisResult.clarifyingQuestions = [];
  for (const code of unverifiedFunds) {
    // Mark the holding with unverifiedBadge
    if (analysisResult.assetClasses) {
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

    analysisResult.clarifyingQuestions.push({
      id: `fund_${code}`,
      question: `I couldn't verify fund code "${code}" via web search. Can you confirm what this fund holds? You can paste a public URL to the fund fact sheet or describe it.`,
      context: `Fund code ${code} could not be matched to a known fund with high confidence.`,
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
