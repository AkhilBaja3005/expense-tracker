import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: vi.fn(() => Promise.resolve({ error: null })),
      delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })), in: vi.fn(() => Promise.resolve({ error: null })) })),
      select: vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn(() => Promise.resolve({ data: [], error: null })), single: vi.fn(() => Promise.resolve({ data: null, error: null })) })) }))
    }))
  }
}));

import { deduplicateQueue, addToQueue, getSyncQueue, addExpense, updateExpense, deleteExpense, getExpenses } from './storage';

const SYNC_QUEUE_KEY = 'expenser_sync_queue';

describe('deduplicateQueue', () => {
  it('collapses an upsert followed by a delete for the same expense into just the delete', () => {
    const queue = [
      { action: 'upsert', type: 'expense', payload: { id: 'e1' }, timestamp: 1 },
      { action: 'delete', type: 'expense', payload: { id: 'e1' }, timestamp: 2 }
    ];
    const result = deduplicateQueue(queue);
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe('delete');
  });

  it('collapses repeated upserts for the same expense into only the latest', () => {
    const queue = [
      { action: 'upsert', type: 'expense', payload: { id: 'e1', description: 'first' }, timestamp: 1 },
      { action: 'upsert', type: 'expense', payload: { id: 'e1', description: 'second' }, timestamp: 2 }
    ];
    const result = deduplicateQueue(queue);
    expect(result).toHaveLength(1);
    expect(result[0].payload.description).toBe('second');
  });

  it('keeps tasks for distinct expense ids separate', () => {
    const queue = [
      { action: 'upsert', type: 'expense', payload: { id: 'e1' }, timestamp: 1 },
      { action: 'upsert', type: 'expense', payload: { id: 'e2' }, timestamp: 2 }
    ];
    const result = deduplicateQueue(queue);
    expect(result).toHaveLength(2);
  });

  it('keeps only the latest settings task', () => {
    const queue = [
      { action: 'upsert', type: 'settings', payload: { budget: 100 }, timestamp: 1 },
      { action: 'upsert', type: 'settings', payload: { budget: 200 }, timestamp: 2 }
    ];
    const result = deduplicateQueue(queue);
    expect(result).toHaveLength(1);
    expect(result[0].payload.budget).toBe(200);
  });

  it('sorts the compacted result by timestamp ascending', () => {
    const queue = [
      { action: 'upsert', type: 'expense', payload: { id: 'e2' }, timestamp: 5 },
      { action: 'upsert', type: 'expense', payload: { id: 'e1' }, timestamp: 1 }
    ];
    const result = deduplicateQueue(queue);
    expect(result.map(t => t.payload.id)).toEqual(['e1', 'e2']);
  });
});

describe('addToQueue cap', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('drops the oldest upsert entries once the queue exceeds the max size', () => {
    for (let i = 0; i < 501; i++) {
      addToQueue('upsert', 'expense', { id: `e${i}` }, 'user1');
    }
    const queue = getSyncQueue();
    expect(queue.length).toBeLessThanOrEqual(500);
    expect(queue.some(t => t.payload.id === 'e0')).toBe(false);
    expect(queue.some(t => t.payload.id === 'e500')).toBe(true);
  });

  it('does not drop delete entries when trimming for the cap', () => {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(
      Array.from({ length: 500 }, (_, i) => ({ action: 'upsert', type: 'expense', payload: { id: `e${i}` }, userId: 'user1', timestamp: i }))
    ));
    addToQueue('delete', 'expense', { id: 'delete-me' }, 'user1');
    const queue = getSyncQueue();
    expect(queue.some(t => t.action === 'delete' && t.payload.id === 'delete-me')).toBe(true);
    expect(queue.length).toBeLessThanOrEqual(500);
  });
});

describe('addExpense / updateExpense amount validation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adds an expense with a valid positive amount', async () => {
    const expense = await addExpense({ description: 'Coffee', amount: '4.50', category: 'Food', date: '2026-07-01' }, null);
    expect(expense.amount).toBe(4.5);
    expect(getExpenses(null)).toHaveLength(1);
  });

  it('rejects a zero or negative amount on add', async () => {
    await expect(addExpense({ description: 'Bad', amount: 0, category: 'Food', date: '2026-07-01' }, null)).rejects.toThrow();
    await expect(addExpense({ description: 'Bad', amount: -5, category: 'Food', date: '2026-07-01' }, null)).rejects.toThrow();
  });

  it('rejects a non-numeric amount on add', async () => {
    await expect(addExpense({ description: 'Bad', amount: 'not-a-number', category: 'Food', date: '2026-07-01' }, null)).rejects.toThrow();
  });

  it('rejects an invalid amount on update, leaving the stored expense unchanged', async () => {
    const expense = await addExpense({ description: 'Coffee', amount: '4.50', category: 'Food', date: '2026-07-01' }, null);
    await expect(updateExpense(expense.id, { ...expense, amount: -1 }, null)).rejects.toThrow();
    const stored = getExpenses(null);
    expect(stored[0].amount).toBe(4.5);
  });

  it('deletes an expense by id', async () => {
    const expense = await addExpense({ description: 'Coffee', amount: '4.50', category: 'Food', date: '2026-07-01' }, null);
    await deleteExpense(expense.id, null);
    expect(getExpenses(null)).toHaveLength(0);
  });
});
