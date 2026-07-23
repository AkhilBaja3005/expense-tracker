import { useState, useEffect } from 'react';
import {
  getExpenses,
  getBudget,
  saveBudget,
  syncFromCloud,
  saveCloudSettings,
  getCategoryBudgets,
  saveCategoryBudgets,
  syncOfflineQueue,
  getPendingSyncCount,
  saveExpenses,
  getSavingsGoals,
  saveSavingsGoals,
  getIncome,
  saveIncome
} from '../utils/storage';

export const CURRENCIES = {
  USD: { symbol: '$', name: 'USD ($)' },
  INR: { symbol: '₹', name: 'INR (₹)' },
  GBP: { symbol: '£', name: 'GBP (£)' }
};

export function useExpenseData(user) {
  const userId = user?.id || null;

  const [expenses, setExpenses] = useState([]);
  const [budget, setBudget] = useState(1000);
  const [categoryBudgets, setCategoryBudgets] = useState({});
  const [currency, setCurrency] = useState('USD');
  const [goals, setGoals] = useState([]);
  const [incomeList, setIncomeList] = useState([]);

  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const [toastMessage, setToastMessage] = useState(null);

  // Sync data from cloud helper
  const triggerCloudSync = async (uid) => {
    if (!uid) return;
    setIsSyncing(true);
    await syncFromCloud(uid, () => {
      setExpenses(getExpenses(uid));
      setBudget(getBudget(uid));
      setCategoryBudgets(getCategoryBudgets(uid));
      setGoals(getSavingsGoals(uid));
      setIncomeList(getIncome(uid));
      const savedCurrency = localStorage.getItem(`expenser_currency_${uid}`);
      if (savedCurrency && CURRENCIES[savedCurrency]) {
        setCurrency(savedCurrency);
      }
    });
    setIsSyncing(false);
    setPendingSyncs(getPendingSyncCount());
  };

  // Load user-specific data from local cache initially
  useEffect(() => {
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
  }, [user, userId]);

  // Track network status & auto-flush sync queue
  useEffect(() => {
    let retryTimer = null;

    const goOnline = async () => {
      setIsOffline(false);
      setIsSyncing(true);
      await syncOfflineQueue();
      if (userId) {
        await syncFromCloud(userId, () => {
          setExpenses(getExpenses(userId));
        });
      }
      setIsSyncing(false);
      setPendingSyncs(getPendingSyncCount());
      setToastMessage('🟢 Back online! Syncing your local changes with Supabase...');
      setTimeout(() => setToastMessage(null), 4000);

      // If some tasks failed to sync, retry once after a short delay
      if (getPendingSyncCount() > 0) {
        retryTimer = setTimeout(async () => {
          if (!navigator.onLine) return;
          setIsSyncing(true);
          await syncOfflineQueue();
          setIsSyncing(false);
          setPendingSyncs(getPendingSyncCount());
        }, 5000);
      }
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
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [user, userId]);

  const handleCurrencyChange = async (e) => {
    const nextCur = e.target.value;
    setCurrency(nextCur);
    localStorage.setItem(`expenser_currency_${userId}`, nextCur);
    if (userId) {
      await saveCloudSettings(userId, budget, nextCur, categoryBudgets);
    }
  };

  const handleSaveBudget = async (newBudget, newCatBudgets) => {
    saveBudget(newBudget, userId);
    saveCategoryBudgets(newCatBudgets, userId);
    setBudget(newBudget);
    setCategoryBudgets(newCatBudgets);
    if (userId) {
      await saveCloudSettings(userId, newBudget, currency, newCatBudgets);
    }
  };

  const handleResetCache = async () => {
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
  };

  const handleLoadDemoData = async (supabase) => {
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
  };

  const handleClearDemoData = async (supabase) => {
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
  };

  const handleAddSavingsGoal = async (name, targetAmt, deadline, supabase) => {
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
        // id is omitted so Supabase's uuid default generates it (the local 'goal_...' id isn't valid uuid syntax)
        const { data, error } = await supabase.from('savings_goals').insert({
          user_id: userId,
          name: newGoal.name,
          target_amount: newGoal.targetAmount,
          current_amount: newGoal.currentAmount,
          deadline: newGoal.deadline || null
        }).select().single();
        if (error) throw error;

        if (data?.id) {
          setGoals(prev => {
            const reconciled = prev.map(g => g.id === newGoal.id ? { ...g, id: data.id } : g);
            saveSavingsGoals(reconciled, userId);
            return reconciled;
          });
        }
      } catch (err) {
        console.error("Failed to upload savings goal:", err);
      }
    }
  };

  const handleAddGoalContribution = async (goalId, amountToAllocate, supabase) => {
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
  };

  const handleDeleteSavingsGoal = async (goalId, supabase) => {
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
  };

  const handleAddIncome = async (newIncome, supabase) => {
    const incomeWithId = {
      ...newIncome,
      id: 'inc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString()
    };
    const updatedIncome = [incomeWithId, ...incomeList];
    setIncomeList(updatedIncome);
    saveIncome(updatedIncome, userId);

    if (userId) {
      try {
        // id is omitted so Supabase's uuid default generates it (the local 'inc_...' id isn't valid uuid syntax)
        const { data, error } = await supabase.from('income').insert({
          user_id: userId,
          source: incomeWithId.source,
          amount: incomeWithId.amount,
          date: incomeWithId.date,
          notes: incomeWithId.notes
        }).select().single();
        if (error) throw error;

        if (data?.id) {
          setIncomeList(prev => {
            const reconciled = prev.map(i => i.id === incomeWithId.id ? { ...i, id: data.id } : i);
            saveIncome(reconciled, userId);
            return reconciled;
          });
        }
      } catch (err) {
        console.error("Failed to upload income:", err);
      }
    }
  };

  const handleDeleteIncome = async (id, supabase) => {
    if (!window.confirm("Delete this income record?")) return;
    const updatedIncome = incomeList.filter(i => i.id !== id);
    setIncomeList(updatedIncome);
    saveIncome(updatedIncome, userId);

    if (userId) {
      try {
        await supabase.from('income').delete().eq('id', id);
      } catch (err) {
        console.error("Failed to delete income:", err);
      }
    }
  };

  return {
    userId,
    expenses, setExpenses,
    budget, setBudget,
    categoryBudgets, setCategoryBudgets,
    currency, setCurrency,
    goals, setGoals,
    incomeList, setIncomeList,
    isOffline, isSyncing, setIsSyncing,
    pendingSyncs, setPendingSyncs,
    toastMessage, setToastMessage,
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
  };
}
