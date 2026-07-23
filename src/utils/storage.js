import { supabase } from './supabaseClient';

const EXPENSES_STORAGE_KEY = 'expenser_expenses';
const BUDGET_STORAGE_KEY = 'expenser_budget';
const CAT_BUDGETS_STORAGE_KEY = 'expenser_cat_budgets';
const SYNC_QUEUE_KEY = 'expenser_sync_queue';

function getUserKey(key, userId) {
  return userId ? `${key}_${userId}` : key;
}

// LOCAL STORAGE ACCESSORS
export function getExpenses(userId) {
  try {
    const data = localStorage.getItem(getUserKey(EXPENSES_STORAGE_KEY, userId));
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveExpenses(expenses, userId) {
  try {
    localStorage.setItem(getUserKey(EXPENSES_STORAGE_KEY, userId), JSON.stringify(expenses));
  } catch (e) {
    console.error('Failed to save expenses locally', e);
  }
}

const GOALS_STORAGE_KEY = 'expenser_savings_goals';

export function getSavingsGoals(userId) {
  try {
    const data = localStorage.getItem(getUserKey(GOALS_STORAGE_KEY, userId));
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveSavingsGoals(goals, userId) {
  try {
    localStorage.setItem(getUserKey(GOALS_STORAGE_KEY, userId), JSON.stringify(goals));
  } catch (e) {
    console.error('Failed to save savings goals locally', e);
  }
}

const INCOME_STORAGE_KEY = 'expenser_income';

export function getIncome(userId) {
  try {
    const data = localStorage.getItem(getUserKey(INCOME_STORAGE_KEY, userId));
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveIncome(income, userId) {
  try {
    localStorage.setItem(getUserKey(INCOME_STORAGE_KEY, userId), JSON.stringify(income));
  } catch (e) {
    console.error('Failed to save income locally', e);
  }
}

export function getBudget(userId) {
  try {
    const budget = localStorage.getItem(getUserKey(BUDGET_STORAGE_KEY, userId));
    return budget ? parseFloat(budget) : 1000;
  } catch {
    return 1000;
  }
}

export function saveBudget(budget, userId) {
  try {
    localStorage.setItem(getUserKey(BUDGET_STORAGE_KEY, userId), budget.toString());
  } catch (e) {
    console.error('Failed to save budget locally', e);
  }
}

export function getCategoryBudgets(userId) {
  try {
    const data = localStorage.getItem(getUserKey(CAT_BUDGETS_STORAGE_KEY, userId));
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function getPendingSyncCount() {
  try {
    const queue = localStorage.getItem(SYNC_QUEUE_KEY);
    return queue ? JSON.parse(queue).length : 0;
  } catch {
    return 0;
  }
}

export function saveCategoryBudgets(budgets, userId) {
  try {
    localStorage.setItem(getUserKey(CAT_BUDGETS_STORAGE_KEY, userId), JSON.stringify(budgets));
  } catch (e) {
    console.error('Failed to save category budgets locally', e);
  }
}

// OFFLINE QUEUE UTILS
export function getSyncQueue() {
  try {
    const queue = localStorage.getItem(SYNC_QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch {
    return [];
  }
}

function saveSyncQueue(queue) {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to save sync queue', e);
  }
}

export function deleteFromSyncQueue(timestamp) {
  try {
    const queue = getSyncQueue();
    const updated = queue.filter(t => t.timestamp !== timestamp);
    saveSyncQueue(updated);
  } catch (e) {
    console.error('Failed to delete from sync queue', e);
  }
}

function addToQueue(action, type, payload, userId) {
  const queue = getSyncQueue();
  queue.push({ action, type, payload, userId, timestamp: Date.now() });
  saveSyncQueue(queue);
}

// Compact and deduplicate sync queue to fold redundant operations
function deduplicateQueue(queue) {
  const expenseMap = new Map(); // id -> latest task
  let settingsTask = null; // latest settings task

  for (const task of queue) {
    if (task.type === 'expense') {
      const id = task.payload.id;
      if (task.action === 'delete') {
        // Discard any preceding upsert tasks for this expense ID, and set the delete task
        expenseMap.set(id, task);
      } else if (task.action === 'upsert') {
        // Overwrite any preceding upsert/delete task for this expense ID
        expenseMap.set(id, task);
      }
    } else if (task.type === 'settings') {
      settingsTask = task;
    }
  }

  const compacted = [];
  expenseMap.forEach(task => compacted.push(task));
  if (settingsTask) {
    compacted.push(settingsTask);
  }

  return compacted.sort((a, b) => a.timestamp - b.timestamp);
}

// SYNC PENDING OFFLINE ACTIONS TO SUPABASE IN BATCHES
export async function syncOfflineQueue() {
  const queue = getSyncQueue();
  if (queue.length === 0) return;

  const deduplicated = deduplicateQueue(queue);

  const expensesToUpsert = [];
  const expenseIdsToDelete = [];
  const settingsToUpsert = [];

  const upsertTasks = [];
  const deleteTasks = [];
  const settingsTasks = [];

  for (const task of deduplicated) {
    const { action, type, payload, userId } = task;
    if (type === 'expense') {
      if (action === 'upsert') {
        expensesToUpsert.push({
          id: payload.id,
          user_id: userId,
          description: payload.description,
          amount: payload.amount,
          category: payload.category,
          date: payload.date,
          notes: payload.notes,
          date_added: payload.dateAdded,
          date_modified: payload.dateModified,
          is_subscription: !!payload.isSubscription,
          billing_day: payload.billingDay
        });
        upsertTasks.push(task);
      } else if (action === 'delete') {
        expenseIdsToDelete.push(payload.id);
        deleteTasks.push(task);
      }
    } else if (type === 'settings') {
      settingsToUpsert.push({
        user_id: userId,
        budget: payload.budget,
        currency: payload.currency,
        category_budgets: payload.categoryBudgets,
        updated_at: new Date().toISOString()
      });
      settingsTasks.push(task);
    }
  }

  const failedTasks = [];

  // 1. Batch Upsert Expenses
  if (expensesToUpsert.length > 0) {
    try {
      const { error } = await supabase.from('expenses').upsert(expensesToUpsert);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to batch upsert expenses, retrying individually:', err);
      // Fall back to individual operations to isolate corrupted records
      for (let i = 0; i < expensesToUpsert.length; i++) {
        try {
          const { error } = await supabase.from('expenses').upsert(expensesToUpsert[i]);
          if (error) throw error;
        } catch (singleErr) {
          console.error(`Failed to upsert individual expense ${expensesToUpsert[i].id}:`, singleErr);
          failedTasks.push(upsertTasks[i]);
        }
      }
    }
  }

  // 2. Batch Delete Expenses
  if (expenseIdsToDelete.length > 0) {
    try {
      const { error } = await supabase.from('expenses').delete().in('id', expenseIdsToDelete);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to batch delete expenses, retrying individually:', err);
      for (let i = 0; i < expenseIdsToDelete.length; i++) {
        try {
          const { error } = await supabase.from('expenses').delete().eq('id', expenseIdsToDelete[i]);
          if (error) throw error;
        } catch (singleErr) {
          console.error(`Failed to delete individual expense ${expenseIdsToDelete[i]}:`, singleErr);
          failedTasks.push(deleteTasks[i]);
        }
      }
    }
  }

  // 3. Sync Settings
  for (let i = 0; i < settingsToUpsert.length; i++) {
    try {
      const { error } = await supabase.from('user_settings').upsert(settingsToUpsert[i]);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to sync settings, keeping in queue:', err);
      failedTasks.push(settingsTasks[i]);
    }
  }

  saveSyncQueue(failedTasks);
}

// CLOUD SYNC OPERATIONS (SUPABASE)
export async function syncFromCloud(userId, onSyncDone) {
  if (!userId) return;
  
  await syncOfflineQueue();

  try {
    // 1. Sync Expenses
    const { data: dbExpenses, error: expError } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .order('date_added', { ascending: false });

    if (expError) throw expError;

    if (dbExpenses) {
      const formattedExpenses = dbExpenses.map(item => ({
        id: item.id,
        description: item.description,
        amount: parseFloat(item.amount),
        category: item.category,
        date: item.date,
        notes: item.notes,
        dateAdded: item.date_added,
        dateModified: item.date_modified,
        isSubscription: !!item.is_subscription,
        billingDay: item.billing_day,
        isDemo: !!item.is_demo
      }));
      saveExpenses(formattedExpenses, userId);
    }

    // 2. Sync Settings
    const { data: dbSettings, error: setBgError } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (setBgError) throw setBgError;

    if (dbSettings) {
      saveBudget(parseFloat(dbSettings.budget), userId);
      saveCategoryBudgets(dbSettings.category_budgets || {}, userId);
      localStorage.setItem(`expenser_currency_${userId}`, dbSettings.currency);
    }

    // 3. Sync Savings Goals
    try {
      const { data: dbGoals, error: goalsError } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (!goalsError && dbGoals) {
        const formattedGoals = dbGoals.map(g => ({
          id: g.id,
          name: g.name,
          targetAmount: parseFloat(g.target_amount),
          currentAmount: parseFloat(g.current_amount),
          deadline: g.deadline,
          createdAt: g.created_at
        }));
        saveSavingsGoals(formattedGoals, userId);
      }
    } catch (goalsErr) {
      console.warn("Savings goals sync warning:", goalsErr);
    }

    // 4. Sync Income
    try {
      const { data: dbIncome, error: incError } = await supabase
        .from('income')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (!incError && dbIncome) {
        const formattedIncome = dbIncome.map(item => ({
          id: item.id,
          source: item.source,
          amount: parseFloat(item.amount),
          date: item.date,
          notes: item.notes,
          createdAt: item.created_at
        }));
        saveIncome(formattedIncome, userId);
      }
    } catch (incErr) {
      console.warn("Income sync warning:", incErr);
    }

    if (onSyncDone) onSyncDone();
  } catch (e) {
    console.error('Error syncing data from cloud:', e.message);
  }
}

export async function addExpense(expense, userId) {
  const now = new Date().toISOString();
  const newExpense = {
    ...expense,
    id: 'exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    amount: parseFloat(expense.amount) || 0,
    dateAdded: now,
    dateModified: now
  };

  const localExpenses = getExpenses(userId);
  localExpenses.unshift(newExpense);
  saveExpenses(localExpenses, userId);

  if (userId) {
    try {
      const { error } = await supabase.from('expenses').upsert({
        id: newExpense.id,
        user_id: userId,
        description: newExpense.description,
        amount: newExpense.amount,
        category: newExpense.category,
        date: newExpense.date,
        notes: newExpense.notes,
        date_added: newExpense.dateAdded,
        date_modified: newExpense.dateModified,
        is_subscription: !!newExpense.isSubscription,
        billing_day: newExpense.billingDay
      });
      if (error) throw error;
    } catch {
      addToQueue('upsert', 'expense', newExpense, userId);
    }
  }
  return newExpense;
}

export async function updateExpense(id, updatedData, userId) {
  const localExpenses = getExpenses(userId);
  const index = localExpenses.findIndex(e => e.id === id);
  if (index === -1) return null;

  const now = new Date().toISOString();
  const updatedExpense = {
    ...localExpenses[index],
    ...updatedData,
    amount: parseFloat(updatedData.amount) || 0,
    dateModified: now
  };

  localExpenses[index] = updatedExpense;
  saveExpenses(localExpenses, userId);

  if (userId) {
    try {
      const { error } = await supabase.from('expenses').upsert({
        id: updatedExpense.id,
        user_id: userId,
        description: updatedExpense.description,
        amount: updatedExpense.amount,
        category: updatedExpense.category,
        date: updatedExpense.date,
        notes: updatedExpense.notes,
        date_added: updatedExpense.dateAdded,
        date_modified: updatedExpense.dateModified,
        is_subscription: !!updatedExpense.isSubscription,
        billing_day: updatedExpense.billingDay
      });
      if (error) throw error;
    } catch {
      addToQueue('upsert', 'expense', updatedExpense, userId);
    }
  }
  return updatedExpense;
}

export async function deleteExpense(id, userId) {
  const localExpenses = getExpenses(userId);
  const filtered = localExpenses.filter(e => e.id !== id);
  saveExpenses(filtered, userId);

  if (userId) {
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
    } catch {
      addToQueue('delete', 'expense', { id }, userId);
    }
  }
  return filtered;
}

export async function saveCloudSettings(userId, budget, currency, categoryBudgets) {
  if (!userId) return;
  const payload = {
    budget: parseFloat(budget) || 1000,
    currency: currency || 'USD',
    categoryBudgets: categoryBudgets || {}
  };

  try {
    const { error } = await supabase.from('user_settings').upsert({
      user_id: userId,
      budget: payload.budget,
      currency: payload.currency,
      category_budgets: payload.categoryBudgets,
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
  } catch {
    addToQueue('upsert', 'settings', payload, userId);
  }
}
