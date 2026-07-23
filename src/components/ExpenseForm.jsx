import React, { useState, useEffect, useRef } from 'react';
import { CATEGORIES, suggestCategory, suggestCategoryWithGemini, learnCategory } from '../utils/categorizer';

function ExpenseForm({ 
  expense, 
  onSave, 
  onDelete, 
  onClose, 
  currencySymbol = '$', 
  categoryBudgets = {}, 
  categorySpendings = {} 
}) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Others');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isSubscription, setIsSubscription] = useState(false);
  const [billingDay, setBillingDay] = useState(1);
  const [subscriptionInterval, setSubscriptionInterval] = useState('monthly');
  const [suggestedCat, setSuggestedCat] = useState('Others');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const debounceTimer = useRef(null);
  const abortControllerRef = useRef(null);

  // Get suggestions for notes from category history
  const noteSuggestions = React.useMemo(() => {
    if (!category) return [];
    try {
      const userCached = localStorage.getItem('expenser_user');
      const userId = userCached ? JSON.parse(userCached)?.id : null;
      const key = userId ? `expenser_expenses_${userId}` : 'expenser_expenses';
      const listData = localStorage.getItem(key);
      if (listData) {
        const list = JSON.parse(listData) || [];
        const matchingNotes = list
          .filter(e => e.category === category && e.notes && e.notes.trim().length > 0)
          .map(e => e.notes.trim());
        return [...new Set(matchingNotes)].slice(0, 4);
      }
    } catch (e) {
      return [];
    }
    return [];
  }, [category]);

  // Load editing values
  useEffect(() => {
    if (expense) {
      setDescription(expense.description || '');
      setAmount(expense.amount || '');
      setCategory(expense.category || 'Others');
      setDate(expense.date || new Date().toISOString().split('T')[0]);
      setNotes(expense.notes || '');
      setIsSubscription(!!expense.isSubscription);
      setBillingDay(expense.billingDay || 1);
      setSubscriptionInterval(expense.subscriptionInterval || 'monthly');
      setSuggestedCat(expense.category || 'Others');
    }
  }, [expense]);

  // Clean up timers and fetch calls on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // Handle auto-categorization
  const handleDescriptionChange = (e) => {
    const val = e.target.value;
    setDescription(val);
    if (expense) return; // Do not auto-categorize editing entries

    const localSuggested = suggestCategory(val);
    setSuggestedCat(localSuggested);
    setCategory(localSuggested);

    if (localSuggested === 'Others' && val.length > 3) {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      debounceTimer.current = setTimeout(async () => {
        setIsAiLoading(true);
        try {
          const aiSuggested = await suggestCategoryWithGemini(val, signal);
          if (aiSuggested !== 'Others') {
            setSuggestedCat(aiSuggested);
            setCategory(aiSuggested);
          }
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error('Gemini auto-categorization failed', err);
          }
        } finally {
          setIsAiLoading(false);
        }
      }, 600);
    }
  };

  const handleReceiptScan = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsOcrLoading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = reader.result.split(',')[1];
        const mimeType = file.type;

        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
          alert("Gemini API Key is missing. Please add VITE_GEMINI_API_KEY to your environment.");
          setIsOcrLoading(false);
          return;
        }

        // Call Gemini multimodal API (3.1-flash-lite supports images too and is faster!)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data
                  }
                },
                {
                  text: "You are an expert receipt parser. Scan this receipt image and extract the main store name (description), total spending amount, and categorise it into one of these keys: Food, Transport, Shopping, Bills, Entertainment, Health, Others. Return ONLY a single raw valid JSON object and nothing else. Output format:\n{\n  \"description\": \"Store Name\",\n  \"amount\": 12.50,\n  \"category\": \"Food\"\n}"
                }
              ]
            }]
          })
        });

        if (!response.ok) throw new Error("Gemini OCR request failed");

        const result = await response.json();
        const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!jsonText) throw new Error("Failed to extract content text from Gemini response");
        
        const cleanJson = jsonText.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        
        if (parsed.description) setDescription(parsed.description);
        if (parsed.amount) setAmount(parsed.amount.toString());
        if (parsed.category) setCategory(parsed.category);
        setIsOcrLoading(false);
      };
    } catch (err) {
      console.error("Receipt OCR parsing failed:", err);
      alert("Failed to analyze receipt: " + err.message);
      setIsOcrLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description.trim() || !amount) return;

    if (!expense && category !== suggestedCat) {
      learnCategory(description, category);
    }

    onSave({
      description,
      amount: parseFloat(amount),
      category,
      date,
      notes,
      isSubscription,
      billingDay: isSubscription ? parseInt(billingDay) || 1 : null,
      subscriptionInterval: isSubscription ? subscriptionInterval : 'monthly'
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

  // Proactive Over-Budget warning calculation
  const currentSpent = categorySpendings[category] || 0;
  const limit = categoryBudgets[category] || 0;
  const originalAmt = expense && expense.category === category ? parseFloat(expense.amount) || 0 : 0;
  const entryAmt = parseFloat(amount) || 0;
  const projectedTotal = currentSpent - originalAmt + entryAmt;
  const isProjectedOver = limit > 0 && projectedTotal > limit;
  const remainingBeforeEntry = limit - (currentSpent - originalAmt);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: '20px', fontWeight: '700' }}>
          {expense ? 'Edit Expense' : 'Add Expense'}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* AI Receipt Scanner Widget */}
          {!expense && (
            <div className="form-group" style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px dashed var(--glass-border)' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📷 AI Receipt Scanner</span>
                {isOcrLoading && <span style={{ color: 'var(--accent-primary)', fontSize: '10px' }}>Analyzing receipt...</span>}
              </label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleReceiptScan} 
                disabled={isOcrLoading}
                style={{ fontSize: '11px', marginTop: '4px', cursor: 'pointer', color: 'var(--text-muted)', width: '100%' }}
              />
            </div>
          )}

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
            
            {/* Inline Proactive Budget Alert */}
            {isProjectedOver && (
              <div style={{
                fontSize: '11px',
                color: 'var(--danger)',
                background: 'rgba(244, 63, 94, 0.05)',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(244, 63, 94, 0.15)',
                marginTop: '8px',
                lineHeight: '1.4'
              }}>
                ⚠️ Adding this will exceed your {CATEGORIES[category]?.name} limit of {currencySymbol}{limit.toFixed(0)} (Remaining budget: {currencySymbol}{remainingBeforeEntry.toFixed(2)}).
              </div>
            )}
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

          {/* Billing Day Selector */}
          {isSubscription && (
            <>
              <div className="form-group">
                <label>Billing Day of Month (1 - 31)</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  className="input-field"
                  value={billingDay}
                  onChange={(e) => {
                    const val = Math.max(1, Math.min(31, parseInt(e.target.value) || 1));
                    setBillingDay(val);
                  }}
                  required
                />
              </div>
              <div className="form-group">
                <label>Billing Cycle / Interval</label>
                <select
                  className="input-field"
                  value={subscriptionInterval}
                  onChange={(e) => setSubscriptionInterval(e.target.value)}
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </>
          )}

          <div className="form-group">
            <label>Notes (Optional)</label>
            <textarea
              className="input-field"
              placeholder="Add extra details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ minHeight: '60px', resize: 'vertical' }}
            />
            {noteSuggestions.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                {noteSuggestions.map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setNotes(sug)}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '12px',
                      padding: '3px 8px',
                      fontSize: '10px',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    💡 {sug}
                  </button>
                ))}
              </div>
            )}
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

export default React.memo(ExpenseForm);
