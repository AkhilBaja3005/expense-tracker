import React, { useState } from 'react';
import {
  getExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
  getPendingSyncCount
} from './utils/storage';
import { CATEGORIES } from './utils/categorizer';
import ExpenseForm from './components/ExpenseForm';
import { supabase } from './utils/supabaseClient';
import { useAuth } from './hooks/useAuth';
import { useExpenseData, CURRENCIES } from './hooks/useExpenseData';
import { useAiFeatures } from './hooks/useAiFeatures';
import { usePwaInstall } from './hooks/usePwaInstall';
import BudgetModal from './components/BudgetModal';
import OfflineQueueModal from './components/OfflineQueueModal';
import CsvMapperModal from './components/CsvMapperModal';
import DashboardSidebar from './components/DashboardSidebar';
import ExpensesPanel from './components/ExpensesPanel';

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

export default function App() {
  const { user, handleSignOut } = useAuth();

  const {
    userId,
    expenses, setExpenses,
    budget,
    categoryBudgets,
    currency,
    goals,
    incomeList,
    isOffline, isSyncing,
    pendingSyncs, setPendingSyncs,
    toastMessage,
    triggerCloudSync,
    handleCurrencyChange,
    handleSaveBudget,
    handleResetCache,
    handleLoadDemoData,
    handleClearDemoData,
    handleAddSavingsGoal,
    handleAddGoalContribution,
    handleDeleteSavingsGoal,
    handleAddIncome,
    handleDeleteIncome
  } = useExpenseData(user);

  const [activeForm, setActiveForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [activeBudgetModal, setActiveBudgetModal] = useState(false);
  const [showQueueInspector, setShowQueueInspector] = useState(false);

  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [showCsvMapper, setShowCsvMapper] = useState(false);

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

  // Check if user has logged any expenses today
  const hasLoggedToday = expenses.some((exp) => {
    const expDateStr = new Date(exp.date).toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    return expDateStr === todayStr;
  });

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

  const {
    dailyReminder,
    aiInsights, isAiInsightsLoading, fetchAiInsights,
    aiForecast, isAiForecastLoading, fetchAiForecast
  } = useAiFeatures({ expenses, hasLoggedToday, isOffline, budget, totalSpent, totalSubscriptionCost, subscriptions, safeDailyLimit, currSymbol });

  const {
    showInstallBanner, setShowInstallBanner,
    handleInstallPWA,
    isPushSupported, isPushEnabled, handleTogglePush,
    notificationStatus,
    sendTestNotification,
    updateAvailable, applyUpdate
  } = usePwaInstall(user);

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

  const handleExportPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 14;
    let y = 18;

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Expense Tracker Report', marginX, y);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Generated ${new Date().toLocaleString()} for ${user.name}`, marginX, y + 6);
    doc.setTextColor(0);
    y += 16;

    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Budget Summary', marginX, y);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    y += 6;
    const summaryLines = [
      `Overall Budget: ${currSymbol}${budget.toFixed(2)}`,
      `Total Spent: ${currSymbol}${totalSpent.toFixed(2)}`,
      `Remaining: ${currSymbol}${(budget - totalSpent).toFixed(2)}`,
      `Health Score: ${healthScore}%`,
      `Total Transactions: ${expenses.length}`
    ];
    summaryLines.forEach(line => {
      doc.text(line, marginX, y);
      y += 5.5;
    });
    y += 4;

    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Category Breakdown', marginX, y);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    y += 6;
    Object.entries(categorySpendings).filter(([, amt]) => amt > 0).forEach(([key, amt]) => {
      const catName = CATEGORIES[key]?.name || key;
      doc.text(`${catName}: ${currSymbol}${amt.toFixed(2)}`, marginX, y);
      y += 5.5;
    });
    y += 6;

    const colX = { desc: marginX, cat: marginX + 70, date: marginX + 110, amt: pageWidth - marginX };
    const drawTableHeader = () => {
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('Transactions', marginX, y);
      y += 6;
      doc.setFontSize(9);
      doc.text('Description', colX.desc, y);
      doc.text('Category', colX.cat, y);
      doc.text('Date', colX.date, y);
      doc.text('Amount', colX.amt, y, { align: 'right' });
      y += 2;
      doc.setDrawColor(200);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 5;
      doc.setFont(undefined, 'normal');
    };

    drawTableHeader();
    const sortedExpenses = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
    sortedExpenses.forEach(exp => {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 18;
        drawTableHeader();
      }
      const catName = CATEGORIES[exp.category]?.name || exp.category;
      doc.text(doc.splitTextToSize(exp.description, 64)[0], colX.desc, y);
      doc.text(catName, colX.cat, y);
      doc.text(new Date(exp.date).toLocaleDateString(), colX.date, y);
      doc.text(`${currSymbol}${exp.amount.toFixed(2)}`, colX.amt, y, { align: 'right' });
      y += 6;
    });

    doc.save(`expenses_${user.name.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length <= 1) {
        alert('Invalid CSV file or empty list');
        return;
      }

      const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const parsedRows = [];
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const cleanRow = row.map(cell => cell.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        if (cleanRow.length > 0) {
          parsedRows.push(cleanRow);
        }
      }

      setCsvHeaders(rawHeaders);
      setCsvRows(parsedRows);
      setShowCsvMapper(true);
    };
    reader.readAsText(file);
  };

  const handleConfirmCsvImport = async (mapping) => {
    const importedExpenses = [];

    for (const row of csvRows) {
      if (row.length < Math.max(mapping.description, mapping.amount) + 1) continue;
      const desc = row[mapping.description] || 'Imported Expense';
      const amt = parseFloat(row[mapping.amount]) || 0;

      let cat = 'Others';
      if (mapping.category !== -1 && row[mapping.category]) {
        const rawCat = row[mapping.category];
        const matchedKey = Object.keys(CATEGORIES).find(
          k => k.toLowerCase() === rawCat.toLowerCase() || CATEGORIES[k].name.toLowerCase() === rawCat.toLowerCase()
        );
        if (matchedKey) cat = matchedKey;
      }

      const date = mapping.date !== -1 && row[mapping.date] ? row[mapping.date] : new Date().toISOString().split('T')[0];
      const notes = mapping.notes !== -1 ? row[mapping.notes] : '';

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
    setShowCsvMapper(false);
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
    try {
      if (editingExpense) {
        await updateExpense(editingExpense.id, data, userId);
      } else {
        await addExpense(data, userId);
      }
    } catch (err) {
      alert(err.message || 'Failed to save expense: invalid amount.');
      return;
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
  }, [editingExpense, userId, totalSpent, budget, currSymbol, notificationStatus, categoryBudgets, getCategorySpending, setExpenses, setPendingSyncs]);

  const handleDeleteExpense = React.useCallback(async (id) => {
    await deleteExpense(id, userId);
    setExpenses(getExpenses(userId));
    setPendingSyncs(getPendingSyncCount());
    setActiveForm(false);
    setEditingExpense(null);
  }, [userId, setExpenses, setPendingSyncs]);

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

  const onAddIncomeWrapped = (source, amount, date, notes) => handleAddIncome({ source, amount, date, notes }, supabase);
  const onDeleteIncomeWrapped = (id) => handleDeleteIncome(id, supabase);
  const onAddSavingsGoalWrapped = (name, targetAmt, deadline) => handleAddSavingsGoal(name, targetAmt, deadline, supabase);
  const onAddGoalContributionWrapped = (goalId, amt) => handleAddGoalContribution(goalId, amt, supabase);
  const onDeleteSavingsGoalWrapped = (goalId) => handleDeleteSavingsGoal(goalId, supabase);
  const onLoadDemoDataWrapped = () => handleLoadDemoData(supabase);
  const onClearDemoDataWrapped = () => handleClearDemoData(supabase);

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
            title="Changing currency does not convert existing amounts"
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

      {/* Desktop Section Tab Bar (mirrors mobile bottom nav) */}
      <div className="desktop-tab-bar">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
        >
          📊 Overview
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`tab-btn ${activeTab === 'expenses' ? 'active' : ''}`}
        >
          💸 Expenses
        </button>
        <button
          onClick={() => setActiveTab('planning')}
          className={`tab-btn ${activeTab === 'planning' ? 'active' : ''}`}
        >
          🎯 Planning
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
        >
          💡 Analytics
        </button>
      </div>

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

          <DashboardSidebar
            activeTab={activeTab}
            currSymbol={currSymbol}
            currency={currency}
            totalSpent={totalSpent}
            budget={budget}
            budgetProgress={budgetProgress}
            healthScore={healthScore}
            expenses={expenses}
            spentToday={spentToday}
            spentThisWeek={spentThisWeek}
            spentThisMonth={spentThisMonth}
            safeDailyLimit={safeDailyLimit}
            subscriptions={subscriptions}
            totalSubscriptionCost={totalSubscriptionCost}
            categoryBudgets={categoryBudgets}
            getCategorySpending={getCategorySpending}
            setActiveBudgetModal={setActiveBudgetModal}
            goals={goals}
            incomeList={incomeList}
            onAddIncome={onAddIncomeWrapped}
            onDeleteIncome={onDeleteIncomeWrapped}
            onAddSavingsGoal={onAddSavingsGoalWrapped}
            onAddGoalContribution={onAddGoalContributionWrapped}
            onDeleteSavingsGoal={onDeleteSavingsGoalWrapped}
            chartPeriod={chartPeriod}
            setChartPeriod={setChartPeriod}
            chartExpenses={chartExpenses}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            fetchAiInsights={fetchAiInsights}
            isAiInsightsLoading={isAiInsightsLoading}
            aiInsights={aiInsights}
            fetchAiForecast={fetchAiForecast}
            isAiForecastLoading={isAiForecastLoading}
            aiForecast={aiForecast}
            handleExportCSV={handleExportCSV}
            handleImportCSV={handleImportCSV}
            handleExportPDF={handleExportPDF}
            sendTestNotification={sendTestNotification}
          />

          <ExpensesPanel
            activeTab={activeTab}
            onAddExpenseClick={() => { setEditingExpense(null); setActiveForm(true); }}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            sortBy={sortBy}
            setSortBy={setSortBy}
            sortOptions={SORT_OPTIONS}
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            dateFilters={DATE_FILTERS}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            filteredExpenses={filteredExpenses}
            expenses={expenses}
            onLoadDemoData={onLoadDemoDataWrapped}
            hasDemoData={hasDemoData}
            onClearDemoData={onClearDemoDataWrapped}
            categoryBudgets={categoryBudgets}
            getCategorySpending={getCategorySpending}
            currSymbol={currSymbol}
            swipedItemId={swipedItemId}
            handleSwipeOpen={handleSwipeOpen}
            handleSwipeClose={handleSwipeClose}
            handleListItemClick={handleListItemClick}
            handleListItemDelete={handleListItemDelete}
          />

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

      {/* CSV Column Mapper Modal */}
      {showCsvMapper && (
        <CsvMapperModal
          headers={csvHeaders}
          rows={csvRows}
          onConfirm={handleConfirmCsvImport}
          onClose={() => setShowCsvMapper(false)}
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

      {/* Service Worker Update Available Toast */}
      {updateAvailable && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(18, 18, 20, 0.95)',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          borderRadius: '24px',
          padding: '10px 12px 10px 20px',
          color: 'var(--text-primary)',
          fontSize: '11px',
          fontWeight: '600',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          textAlign: 'center',
          whiteSpace: 'nowrap'
        }}>
          🚀 New version available
          <button
            onClick={applyUpdate}
            style={{
              background: 'var(--accent-primary)',
              border: 'none',
              color: '#030712',
              padding: '5px 12px',
              borderRadius: '16px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '700'
            }}
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}
