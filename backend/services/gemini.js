import { GoogleGenerativeAI } from '@google/generative-ai';

// Per-user Gemini clients (keyed by userId)
const clients = new Map();

export function initGemini(userId, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  clients.set(userId, { genAI, apiKey });
}

export function getClient(userId) {
  return clients.get(userId) || null;
}

export function hasClient(userId) {
  return clients.has(userId);
}

export async function validateApiKey(apiKey) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });
    const result = await model.generateContent('Say "valid" in one word.');
    const text = result.response.text();
    return { valid: true, text };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

export async function generateText(userId, prompt, systemPrompt = '') {
  const clientData = clients.get(userId);
  if (!clientData) throw new Error('No Gemini client for user. Please set API key.');

  const model = clientData.genAI.getGenerativeModel({
    model: 'gemini-3.1-flash-lite-preview',
    systemInstruction: systemPrompt || undefined,
  });

  const result = await model.generateContent(prompt);
  return result.response.text();
}
