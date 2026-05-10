const Anthropic = require('@anthropic-ai/sdk');

async function moderateText(text) {
  if (!process.env.ANTHROPIC_API_KEY || !text?.trim()) return { ok: true };

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 60,
      messages: [{
        role: 'user',
        content: `You are a content moderator for a professional business networking platform for entrepreneurs and investors. Flag ONLY clearly inappropriate content: hate speech, sexual content, threats, or obvious spam. Normal business language, frustration, or informal tone is fine. Reply with ONLY "PASS" or "FAIL: <one-line reason>".

Content: ${text.trim()}`,
      }],
    });
    const raw = (response.content[0]?.text || '').trim();
    if (raw.toUpperCase().startsWith('FAIL')) {
      const reason = raw.replace(/^FAIL[:\s]*/i, '').trim() || 'Content flagged by moderation';
      return { ok: false, reason };
    }
    return { ok: true };
  } catch {
    return { ok: true }; // fail open — never block users if AI is unavailable
  }
}

module.exports = { moderateText };
