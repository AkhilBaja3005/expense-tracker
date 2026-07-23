import React, { useState, useEffect, useRef } from 'react';
import { CATEGORIES, suggestCategory, suggestCategoryWithGemini, learnCategory } from '../utils/categorizer';

export default function ExpenseForm({ expense, onSave, onDelete, onClose, currencySymbol = '$' }) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Others');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isSubscription, setIsSubscription] = useState(false);
  const [suggestedCat, setSuggestedCat] = useState('Others');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const debounceTimer = useRef(null);

  // Load editing values
  useEffect(() => {
    if (expense) {
      setDescription(expense.description || '');
      setAmount(expense.amount || '');
      setCategory(expense.category || 'Others');
      setDate(expense.date || new Date().toISOString().split('T')[0]);
      setNotes(expense.notes || '');
      setIsSubscription(!!expense.isSubscription);
      setSuggestedCat(expense.category || 'Others');
    }
  }, [expense]);

  // Handle auto-categorization
  const handleDescriptionChange = (e) => {
    const val = e.target.value;
    setDescription(val);
    if (expense) return; // Do not auto-categorize editing entries

    // 1. Immediately apply fast keyword categorization
    const localSuggested = suggestCategory(val);
    setSuggestedCat(localSuggested);
    setCategory(localSuggested);

    // 2. Debounce and run Gemini fallback classification if local matched to Others
    if (localSuggested === 'Others' && val.length > 3) {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(async () => {
        setIsAiLoading(true);
        const aiSuggested = await suggestCategoryWithGemini(val);
        setIsAiLoading(false);
        if (aiSuggested !== 'Others') {
          setSuggestedCat(aiSuggested);
          setCategory(aiSuggested);
        }
      }, 600);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description.trim() || !amount) return;

    // Check if user changed the auto-suggested category, so we learn the mapping
    if (!expense && category !== suggestedCat) {
      learnCategory(description, category);
    }

    onSave({
      description,
      amount: parseFloat(amount),
      category,
      date,
      notes,
      isSubscription
    });
  };

  const formatAuditDate = (isoString) => {
    if (!isoString) return 'N/A';
    const d = new Date(isoString);
    return d.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: '20px', fontWeight: '700' }}>
          {expense ? 'Edit Expense' : 'Add Expense'}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <span>Description</span>
              {isAiLoading && <span style={{ fontSize: '11px', color: 'var(--accent-primary)', animation: 'fadeIn 1s infinite alternate' }}>Gemini categorizing...</span>}
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Netflix Subscription"
              value={description}
              onChange={handleDescriptionChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Amount ({currencySymbol})</label>
            <input
              type="number"
              step="0.01"
              className="input-field"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Category</label>
            <div className="category-select-grid">
              {Object.entries(CATEGORIES).map(([key, cat]) => (
                <button
                  type="button"
                  key={key}
                  className={`category-option-btn ${category === key ? 'selected' : ''}`}
                  onClick={() => setCategory(key)}
                >
                  <span className="icon">{cat.icon}</span>
                  <span className="label">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              className="input-field"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px', margin: '4px 0' }}>
            <input
              type="checkbox"
              id="isSubscription"
              checked={isSubscription}
              onChange={(e) => setIsSubscription(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
            />
            <label htmlFor="isSubscription" style={{ cursor: 'pointer', userSelect: 'none' }}>
              Is Recurring Subscription / Bill
            </label>
          </div>

          <div className="form-group">
            <label>Notes (Optional)</label>
            <textarea
              className="input-field"
              placeholder="Add extra details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ minHeight: '60px', resize: 'vertical' }}
            />
          </div>

          {expense && (
            <div className="audit-details">
              <div className="audit-row">
                <span>Date Added:</span>
                <span>{formatAuditDate(expense.dateAdded)}</span>
              </div>
              <div className="audit-row">
                <span>Date Modified:</span>
                <span>{formatAuditDate(expense.dateModified)}</span>
              </div>
            </div>
          )}

          <div className="btn-group">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save
            </button>
          </div>

          {expense && (
            <button
              type="button"
              className="btn btn-danger"
              style={{ marginTop: '-4px' }}
              onClick={() => {
                if (window.confirm('Are you sure you want to delete this expense?')) {
                  onDelete(expense.id);
                }
              }}
            >
              Delete Expense
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
