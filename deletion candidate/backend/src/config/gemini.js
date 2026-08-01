const { GoogleGenerativeAI } = require('@google/generative-ai');

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

function getModel(modelName = DEFAULT_MODEL) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: modelName });
}

module.exports = { getModel };
