const DEFAULT_MODELS = ['gemini-2.5-flash', 'gemini-3.1-flash-lite'];

/**
 * Calls the Gemini API, trying each model in order until one succeeds.
 * @param {Array<object>} promptParts - Gemini "parts" array (text and/or inlineData parts)
 * @param {{ models?: string[], signal?: AbortSignal }} [options]
 * @returns {Promise<string>} the trimmed text response
 */
export async function callGemini(promptParts, { models = DEFAULT_MODELS, signal } = {}) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('API Key missing');

  let lastError;
  for (const model of models) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: promptParts }] })
      });

      if (!response.ok) throw new Error(`${model} failed/rate-limited`);
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty response');
      return text.trim();
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      lastError = err;
      if (models.indexOf(model) < models.length - 1) {
        console.warn(`${model} failed, attempting next model...`, err);
      }
    }
  }
  throw lastError;
}
