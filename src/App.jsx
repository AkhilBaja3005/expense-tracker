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
  getPendingSyncCount,
  getSyncQueue,
  deleteFromSyncQueue,
  saveExpenses,
  getSavingsGoals,
  saveSavingsGoals,
  getIncome,
  saveIncome
} from './utils/storage';
import { CATEGORIES } from './utils/categorizer';
import ExpenseForm from './components/ExpenseForm';
import { supabase } from './utils/supabaseClient';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const getSubscriptionCountdown = (billingDay) => {
  if (!billingDay) return null;
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  
  // Set time of today to midnight for clean comparison
  const todayMidnight = new Date(year, month, today.getDate());
  let billingDate = new Date(year, month, billingDay);
  
  if (billingDate < todayMidnight) {
    billingDate = new Date(year, month + 1, billingDay);
  }
  
  const diffTime = billingDate - todayMidnight;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'due today 🔔';
  }
  if (diffDays === 1) {
    return 'due tomorrow ⏰';
  }
  return `due in ${diffDays} days`;
};

const highlightText = (text, highlight) => {
  if (!highlight || !highlight.trim()) return text;
  const parts = text.split(new RegExp(`(${highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === highlight.toLowerCase() 
          ? <mark key={i} className="search-highlight" style={{ background: 'rgba(34, 211, 238, 0.35)', color: 'white', borderRadius: '2px', padding: '0 2px' }}>{part}</mark> 
          : part
      )}
    </span>
  );
};
import AnalyticsCharts from './components/AnalyticsCharts';
import BudgetModal from './components/BudgetModal';
import OfflineQueueModal from './components/OfflineQueueModal';
import ExpenseListItem from './components/ExpenseListItem';
import SavingsGoalsCard from './components/SavingsGoalsCard';
import IncomeCard from './components/IncomeCard';

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
  } catch {
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
  const [showQueueInspector, setShowQueueInspector] = useState(false);

  // PWA Install Banner states
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // AI Forecasting Projections states
  const [aiForecast, setAiForecast] = useState('');
  const [isAiForecastLoading, setIsAiForecastLoading] = useState(false);

  // Savings Goals states
  const [goals, setGoals] = useState([]);
  const [incomeList, setIncomeList] = useState([]);
  
  // Sorters, date filters, and reminders state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const [dateFilter, setDateFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Mobile Tab State
  const [activeTab, setActiveTab] = useState('dashboard');

  // Swipe-to-delete gesture states
  const [swipedItemId, setSwipedItemId] = useState(null);

  // Chart Period State ('today', 'week', 'month', 'all')
  const [chartPeriod, setChartPeriod] = useState('all');

  // Daily tracker reminder
  const [dailyReminder, setDailyReminder] = useState('');

  // Push notifications toggle states
  const [isPushSupported, setIsPushSupported] = useState(false);
  const [isPushEnabled, setIsPushEnabled] = useState(false);

  // Reconnection Sync Toast state
  const [toastMessage, setToastMessage] = useState(null);

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
      setToastMessage('🟢 Back online! Syncing your local changes with Supabase...');
      setTimeout(() => setToastMessage(null), 4000);
    };
    
    const goOffline = () => {
      setIsOffline(true);
      setToastMessage('🔌 Offline mode active. Local changes will sync when online.');
      setTimeout(() => setToastMessage(null), 4000);
    };

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
      } catch {
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
      setGoals(getSavingsGoals(userId));
      setIncomeList(getIncome(userId));
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
    
    // Apply selected theme variables
    const themeAccent = localStorage.getItem('expenser_theme_accent') || 'cyan';
    let primary = '6, 182, 212';
    let glow = 'rgba(6, 182, 212, 0.15)';
    if (themeAccent === 'rose') {
      primary = '244, 63, 94';
      glow = 'rgba(244, 63, 94, 0.15)';
    } else if (themeAccent === 'emerald') {
      primary = '16, 185, 129';
      glow = 'rgba(16, 185, 129, 0.15)';
    } else if (themeAccent === 'amber') {
      primary = '245, 158, 11';
      glow = 'rgba(245, 158, 11, 0.15)';
    }
    document.documentElement.style.setProperty('--accent-primary', `rgb(${primary})`);
    document.documentElement.style.setProperty('--accent-glow', glow);

    setExpenses(getExpenses(userId));
    setBudget(getBudget(userId));
    setCategoryBudgets(getCategoryBudgets(userId));
    setGoals(getSavingsGoals(userId));
    setIncomeList(getIncome(userId));
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

  // Setup Google Login & PWA Web Push Service Worker
  useEffect(() => {
    // 1. Service Worker registration and Web Push status query
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(async (reg) => {
          console.log('SW registered successfully:', reg);
          if ('PushManager' in window) {
            setIsPushSupported(true);
            const sub = await reg.pushManager.getSubscription();
            setIsPushEnabled(!!sub);
          }
        })
        .catch((err) => {
          console.error('SW registration failed:', err);
        });
    }
  }, [user]);

  // Toggle push notifications (subscribe / unsubscribe)
  const handleTogglePush = async () => {
    if (!('serviceWorker' in navigator && 'PushManager' in window)) return;
    if (!user?.id) {
      alert('Please sign in to configure daily push reminders.');
      return;
    }
    
    try {
      const reg = await navigator.serviceWorker.ready;
      if (isPushEnabled) {
        // Unsubscribe active registration
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint);
        }
        setIsPushEnabled(false);
        console.log('Push notifications disabled.');
      } else {
        // Subscribe to push notifications
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          alert('Notification permissions are required to enable daily reminders.');
          return;
        }

        const pubKey = 'BNT0tNWiED6i5vaUz_yFbNY4tEJIP9Rs1G4HeVcrT7wK9GcDNc2lUR7oBJYB91x86jfpk_JTIx8pYlB4bx7qn9w';
        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(pubKey)
        });

        const p256dhKey = subscription.getKey('p256dh');
        const authKey = subscription.getKey('auth');
        if (!p256dhKey || !authKey) {
          throw new Error("Web Push subscription keys are missing or unsupported by the browser.");
        }

        const p256dh = btoa(String.fromCharCode.apply(null, new Uint8Array(p256dhKey)));
        const auth = btoa(String.fromCharCode.apply(null, new Uint8Array(authKey)));

        await supabase.from('push_subscriptions').upsert({
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh,
          auth
        });

        setIsPushEnabled(true);
        console.log('Push notifications enabled.');
      }
    } catch (err) {
      console.error('Push notification toggle failed:', err);
      alert('Failed to modify push reminders: ' + err.message);
    }
  };

  // Listen for native beforeinstallprompt PWA event
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      if (!isStandalone) {
        setShowInstallBanner(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User PWA install prompt choice: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  // Setup Google Login & version checks
  useEffect(() => {
    // 2. Version redeployment test notification notifier
    const CURRENT_VERSION = 'v2.2.0';
    const lastVersion = localStorage.getItem('expenser_app_version');
    if (lastVersion && lastVersion !== CURRENT_VERSION) {
      if (Notification.permission === 'granted') {
        new Notification("Expense Tracker Updated! 🚀", {
          body: `New version ${CURRENT_VERSION} has been successfully redeployed and is now live.`,
          icon: "/icon.svg",
          badge: "/icon.svg"
        });
      }
    }
    localStorage.setItem('expenser_app_version', CURRENT_VERSION);

    // 3. Initialize Google login button if not logged in
    if (!user && typeof window.google !== 'undefined') {
      window.google.accounts.id.initialize({
        client_id: "381822591589-cnbic33i53ra1puqr4jkj2hrqreub02e.apps.googleusercontent.com",
        callback: handleCredentialResponse
      });

      const btnElement = document.getElementById("google-signin-btn");
      if (btnElement) {
        window.google.accounts.id.renderButton(
          btnElement,
          { theme: "outline", size: "large", width: "100%", alignment: "center" }
        );
      }
    }
  }, [user]);


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

  const sendTestNotification = () => {
    if (!('Notification' in window)) {
      alert("This browser does not support push notifications.");
      return;
    }

    if (Notification.permission === 'granted') {
      new Notification("Expense Tracker Test Alert 🔔", {
        body: "Success! PWA push notifications are configured and working correctly.",
        icon: "/icon.svg",
        badge: "/icon.svg",
        tag: "test-notification"
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification("Expense Tracker Test Alert 🔔", {
            body: "Success! PWA push notifications are configured and working correctly.",
            icon: "/icon.svg",
            badge: "/icon.svg",
            tag: "test-notification"
          });
          setNotificationStatus('granted');
        } else {
          alert("Notification permission was denied.");
        }
      });
    } else {
      alert("Notification permission is blocked. Please reset/enable notification permissions in your browser site settings to receive notifications.");
    }
  };

  const userId = user?.id || null;
  const currSymbol = CURRENCIES[currency].symbol;

  const totalSpent = React.useMemo(() => {
    return expenses.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  }, [expenses]);

  const budgetProgress = React.useMemo(() => {
    return Math.min((totalSpent / budget) * 100, 100);
  }, [totalSpent, budget]);

  const periodSpendings = React.useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    oneWeekAgo.setHours(0,0,0,0);

    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0,0,0,0);

    let todayAmt = 0;
    let weekAmt = 0;
    let monthAmt = 0;

    expenses.forEach(e => {
      const amt = parseFloat(e.amount) || 0;
      const date = new Date(e.date);

      if (e.date === todayStr) {
        todayAmt += amt;
      }
      if (date >= oneWeekAgo) {
        weekAmt += amt;
      }
      if (date >= currentMonthStart) {
        monthAmt += amt;
      }
    });

    return { today: todayAmt, week: weekAmt, month: monthAmt };
  }, [expenses]);

  const spentToday = periodSpendings.today;
  const spentThisWeek = periodSpendings.week;
  const spentThisMonth = periodSpendings.month;

  // Safe Daily Limit Calculation
  const safeDailyLimit = React.useMemo(() => {
    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const daysLeft = lastDayOfMonth.getDate() - today.getDate() + 1;
    const remaining = budget - totalSpent;
    return remaining > 0 ? remaining / daysLeft : 0;
  }, [budget, totalSpent]);

  // Budget Health Score Calculation
  const healthScore = React.useMemo(() => {
    if (budget <= 0) return 0;
    const today = new Date();
    const totalDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const currentDay = today.getDate();
    
    const elapsedFraction = currentDay / totalDays;
    const spentFraction = totalSpent / budget;
    const diff = spentFraction - elapsedFraction;
    
    if (diff <= 0) return 100;
    return Math.max(0, Math.min(100, Math.round((1 - diff) * 100)));
  }, [budget, totalSpent]);

  // Smart Subscription Calculations
  const subscriptions = React.useMemo(() => {
    return expenses.filter(e => !!e.isSubscription);
  }, [expenses]);

  const totalSubscriptionCost = React.useMemo(() => {
    return subscriptions.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  }, [subscriptions]);

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
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key missing");

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Analyze these expense details:
              - Overall Monthly Budget: ${currSymbol}${budget}
              - Total Spent so far: ${currSymbol}${totalSpent}
              - Recurring Bills Total: ${currSymbol}${totalSubscriptionCost}
              - Spending Category Breakdown: ${JSON.stringify(categoryTotals)}
              Predict next month's spending projection in clean text. Provide a projected total cost, a brief prediction explanation, and 2 predictive rules to keep costs lower next month. Keep it short and actionable.`
            }]
          }]
        })
      });

      if (!response.ok) throw new Error('Gemini API call failed');
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty response');
      setAiForecast(text.trim());
    } catch (err) {
      console.error('Failed to load AI Forecast:', err);
      const projectedSpent = totalSpent * 1.05;
      setAiForecast(`🔮 Projection: ${currSymbol}${projectedSpent.toFixed(2)}\nAn error occurred loading the cloud AI forecast. Try again online.`);
    } finally {
      setIsAiForecastLoading(false);
    }
  };

  const getProgressBarClass = (prog) => {
    if (prog >= 90) return 'progress-bar danger';
    if (prog >= 75) return 'progress-bar warning';
    return 'progress-bar';
  };

  const categorySpendings = React.useMemo(() => {
    const spendings = {};
    Object.keys(CATEGORIES).forEach((key) => {
      spendings[key] = 0;
    });
    expenses.forEach((e) => {
      const cat = e.category || 'Others';
      const amt = parseFloat(e.amount) || 0;
      if (spendings[cat] !== undefined) {
        spendings[cat] += amt;
      } else {
        spendings['Others'] = (spendings['Others'] || 0) + amt;
      }
    });
    return spendings;
  }, [expenses]);

  // Check category-specific spending totals
  const getCategorySpending = React.useCallback((catKey) => {
    return categorySpendings[catKey] || 0;
  }, [categorySpendings]);


  const handleSaveExpense = React.useCallback(async (data) => {
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
  }, [editingExpense, userId, totalSpent, budget, currSymbol, notificationStatus, categoryBudgets, getCategorySpending]);

  const handleDeleteExpense = React.useCallback(async (id) => {
    await deleteExpense(id, userId);
    setExpenses(getExpenses(userId));
    setPendingSyncs(getPendingSyncCount());
    setActiveForm(false);
    setEditingExpense(null);
  }, [userId]);

  const handleSaveBudget = React.useCallback(async (newBudget, newCatBudgets) => {
    saveBudget(newBudget, userId);
    saveCategoryBudgets(newCatBudgets, userId);
    setBudget(newBudget);
    setCategoryBudgets(newCatBudgets);
    setActiveBudgetModal(false);
    if (userId) {
      await saveCloudSettings(userId, newBudget, currency, newCatBudgets);
    }
  }, [userId, currency]);
  const handleResetCache = React.useCallback(async () => {
    if (!userId) return;
    setIsSyncing(true);
    try {
      localStorage.removeItem(`expenser_expenses_${userId}`);
      localStorage.removeItem(`expenser_budget_${userId}`);
      localStorage.removeItem(`expenser_cat_budgets_${userId}`);
      localStorage.removeItem('expenser_sync_queue');
      
      await syncFromCloud(userId, () => {
        window.location.reload();
      });
    } catch (err) {
      console.error('Failed to reset system cache:', err);
      alert('Failed to reset system cache: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  }, [userId]);

  const handleLoadDemoData = React.useCallback(async () => {
    const demoExpenses = [
      {
        id: crypto.randomUUID(),
        description: 'Starbucks Coffee',
        amount: 8.50,
        category: 'Food',
        date: new Date().toISOString().split('T')[0],
        notes: 'Morning coffee',
        dateAdded: new Date().toISOString(),
        dateModified: new Date().toISOString(),
        isDemo: true
      },
      {
        id: crypto.randomUUID(),
        description: 'Uber Ride',
        amount: 18.20,
        category: 'Transport',
        date: new Date().toISOString().split('T')[0],
        notes: 'Office ride',
        dateAdded: new Date().toISOString(),
        dateModified: new Date().toISOString(),
        isDemo: true
      },
      {
        id: crypto.randomUUID(),
        description: 'Netflix subscription',
        amount: 15.99,
        category: 'Bills',
        date: new Date().toISOString().split('T')[0],
        notes: 'Monthly streaming bill',
        isSubscription: true,
        billingDay: 15,
        dateAdded: new Date().toISOString(),
        dateModified: new Date().toISOString(),
        isDemo: true
      },
      {
        id: crypto.randomUUID(),
        description: 'Weekly Groceries Store',
        amount: 72.40,
        category: 'Food',
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: 'Whole Foods purchase',
        dateAdded: new Date().toISOString(),
        dateModified: new Date().toISOString(),
        isDemo: true
      },
      {
        id: crypto.randomUUID(),
        description: 'Amazon shopping - Jacket',
        amount: 54.00,
        category: 'Shopping',
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: 'Winter jacket',
        dateAdded: new Date().toISOString(),
        dateModified: new Date().toISOString(),
        isDemo: true
      },
      {
        id: crypto.randomUUID(),
        description: 'Cinema Movie Ticket',
        amount: 12.50,
        category: 'Entertainment',
        date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: 'Evening movie',
        dateAdded: new Date().toISOString(),
        dateModified: new Date().toISOString(),
        isDemo: true
      }
    ];

    saveExpenses(demoExpenses, userId);
    setExpenses(demoExpenses);
    
    if (userId) {
      setIsSyncing(true);
      try {
        const formattedDemo = demoExpenses.map(e => ({
          id: e.id,
          user_id: userId,
          description: e.description,
          amount: e.amount,
          category: e.category,
          date: e.date,
          notes: e.notes,
          date_added: e.dateAdded,
          date_modified: e.dateModified,
          is_subscription: !!e.isSubscription,
          billing_day: e.billingDay,
          is_demo: true
        }));
        await supabase.from('expenses').upsert(formattedDemo);
      } catch (err) {
        console.error('Failed to upload demo data to cloud:', err);
      } finally {
        setIsSyncing(false);
      }
    }
  }, [userId]);

  const handleClearDemoData = React.useCallback(async () => {
    const cleanExpenses = expenses.filter(e => !e.isDemo);
    setExpenses(cleanExpenses);
    saveExpenses(cleanExpenses, userId);
    
    if (userId) {
      setIsSyncing(true);
      try {
        const demoIds = expenses.filter(e => e.isDemo).map(e => e.id);
        if (demoIds.length > 0) {
          await supabase.from('expenses').delete().in('id', demoIds);
        }
      } catch (err) {
        console.error('Failed to clear demo data from cloud:', err);
      } finally {
        setIsSyncing(false);
      }
    }
  }, [expenses, userId]);

  const handleAddSavingsGoal = React.useCallback(async (name, targetAmt, deadline) => {
    const newGoal = {
      id: 'goal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      name,
      targetAmount: parseFloat(targetAmt) || 0,
      currentAmount: 0,
      deadline,
      createdAt: new Date().toISOString()
    };
    const updatedGoals = [...goals, newGoal];
    setGoals(updatedGoals);
    saveSavingsGoals(updatedGoals, userId);

    if (userId) {
      try {
        await supabase.from('savings_goals').insert({
          id: newGoal.id,
          user_id: userId,
          name: newGoal.name,
          target_amount: newGoal.targetAmount,
          current_amount: newGoal.currentAmount,
          deadline: newGoal.deadline || null
        });
      } catch (err) {
        console.error("Failed to upload savings goal:", err);
      }
    }
  }, [goals, userId]);

  const handleAddGoalContribution = React.useCallback(async (goalId, amountToAllocate) => {
    const updatedGoals = goals.map(g => {
      if (g.id === goalId) {
        return { ...g, currentAmount: g.currentAmount + (parseFloat(amountToAllocate) || 0) };
      }
      return g;
    });
    setGoals(updatedGoals);
    saveSavingsGoals(updatedGoals, userId);

    if (userId) {
      try {
        const targetGoal = updatedGoals.find(g => g.id === goalId);
        await supabase
          .from('savings_goals')
          .update({ current_amount: targetGoal.currentAmount })
          .eq('id', goalId);
      } catch (err) {
        console.error("Failed to update savings goal amount:", err);
      }
    }
  }, [goals, userId]);

  const handleDeleteSavingsGoal = React.useCallback(async (goalId) => {
    if (!window.confirm("Are you sure you want to delete this savings goal?")) return;
    const updatedGoals = goals.filter(g => g.id !== goalId);
    setGoals(updatedGoals);
    saveSavingsGoals(updatedGoals, userId);

    if (userId) {
      try {
        await supabase.from('savings_goals').delete().eq('id', goalId);
      } catch (err) {
        console.error("Failed to delete savings goal:", err);
      }
    }
  }, [goals, userId]);
  const handleAddIncome = React.useCallback(async (newIncome) => {
    const incomeWithId = {
      ...newIncome,
      id: 'inc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString()
    };
    const updatedIncome = [incomeWithId, ...incomeList];
    setIncomeList(updatedIncome);
    saveIncome(updatedIncome, user?.id);

    if (user?.id) {
      try {
        await supabase.from('income').insert({
          id: incomeWithId.id,
          user_id: user.id,
          source: incomeWithId.source,
          amount: incomeWithId.amount,
          date: incomeWithId.date,
          notes: incomeWithId.notes
        });
      } catch (err) {
        console.error("Failed to upload income:", err);
      }
    }
  }, [incomeList, user]);

  const handleDeleteIncome = React.useCallback(async (id) => {
    if (!window.confirm("Delete this income record?")) return;
    const updatedIncome = incomeList.filter(i => i.id !== id);
    setIncomeList(updatedIncome);
    saveIncome(updatedIncome, user?.id);

    if (user?.id) {
      try {
        await supabase.from('income').delete().eq('id', id);
      } catch (err) {
        console.error("Failed to delete income:", err);
      }
    }
  }, [incomeList, user]);

  const drawSvgGraph = () => {
    if (budget === 0) return null;
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const currentDay = new Date().getDate();
    
    const currentMonthStr = new Date().toISOString().slice(0,7);
    const monthlyExpenses = expenses.filter(e => e.date.startsWith(currentMonthStr));
    
    let cumulative = 0;
    const pacingData = Array.from({ length: daysInMonth }, (_, i) => {
      const dayStr = `${currentMonthStr}-${String(i + 1).padStart(2, '0')}`;
      const daySpent = monthlyExpenses
        .filter(e => e.date === dayStr)
        .reduce((sum, e) => sum + e.amount, 0);
      
      if (i < currentDay) {
        cumulative += daySpent;
        return cumulative;
      }
      return null;
    });

    const maxPacing = Math.max(budget, cumulative) || 1;
    const height = 60;
    const width = 100;

    const points = pacingData
      .map((val, i) => {
        if (val === null) return null;
        const x = (i / (daysInMonth - 1)) * width;
        const y = height - (val / maxPacing) * height;
        return `${x},${y}`;
      })
      .filter(Boolean)
      .join(' ');

    const idealPoints = `0,${height} ${width},0`;

    return (
      <div style={{ marginTop: '12px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Cumulative Pacing</span>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '60px', overflow: 'visible', marginTop: '4px' }}>
          <polyline points={idealPoints} fill="none" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="1" strokeDasharray="4,4" />
          <polyline points={points} fill="none" stroke="var(--accent-primary)" strokeWidth="2" />
          {points && (
            <polygon points={`0,${height} ${points} ${((currentDay-1) / (daysInMonth - 1)) * width},${height}`} fill="rgba(34, 211, 238, 0.1)" />
          )}
        </svg>
      </div>
    );
  };

  const handleSwipeOpen = React.useCallback((id) => {
    setSwipedItemId(id);
  }, []);

  const handleSwipeClose = React.useCallback(() => {
    setSwipedItemId(null);
  }, []);

  const handleListItemClick = React.useCallback((item) => {
    setEditingExpense(item);
    setActiveForm(true);
  }, []);

  const handleListItemDelete = React.useCallback(async (id) => {
    if (window.confirm("Are you sure you want to delete this expense?")) {
      await handleDeleteExpense(id);
      setSwipedItemId(null);
    }
  }, [handleDeleteExpense]);

  // Detect if list contains demo items
  const hasDemoData = React.useMemo(() => {
    return expenses.some(e => e.isDemo);
  }, [expenses]);

  // Filter & Sort expenses logic
  const filteredExpenses = React.useMemo(() => {
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
  }, [expenses, searchQuery, categoryFilter, dateFilter, startDate, endDate, sortBy]);

  // Get expenses specifically for selected chart period breakdown
  const chartExpenses = React.useMemo(() => {
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
  }, [expenses, chartPeriod]);

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
              <span 
                onClick={() => { if (pendingSyncs > 0) setShowQueueInspector(true); }}
                style={{ 
                  fontSize: '9px', 
                  color: pendingSyncs > 0 ? 'var(--danger)' : 'var(--text-muted)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px', 
                  fontWeight: pendingSyncs > 0 ? '600' : '400',
                  cursor: pendingSyncs > 0 ? 'pointer' : 'default'
                }}
                title={pendingSyncs > 0 ? "View pending offline sync queue" : "All local changes synced"}
              >
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
            {Object.keys(CURRENCIES).map((key) => (
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

      {/* PWA Custom Install Banner */}
      {showInstallBanner && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(8, 145, 178, 0.05))',
          border: '1px solid rgba(6, 182, 212, 0.3)',
          color: 'var(--text-primary)',
          padding: '12px 18px',
          margin: '16px 20px 0 20px',
          borderRadius: '8px',
          fontSize: '13px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>📲</span>
            <span style={{ fontWeight: '500' }}>Install Expense Tracker for offline sync & real-time alerts!</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleInstallPWA}
              style={{
                background: 'var(--accent-primary)',
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontWeight: '600',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              Install
            </button>
            <button
              onClick={() => setShowInstallBanner(false)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--glass-border)',
                padding: '6px 12px',
                borderRadius: '6px',
                fontWeight: '600',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <main className="content">
        <div className="desktop-grid">
          
          {/* LEFT SIDEBAR (Budget, Analytics & Subscription Lists) */}
          <div className={`left-column ${activeTab === 'dashboard' || activeTab === 'planning' || activeTab === 'analytics' ? 'show-mobile' : 'hide-mobile'}`} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* OVERVIEW SECTION */}
            <div className={activeTab === 'dashboard' ? 'flex-column-gap' : 'hide-mobile'} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Overall Budget Status */}
              <div className="glass-card budget-summary">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Overall Limit</span>
                <button 
                  onClick={() => setActiveBudgetModal(true)}
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--accent-primary)',
                    cursor: 'pointer',
                    fontSize: '10px',
                    fontWeight: '600',
                    padding: '3px 8px',
                    borderRadius: '12px'
                  }}
                >
                  Configure
                </button>
              </div>

              <div className="budget-row" style={{ marginTop: '-4px' }}>
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

               <div className="stats-grid" style={{ marginBottom: '4px', gridTemplateColumns: 'repeat(3, 1fr)', display: 'grid' }}>
                <div className="stat-item">
                  <span className="stat-label">Remaining</span>
                  <span className="stat-val" style={{ color: budget - totalSpent >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '13px' }}>
                    {currSymbol}{(budget - totalSpent).toFixed(0)}
                  </span>
                </div>
                <div className="stat-item" style={{ alignItems: 'center' }}>
                  <span className="stat-label">Health Score</span>
                  <span className="stat-val" style={{ 
                    color: healthScore >= 85 ? 'var(--success)' : (healthScore >= 50 ? 'var(--warning)' : 'var(--danger)'),
                    fontWeight: '700',
                    fontSize: '13px'
                  }}>
                    {healthScore}%
                  </span>
                </div>
                <div className="stat-item" style={{ alignItems: 'flex-end' }}>
                  <span className="stat-label">Trans.</span>
                  <span className="stat-val" style={{ fontSize: '13px' }}>{expenses.length}</span>
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
                  {currSymbol}{safeDailyLimit.toFixed(2)} / day
                </span>
              </div>

              {drawSvgGraph()}
            </div>

            {/* Smart Subscriptions / Recurring Bills Card */}
            {subscriptions.length > 0 && (
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                      🔁 Fixed Subscriptions
                    </h3>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Consumes {(budget > 0 ? (totalSubscriptionCost / budget) * 100 : 0).toFixed(1)}% of budget
                    </span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--accent-primary)' }}>
                    {currSymbol}{totalSubscriptionCost.toFixed(2)}/mo
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '120px', overflowY: 'auto' }}>
                  {subscriptions.map(sub => {
                    const cat = CATEGORIES[sub.category] || CATEGORIES.Others;
                    const countdown = getSubscriptionCountdown(sub.billingDay);
                    return (
                      <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{cat.icon} {sub.description}</span>
                          {countdown && (
                            <span style={{
                              fontSize: '9px',
                              color: countdown.includes('today') || countdown.includes('tomorrow') ? 'var(--danger)' : 'var(--text-muted)',
                              fontWeight: '600'
                            }}>
                              📅 Day {sub.billingDay} ({countdown})
                            </span>
                          )}
                        </div>
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
          </div>

            {/* PLANNING SECTION */}
            <div className={activeTab === 'planning' ? 'flex-column-gap' : 'hide-mobile'} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Budget Surplus Rollover Widget */}
              {budget > 0 && totalSpent < budget && (
                <div className="glass-card" style={{ background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.25)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--success)' }}>🎉 Budget Surplus Detected!</span>
                    <span style={{ fontSize: '12px', fontWeight: '600' }}>{currSymbol}{(budget - totalSpent).toFixed(0)} saved</span>
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                    You spent less than your monthly limit! Rollover this leftover surplus directly into your active Savings Goals.
                  </p>
                  {goals.length > 0 ? (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <select 
                        id="surplus-target-goal"
                        className="input-field" 
                        style={{ padding: '4px 8px', fontSize: '11px', flex: 1 }}
                      >
                        {goals.map(g => (
                          <option key={g.id} value={g.id}>{g.name} ({currSymbol}{g.currentAmount}/{currSymbol}{g.targetAmount})</option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          const selectEl = document.getElementById('surplus-target-goal');
                          if (selectEl && selectEl.value) {
                            handleAddGoalContribution(selectEl.value, budget - totalSpent);
                            alert("Successfully allocated surplus to your savings goal!");
                          }
                        }}
                        style={{
                          background: 'var(--success)',
                          border: 'none',
                          color: 'white',
                          padding: '4px 12px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        Allocate All
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Create a savings goal below to allocate this surplus.</span>
                  )}
                </div>
              )}

              {/* Monthly Income Tracker Card */}
              <IncomeCard
                incomeList={incomeList}
                currencySymbol={currSymbol}
                onAddIncome={handleAddIncome}
                onDeleteIncome={handleDeleteIncome}
              />

              {/* Savings Goals Target Tracker */}
              <SavingsGoalsCard
                goals={goals}
                currencySymbol={currSymbol}
                onAddGoal={handleAddSavingsGoal}
                onAddContribution={handleAddGoalContribution}
                onDeleteGoal={handleDeleteSavingsGoal}
              />
            </div>

            {/* ANALYTICS SECTION */}
            <div className={activeTab === 'analytics' ? 'flex-column-gap' : 'hide-mobile'} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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

              {/* AI Forecast & Projections */}
              <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>🔮 AI Spending Forecast</span>
                  <button
                    onClick={fetchAiForecast}
                    disabled={isAiForecastLoading}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-primary)',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: '600',
                      padding: 0
                    }}
                  >
                    {isAiForecastLoading ? 'Predicting...' : (aiForecast ? '🔄 Refresh' : 'Get Projection')}
                  </button>
                </div>
                
                {aiForecast && (
                  <div style={{ 
                    background: 'rgba(255,255,255,0.02)', 
                    border: '1px solid var(--glass-border)', 
                    borderRadius: '8px', 
                    padding: '10px',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.5',
                    maxHeight: '110px',
                    overflowY: 'auto'
                  }}>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{aiForecast}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Backup Action card */}
          <div className={activeTab === 'dashboard' ? 'flex-column-gap' : 'hide-mobile'} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
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

              <button
                onClick={sendTestNotification}
                style={{
                  width: '100%',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--accent-primary)',
                  padding: '10px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: '600'
                }}
              >
                🔔 Test Push Notification
              </button>
            </div>
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
                <div className="empty-state glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '30px 20px', alignItems: 'center' }}>
                  <div className="icon" style={{ fontSize: '32px' }}>💸</div>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {expenses.length === 0 ? "You haven't logged any expenses yet." : "No transactions match your filters."}
                  </p>
                  {expenses.length === 0 && (
                    <button
                      onClick={handleLoadDemoData}
                      style={{
                        background: 'var(--accent-glow)',
                        border: '1px solid var(--accent-primary)',
                        color: 'var(--accent-primary)',
                        padding: '6px 16px',
                        borderRadius: '20px',
                        fontWeight: '600',
                        fontSize: '12px',
                        cursor: 'pointer',
                        marginTop: '4px'
                      }}
                    >
                      🧪 Load Sample Demo Data
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {hasDemoData && (
                    <div style={{
                      background: 'rgba(251, 146, 60, 0.08)',
                      border: '1px solid rgba(251, 146, 60, 0.3)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      marginBottom: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '11px',
                      color: 'var(--text-secondary)'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🧪</span> <span>Currently showing sample demo data.</span>
                      </span>
                      <button
                        onClick={handleClearDemoData}
                        style={{
                          background: 'rgba(244, 63, 94, 0.1)',
                          border: '1px solid rgba(244, 63, 94, 0.25)',
                          color: 'var(--danger)',
                          fontWeight: '600',
                          cursor: 'pointer',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '10px'
                        }}
                      >
                        Clear Demo Data
                      </button>
                    </div>
                  )}
                  <div className="expense-list">
                  {filteredExpenses.map((exp) => {
                    const cat = CATEGORIES[exp.category] || CATEGORIES.Others;
                    const catLimit = categoryBudgets[exp.category];
                    const catSpent = getCategorySpending(exp.category);
                    const isOverCategoryBudget = catLimit && catLimit > 0 && catSpent > catLimit;

                    return (
                      <ExpenseListItem
                        key={exp.id}
                        expense={exp}
                        currencySymbol={currSymbol}
                        categoryInfo={cat}
                        isOverCategoryBudget={isOverCategoryBudget}
                        isSwiped={swipedItemId === exp.id}
                        onSwipeOpen={handleSwipeOpen}
                        onSwipeClose={handleSwipeClose}
                        onClick={handleListItemClick}
                        onDelete={handleListItemDelete}
                        searchQuery={searchQuery}
                      />
                    );
                  })}
                </div>
              </>
            )}
            </div>
          </div>

        </div>
      </main>

      {/* Bottom Navigation Bar (Mobile Only) */}
      <div className="mobile-nav-bar" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', width: '100%', padding: '4px 0' }}>
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
          <span>Expenses</span>
        </button>
        <button 
          onClick={() => setActiveTab('planning')} 
          className={`nav-item ${activeTab === 'planning' ? 'active' : ''}`}
        >
          <span className="icon">🎯</span>
          <span>Planning</span>
        </button>
        <button 
          onClick={() => setActiveTab('analytics')} 
          className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
        >
          <span className="icon">💡</span>
          <span>Analytics</span>
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
          isPushSupported={isPushSupported}
          isPushEnabled={isPushEnabled}
          onTogglePush={handleTogglePush}
          onResetCache={handleResetCache}
          onClose={() => setActiveBudgetModal(false)}
        />
      )}

      {/* Offline Queue Inspector Modal */}
      {showQueueInspector && (
        <OfflineQueueModal
          onClose={() => setShowQueueInspector(false)}
          onQueueChanged={() => setPendingSyncs(getPendingSyncCount())}
        />
      )}

      {/* Floating PWA Connectivity Toast */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(18, 18, 20, 0.95)',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          borderRadius: '24px',
          padding: '10px 20px',
          color: 'var(--text-primary)',
          fontSize: '11px',
          fontWeight: '600',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          pointerEvents: 'none',
          textAlign: 'center',
          whiteSpace: 'nowrap'
        }}>
          {toastMessage}
        </div>
      )}
    </div>
  );
}
