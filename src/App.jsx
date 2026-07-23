import React, { useState, useEffect } from 'react';
import { 
  getExpenses, 
  addExpense, 
  updateExpense, 
  deleteExpense, 
  getBudget, 
  saveBudget, 
  syncFromCloud, 
  saveCloudSettings,
  getCategoryBudgets,
  saveCategoryBudgets,
  syncOfflineQueue,
  getPendingSyncCount
} from './utils/storage';
import { CATEGORIES } from './utils/categorizer';
import ExpenseForm from './components/ExpenseForm';
import AnalyticsCharts from './components/AnalyticsCharts';
import BudgetModal from './components/BudgetModal';

const CURRENCIES = {
  USD: { symbol: '$', name: 'USD ($)' },
  INR: { symbol: '₹', name: 'INR (₹)' },
  GBP: { symbol: '£', name: 'GBP (£)' }
};

const SORT_OPTIONS = {
  newest: 'Newest First',
  oldest: 'Oldest First',
  highest: 'Highest Amount',
  lowest: 'Lowest Amount'
};

const DATE_FILTERS = {
  all: 'All Time',
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  custom: 'Custom Date'
};

function decodeJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export default function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('expenser_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [expenses, setExpenses] = useState([]);
  const [budget, setBudget] = useState(1000);
  const [categoryBudgets, setCategoryBudgets] = useState({});
  const [currency, setCurrency] = useState('USD');

  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSyncs, setPendingSyncs] = useState(0);
  
  const [activeForm, setActiveForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [activeBudgetModal, setActiveBudgetModal] = useState(false);
  
  // Sorters, date filters, and reminders state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const [dateFilter, setDateFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Mobile Tab State
  const [activeTab, setActiveTab] = useState('dashboard');

  // Chart Period State ('today', 'week', 'month', 'all')
  const [chartPeriod, setChartPeriod] = useState('all');

  // Daily tracker reminder
  const [dailyReminder, setDailyReminder] = useState('');

  // Reconnection Sync Banner
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);

  // Check if user has logged any expenses today
  const hasLoggedToday = expenses.some((exp) => {
    const expDateStr = new Date(exp.date).toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    return expDateStr === todayStr;
  });

  // Track network status & auto-flush sync queue
  useEffect(() => {
    const goOnline = async () => {
      setIsOffline(false);
      setIsSyncing(true);
      await syncOfflineQueue();
      if (user?.id) {
        await syncFromCloud(user.id, () => {
          setExpenses(getExpenses(user.id));
        });
      }
      setIsSyncing(false);
      setPendingSyncs(getPendingSyncCount());
      setShowSyncSuccess(true);
      setTimeout(() => setShowSyncSuccess(false), 3000);
    };
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [user]);

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
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) throw new Error("API Key missing");
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Generate a single short, creative, motivational or witty notification alert message (maximum 8 words, no punctuation) reminding a user to log their daily expenses. Return ONLY the message string.`
              }]
            }]
          })
        });
        if (!response.ok) throw new Error();
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const reminderText = text ? text.trim() : '⚠️ You haven\'t logged any expenses today! Keep your streaks alive.';
        setDailyReminder(reminderText);
        sessionStorage.setItem(`expenser_reminder_${todayStr}`, reminderText);
      } catch (e) {
        const defaultMsg = '⚠️ You haven\'t logged any expenses today! Keep your streaks alive.';
        setDailyReminder(defaultMsg);
        sessionStorage.setItem(`expenser_reminder_${todayStr}`, defaultMsg);
      }
    };

    fetchReminder();
  }, [expenses, hasLoggedToday, isOffline]);

  // AI Savings Advisor state
  const [aiInsights, setAiInsights] = useState('');
  const [isAiInsightsLoading, setIsAiInsightsLoading] = useState(false);

  const [notificationStatus, setNotificationStatus] = useState(() => {
    return 'Notification' in window ? Notification.permission : 'unsupported';
  });



  // Sync data from cloud helper
  const triggerCloudSync = async (userId) => {
    if (!userId) return;
    setIsSyncing(true);
    await syncFromCloud(userId, () => {
      setExpenses(getExpenses(userId));
      setBudget(getBudget(userId));
      setCategoryBudgets(getCategoryBudgets(userId));
      const savedCurrency = localStorage.getItem(`expenser_currency_${userId}`);
      if (savedCurrency && CURRENCIES[savedCurrency]) {
        setCurrency(savedCurrency);
      }
    });
    setIsSyncing(false);
    setPendingSyncs(getPendingSyncCount());
  };

  const handleCredentialResponse = (response) => {
    const profile = decodeJwt(response.credential);
    if (profile) {
      const userData = {
        id: profile.sub,
        name: profile.name,
        email: profile.email,
        picture: profile.picture
      };
      localStorage.setItem('expenser_user', JSON.stringify(userData));
      setUser(userData);
      triggerCloudSync(userData.id);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('expenser_user');
    setUser(null);
  };

  // Load user-specific data from local cache initially
  useEffect(() => {
    const userId = user?.id || null;
    setExpenses(getExpenses(userId));
    setBudget(getBudget(userId));
    setCategoryBudgets(getCategoryBudgets(userId));
    setPendingSyncs(getPendingSyncCount());

    const savedCurrency = localStorage.getItem(`expenser_currency_${userId}`);
    if (savedCurrency && CURRENCIES[savedCurrency]) {
      setCurrency(savedCurrency);
    } else {
      setCurrency('USD');
    }

    if (userId) {
      triggerCloudSync(userId);
    }
  }, [user]);

  const handleCurrencyChange = async (e) => {
    const nextCur = e.target.value;
    setCurrency(nextCur);
    const userId = user?.id || null;
    localStorage.setItem(`expenser_currency_${userId}`, nextCur);
    if (userId) {
      await saveCloudSettings(userId, budget, nextCur, categoryBudgets);
    }
  };

  // Setup Google Login & SW cleanup
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let registration of registrations) {
          registration.unregister().then(() => {
            console.log('SW unregistered successfully');
            window.location.reload();
          });
        }
      });
    }

    if (!user && typeof window.google !== 'undefined') {
      window.google.accounts.id.initialize({
        client_id: "381822591589-cnbic33i53ra1puqr4jkj2hrqreub02e.apps.googleusercontent.com",
        callback: handleCredentialResponse
      });

      window.google.accounts.id.renderButton(
        document.getElementById("google-signin-btn"),
        { theme: "outline", size: "large", width: "100%", alignment: "center" }
      );
    }
  }, [user]);

  const triggerNotificationTest = () => {
    if (!('Notification' in window)) return;
    Notification.requestPermission().then((permission) => {
      setNotificationStatus(permission);
      if (permission === 'granted') {
        new Notification("Expense Tracker", {
          body: "Notifications active! We will remind you to log your daily expenses.",
          icon: "/icon.svg"
        });
      }
    });
  };

  const handleExportCSV = () => {
    const headers = ['Description', 'Amount', 'Category', 'Date', 'Notes', 'Recurring Bill', 'Date Added', 'Date Modified'];
    const rows = expenses.map(exp => [
      `"${exp.description.replace(/"/g, '""')}"`,
      exp.amount,
      CATEGORIES[exp.category]?.name || exp.category,
      exp.date,
      `"${(exp.notes || '').replace(/"/g, '""')}"`,
      exp.isSubscription ? 'Yes' : 'No',
      exp.dateAdded,
      exp.dateModified
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `expenses_${user.name.replace(/\s+/g, '_').toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length <= 1) {
        alert('Invalid CSV file or empty list');
        return;
      }

      // Parse headers
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
      const descIdx = headers.indexOf('description');
      const amtIdx = headers.indexOf('amount');
      const catIdx = headers.indexOf('category');
      const dateIdx = headers.indexOf('date');
      const notesIdx = headers.indexOf('notes');

      if (descIdx === -1 || amtIdx === -1) {
        alert('CSV must contain at least "Description" and "Amount" headers.');
        return;
      }

      const importedExpenses = [];
      const userId = user?.id || null;

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const cleanRow = row.map(cell => cell.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

        if (cleanRow.length < Math.max(descIdx, amtIdx) + 1) continue;

        const desc = cleanRow[descIdx] || 'Imported Expense';
        const amt = parseFloat(cleanRow[amtIdx]) || 0;
        
        let cat = 'Others';
        if (catIdx !== -1 && cleanRow[catIdx]) {
          const rawCat = cleanRow[catIdx];
          const matchedKey = Object.keys(CATEGORIES).find(
            k => k.toLowerCase() === rawCat.toLowerCase() || CATEGORIES[k].name.toLowerCase() === rawCat.toLowerCase()
          );
          if (matchedKey) cat = matchedKey;
        }

        const date = dateIdx !== -1 && cleanRow[dateIdx] ? cleanRow[dateIdx] : new Date().toISOString().split('T')[0];
        const notes = notesIdx !== -1 ? cleanRow[notesIdx] : '';

        importedExpenses.push({
          description: desc,
          amount: amt,
          category: cat,
          date: date,
          notes: notes,
          isSubscription: false
        });
      }

      if (importedExpenses.length > 0) {
        for (const exp of importedExpenses) {
          await addExpense(exp, userId);
        }
        setExpenses(getExpenses(userId));
        alert(`Successfully imported ${importedExpenses.length} expenses!`);
        triggerCloudSync(userId);
      } else {
        alert('No valid expenses found in CSV.');
      }
    };
    reader.readAsText(file);
  };

  const userId = user?.id || null;
  const currSymbol = CURRENCIES[currency].symbol;
  const totalSpent = expenses.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  const budgetProgress = Math.min((totalSpent / budget) * 100, 100);

  // Period Overviews Calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const spentToday = expenses
    .filter(e => e.date === todayStr)
    .reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  oneWeekAgo.setHours(0,0,0,0);
  const spentThisWeek = expenses
    .filter(e => new Date(e.date) >= oneWeekAgo)
    .reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0,0,0,0);
  const spentThisMonth = expenses
    .filter(e => new Date(e.date) >= currentMonthStart)
    .reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

  // Safe Daily Limit Calculation
  const getSafeDailyLimit = () => {
    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const daysLeft = lastDayOfMonth.getDate() - today.getDate() + 1;
    const remaining = budget - totalSpent;
    return remaining > 0 ? remaining / daysLeft : 0;
  };

  // Smart Subscription Calculations
  const subscriptions = expenses.filter(e => !!e.isSubscription);
  const totalSubscriptionCost = subscriptions.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

  // Fetch AI Financial Insights from Gemini with smart offline fallback
  const fetchAiInsights = async () => {
    if (isOffline) {
      setAiInsights('💡 AI Insights are unavailable while offline. Please connect to the internet.');
      return;
    }

    setIsAiInsightsLoading(true);
    setAiInsights('');
    
    // Calculate category totals for prompts/fallbacks
    const categoryTotals = {};
    expenses.forEach(e => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });

    // Find highest spending category
    let highestCat = 'N/A';
    let highestAmt = 0;
    Object.entries(categoryTotals).forEach(([cat, amt]) => {
      if (amt > highestAmt) {
        highestAmt = amt;
        highestCat = CATEGORIES[cat]?.name || cat;
      }
    });

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key missing");

      // 1. Attempt with gemini-2.5-flash
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Analyze this monthly budget status:
                - Overall Budget: ${currSymbol}${budget}
                - Total Spent: ${currSymbol}${totalSpent}
                - Recurring Bills Total: ${currSymbol}${totalSubscriptionCost}
                - Spending per Category: ${JSON.stringify(categoryTotals)}
                Please provide exactly 3 concise, bulleted, actionable savings suggestions in clean text (no markdown formatting, no stars). Keep it brief.`
              }]
            }]
          })
        });

        if (!response.ok) throw new Error('gemini-2.5-flash failed/rate-limited');
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Empty response');
        setAiInsights(text.trim());
        setIsAiInsightsLoading(false);
        return;
      } catch (err1) {
        console.warn('gemini-2.5-flash failed, attempting gemini-3.1-flash-lite...', err1);
        
        // 2. Attempt with gemini-3.1-flash-lite as fallback
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Analyze this monthly budget status:
                - Overall Budget: ${currSymbol}${budget}
                - Total Spent: ${currSymbol}${totalSpent}
                - Recurring Bills Total: ${currSymbol}${totalSubscriptionCost}
                - Spending per Category: ${JSON.stringify(categoryTotals)}
                Please provide exactly 3 concise, bulleted, actionable savings suggestions in clean text (no markdown formatting, no stars). Keep it brief.`
              }]
            }]
          })
        });

        if (!response.ok) throw new Error('gemini-3.1-flash-lite failed/rate-limited');
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Empty response');
        setAiInsights(text.trim());
        setIsAiInsightsLoading(false);
        return;
      }
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
          : `• You have ${currSymbol}${limitStatus.toFixed(2)} remaining. Keeping your daily spending under ${currSymbol}${getSafeDailyLimit().toFixed(2)} will guarantee you stay within budget.`
      ];
      
      setAiInsights(fallbackTips.join('\n'));
    }
    setIsAiInsightsLoading(false);
  };

  const getProgressBarClass = (prog) => {
    if (prog >= 90) return 'progress-bar danger';
    if (prog >= 75) return 'progress-bar warning';
    return 'progress-bar';
  };

  // Check category-specific spending totals
  const getCategorySpending = (catKey) => {
    return expenses
      .filter(e => e.category === catKey)
      .reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  };

  const handleSaveExpense = async (data) => {
    if (editingExpense) {
      await updateExpense(editingExpense.id, data, userId);
    } else {
      await addExpense(data, userId);
    }
    setExpenses(getExpenses(userId));
    setPendingSyncs(getPendingSyncCount());
    setActiveForm(false);
    setEditingExpense(null);

    // 1. Overall Budget Warning Alert
    const newTotal = totalSpent + data.amount;
    if (newTotal > budget && notificationStatus === 'granted') {
      new Notification("Overall Budget Limit Exceeded ⚠️", {
        body: `You've exceeded your monthly budget limit! Total: ${currSymbol}${newTotal.toFixed(2)} / ${currSymbol}${budget.toFixed(2)}`,
        icon: "/icon.svg"
      });
    }

    // 2. Category-Specific Budget Warning Alert
    const catLimit = categoryBudgets[data.category];
    if (catLimit && catLimit > 0) {
      const catSpent = getCategorySpending(data.category) + (editingExpense ? 0 : data.amount);
      if (catSpent > catLimit && notificationStatus === 'granted') {
        const catName = CATEGORIES[data.category]?.name || data.category;
        new Notification("Category Budget Alert ⚠️", {
          body: `You've exceeded the budget limit for ${catName}! Spent: ${currSymbol}${catSpent.toFixed(2)} / ${currSymbol}${catLimit.toFixed(2)}`,
          icon: "/icon.svg"
        });
      }
    }
  };

  const handleDeleteExpense = async (id) => {
    await deleteExpense(id, userId);
    setExpenses(getExpenses(userId));
    setPendingSyncs(getPendingSyncCount());
    setActiveForm(false);
    setEditingExpense(null);
  };

  const handleSaveBudget = async (newBudget, newCatBudgets) => {
    saveBudget(newBudget, userId);
    saveCategoryBudgets(newCatBudgets, userId);
    setBudget(newBudget);
    setCategoryBudgets(newCatBudgets);
    setActiveBudgetModal(false);
    if (userId) {
      await saveCloudSettings(userId, newBudget, currency, newCatBudgets);
    }
  };

  // Filter & Sort expenses logic
  const getFilteredExpenses = () => {
    return expenses.filter((exp) => {
      const matchesSearch = exp.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (exp.notes && exp.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = categoryFilter === 'All' || exp.category === categoryFilter;

      let matchesDate = true;
      const expDate = new Date(exp.date);
      const today = new Date();
      today.setHours(0,0,0,0);

      if (dateFilter === 'today') {
        const dateStr = expDate.toISOString().split('T')[0];
        const todayStr = new Date().toISOString().split('T')[0];
        matchesDate = dateStr === todayStr;
      } else if (dateFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(today.getDate() - 7);
        matchesDate = expDate >= weekAgo;
      } else if (dateFilter === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(today.getMonth() - 1);
        matchesDate = expDate >= monthAgo;
      } else if (dateFilter === 'custom') {
        if (startDate) {
          const sDate = new Date(startDate);
          matchesDate = matchesDate && expDate >= sDate;
        }
        if (endDate) {
          const eDate = new Date(endDate);
          matchesDate = matchesDate && expDate <= eDate;
        }
      }

      return matchesSearch && matchesCategory && matchesDate;
    }).sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.dateAdded) - new Date(a.dateAdded);
      if (sortBy === 'oldest') return new Date(a.dateAdded) - new Date(b.dateAdded);
      if (sortBy === 'highest') return b.amount - a.amount;
      if (sortBy === 'lowest') return a.amount - b.amount;
      return 0;
    });
  };

  const filteredExpenses = getFilteredExpenses();

  // Get expenses specifically for selected chart period breakdown
  const getChartExpenses = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    oneWeekAgo.setHours(0,0,0,0);
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0,0,0,0);

    return expenses.filter(e => {
      if (chartPeriod === 'today') {
        return e.date === todayStr;
      }
      if (chartPeriod === 'week') {
        return new Date(e.date) >= oneWeekAgo;
      }
      if (chartPeriod === 'month') {
        return new Date(e.date) >= currentMonthStart;
      }
      return true; // 'all'
    });
  };

  const chartExpenses = getChartExpenses();

  // Login Screen
  if (!user) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', padding: '40px 20px', gap: '30px' }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/icon.svg" alt="logo" style={{ width: '80px', height: '80px', marginBottom: '16px' }} />
          <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px', background: 'linear-gradient(135deg, #22d3ee, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Expense Tracker
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
            A premium dashboard to manage your spending with smart AI auto-categorization.
          </p>
        </div>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Sign in to continue</h3>
          <div id="google-signin-btn" style={{ display: 'flex', justifyContent: 'center', width: '100%' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {isOffline && <div className="offline-banner">Working Offline</div>}
      
      {showSyncSuccess && (
        <div style={{
          background: 'var(--success)',
          color: 'white',
          fontSize: '12px',
          fontWeight: '600',
          textAlign: 'center',
          padding: '6px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          animation: 'fadeIn 0.3s ease-out'
        }}>
          🟢 Back Online! Offline changes synchronized successfully.
        </div>
      )}

      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img 
            src={user.picture} 
            alt="profile" 
            referrerPolicy="no-referrer"
            style={{ width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer' }} 
            onClick={() => {
              if (window.confirm("Do you want to sign out?")) {
                handleSignOut();
              }
            }}
            title="Sign out"
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 style={{ fontSize: '15px', lineHeight: '1.2' }}>Expense Tracker</h1>
            {isSyncing ? (
              <span className="sync-skeleton" style={{ fontSize: '9px', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'inline-block' }}></span>
                syncing...
              </span>
            ) : (
              <span style={{ fontSize: '9px', color: pendingSyncs > 0 ? 'var(--danger)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: pendingSyncs > 0 ? '600' : '400' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: pendingSyncs > 0 ? 'var(--danger)' : 'var(--success)', display: 'inline-block' }}></span>
                {pendingSyncs > 0 ? `${pendingSyncs} pending` : 'synced'}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <select 
            value={currency} 
            onChange={handleCurrencyChange}
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
              padding: '6px 10px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '600',
              outline: 'none'
            }}
          >
            {Object.entries(CURRENCIES).map(([key, cur]) => (
              <option key={key} value={key} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                {key}
              </option>
            ))}
          </select>

          {/* Manual Cloud Sync Button (Sleek Circular Icon Button) */}
          <button
            onClick={() => triggerCloudSync(user.id)}
            disabled={isSyncing}
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isSyncing ? 0.6 : 1
            }}
            title="Force cloud sync"
          >
            🔄
          </button>
        </div>
      </header>

      {/* Daily reminder banner */}
      {!hasLoggedToday && dailyReminder && (
        <div style={{
          background: 'rgba(6, 182, 212, 0.05)',
          border: '1px solid var(--glass-border)',
          color: 'var(--text-primary)',
          padding: '10px 16px',
          margin: '16px 20px 0 20px',
          borderRadius: '8px',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 12px rgba(6, 182, 212, 0.04)'
        }}>
          <span style={{ fontSize: '15px' }}>🔔</span>
          <span style={{ fontWeight: '500', opacity: 0.95 }}>{dailyReminder}</span>
        </div>
      )}

      <main className="content">
        <div className="desktop-grid">
          
          {/* LEFT SIDEBAR (Budget, Analytics & Subscription Lists) */}
          <div className={`left-column ${activeTab === 'dashboard' ? 'show-mobile' : 'hide-mobile'}`} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Overall Budget Status */}
            <div className="glass-card budget-summary">
              <div className="budget-row">
                <span style={{ color: 'var(--text-secondary)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Overall Limit
                  <button 
                    onClick={() => setActiveBudgetModal(true)}
                    style={{
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--glass-border)',
                      color: 'var(--accent-primary)',
                      cursor: 'pointer',
                      fontSize: '10px',
                      fontWeight: '600',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}
                  >
                    Edit
                  </button>
                </span>
                <span className="budget-amount">
                  {currSymbol}{totalSpent.toFixed(2)} <span>/ {currSymbol}{budget.toFixed(2)}</span>
                </span>
              </div>

              <div className="progress-container">
                <div 
                  className={getProgressBarClass(budgetProgress)} 
                  style={{ width: `${budgetProgress}%` }}
                ></div>
              </div>

              <div className="stats-grid" style={{ marginBottom: '4px' }}>
                <div className="stat-item">
                  <span className="stat-label">Remaining</span>
                  <span className="stat-val" style={{ color: budget - totalSpent >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {currSymbol}{(budget - totalSpent).toFixed(2)}
                  </span>
                </div>
                <div className="stat-item" style={{ alignItems: 'flex-end' }}>
                  <span className="stat-label">Transactions</span>
                  <span className="stat-val">{expenses.length}</span>
                </div>
              </div>

              {/* Quick Period Overviews (Daily, Weekly, Monthly) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', padding: '12px 0', borderTop: '1px solid var(--glass-border)', borderBottom: '1px solid var(--glass-border)', margin: '4px 0' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Today</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{currSymbol}{spentToday.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>This Week</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{currSymbol}{spentThisWeek.toFixed(0)}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>This Month</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{currSymbol}{spentThisMonth.toFixed(0)}</span>
                </div>
              </div>

              {/* Safe Daily Spending Limit */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>💡 Safe Daily Spending Limit</span>
                <span style={{ fontWeight: '600', color: 'var(--accent-primary)' }}>
                  {currSymbol}{getSafeDailyLimit().toFixed(2)} / day
                </span>
              </div>
            </div>

            {/* Smart Subscriptions / Recurring Bills Card */}
            {subscriptions.length > 0 && (
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                    🔁 Fixed Subscriptions
                  </h3>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--accent-primary)' }}>
                    {currSymbol}{totalSubscriptionCost.toFixed(2)}/mo
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '120px', overflowY: 'auto' }}>
                  {subscriptions.map(sub => {
                    const cat = CATEGORIES[sub.category] || CATEGORIES.Others;
                    return (
                      <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0' }}>
                        <span style={{ color: 'var(--text-primary)' }}>{cat.icon} {sub.description}</span>
                        <span style={{ color: 'var(--text-muted)' }}>-{currSymbol}{sub.amount.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Category Budgets Warnings list */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Category Budgets
                </h3>
                {Object.keys(categoryBudgets).length === 0 && (
                  <button 
                    onClick={() => setActiveBudgetModal(true)}
                    style={{
                      background: 'var(--accent-glow)',
                      border: '1px solid var(--accent-primary)',
                      color: 'var(--accent-primary)',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}
                  >
                    + Set limits
                  </button>
                )}
              </div>
              
              {Object.keys(categoryBudgets).length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {Object.entries(categoryBudgets).map(([catKey, catLimit]) => {
                    const catSpent = getCategorySpending(catKey);
                    const catInfo = CATEGORIES[catKey] || CATEGORIES.Others;
                    const catProg = Math.min((catSpent / catLimit) * 100, 100);

                    return (
                      <div key={catKey} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span>{catInfo.icon} {catInfo.name}</span>
                          <span style={{ fontWeight: '500' }}>
                            {currSymbol}{catSpent.toFixed(0)} / {currSymbol}{catLimit.toFixed(0)}
                          </span>
                        </div>
                        <div className="progress-container" style={{ height: '5px' }}>
                          <div 
                            className={getProgressBarClass(catProg)} 
                            style={{ width: `${catProg}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  No category limits set. Set individual spending limits on Food, Dining, Shopping, etc., to monitor them closely.
                </p>
              )}
            </div>

            {/* Distribution chart & AI Savings Advisor */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Distribution ({currency})
                </h3>
                <button
                  onClick={fetchAiInsights}
                  disabled={isAiInsightsLoading}
                  style={{
                    background: 'var(--accent-glow)',
                    border: '1px solid var(--accent-primary)',
                    color: 'var(--accent-primary)',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: '600'
                  }}
                >
                  {isAiInsightsLoading ? '💡 Analyzing...' : '💡 AI Insights'}
                </button>
              </div>

              {/* Period Switcher Tabs */}
              <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', flexWrap: 'wrap' }}>
                {['today', 'week', 'month', 'all'].map(p => (
                  <button
                    key={p}
                    onClick={() => setChartPeriod(p)}
                    style={{
                      background: chartPeriod === p ? 'var(--accent-glow)' : 'none',
                      border: '1px solid',
                      borderColor: chartPeriod === p ? 'var(--accent-primary)' : 'var(--glass-border)',
                      color: chartPeriod === p ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontSize: '10px',
                      fontWeight: '600',
                      textTransform: 'capitalize',
                      transition: 'all 0.2s'
                    }}
                  >
                    {p === 'all' ? 'All Time' : p}
                  </button>
                ))}
              </div>

              <AnalyticsCharts 
                expenses={chartExpenses} 
                currencySymbol={currSymbol} 
                selectedCategory={categoryFilter}
                onSelectCategory={setCategoryFilter}
              />

              {/* AI Insights Display */}
              {aiInsights && (
                <div style={{ 
                  background: 'rgba(255,255,255,0.02)', 
                  border: '1px solid var(--glass-border)', 
                  borderRadius: '8px', 
                  padding: '12px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.6',
                  maxHeight: '130px',
                  overflowY: 'auto'
                }}>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                    Gemini Financial Advice:
                  </strong>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{aiInsights}</div>
                </div>
              )}
            </div>

            {/* Backup Action card */}
            <div className="glass-card" style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={handleExportCSV}
                style={{
                  flex: 1,
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-primary)',
                  padding: '10px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: '600'
                }}
              >
                📥 Export CSV
              </button>
              <label 
                style={{
                  flex: 1,
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-primary)',
                  padding: '10px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: '600',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                📤 Import CSV
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={handleImportCSV} 
                  style={{ display: 'none' }} 
                />
              </label>
            </div>
          </div>

          {/* RIGHT SIDEBAR */}
          <div className={`right-column ${activeTab === 'expenses' ? 'show-mobile' : 'hide-mobile'}`} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <div className="section-title" style={{ marginBottom: '12px' }}>
                <span>Expenses List</span>
                <button 
                  onClick={() => {
                    setEditingExpense(null);
                    setActiveForm(true);
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                    border: 'none',
                    color: '#030712',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: '600',
                    display: 'none'
                  }}
                  className="desktop-add-btn"
                >
                  + Add Expense
                </button>
                <style>{`
                  @media (min-width: 768px) {
                    .desktop-add-btn { display: block !important; }
                  }
                `}</style>
              </div>

              {/* Search & Custom Advanced Filters */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ padding: '10px 14px', fontSize: '14px' }}
                />

                {/* Sorter and Date Presets */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="input-field"
                    style={{ padding: '8px 12px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    {Object.entries(SORT_OPTIONS).map(([key, label]) => (
                      <option key={key} value={key} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                        {label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="input-field"
                    style={{ padding: '8px 12px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    {Object.entries(DATE_FILTERS).map(([key, label]) => (
                      <option key={key} value={key} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Custom Date Bounds */}
                {dateFilter === 'custom' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="input-field"
                      style={{ padding: '6px 10px', fontSize: '11px' }}
                    />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="input-field"
                      style={{ padding: '6px 10px', fontSize: '11px' }}
                    />
                  </div>
                )}
                
                {/* Category filters */}
                <div className="filter-tabs-container" style={{ marginTop: '4px' }}>
                  <button
                    onClick={() => setCategoryFilter('All')}
                    className={`filter-tab-btn ${categoryFilter === 'All' ? 'active' : ''}`}
                  >
                    All
                  </button>
                  {Object.entries(CATEGORIES).map(([key, cat]) => (
                    <button
                      key={key}
                      onClick={() => setCategoryFilter(key)}
                      className={`filter-tab-btn ${categoryFilter === key ? 'active' : ''}`}
                    >
                      {cat.icon} {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {filteredExpenses.length === 0 ? (
                <div className="empty-state glass-card">
                  <div className="icon">💸</div>
                  <p>No transactions match your filters.</p>
                </div>
              ) : (
                <div className="expense-list">
                  {filteredExpenses.map((exp) => {
                    const cat = CATEGORIES[exp.category] || CATEGORIES.Others;
                    const catLimit = categoryBudgets[exp.category];
                    const catSpent = getCategorySpending(exp.category);
                    const isOverCategoryBudget = catLimit && catLimit > 0 && catSpent > catLimit;

                    return (
                      <div 
                        key={exp.id} 
                        className="expense-item"
                        onClick={() => {
                          setEditingExpense(exp);
                          setActiveForm(true);
                        }}
                      >
                        <div className="expense-left">
                          <div className="cat-icon-container" style={{ color: cat.color }}>
                            {cat.icon}
                          </div>
                          <div className="expense-info">
                            <span className="expense-desc" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {exp.description}
                              {isOverCategoryBudget && (
                                <span 
                                  style={{
                                    fontSize: '9px',
                                    color: 'var(--danger)',
                                    background: 'rgba(244, 63, 94, 0.08)',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontWeight: '700',
                                    letterSpacing: '0.2px'
                                  }}
                                  title="Category Budget Exceeded"
                                >
                                  Limit Exceeded
                                </span>
                              )}
                            </span>
                            <span className="expense-date">
                              {new Date(exp.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                            </span>
                          </div>
                        </div>
                        <div className="expense-right">
                          <span className="expense-amount" style={{ color: cat.color }}>
                            -{currSymbol}{exp.amount.toFixed(2)}
                          </span>
                          {(exp.notes || exp.isSubscription) && (
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', gap: '4px', alignItems: 'center' }}>
                              {exp.isSubscription && <span title="Recurring subscription">🔁</span>}
                              {exp.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* Bottom Navigation Bar (Mobile Only) */}
      <div className="mobile-nav-bar">
        <button 
          onClick={() => setActiveTab('dashboard')} 
          className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
        >
          <span className="icon">📊</span>
          <span>Overview</span>
        </button>
        <button 
          onClick={() => setActiveTab('expenses')} 
          className={`nav-item ${activeTab === 'expenses' ? 'active' : ''}`}
        >
          <span className="icon">💸</span>
          <span>Transactions</span>
        </button>
      </div>

      {/* Floating Action Button (Mobile Only) */}
      <button className="fab" onClick={() => {
        setEditingExpense(null);
        setActiveForm(true);
      }}>
        +
      </button>

      {/* Expense Form Modal */}
      {activeForm && (
        <ExpenseForm
          expense={editingExpense}
          onSave={handleSaveExpense}
          onDelete={handleDeleteExpense}
          currencySymbol={currSymbol}
          categoryBudgets={categoryBudgets}
          categorySpendings={Object.keys(CATEGORIES).reduce((acc, key) => {
            acc[key] = getCategorySpending(key);
            return acc;
          }, {})}
          onClose={() => {
            setActiveForm(false);
            setEditingExpense(null);
          }}
        />
      )}

      {/* Budget Modal */}
      {activeBudgetModal && (
        <BudgetModal
          currentBudget={budget}
          categoryBudgets={categoryBudgets}
          onSave={handleSaveBudget}
          currencySymbol={currSymbol}
          onClose={() => setActiveBudgetModal(false)}
        />
      )}
    </div>
  );
}
