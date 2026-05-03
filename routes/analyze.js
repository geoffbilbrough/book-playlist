const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    analysis: {
      type: 'object',
      properties: {
        mood: { type: 'string' },
        themes: { type: 'array', items: { type: 'string' } },
        setting: { type: 'string' },
        era: { type: 'string' },
        characters: { type: 'string' },
      },
      required: ['mood', 'themes', 'setting', 'era', 'characters'],
      additionalProperties: false,
    },
    songs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          artist: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['title', 'artist', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['analysis', 'songs'],
  additionalProperties: false,
};

// POST /api/analyze
const ERA_INSTRUCTIONS = {
  'contemporary':  'Choose songs from any era — let the themes, mood, and emotional arc guide your selections freely.',
  'pre-1940s':     'Choose songs recorded or written before 1940 — blues, jazz, folk, classical, and early popular music.',
  '1940s-1960s':   'Choose songs from the 1940s, 1950s, and 1960s — jazz, early rock and roll, soul, folk, and big band.',
  '1960s-1980s':   'Choose songs from the 1960s and 1970s — rock, folk, soul, funk, and the singer-songwriter era.',
  '1980s-2000s':   'Choose songs from the 1980s and 1990s — pop, rock, hip-hop, R&B, and alternative.',
  '2000s-2020s':   'Choose songs from the 2000s and 2010s — indie, pop, hip-hop, electronic, and modern alternatives.',
};

router.post('/analyze', async (req, res) => {
  const { title, author, era = 'contemporary' } = req.body;

  if (!title?.trim() || !author?.trim()) {
    return res.status(400).json({ error: 'Book title and author are required.' });
  }

  const eraInstruction = ERA_INSTRUCTIONS[era] || ERA_INSTRUCTIONS['contemporary'];

  try {
    const stream = await anthropic.messages.stream({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      output_config: {
        format: {
          type: 'json_schema',
          schema: OUTPUT_SCHEMA,
        },
      },
      system: `You are a music curator with deep knowledge of literature.
You create thoughtful playlists that enhance the reading experience of books.
When given a book, you analyse its emotional landscape and suggest songs that a
discerning reader would genuinely want to listen to while reading.
Mix genres and energy levels to reflect the full arc of the book.
Use New Zealand English spelling in all your responses (e.g. analyse, colour, realise, favourite).`,
      messages: [
        {
          role: 'user',
          content: `Analyse the book "${title}" by ${author} and create a playlist of exactly 15 songs that perfectly complement it.

For the analysis, describe:
- mood: the overall emotional atmosphere
- themes: 3–5 key themes as an array of short phrases
- setting: where and when the story takes place
- era: the time period of the story
- characters: a brief description of the key characters and their emotional journeys

For the songs, choose tracks that:
- Reflect the book's emotional arc (don't just pick upbeat or just melancholy)
- Span different genres for variety within the selected era
- Include some well-known tracks and some unexpected choices
- Each song's "reason" should be 1–2 sentences explaining the connection to the book
- ERA CONSTRAINT: ${eraInstruction}

Return exactly 15 songs.`,
        },
      ],
    });

    const message = await stream.finalMessage();
    const textBlock = message.content.find((b) => b.type === 'text');

    if (!textBlock) {
      return res.status(500).json({ error: 'No response from AI. Please try again.' });
    }

    const data = JSON.parse(textBlock.text);
    res.json(data);
  } catch (err) {
    console.error('Analyze error:', err.message);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Analysis failed. Please try again.' });
  }
});

module.exports = router;
