import Anthropic from '@anthropic-ai/sdk';
import {
  ANALYSIS_SYSTEM_PROMPT,
  FUND_RESEARCH_SYSTEM_PROMPT,
  CHAT_SYSTEM_PROMPT,
  buildAnalysisPrompt,
  buildChatPrompt,
} from './promptBuilder.js';
import { parseCSVData } from './csvParser.js';
import { classifyAndFlag } from './assetClassifier.js';

let client = null;

export function initClient(apiKey) {
  client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });
}

export function isClientReady() {
  return client !== null;
}

async function researchFund(fundCode) {
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 500,
      system: FUND_RESEARCH_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: `Research this Canadian investment fund code: ${fundCode}` },
      ],
    });

    const text = response.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);

    return {
      fullName: 'Unknown',
      manager: 'Unknown',
      assetClass: 'Unknown',
      description: `Could not identify fund ${fundCode}`,
      confidence: 'Low',
    };
  } catch (err) {
    console.error(`Fund research failed for ${fundCode}:`, err.message);
    return {
      fullName: 'Unknown',
      manager: 'Unknown',
      assetClass: 'Unknown',
      description: `Research failed for ${fundCode}`,
      confidence: 'Low',
    };
  }
}

export async function analyseCSV(csvData, onStatus) {
  if (!client) throw new Error('API key not set');

  onStatus?.('Parsing accounts and holdings…');
  const parsedData = parseCSVData(csvData);
  const classification = classifyAndFlag(parsedData);

  // Research fund codes in parallel
  onStatus?.('Researching holdings…');
  const fundResults = {};
  if (classification.fundCodes.length > 0) {
    const results = await Promise.all(
      classification.fundCodes.map(async (code) => {
        const result = await researchFund(code);
        return { code, result };
      })
    );
    results.forEach(({ code, result }) => {
      fundResults[code] = result;
    });
  }

  // Full analysis via Claude
  onStatus?.('Analyzing asset allocation…');
  const prompt = buildAnalysisPrompt(parsedData, classification);
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
    system: ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse Claude analysis response');

  const analysisResult = JSON.parse(jsonMatch[0]);

  // Merge fund research
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

  if (!analysisResult.owners || analysisResult.owners.length === 0) {
    analysisResult.owners = parsedData.owners;
  }

  return { data: analysisResult, fundResearch: fundResults };
}

export async function submitChat(currentData, questions, answers) {
  if (!client) throw new Error('API key not set');

  const prompt = buildChatPrompt(currentData, questions, answers);
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
    system: CHAT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    return { data: JSON.parse(jsonMatch[0]) };
  }

  // Fallback: annotate original data
  const updated = { ...currentData };
  if (!updated.assumptionsAndNotes) updated.assumptionsAndNotes = [];
  answers.forEach((answer, i) => {
    if (answer && questions[i]) {
      updated.assumptionsAndNotes.push(`${questions[i].question} — Advisor: ${answer}`);
    }
  });
  return { data: updated };
}
