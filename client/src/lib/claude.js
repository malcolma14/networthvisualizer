import Anthropic from '@anthropic-ai/sdk';
import {
  ANALYSIS_SYSTEM_PROMPT,
  CHAT_SYSTEM_PROMPT,
  buildAnalysisPrompt,
  buildChatPrompt,
} from './promptBuilder.js';
import { parseCSVData } from './csvParser.js';
import { classifyAndFlag } from './assetClassifier.js';

let client = null;

export function initClient() {
  const key = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error('Missing VITE_ANTHROPIC_API_KEY environment variable');
  }
  if (!client) {
    client = new Anthropic({
      apiKey: key,
      dangerouslyAllowBrowser: true,
    });
  }
}

export function isClientReady() {
  return client !== null;
}

const FUND_RESEARCH_MODEL = 'claude-sonnet-4-20250514';

async function researchSingleFund(code) {
  const systemPrompt = `You are a Canadian investment fund research assistant. Use the web_search tool to look up fund code "${code}" on FundLibrary.com or other Canadian fund sources.

Search strategy:
1. First search: "${code} site:fundlibrary.com"
2. If that yields nothing useful, search: "${code} fund fact sheet Canada"

Return a JSON object with these fields:
- code: "${code}"
- fullName: Official fund name (null if uncertain)
- fundCompany: Fund manager/company (null if uncertain)
- cifscCategory: CIFSC category e.g. "Global Equity" (null if uncertain)
- mer: MER as a number e.g. 1.25 (null if unknown)
- distributionYield: Trailing 12-month yield as a number (null if unknown)
- distributionFrequency: "Monthly", "Quarterly", "Annually", or null
- assetAllocation: Array of {name, percent} using these standard names ONLY: "Canadian equity", "US equity", "International equity", "Global equity", "Fixed income", "Cash & equivalents", "Real estate — listed", "Private alternatives", "Other"
- geographicAllocation: Array of {name, percent} using these standard names ONLY: "Canada", "United States", "Europe", "Japan", "Asia ex-Japan", "Other/EM"
- dataAsAt: Date of data if known, else null
- confidence: "High", "Medium", or "Low"

CRITICAL:
- If you cannot confidently identify the fund, set confidence to "Low" and fullName to null
- NEVER guess a name with high confidence — better to say "Low" than be wrong
- For IG Wealth Management funds (codes starting with "IGI" or "IG"), these are Investors Group / IG Wealth Management proprietary funds
- For DFA funds, these are Dimensional Fund Advisors funds available in Canada
- Respond with JSON only — no markdown fences, no explanation`;

  try {
    const response = await client.messages.create({
      model: FUND_RESEARCH_MODEL,
      max_tokens: 1200,
      system: systemPrompt,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      messages: [{ role: 'user', content: `Look up fund code "${code}" and return the JSON object.` }],
    });

    // Extract the final text block from the response
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
      cifscCategory: isVerified ? result.cifscCategory : null,
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

export async function submitChat(currentData, questions, answers) {
  if (!client) throw new Error('API key not set');

  const prompt = buildChatPrompt(currentData, questions, answers);
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
    return { data: updated };
  }

  return { data: currentData };
}
