require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

const SYSTEM_PROMPT = `You write article summaries in a warm, conversational storytelling style. Always two paragraphs. The first paragraph sets the scene. The second adds reflection or wider meaning. Simple accessible English with an Indian cultural context where fitting. Use small sensory details, humanize the characters, and end with an emotional close. No bullet points. No headers. Tone is like explaining a good story to a friend over chai. Always refer to the writer as "the author" only, never use any names. No em dashes anywhere. Make the language feel natural and human, not literary or over-explained. Do not stretch a moment longer than it needs to go. Keep details simple and direct. Occasionally make a small typo or miss a comma to feel naturally human. Around 400 words per summary. When a sentence can be shorter and still land the same feeling, make it shorter. The emotional close should be tight, not layered with too many reflections piled on top of each other.

When given an image of an article, extract its content and summarise it following these rules exactly.`;

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  try {
    const lastMessage = messages[messages.length - 1];
    const parts = [];

    for (const block of lastMessage.content) {
      if (block.type === 'text') {
        parts.push({ text: block.text });
      } else if (block.type === 'image') {
        parts.push({
          inlineData: {
            mimeType: block.source.media_type,
            data: block.source.data
          }
        });
      }
    }

    const history = messages.slice(0, -1).map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: typeof msg.content === 'string'
        ? [{ text: msg.content }]
        : msg.content.map(b => ({ text: b.text || '' }))
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [
            ...history,
            { role: 'user', parts }
          ]
        })
      }
    );

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: { message: data.error.message } });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response received.';
    res.json({ content: [{ text }] });

  } catch (err) {
    res.status(500).json({ error: { message: 'Server error: ' + err.message } });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Running at http://localhost:${PORT}`));