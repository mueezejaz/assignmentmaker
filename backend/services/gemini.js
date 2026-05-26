import { GoogleGenAI } from '@google/genai';

// Per-user GoogleGenAI clients (keyed by userId)
const clients = new Map();

export function initGemini(userId, apiKey) {
  const ai = new GoogleGenAI({ apiKey });
  clients.set(userId, { ai, apiKey });
}

export function getClient(userId) {
  return clients.get(userId) || null;
}

export function hasClient(userId) {
  return clients.has(userId);
}

export async function validateApiKey(apiKey) {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: 'Say "valid" in one word.',
    });
    const text = response.text;
    console.log(text)
    return { valid: true, text };
  } catch (err) {
    console.log("this is error", err)
    return { valid: false, error: err.message };
  }
}

export async function generateText(userId, prompt, systemPrompt = '') {
  const clientData = clients.get(userId);
  if (!clientData) throw new Error('No Gemini client for user. Please set API key.');

  const { ai } = clientData;

  const config = {};
  if (systemPrompt) {
    config.systemInstruction = systemPrompt;
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents: prompt,
    config: Object.keys(config).length > 0 ? config : undefined,
  });

  return response.text;
}