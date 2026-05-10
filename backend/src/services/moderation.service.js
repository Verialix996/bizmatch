const { GoogleGenerativeAI } = require('@google/generative-ai');

async function moderateText(text) {
  if (!process.env.GEMINI_API_KEY || !text?.trim()) return { ok: true };

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash', generationConfig: { maxOutputTokens: 60 } });
    const result = await model.generateContent(
      `You are a content moderator for a professional business networking platform for entrepreneurs and investors. Flag ONLY clearly inappropriate content: hate speech, sexual content, threats, or obvious spam. Normal business language, frustration, or informal tone is fine. Reply with ONLY "PASS" or "FAIL: <one-line reason>".

Content: ${text.trim()}`
    );
    const raw = result.response.text().trim();
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
