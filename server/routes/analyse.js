import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { parseCSVData } from '../lib/csvParser.js';
import { classifyAndFlag } from '../lib/assetClassifier.js';
import {
  ANALYSIS_SYSTEM_PROMPT,
  FUND_RESEARCH_SYSTEM_PROMPT,
  buildAnalysisPrompt,
} from '../lib/promptBuilder.js';

const router = Router();
const client = new Anthropic();

async function researchFund(fundCode) {
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 500,
      system: FUND_RESEARCH_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Research this Canadian investment fund code: ${fundCode}`,
        },
      ],
    });

    const text = response.content[0]?.text || '';
    // Try to parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
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

router.post('/', async (req, res) => {
  try {
    const { csvData } = req.body;
    if (!csvData || !Array.isArray(csvData)) {
      return res.status(400).json({ error: 'Invalid CSV data' });
    }

    // Step 1: Parse and classify
    const parsedData = parseCSVData(csvData);
    const classification = classifyAndFlag(parsedData);

    // Step 2: Research fund codes in parallel
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

    // Step 3: Send to Claude for full analysis
    const prompt = buildAnalysisPrompt(parsedData, classification);
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0]?.text || '';
    let analysisResult;

    // Parse the JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      analysisResult = JSON.parse(jsonMatch[0]);
    } else {
      return res.status(500).json({ error: 'Failed to parse Claude analysis response' });
    }

    // Merge fund research into analysis
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

    // Ensure owners is populated
    if (!analysisResult.owners || analysisResult.owners.length === 0) {
      analysisResult.owners = parsedData.owners;
    }

    res.json({ success: true, data: analysisResult, fundResearch: fundResults });
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: err.message || 'Analysis failed' });
  }
});

export { router as analyseRoute };
