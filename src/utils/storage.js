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
  } catch (e) {
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

export function getBudget(userId) {
  try {
    const budget = localStorage.getItem(getUserKey(BUDGET_STORAGE_KEY, userId));
    return budget ? parseFloat(budget) : 1000;
  } catch (e) {
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
  } catch (e) {
    return {};
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
function getSyncQueue() {
  try {
    const queue = localStorage.getItem(SYNC_QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch (e) {
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

function addToQueue(action, type, payload, userId) {
  const queue = getSyncQueue();
  queue.push({ action, type, payload, userId, timestamp: Date.now() });
  saveSyncQueue(queue);
}

// SYNC PENDING OFFLINE ACTIONS TO SUPABASE
export async function syncOfflineQueue() {
  const queue = getSyncQueue();
  if (queue.length === 0) return;

  const remaining = [];
  for (const task of queue) {
    const { action, type, payload, userId } = task;
    try {
      if (type === 'expense') {
        if (action === 'upsert') {
          await supabase.from('expenses').upsert({
            id: payload.id,
            user_id: userId,
            description: payload.description,
            amount: payload.amount,
            category: payload.category,
            date: payload.date,
            notes: payload.notes,
            date_added: payload.dateAdded,
            date_modified: payload.dateModified
          });
        } else if (action === 'delete') {
          await supabase.from('expenses').delete().eq('id', payload.id);
        }
      } else if (type === 'settings') {
        await supabase.from('user_settings').upsert({
          user_id: userId,
          budget: payload.budget,
          currency: payload.currency,
          category_budgets: payload.categoryBudgets,
          updated_at: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Could not sync item, keeping in queue:', err);
      remaining.push(task); // Keep task if server still unreachable
    }
  }

  saveSyncQueue(remaining);
}

// CLOUD SYNC OPERATIONS (SUPABASE)
export async function syncFromCloud(userId, onSyncDone) {
  if (!userId) return;
  
  // Try to sync offline modifications first
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
        dateModified: item.date_modified
      }));
      saveExpenses(formattedExpenses, userId);
    }

    // 2. Sync Settings
    const { data: dbSettings, error: setBgError } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (dbSettings) {
      saveBudget(parseFloat(dbSettings.budget), userId);
      saveCategoryBudgets(dbSettings.category_budgets || {}, userId);
      localStorage.setItem(`expenser_currency_${userId}`, dbSettings.currency);
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

  // Save locally
  const localExpenses = getExpenses(userId);
  localExpenses.unshift(newExpense);
  saveExpenses(localExpenses, userId);

  // Sync / Queue
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
        date_modified: newExpense.dateModified
      });
      if (error) throw error;
    } catch (e) {
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
        date_modified: updatedExpense.dateModified
      });
      if (error) throw error;
    } catch (e) {
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
    } catch (e) {
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
  } catch (e) {
    addToQueue('upsert', 'settings', payload, userId);
  }
}
