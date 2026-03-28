import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { CHAT_SYSTEM_PROMPT, buildChatPrompt } from '../lib/promptBuilder.js';

const router = Router();
const client = new Anthropic();

router.post('/', async (req, res) => {
  try {
    const { currentData, questions, answers } = req.body;

    if (!currentData) {
      return res.status(400).json({ error: 'Missing current analysis data' });
    }

    const prompt = buildChatPrompt(currentData, questions || [], answers || []);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: CHAT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const updatedData = JSON.parse(jsonMatch[0]);
      res.json({ success: true, data: updatedData });
    } else {
      // If Claude doesn't return valid JSON, return original data with answers noted
      const updated = { ...currentData };
      if (!updated.assumptionsAndNotes) updated.assumptionsAndNotes = [];
      answers.forEach((answer, i) => {
        if (answer && questions[i]) {
          updated.assumptionsAndNotes.push(`${questions[i].question} — Advisor: ${answer}`);
        }
      });
      res.json({ success: true, data: updated });
    }
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message || 'Chat synthesis failed' });
  }
});

export { router as chatRoute };
