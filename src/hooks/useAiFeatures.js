import { useState, useEffect } from 'react';
import { CATEGORIES } from '../utils/categorizer';
import { callGemini } from '../utils/gemini';

export function useAiFeatures({ expenses, hasLoggedToday, isOffline, budget, totalSpent, totalSubscriptionCost, subscriptions, safeDailyLimit, currSymbol }) {
  const [dailyReminder, setDailyReminder] = useState('');
  const [aiInsights, setAiInsights] = useState('');
  const [isAiInsightsLoading, setIsAiInsightsLoading] = useState(false);
  const [aiForecast, setAiForecast] = useState('');
  const [isAiForecastLoading, setIsAiForecastLoading] = useState(false);

  // Fetch or retrieve daily reminder message
  useEffect(() => {
    if (hasLoggedToday) {
      setDailyReminder('');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const cachedReminder = sessionStorage.getItem(`expenser_reminder_${todayStr}`);

    if (cachedReminder) {
      setDailyReminder(cachedReminder);
      return;
    }

    if (isOffline) {
      setDailyReminder('⚠️ Log your daily expenses to keep your streaks alive!');
      return;
    }

    const fetchReminder = async () => {
      try {
        const text = await callGemini(
          [{ text: `Generate a single short, creative, motivational or witty notification alert message (maximum 8 words, no punctuation) reminding a user to log their daily expenses. Return ONLY the message string.` }],
          { models: ['gemini-2.5-flash'] }
        );
        const reminderText = text || '⚠️ You haven\'t logged any expenses today! Keep your streaks alive.';
        setDailyReminder(reminderText);
        sessionStorage.setItem(`expenser_reminder_${todayStr}`, reminderText);
      } catch {
        const defaultMsg = '⚠️ You haven\'t logged any expenses today! Keep your streaks alive.';
        setDailyReminder(defaultMsg);
        sessionStorage.setItem(`expenser_reminder_${todayStr}`, defaultMsg);
      }
    };

    fetchReminder();
  }, [expenses, hasLoggedToday, isOffline]);

  // Fetch AI Financial Insights from Gemini with smart offline fallback
  const fetchAiInsights = async () => {
    setIsAiInsightsLoading(true);
    setAiInsights('');

    // Calculate category totals for prompts/fallbacks
    const categoryTotals = {};
    expenses.forEach(e => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });

    // Find highest spending category
    let highestCat = 'Others';
    let highestAmt = 0;
    Object.entries(categoryTotals).forEach(([cat, amt]) => {
      if (amt > highestAmt) {
        highestAmt = amt;
        highestCat = CATEGORIES[cat]?.name || cat;
      }
    });

    if (isOffline) {
      const limitStatus = budget - totalSpent;
      const offlineTips = [
        `💡 Running Offline - showing local diagnostics:`,
        `• Highest spending: ${highestCat} at ${currSymbol}${highestAmt.toFixed(2)}.`,
        totalSubscriptionCost > 0
          ? `• Recurring bills: ${subscriptions.length} subscriptions totaling ${currSymbol}${totalSubscriptionCost.toFixed(2)}/mo.`
          : `• Tip: Setting up recurring budgets for utilities helps forecast fixed costs.`,
        limitStatus < 0
          ? `• Warning: You are currently over budget by ${currSymbol}${Math.abs(limitStatus).toFixed(2)}.`
          : `• Status: ${currSymbol}${limitStatus.toFixed(2)} remaining. Safe limit is ${currSymbol}${safeDailyLimit.toFixed(2)}/day.`
      ];

      setAiInsights(offlineTips.join('\n'));
      setIsAiInsightsLoading(false);
      return;
    }

    try {
      const text = await callGemini([{
        text: `Analyze this monthly budget status:
                - Overall Budget: ${currSymbol}${budget}
                - Total Spent: ${currSymbol}${totalSpent}
                - Recurring Bills Total: ${currSymbol}${totalSubscriptionCost}
                - Spending per Category: ${JSON.stringify(categoryTotals)}
                Please provide exactly 3 concise, bulleted, actionable savings suggestions in clean text (no markdown formatting, no stars). Keep it brief.`
      }]);
      setAiInsights(text);
      setIsAiInsightsLoading(false);
      return;
    } catch (e) {
      console.warn('Both Gemini APIs failed, using local mathematical insights fallback.', e);

      // Smart Fallback insights based on actual user data
      const limitStatus = budget - totalSpent;
      const fallbackTips = [
        `• Your highest spending category is ${highestCat} at ${currSymbol}${highestAmt.toFixed(2)}. Consider cutting down on non-essential items here.`,
        totalSubscriptionCost > 0
          ? `• You have ${subscriptions.length} recurring subscription(s) totaling ${currSymbol}${totalSubscriptionCost.toFixed(2)}/month. Review these to ensure you still get value from all of them.`
          : `• Plan ahead: setting up recurring categories for utilities and bills will help you forecast fixed monthly expenses.`,
        limitStatus < 0
          ? `• You are currently over budget by ${currSymbol}${Math.abs(limitStatus).toFixed(2)}. Reduce discretionary spending immediately to balance your sheet.`
          : `• You have ${currSymbol}${limitStatus.toFixed(2)} remaining. Keeping your daily spending under ${currSymbol}${safeDailyLimit.toFixed(2)} will guarantee you stay within budget.`
      ];

      setAiInsights(fallbackTips.join('\n'));
    }
    setIsAiInsightsLoading(false);
  };

  const fetchAiForecast = async () => {
    setIsAiForecastLoading(true);
    setAiForecast('');

    // Calculate category totals
    const categoryTotals = {};
    expenses.forEach(e => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });

    // Find highest category
    let highestCat = 'Others';
    let highestAmt = 0;
    Object.entries(categoryTotals).forEach(([cat, amt]) => {
      if (amt > highestAmt) {
        highestAmt = amt;
        highestCat = CATEGORIES[cat]?.name || cat;
      }
    });

    if (isOffline) {
      const projectedSpent = totalSpent * 1.05;
      const fallbackForecast = `🔮 Projected next month's spending: ${currSymbol}${projectedSpent.toFixed(2)} (Based on current spent of ${currSymbol}${totalSpent.toFixed(2)}).\n` +
        `• Category Warning: Your highest spending category is ${highestCat}. Expect this to remain your primary cost area next month.\n` +
        `• Tip: Pause unused subscriptions to save up to ${currSymbol}${totalSubscriptionCost.toFixed(2)} monthly.`;
      setAiForecast(fallbackForecast);
      setIsAiForecastLoading(false);
      return;
    }

    try {
      const text = await callGemini(
        [{
          text: `Analyze these expense details:
              - Overall Monthly Budget: ${currSymbol}${budget}
              - Total Spent so far: ${currSymbol}${totalSpent}
              - Recurring Bills Total: ${currSymbol}${totalSubscriptionCost}
              - Spending Category Breakdown: ${JSON.stringify(categoryTotals)}
              Predict next month's spending projection in clean text. Provide a projected total cost, a brief prediction explanation, and 2 predictive rules to keep costs lower next month. Keep it short and actionable.`
        }],
        { models: ['gemini-3.1-flash-lite'] }
      );
      setAiForecast(text);
    } catch (err) {
      console.error('Failed to load AI Forecast:', err);
      const projectedSpent = totalSpent * 1.05;
      setAiForecast(`🔮 Projection: ${currSymbol}${projectedSpent.toFixed(2)}\nAn error occurred loading the cloud AI forecast. Try again online.`);
    } finally {
      setIsAiForecastLoading(false);
    }
  };

  return {
    dailyReminder,
    aiInsights, isAiInsightsLoading, fetchAiInsights,
    aiForecast, isAiForecastLoading, fetchAiForecast
  };
}
