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
  syncOfflineQueue
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
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('expenser_theme') || 'dark';
  });

  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [activeForm, setActiveForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [activeBudgetModal, setActiveBudgetModal] = useState(false);
  
  // Filtering and Sorting state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const [dateFilter, setDateFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [notificationStatus, setNotificationStatus] = useState(() => {
    return 'Notification' in window ? Notification.permission : 'unsupported';
  });

  // Apply Theme class
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
    localStorage.setItem('expenser_theme', theme);
  }, [theme]);

  // Track network status & auto-flush sync queue
  useEffect(() => {
    const goOnline = async () => {
      setIsOffline(false);
      // Auto-flush queue
      await syncOfflineQueue();
      if (user?.id) triggerCloudSync(user.id);
    };
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [user]);

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

  // Setup Google Login & PWA
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then((reg) => {
          console.log('SW registered:', reg);

          // Force auto-reload when a new service worker update is found and installed
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('New update available. Force reloading...');
                  window.location.reload();
                }
              });
            }
          });
        }).catch((err) => {
          console.error('SW registration failed:', err);
        });
      });
    }

    if (!user && typeof window.google !== 'undefined') {
      window.google.accounts.id.initialize({
        client_id: "381822591589-cnbic33i53ra1puqr4jkj2hrqreub02e.apps.googleusercontent.com",
        callback: handleCredentialResponse
      });

      window.google.accounts.id.renderButton(
        document.getElementById("google-signin-btn"),
        { theme: "outline", size: "large", width: "100%" }
      );
    }
  }, [user]);

  const triggerNotificationTest = () => {
    if (!('Notification' in window)) return;
    Notification.requestPermission().then((permission) => {
      setNotificationStatus(permission);
      if (permission === 'granted') {
        new Notification("Expenser PWA", {
          body: "Notifications active! We will remind you to log your daily expenses.",
          icon: "/icon.svg"
        });
      }
    });
  };

  const userId = user?.id || null;
  const currSymbol = CURRENCIES[currency].symbol;
  const totalSpent = expenses.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  const budgetProgress = Math.min((totalSpent / budget) * 100, 100);

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
      // 1. Search Query filter
      const matchesSearch = exp.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (exp.notes && exp.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      
      // 2. Category tab filter
      const matchesCategory = categoryFilter === 'All' || exp.category === categoryFilter;

      // 3. Date window filter
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

  // Login Screen
  if (!user) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', padding: '40px 20px', gap: '30px' }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/icon.svg" alt="logo" style={{ width: '80px', height: '80px', marginBottom: '16px' }} />
          <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px', background: 'linear-gradient(135deg, #22d3ee, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Expenser PWA
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
            A premium dashboard to manage your spending with smart AI auto-categorization.
          </p>
        </div>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Sign in to continue</h3>
          <div id="google-signin-btn" style={{ width: '100%' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {isOffline && <div className="offline-banner">Working Offline</div>}

      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img 
            src={user.picture} 
            alt="profile" 
            style={{ width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer' }} 
            onClick={() => {
              if (window.confirm("Do you want to sign out?")) {
                handleSignOut();
              }
            }}
            title="Sign out"
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 style={{ fontSize: '16px', lineHeight: '1.2' }}>Expenser</h1>
            {isSyncing ? (
              <span style={{ fontSize: '9px', color: 'var(--accent-primary)' }}>syncing cloud...</span>
            ) : (
              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>cloud synced</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Theme Switcher Toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
              padding: '6px 10px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '600'
            }}
          >
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>

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
                {cur.name}
              </option>
            ))}
          </select>

          <button 
            onClick={() => setActiveBudgetModal(true)} 
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
              padding: '6px 12px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '600'
            }}
          >
            Budgets
          </button>
        </div>
      </header>

      <main className="content">
        <div className="desktop-grid">
          
          {/* LEFT SIDEBAR */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Overall Budget Status */}
            <div className="glass-card budget-summary">
              <div className="budget-row">
                <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Overall Limit</span>
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

              <div className="stats-grid">
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
            </div>

            {/* Category Budgets Warnings list */}
            {Object.keys(categoryBudgets).length > 0 && (
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Category Budgets
                </h3>
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
              </div>
            )}

            {/* Distribution chart */}
            <div className="glass-card">
              <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px', color: 'var(--text-secondary)' }}>
                Distribution ({currency})
              </h3>
              <AnalyticsCharts expenses={expenses} currencySymbol={currSymbol} />
            </div>

            {/* Utility Alerts */}
            <div className="glass-card" style={{ display: 'flex', gap: '10px' }}>
              {notificationStatus !== 'granted' && (
                <button 
                  onClick={triggerNotificationTest}
                  style={{
                    flex: 1,
                    background: 'var(--accent-glow)',
                    border: '1px solid var(--accent-primary)',
                    color: 'var(--accent-primary)',
                    padding: '10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}
                >
                  🔔 Alerts
                </button>
              )}
            </div>
          </div>

          {/* RIGHT SIDEBAR */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                            <span className="expense-desc">{exp.description}</span>
                            <span className="expense-date">
                              {new Date(exp.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                            </span>
                          </div>
                        </div>
                        <div className="expense-right">
                          <span className="expense-amount" style={{ color: cat.color }}>
                            -{currSymbol}{exp.amount.toFixed(2)}
                          </span>
                          {exp.notes && (
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
