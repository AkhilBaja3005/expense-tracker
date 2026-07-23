import { callGemini } from './gemini';

// Default categories with metadata
export const CATEGORIES = {
  Food: { name: 'Food & Dining', color: '#f59e0b', icon: '🍔' },
  Transport: { name: 'Transport & Auto', color: '#3b82f6', icon: '🚗' },
  Shopping: { name: 'Shopping', color: '#ec4899', icon: '🛍️' },
  Bills: { name: 'Bills & Utilities', color: '#10b981', icon: '🔌' },
  Entertainment: { name: 'Entertainment', color: '#8b5cf6', icon: '🎬' },
  Health: { name: 'Health & Fitness', color: '#ef4444', icon: '🏥' },
  Others: { name: 'Others', color: '#6b7280', icon: '📦' }
};

// Keyword mapping for initial matching
const KEYWORDS = {
  Food: ['food', 'dining', 'restaurant', 'cafe', 'starbucks', 'mcdonald', 'burger', 'pizza', 'dinner', 'lunch', 'breakfast', 'grocery', 'supermarket', 'walmart', 'target', 'eat', 'coffee', 'bakery'],
  Transport: ['uber', 'lyft', 'taxi', 'gas', 'fuel', 'petrol', 'diesel', 'metro', 'bus', 'train', 'flight', 'ticket', 'parking', 'cab', 'toll'],
  Shopping: ['amazon', 'ebay', 'cloth', 'shoe', 'shirt', 'pants', 'mall', 'shop', 'online', 'store', 'apparel', 'gift', 'buy'],
  Bills: ['rent', 'electricity', 'water', 'internet', 'wifi', 'phone', 'mobile', 'bill', 'subscription', 'netflix', 'spotify', 'apple', 'icloud', 'insurance', 'tax'],
  Entertainment: ['cinema', 'movie', 'concert', 'game', 'gaming', 'pub', 'bar', 'club', 'party', 'show', 'theater', 'fun', 'ticket'],
  Health: ['gym', 'fitness', 'pharmacy', 'medicine', 'doctor', 'dentist', 'hospital', 'workout', 'clinic', 'pill', 'health']
};

const STORAGE_KEY = 'expenser_custom_categorization';

// Get custom rules from localStorage
function getCustomRules() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

// Save custom rules to localStorage
function saveCustomRules(rules) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch (e) {
    console.error('Failed to save categorization rules', e);
  }
}

/**
 * Suggests a category based on the description using fast local matching first.
 * @param {string} description 
 * @returns {string} Category key
 */
export function suggestCategory(description) {
  if (!description || typeof description !== 'string') return 'Others';
  const cleanDesc = description.trim().toLowerCase();
  if (!cleanDesc) return 'Others';

  // 1. Check custom user-learned rules
  const customRules = getCustomRules();
  if (customRules[cleanDesc]) {
    return customRules[cleanDesc];
  }

  // 2. Keyword check
  for (const [catKey, keywords] of Object.entries(KEYWORDS)) {
    for (const keyword of keywords) {
      if (cleanDesc.includes(keyword)) {
        return catKey;
      }
    }
  }

  return 'Others';
}

/**
 * Fetches categorization from Gemini API as a fallback or enhancement
 * @param {string} description
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>}
 */
export async function suggestCategoryWithGemini(description, signal) {
  if (!description || !description.trim()) return 'Others';

  // First do local fast lookup
  const localGuess = suggestCategory(description);
  if (localGuess !== 'Others') {
    return localGuess;
  }

  try {
    const text = await callGemini(
      [{ text: `Classify this expense description: "${description}". It must map to exactly one of these category keys: Food, Transport, Shopping, Bills, Entertainment, Health, Others. Return ONLY the category key name and absolutely nothing else.` }],
      { models: ['gemini-3.1-flash-lite'], signal }
    );

    if (text && CATEGORIES[text]) {
      return text;
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      console.error('Gemini categorization failed, using fallback', e);
    }
  }

  return 'Others';
}

/**
 * Learns a new mapping for a description
 * @param {string} description 
 * @param {string} categoryKey 
 */
export function learnCategory(description, categoryKey) {
  if (!description || !categoryKey || !CATEGORIES[categoryKey]) return;
  const cleanDesc = description.trim().toLowerCase();
  if (!cleanDesc) return;

  const customRules = getCustomRules();
  customRules[cleanDesc] = categoryKey;
  saveCustomRules(customRules);
}
